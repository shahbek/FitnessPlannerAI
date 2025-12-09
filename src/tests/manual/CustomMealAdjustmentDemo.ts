import 'dotenv/config';
import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { MacroValues } from '../../types/nutrition';
import { WeeklyOutline } from '../../models/PlanModels';
import { TrainingSplit } from '../../services/TrainingSplitService';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type IngredientDef = {
  name: string;
  amount: number;
};

type CustomFoodEntry = {
  name: string;
  per100g: MacroValues;
};

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const dailyTarget: MacroValues = {
  calories: 2400,
  protein: 200,
  carbs: 220,
  fats: 80,
};

const mealTargets: Record<MealType, MacroValues> = {
  breakfast: { calories: 600, protein: 45, carbs: 55, fats: 18 },
  lunch: { calories: 650, protein: 55, carbs: 60, fats: 20 },
  dinner: { calories: 650, protein: 55, carbs: 60, fats: 20 },
  snack: { calories: 500, protein: 45, carbs: 45, fats: 22 },
};

const customFoods: CustomFoodEntry[] = [
  { name: 'Egg Whites', per100g: { calories: 52, protein: 11, carbs: 0.7, fats: 0.2 } },
  { name: 'Steel Cut Oats', per100g: { calories: 380, protein: 13.2, carbs: 67, fats: 7 } },
  { name: 'Chia Seeds', per100g: { calories: 486, protein: 16.5, carbs: 42.1, fats: 30.7 } },
  { name: 'Blueberries', per100g: { calories: 57, protein: 0.7, carbs: 14.5, fats: 0.3 } },
  { name: 'Turkey Breast', per100g: { calories: 135, protein: 29, carbs: 0, fats: 1 } },
  { name: 'Quinoa', per100g: { calories: 120, protein: 4.4, carbs: 21.3, fats: 1.9 } },
  { name: 'Black Beans', per100g: { calories: 339, protein: 21.2, carbs: 62.4, fats: 0.8 } },
  { name: 'Avocado', per100g: { calories: 160, protein: 2, carbs: 9, fats: 15 } },
  { name: 'Salmon Fillet', per100g: { calories: 208, protein: 20, carbs: 0, fats: 13 } },
  { name: 'Sweet Potato', per100g: { calories: 86, protein: 1.6, carbs: 20.1, fats: 0.1 } },
  { name: 'Asparagus', per100g: { calories: 20, protein: 2.2, carbs: 3.9, fats: 0.1 } },
  { name: 'Olive Oil', per100g: { calories: 884, protein: 0, carbs: 0, fats: 100 } },
  { name: 'Cottage Cheese', per100g: { calories: 98, protein: 11.1, carbs: 3.4, fats: 4.3 } },
  { name: 'Almond Butter', per100g: { calories: 614, protein: 21.2, carbs: 19.2, fats: 55.5 } },
];

const customUsdaData: Record<
  string,
  {
    nutrition: MacroValues;
    fdcId: number;
  }
> = customFoods.reduce((acc, item, index) => {
  acc[normalizeFoodName(item.name)] = {
    nutrition: item.per100g,
    fdcId: 10_000 + index,
  };
  return acc;
}, {} as Record<string, { nutrition: MacroValues; fdcId: number }>);

const mealBlueprints: Record<MealType, IngredientDef[]> = {
  breakfast: [
    { name: 'Egg Whites', amount: 200 },
    { name: 'Steel Cut Oats', amount: 70 },
    { name: 'Chia Seeds', amount: 15 },
    { name: 'Blueberries', amount: 80 },
  ],
  lunch: [
    { name: 'Turkey Breast', amount: 180 },
    { name: 'Quinoa', amount: 170 },
    { name: 'Black Beans', amount: 90 },
    { name: 'Avocado', amount: 70 },
  ],
  dinner: [
    { name: 'Salmon Fillet', amount: 170 },
    { name: 'Sweet Potato', amount: 200 },
    { name: 'Asparagus', amount: 120 },
    { name: 'Olive Oil', amount: 12 },
  ],
  snack: [
    { name: 'Cottage Cheese', amount: 200 },
    { name: 'Almond Butter', amount: 28 },
    { name: 'Blueberries', amount: 90 },
    { name: 'Chia Seeds', amount: 10 },
  ],
};

const instructions: Record<MealType, string[]> = {
  breakfast: [
    'Whisk egg whites and cook until set.',
    'Simmer oats until creamy.',
    'Layer everything in a bowl with chia seeds and blueberries.',
  ],
  lunch: [
    'Grill the turkey breast until fully cooked.',
    'Cook quinoa and black beans, then mix together.',
    'Slice avocado and plate everything together.',
  ],
  dinner: [
    'Season salmon and roast until flaky.',
    'Roast sweet potatoes with olive oil.',
    'Blanch asparagus and plate with salmon.',
  ],
  snack: [
    'Spoon cottage cheese into a bowl.',
    'Top with almond butter, blueberries, and chia seeds.',
    'Serve chilled.',
  ],
};

// Aggressively skew daily intake up/down so initial meals are far from targets.
// This creates a clear before/after delta when testing the adjustment pipeline.
const varietyPattern = [0.35, 1.85, 0.4, 1.75, 0.45, 1.65, 0.5];

