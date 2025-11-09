/**
 * Macro Accuracy Test Suite
 *
 * Run with: tsx src/tests/unit/MacroAccuracy.test.ts
 */

import { config } from 'dotenv';
import { IngredientSelector } from '../../services/IngredientSelector';
import { PortionCalculator } from '../../services/PortionCalculator';
import { VerificationService } from '../../services/VerificationService';
import { MealCorrectionEngine } from '../../services/MealCorrectionEngine';
import { MacroValues, FoodNutritionData } from '../../types/nutrition';
import { MealStructure } from '../../services/MealStructurePlanner';
import { IngredientWithNutrition } from '../../services/IngredientSelector';
import { MealWithPortions } from '../../services/PortionCalculator';

config();

type TestFunction = () => Promise<void>;

const tests: Array<{ name: string; fn: TestFunction }> = [];

function registerTest(name: string, fn: TestFunction) {
  tests.push({ name, fn });
}

const stubNutritionData = (
  name: string,
  macrosPer100g: MacroValues,
  fdcId: number
): FoodNutritionData => ({
  fdcId,
  name,
  macrosPer100g,
  source: 'usda',
  lastUpdated: new Date().toISOString(),
});

class StubUSDANutritionService {
  private foods: Record<string, FoodNutritionData>;

  constructor(foods: Record<string, FoodNutritionData>) {
    this.foods = foods;
  }

  async getFoodNutritionData(foodName: string): Promise<FoodNutritionData> {
    const normalized = foodName.toLowerCase();
    const entry = this.foods[normalized];
    if (!entry) {
      throw new Error(`Food "${foodName}" not found in stub USDA service`);
    }
    return entry;
  }
}

class StubChainOfThoughtService {
  private responses: Array<{ ingredients: Array<{ name: string; amount: number }>; reasoning?: string }>;
  private index = 0;
  private available = true;

  constructor(
    responses: Array<{ ingredients: Array<{ name: string; amount: number }>; reasoning?: string }>,
    available = true
  ) {
    this.responses = responses;
    this.available = available;
  }

  isAIAvailable(): boolean {
    return this.available;
  }

  async generateWithCoT<T>(
    _prompt: string,
    _schema: unknown
  ): Promise<{ result: T; reasoning: { steps: Array<{ step: number; thought: string }>; finalResult: any } }> {
    if (this.index >= this.responses.length) {
      throw new Error('StubChainOfThoughtService has no more responses');
    }

    const response = this.responses[this.index++];
    return {
      result: {
        ingredients: response.ingredients,
        reasoning: response.reasoning,
      } as T,
      reasoning: {
        steps: [
          {
            step: 1,
            thought: response.reasoning ?? 'Stub reasoning step',
          },
        ],
        finalResult: response.ingredients,
      },
    };
  }
}

/**
 * Test 1: Ingredient validation rejects zero-macro data
 */
registerTest('IngredientSelector rejects ingredients with zero macros', async () => {
  const selector = new IngredientSelector(
    new StubUSDANutritionService({}) as any,
    undefined
  );

  const zeroMacroIngredient: IngredientWithNutrition = {
    name: 'void powder',
    category: 'protein',
    amount: 100,
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    },
    usdaData: stubNutritionData(
      'void powder',
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      },
      1
    ),
    fdcId: 1,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validation = (selector as any).validateIngredientNutrition(zeroMacroIngredient);

  if (validation.isValid) {
    throw new Error('Expected ingredient validation to fail for zero macro ingredient');
  }
  if (!validation.errors.some((err: string) => err.includes('All macros are zero'))) {
    throw new Error('Expected validation error mentioning zero macros');
  }
});

/**
 * Test 2: PortionCalculator clamps unrealistic portions
 */
registerTest('PortionCalculator enforces realistic portion limits', async () => {
  const portionCalculator = new PortionCalculator(new StubChainOfThoughtService([], false) as any);

  const mealStructure: MealStructure['meals'][0] = {
    mealType: 'breakfast',
    targetCalories: 685,
    targetProtein: 31,
    targetCarbs: 48,
    targetFats: 40,
    description: 'High-protein breakfast',
  };

  const ingredients: IngredientWithNutrition[] = [
    {
      name: 'eggs',
      category: 'protein',
      amount: 100,
      nutrition: {
        calories: 143,
        protein: 13,
        carbs: 1.1,
        fats: 10,
      },
      usdaData: stubNutritionData(
        'eggs',
        {
          calories: 143,
          protein: 13,
          carbs: 1.1,
          fats: 10,
        },
        101
      ),
      fdcId: 101,
    },
    {
      name: 'brown rice',
      category: 'carb',
      amount: 100,
      nutrition: {
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fats: 0.9,
      },
      usdaData: stubNutritionData(
        'brown rice',
        {
          calories: 111,
          protein: 2.6,
          carbs: 23,
          fats: 0.9,
        },
        102
      ),
      fdcId: 102,
    },
    {
      name: 'olive oil',
      category: 'fat',
      amount: 20,
      nutrition: {
        calories: 884,
        protein: 0,
        carbs: 0,
        fats: 100,
      },
      usdaData: stubNutritionData(
        'olive oil',
        {
          calories: 884,
          protein: 0,
          carbs: 0,
          fats: 100,
        },
        103
      ),
      fdcId: 103,
    },
    {
      name: 'spinach',
      category: 'vegetable',
      amount: 100,
      nutrition: {
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fats: 0.4,
      },
      usdaData: stubNutritionData(
        'spinach',
        {
          calories: 23,
          protein: 2.9,
          carbs: 3.6,
          fats: 0.4,
        },
        104
      ),
      fdcId: 104,
    },
  ];

  const meal = portionCalculator.calculatePortionsDeterministic(mealStructure, ingredients);

  const eggsPortion = meal.ingredients.find(ing => ing.name === 'eggs');
  if (!eggsPortion) {
    throw new Error('Expected eggs to be present in meal');
  }

  if (eggsPortion.amount > 200) {
    throw new Error(`Egg portion exceeded limit: ${eggsPortion.amount}g`);
  }
});

