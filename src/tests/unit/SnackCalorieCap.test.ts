import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { dummyTrainingSplit, dummyUsdaData, dummyWeeklyOutline } from '../DummyData/sampleWeek';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';

type UsdaEntry = { nutrition: MacroValues; fdcId: number };

function assertWithinAbsolute(value: number, target: number, epsilon: number, label: string) {
  const delta = Math.abs(value - target);
  if (delta > epsilon) {
    throw new Error(`${label} off by ${delta.toFixed(2)} (actual ${value.toFixed(2)} vs target ${target.toFixed(2)})`);
  }
}

function normalizeUsdaCaloriesFromMacros(usda: Record<string, UsdaEntry>): Record<string, UsdaEntry> {
  const normalized: Record<string, UsdaEntry> = {};
  Object.entries(usda).forEach(([key, entry]) => {
    const protein = Number(entry.nutrition?.protein ?? 0);
    const carbs = Number(entry.nutrition?.carbs ?? 0);
    const fats = Number(entry.nutrition?.fats ?? 0);
    const calories = Math.round((protein * 4 + carbs * 4 + fats * 9) * 10) / 10;
    normalized[key] = {
      ...entry,
      nutrition: { ...entry.nutrition, calories },
    };
  });
  return normalized;
}

function makeIngredient(name: string, amount: number, usda: Record<string, UsdaEntry>) {
  const key = normalizeFoodName(name);
  const entry = usda[key];
  if (!entry) {
    throw new Error(`Missing dummy USDA data for ingredient "${name}"`);
  }

  return {
    name,
    amount,
    nutrition: calculateMacrosForAmount(entry.nutrition, amount, 'g'),
    fdcId: entry.fdcId,
  };
}

