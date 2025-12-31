import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';

function atwaterPer100g(macros: Omit<MacroValues, 'calories'>): MacroValues {
  const protein = Math.max(0, Number(macros.protein || 0));
  const carbs = Math.max(0, Number(macros.carbs || 0));
  const fats = Math.max(0, Number(macros.fats || 0));
  return {
    calories: Math.round((protein * 4 + carbs * 4 + fats * 9) * 10) / 10,
    protein,
    carbs,
    fats,
  };
}

function sumMeals(meals: MealWithUSDA[]): MacroValues {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.totalMacros.calories,
      protein: sum.protein + meal.totalMacros.protein,
      carbs: sum.carbs + meal.totalMacros.carbs,
      fats: sum.fats + meal.totalMacros.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
  );
}

function assertWithin(value: number, target: number, epsilon: number, label: string) {
  const delta = Math.abs(value - target);
  if (delta > epsilon) {
    throw new Error(`${label} off by ${delta.toFixed(2)} (actual ${value.toFixed(2)} vs target ${target.toFixed(2)})`);
  }
}

async function run() {
  console.log('🧪 Micro-correction test (carb trim + fat add)');

  const usdaData: Record<string, { nutrition: MacroValues; fdcId: number }> = {
    [normalizeFoodName('Brown Rice')]: { nutrition: atwaterPer100g({ protein: 2.6, carbs: 23, fats: 0.9 }), fdcId: 1 },
    [normalizeFoodName('Olive Oil')]: { nutrition: atwaterPer100g({ protein: 0, carbs: 0, fats: 100 }), fdcId: 2 },
    [normalizeFoodName('Chicken Breast')]: {
      nutrition: atwaterPer100g({ protein: 31, carbs: 0, fats: 3.6 }),
      fdcId: 3,
    },
  };

  const makeIng = (name: string, amount: number) => {
    const entry = usdaData[normalizeFoodName(name)];
    if (!entry) throw new Error(`Missing USDA fixture for ${name}`);
    return {
      name,
      amount,
      nutrition: calculateMacrosForAmount(entry.nutrition, amount, 'g'),
      fdcId: entry.fdcId,
    };
  };

  const makeMeal = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', ingredients: Array<[string, number]>): MealWithUSDA => {
    const ing = ingredients.map(([name, amount]) => makeIng(name, amount));
    const totalMacros = ing.reduce(
      (sum, i) => ({
        calories: sum.calories + i.nutrition.calories,
        protein: sum.protein + i.nutrition.protein,
        carbs: sum.carbs + i.nutrition.carbs,
        fats: sum.fats + i.nutrition.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
    );

    return {
      mealName: `Meal ${mealType}`,
      mealType,
      instructions: [],
      ingredients: ing,
      totalMacros,
      dayNumber: 7,
      dayName: 'Sunday',
    };
  };

  const dayMeals: MealWithUSDA[] = [
    makeMeal('breakfast', [
      ['Chicken Breast', 180],
      ['Olive Oil', 6],
    ]),
    makeMeal('lunch', [
      ['Chicken Breast', 200],
      ['Brown Rice', 260],
      ['Olive Oil', 6],
    ]),
    makeMeal('dinner', [
      ['Chicken Breast', 200],
      ['Brown Rice', 240],
      ['Olive Oil', 6],
    ]),
    makeMeal('snack', [
      ['Brown Rice', 120],
      ['Olive Oil', 2],
    ]),
  ];

  const current = sumMeals(dayMeals);

  // Simulate the real failure mode we saw: carbs over by ~20g and fats under by ~9g.
  // (The sign convention in the app is actual - target; here we construct a target that requires a carb trim and fat add.)
  const target: MacroValues = {
    protein: current.protein,
    carbs: Math.round((current.carbs - 20.1) * 10) / 10,
    fats: Math.round((current.fats + 9.2) * 10) / 10,
    calories: 0,
  };
  target.calories = Math.round((target.protein * 4 + target.carbs * 4 + target.fats * 9) * 10) / 10;

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  const tolerance = { calories: 5, protein: 1, carbs: 1, fats: 1 };
  const nudged: MealWithUSDA[] = generatorAny.nudgeDayForResiduals(dayMeals, usdaData, target, tolerance);
  const after = sumMeals(nudged);

  assertWithin(after.calories, target.calories, tolerance.calories, 'Calories');
  assertWithin(after.protein, target.protein, tolerance.protein, 'Protein');
  assertWithin(after.carbs, target.carbs, tolerance.carbs, 'Carbs');
  assertWithin(after.fats, target.fats, tolerance.fats, 'Fats');

  console.log('✅ Micro-correction carb/fat swap test passed');
}

run().catch((error) => {
  console.error('❌ Micro-correction carb/fat swap test failed');
  console.error(error);
  process.exit(1);
});