/**
 * Test 3: VerificationService enforces dual tolerance checks
 */
registerTest('VerificationService requires both absolute and percentage tolerances', async () => {
  const verificationService = new VerificationService();

  const target: MacroValues = {
    calories: 2500,
    protein: 175,
    carbs: 320,
    fats: 75,
  };

  const withinTolerance: MacroValues = {
    calories: 2510,
    protein: 172,
    carbs: 315,
    fats: 72,
  };

  const result = verificationService.verifyMacros(withinTolerance, target);
  if (!result.passed) {
    throw new Error(`Expected macros to pass verification: ${JSON.stringify(result.summary.errors)}`);
  }

  const outsideTolerance: MacroValues = {
    calories: 2700, // exceeds absolute tolerance of 100 kcal
    protein: 180,
    carbs: 350,
    fats: 90,
  };

  const failingResult = verificationService.verifyMacros(outsideTolerance, target);
  if (failingResult.passed) {
    throw new Error('Expected macros to fail verification due to exceeding tolerances');
  }

  if (!failingResult.summary.errors.some(error => error.includes('Calories'))) {
    throw new Error('Expected calorie error in summary when exceeding absolute tolerance');
  }
});

/**
 * Test 4: MealCorrectionEngine aborts when corrections worsen macros
 */
registerTest('MealCorrectionEngine stops when corrections make macros worse', async () => {
  const verificationService = new VerificationService();

  const stubCoTService = new StubChainOfThoughtService([
    {
      // First correction attempt makes things worse deliberately
      ingredients: [
        { name: 'chicken breast', amount: 50 },
        { name: 'brown rice', amount: 50 },
      ],
      reasoning: 'Reduce portions (intentional stub to worsen accuracy)',
    },
  ]);

  const correctionEngine = new MealCorrectionEngine(stubCoTService as any, verificationService);

  const availableIngredients: IngredientWithNutrition[] = [
    {
      name: 'chicken breast',
      category: 'protein',
      amount: 100,
      nutrition: {
        calories: 165,
        protein: 31,
        carbs: 0,
        fats: 3.6,
      },
      usdaData: stubNutritionData(
        'chicken breast',
        {
          calories: 165,
          protein: 31,
          carbs: 0,
          fats: 3.6,
        },
        201
      ),
      fdcId: 201,
    },
    {
      name: 'brown rice',
      category: 'carb',
      amount: 100,
      nutrition: {
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fats: 0.9,
      },
      usdaData: stubNutritionData(
        'brown rice',
        {
          calories: 111,
          protein: 2.6,
          carbs: 23,
          fats: 0.9,
        },
        202
      ),
      fdcId: 202,
    },
    {
      name: 'olive oil',
      category: 'fat',
      amount: 10,
      nutrition: {
        calories: 884,
        protein: 0,
        carbs: 0,
        fats: 100,
      },
      usdaData: stubNutritionData(
        'olive oil',
        {
          calories: 884,
          protein: 0,
          carbs: 0,
          fats: 100,
        },
        203
      ),
      fdcId: 203,
    },
  ];

  const initialMeal: MealWithPortions = {
    mealType: 'lunch',
    ingredients: [
      {
        name: 'chicken breast',
        amount: 120,
        nutrition: {
          calories: 198,
          protein: 37.2,
          carbs: 0,
          fats: 4.3,
        },
        fdcId: 201,
      },
      {
        name: 'brown rice',
        amount: 180,
        nutrition: {
          calories: 200,
          protein: 4.7,
          carbs: 41.4,
          fats: 1.6,
        },
        fdcId: 202,
      },
      {
        name: 'olive oil',
        amount: 10,
        nutrition: {
          calories: 88,
          protein: 0,
          carbs: 0,
          fats: 10,
        },
        fdcId: 203,
      },
    ],
    totalMacros: {
      calories: 486,
      protein: 41.9,
      carbs: 41.4,
      fats: 15.9,
    },
  };

  const targetMacros: MacroValues = {
    calories: 650,
    protein: 50,
    carbs: 70,
    fats: 22,
  };

  const result = await correctionEngine.verifyAndCorrect(
    initialMeal,
    targetMacros,
    availableIngredients
  );

  if (result.success) {
    throw new Error('Expected correction engine to report failure when error worsens');
  }

  if (result.iterations < 2) {
    throw new Error(`Expected at least 2 iterations before abort, got ${result.iterations}`);
  }
});

async function run() {
  console.log('🧪 Macro Accuracy Test Suite');
  console.log('============================\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name}`);
      console.error(
        error instanceof Error ? `   ${error.message}` : `   ${String(error)}`
      );
      failed++;
    }
  }

  console.log('\n============================');
  console.log(`Tests run: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});