function makeMeal(
  dayNumber: number,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  ingredientDefs: Array<{ name: string; amount: number }>,
  usda: Record<string, UsdaEntry>
): MealWithUSDA {
  const ingredients = ingredientDefs.map((d) => makeIngredient(d.name, d.amount, usda));
  const totalMacros = ingredients.reduce(
    (sum, ing) => ({
      calories: sum.calories + ing.nutrition.calories,
      protein: sum.protein + ing.nutrition.protein,
      carbs: sum.carbs + ing.nutrition.carbs,
      fats: sum.fats + ing.nutrition.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
  );

  return {
    mealName: `${mealType}-${dayNumber}`,
    mealType,
    instructions: [],
    ingredients,
    totalMacros,
    dayNumber,
    dayName: dummyTrainingSplit.days[dayNumber - 1]?.dayName ?? `Day ${dayNumber}`,
  };
}

function sumDay(meals: MealWithUSDA[]): MacroValues {
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

function sumUnroundedCalories(
  ingredientDefs: Array<{ name: string; amount: number }>,
  usda: Record<string, UsdaEntry>
): number {
  return ingredientDefs.reduce((sum, ing) => {
    const key = normalizeFoodName(ing.name);
    const entry = usda[key];
    if (!entry) return sum;
    const per100 = Number(entry.nutrition?.calories ?? 0);
    return sum + (per100 / 100) * ing.amount;
  }, 0);
}

function computeNormalSnackCap(dayCalories: number): number {
  const snackTargetCalories = Math.round(dayCalories * 0.1);
  return Math.min(dayCalories * 0.22, Math.max(snackTargetCalories * 1.8, snackTargetCalories + 150), 800);
}

async function run() {
  console.log('🧪 Snack calorie cap test (prevents massive snacks)');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  // 4 meals/day: breakfast, lunch, dinner, snack
  generatorAny.currentMealFrequency = 4;

  const usdaNormalized = normalizeUsdaCaloriesFromMacros(dummyUsdaData);

  const breakfast = [
    { name: 'Chicken Breast', amount: 120 },
    { name: 'Brown Rice', amount: 100 },
    { name: 'Broccoli', amount: 100 },
    { name: 'Almonds', amount: 10 },
  ];
  const lunch = [
    { name: 'Chicken Breast', amount: 140 },
    { name: 'Brown Rice', amount: 120 },
    { name: 'Broccoli', amount: 120 },
    { name: 'Almonds', amount: 10 },
  ];
  const dinner = [...lunch];

  // Intentionally absurd snack to reproduce the issue (the optimizer previously could "dump" calories here).
  const snack = [
    { name: 'Protein Powder', amount: 60 },
    { name: 'Rolled Oats', amount: 180 },
    { name: 'Peanut Butter', amount: 80 },
    { name: 'Berries', amount: 120 },
    { name: 'Almonds', amount: 40 },
  ];

  const baselineSnackCalories = makeMeal(1, 'snack', snack, usdaNormalized).totalMacros.calories;
  if (baselineSnackCalories < 1200) {
    throw new Error(`Baseline snack is not large enough for this regression test (got ${baselineSnackCalories} kcal)`);
  }

  // Derive a feasible daily target where:
  // - The snack MUST be reduced via caps
  // - Main meals must scale up to compensate while still hitting strict day totals
  let targetCalories = 3500;
  let targetTotals: MacroValues | null = null;

  for (let i = 0; i < 3; i++) {
    const snackCap = computeNormalSnackCap(targetCalories);
    const snackCaloriesUnrounded = sumUnroundedCalories(snack, usdaNormalized);
    const mainCaloriesUnrounded = sumUnroundedCalories([...breakfast, ...lunch, ...dinner], usdaNormalized);

    const snackScale = snackCaloriesUnrounded > 0 ? snackCap / snackCaloriesUnrounded : 1;
    const mainScale =
      mainCaloriesUnrounded > 0 ? (targetCalories - snackCap) / mainCaloriesUnrounded : 1;

    const scaledDayMeals: MealWithUSDA[] = [
      makeMeal(
        1,
        'breakfast',
        breakfast.map((d) => ({ ...d, amount: d.amount * mainScale })),
        usdaNormalized
      ),
      makeMeal(
        1,
        'lunch',
        lunch.map((d) => ({ ...d, amount: d.amount * mainScale })),
        usdaNormalized
      ),
      makeMeal(
        1,
        'dinner',
        dinner.map((d) => ({ ...d, amount: d.amount * mainScale })),
        usdaNormalized
      ),
      makeMeal(
        1,
        'snack',
        snack.map((d) => ({ ...d, amount: d.amount * snackScale })),
        usdaNormalized
      ),
    ];

    const scaledTotals = sumDay(scaledDayMeals);
    const nextTargetCalories = scaledTotals.calories;

    targetTotals = scaledTotals;
    if (nextTargetCalories === targetCalories) break;
    targetCalories = nextTargetCalories;
  }

  if (!targetTotals) {
    throw new Error('Failed to compute target macros for snack cap regression test');
  }

  const expectedSnackCap = computeNormalSnackCap(targetTotals.calories);
  if (expectedSnackCap >= baselineSnackCalories) {
    throw new Error('Expected snack cap should be lower than baseline snack calories for this regression test');
  }

  generatorAny.calculateDayMacros = () => targetTotals;

  const buildMealsForDay = (dayNumber: number): MealWithUSDA[] => [
    makeMeal(dayNumber, 'breakfast', breakfast, usdaNormalized),
    makeMeal(dayNumber, 'lunch', lunch, usdaNormalized),
    makeMeal(dayNumber, 'dinner', dinner, usdaNormalized),
    makeMeal(dayNumber, 'snack', snack, usdaNormalized),
  ];

  const weekMeals: MealWithUSDA[] = [];
  for (let day = 1; day <= 7; day++) {
    weekMeals.push(...buildMealsForDay(day));
  }

  const adjustedMeals: MealWithUSDA[] = await generatorAny.adjustMealsToTargets(
    weekMeals,
    dummyWeeklyOutline,
    dummyTrainingSplit,
    dummyUsdaData
  );

  const mealsByDay: MealWithUSDA[][] = Array.from({ length: 7 }, () => []);
  adjustedMeals.forEach((meal) => {
    mealsByDay[meal.dayNumber - 1].push(meal);
  });

  mealsByDay.forEach((dayMeals, idx) => {
    const totals = sumDay(dayMeals);
    assertWithinAbsolute(totals.calories, targetTotals!.calories, 5, `Day ${idx + 1} calories`);
    assertWithinAbsolute(totals.protein, targetTotals!.protein, 1, `Day ${idx + 1} protein`);
    assertWithinAbsolute(totals.carbs, targetTotals!.carbs, 1, `Day ${idx + 1} carbs`);
    assertWithinAbsolute(totals.fats, targetTotals!.fats, 1, `Day ${idx + 1} fats`);

    const snackMeals = dayMeals.filter((m) => m.mealType === 'snack');
    if (snackMeals.length !== 1) {
      throw new Error(`Day ${idx + 1} expected exactly 1 snack but found ${snackMeals.length}`);
    }

    const snackCalories = snackMeals[0].totalMacros.calories;
    if (snackCalories > expectedSnackCap + 10) {
      throw new Error(
        `Day ${idx + 1} snack exceeded cap (snack ${snackCalories} kcal vs cap ${expectedSnackCap.toFixed(0)} kcal)`
      );
    }

    if (baselineSnackCalories - snackCalories < 500) {
      throw new Error(`Day ${idx + 1} snack was not reduced enough (baseline ${baselineSnackCalories} kcal, got ${snackCalories} kcal)`);
    }
  });

  console.log('✅ Snack calorie cap test passed');
}

run().catch((error) => {
  console.error('❌ Snack calorie cap test failed');
  console.error(error);
  process.exit(1);
});