function buildMeal(dayNumber: number, mealType: MealType, scale: number): MealWithUSDA {
  const blueprint = mealBlueprints[mealType];

  const ingredients = blueprint.map((ingredient) => {
    const scaledAmount = ingredient.amount * scale;
    const normalized = normalizeFoodName(ingredient.name);
    const entry = customUsdaData[normalized];

    if (!entry) {
      throw new Error(`Missing nutrition data for "${ingredient.name}"`);
    }

    return {
      name: ingredient.name,
      amount: Number(scaledAmount.toFixed(2)),
      nutrition: calculateMacrosForAmount(entry.nutrition, scaledAmount, 'g'),
      fdcId: entry.fdcId,
    };
  });

  const totalMacros = ingredients.reduce<MacroValues>(
    (sum, ing) => ({
      calories: sum.calories + ing.nutrition.calories,
      protein: sum.protein + ing.nutrition.protein,
      carbs: sum.carbs + ing.nutrition.carbs,
      fats: sum.fats + ing.nutrition.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    mealName: `${mealType[0].toUpperCase()}${mealType.slice(1)} Fusion ${dayNumber}`,
    mealType,
    instructions: instructions[mealType],
    ingredients,
    totalMacros,
    dayNumber,
    dayName: dayNames[dayNumber - 1],
  };
}

function createReferenceDay(): MacroValues {
  const referenceMeals = (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type, index) =>
    buildMeal(index + 1, type, 1)
  );

  return referenceMeals.reduce<MacroValues>(
    (sum, meal) => ({
      calories: sum.calories + meal.totalMacros.calories,
      protein: sum.protein + meal.totalMacros.protein,
      carbs: sum.carbs + meal.totalMacros.carbs,
      fats: sum.fats + meal.totalMacros.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

const baseReferenceTotals = createReferenceDay();
const normalizationScale = dailyTarget.calories / baseReferenceTotals.calories;

function createMeals(pattern: number[]): MealWithUSDA[] {
  const meals: MealWithUSDA[] = [];

  pattern.forEach((scale, index) => {
    const effectiveScale = scale * normalizationScale;
    (['breakfast', 'lunch', 'dinner', 'snack'] as const).forEach((type) => {
      meals.push(buildMeal(index + 1, type, effectiveScale));
    });
  });

  return meals;
}

function summarizeDay(meals: MealWithUSDA[]) {
  return meals.reduce<MacroValues>(
    (sum, meal) => ({
      calories: sum.calories + meal.totalMacros.calories,
      protein: sum.protein + meal.totalMacros.protein,
      carbs: sum.carbs + meal.totalMacros.carbs,
      fats: sum.fats + meal.totalMacros.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

function formatMacro(values: MacroValues): Record<string, string> {
  return {
    calories: values.calories.toFixed(1),
    protein: values.protein.toFixed(1),
    carbs: values.carbs.toFixed(1),
    fats: values.fats.toFixed(1),
  };
}

async function run(): Promise<void> {
  const initialMeals = createMeals(varietyPattern);

  console.log('🍽️  Initial day-level macros (before adjustment)');
  for (let i = 0; i < 7; i++) {
    const dayMeals = initialMeals.filter((meal) => meal.dayNumber === i + 1);
    const totals = summarizeDay(dayMeals);
    console.log(
      `  Day ${i + 1} (${dayNames[i]}):`,
      formatMacro(totals),
      `| Off vs target: ${(totals.calories / dailyTarget.calories * 100).toFixed(1)}% cal`
    );
  }

  const fakeUsdaService: any = {};
  const fakeCotService: any = { isAIAvailable: () => false };
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  (generator as any).currentMealFrequency = 4;

  const generatorAny = generator as any;
  const originalDayMacroCalc = generatorAny.calculateDayMacros;
  const originalMealMacroTargets = generatorAny.calculateMealMacroTargets;

  generatorAny.calculateDayMacros = () => dailyTarget;
  generatorAny.calculateMealMacroTargets = (mealType: MealType) => mealTargets[mealType];

  const weeklyOutline: WeeklyOutline = {
    weekNumber: 1,
    phase: 'custom-demo',
    dailyTargets: {
      calories: dailyTarget.calories,
      protein: dailyTarget.protein,
      carbs: dailyTarget.carbs,
      fat: dailyTarget.fats,
      proteinPerKg: 2,
    },
    trainingSchedule: {
      resistanceDays: dayNames,
      cardioDays: [],
      restDays: [],
      weeklyVolume: 'Demo volume',
      focusAreas: ['Demo focus'],
    },
    cardioSchedule: {
      sessions: 0,
      duration: 0,
      intensity: 'Low',
      type: 'None',
    },
    objectives: ['Demonstrate optimizer on varied meals'],
    expectedOutcomes: ['Macro alignment within ±5%'],
    adjustments: 'None',
    specialNotes: 'Manual demo for linear-free optimizer',
  };

  const trainingSplit: TrainingSplit = {
    splitName: 'Demo Split',
    daysPerWeek: 7,
    days: dayNames.map((dayName, index) => ({
      dayNumber: index + 1,
      dayName,
      focus: ['Full body'],
      isRestDay: false,
      isCardioDay: false,
    })),
    reasoning: 'Demo split',
  };

  try {
    const adjustedMeals: MealWithUSDA[] = await generatorAny.adjustMealsToTargets(
      initialMeals,
      weeklyOutline,
      trainingSplit,
      customUsdaData
    );

    console.log('\n✅ Adjustment complete. Day-level macros after optimization:');
    for (let i = 0; i < 7; i++) {
      const dayMeals = adjustedMeals.filter((meal) => meal.dayNumber === i + 1);
      const totals = summarizeDay(dayMeals);
      console.log(
        `  Day ${i + 1} (${dayNames[i]}):`,
        formatMacro(totals),
        `| Accuracy: ${(totals.calories / dailyTarget.calories * 100).toFixed(1)}% cal`
      );
    }
  } finally {
    generatorAny.calculateDayMacros = originalDayMacroCalc;
    generatorAny.calculateMealMacroTargets = originalMealMacroTargets;
  }
}

run().catch((error) => {
  console.error('❌ Custom meal adjustment demo failed');
  console.error(error);
  process.exit(1);
});




