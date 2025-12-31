import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';
import { isZeroImpactIngredient } from '../../constants/ingredients';

type UsdaEntry = { nutrition: MacroValues; fdcId: number };

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
  if (!entry) throw new Error(`Missing USDA test data for "${name}"`);
  return {
    name,
    amount,
    nutrition: calculateMacrosForAmount(entry.nutrition, amount, 'g'),
    fdcId: entry.fdcId,
  };
}

function makeMeal(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  ingredientDefs: Array<{ name: string; amount: number }>,
  usda: Record<string, UsdaEntry>,
  options?: { dayNumber?: number; dayName?: string; lockAsSupplement?: boolean }
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
    mealName: `${mealType}-day`,
    mealType,
    instructions: [],
    ingredients,
    totalMacros,
    dayNumber: options?.dayNumber ?? 1,
    dayName: options?.dayName ?? 'Monday',
    ...(options?.lockAsSupplement ? { adjustmentLog: ['protein supplement'] } : {}),
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

function assertWithinAbsolute(value: number, target: number, epsilon: number, label: string) {
  const delta = Math.abs(value - target);
  if (delta > epsilon) {
    throw new Error(`${label} off by ${delta.toFixed(2)} (actual ${value.toFixed(2)} vs target ${target.toFixed(2)})`);
  }
}

async function run() {
  console.log('🧪 Meal integrity (rescue floors) + yogurt cap test');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;
  generatorAny.currentMealFrequency = 4;

  // Minimal deterministic USDA test dataset (per 100g).
  const usda: Record<string, UsdaEntry> = {
    [normalizeFoodName('Eggs')]: { nutrition: { calories: 0, protein: 13, carbs: 1.1, fats: 10.6 }, fdcId: 1 },
    [normalizeFoodName('Chicken Breast')]: { nutrition: { calories: 0, protein: 46, carbs: 0, fats: 5 }, fdcId: 2 },
    [normalizeFoodName('Brown Rice')]: { nutrition: { calories: 0, protein: 4, carbs: 40, fats: 2 }, fdcId: 3 },
    [normalizeFoodName('Broccoli')]: { nutrition: { calories: 0, protein: 3, carbs: 7, fats: 0 }, fdcId: 4 },
    [normalizeFoodName('Olive Oil')]: { nutrition: { calories: 0, protein: 0, carbs: 0, fats: 100 }, fdcId: 5 },
    [normalizeFoodName('Greek Yogurt')]: { nutrition: { calories: 0, protein: 18, carbs: 6, fats: 2 }, fdcId: 6 },
    [normalizeFoodName('Whey Protein Powder')]: { nutrition: { calories: 0, protein: 80, carbs: 10, fats: 5 }, fdcId: 7 },
    [normalizeFoodName('Rolled Oats')]: { nutrition: { calories: 0, protein: 12, carbs: 60, fats: 6 }, fdcId: 8 },
    [normalizeFoodName('Berries')]: { nutrition: { calories: 0, protein: 1, carbs: 14, fats: 0 }, fdcId: 9 },
    [normalizeFoodName('Salt')]: { nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }, fdcId: 10 },
    [normalizeFoodName('Black Pepper')]: { nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }, fdcId: 11 },
    [normalizeFoodName('Water')]: { nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }, fdcId: 12 },
  };

  const usdaNormalized = normalizeUsdaCaloriesFromMacros(usda);

  await generatorAny.ensureOptimizerInitialized();

  // Scenario A: Rescue optimization should never collapse a main meal into seasoning-only.
  {
    const baselineMeals: MealWithUSDA[] = [
      makeMeal(
        'breakfast',
        [
          { name: 'Eggs', amount: 200 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'lunch',
        [
          { name: 'Chicken Breast', amount: 200 },
          { name: 'Brown Rice', amount: 200 },
          { name: 'Broccoli', amount: 150 },
          { name: 'Olive Oil', amount: 10 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'dinner',
        [
          { name: 'Chicken Breast', amount: 200 },
          { name: 'Brown Rice', amount: 200 },
          { name: 'Broccoli', amount: 150 },
          { name: 'Olive Oil', amount: 10 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'snack',
        [
          { name: 'Greek Yogurt', amount: 220 },
          { name: 'Whey Protein Powder', amount: 30 },
          { name: 'Berries', amount: 120 },
          { name: 'Water', amount: 300 },
        ],
        usdaNormalized
      ),
    ];

    // Build a feasible lower target by scaling down substantive ingredients.
    const scaledMeals: MealWithUSDA[] = [
      makeMeal(
        'breakfast',
        [
          { name: 'Eggs', amount: 120 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'lunch',
        [
          { name: 'Chicken Breast', amount: 120 },
          { name: 'Brown Rice', amount: 120 },
          { name: 'Broccoli', amount: 90 },
          { name: 'Olive Oil', amount: 6 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'dinner',
        [
          { name: 'Chicken Breast', amount: 120 },
          { name: 'Brown Rice', amount: 120 },
          { name: 'Broccoli', amount: 90 },
          { name: 'Olive Oil', amount: 6 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized
      ),
      makeMeal(
        'snack',
        [
          { name: 'Greek Yogurt', amount: 160 },
          { name: 'Whey Protein Powder', amount: 20 },
          { name: 'Berries', amount: 90 },
          { name: 'Water', amount: 300 },
        ],
        usdaNormalized
      ),
    ];

    const targets = sumDay(scaledMeals);

    const optimized: MealWithUSDA[] = await generatorAny.adjustDayWithLP(baselineMeals, targets, usdaNormalized, {
      boundsMode: 'rescue',
      snackCapMode: 'normal',
    });

    const totals = sumDay(optimized);
    assertWithinAbsolute(totals.calories, targets.calories, 5, 'Scenario A calories');
    assertWithinAbsolute(totals.protein, targets.protein, 1, 'Scenario A protein');
    assertWithinAbsolute(totals.carbs, targets.carbs, 1, 'Scenario A carbs');
    assertWithinAbsolute(totals.fats, targets.fats, 1, 'Scenario A fats');

    const breakfast = optimized.find((m) => m.mealType === 'breakfast');
    if (!breakfast) throw new Error('Scenario A missing breakfast meal');

    const substantive = (breakfast.ingredients || []).filter(
      (ing) => !isZeroImpactIngredient(ing.name) && Number(ing.amount || 0) > 0.1 && Number(ing.nutrition?.calories || 0) > 0
    );
    if (substantive.length === 0) {
      throw new Error('Scenario A breakfast collapsed into seasoning-only meal');
    }
  }

  // Scenario B: Greek yogurt should never exceed portion cap even under ultra-relaxed snack caps.
  {
    const lockedMeals: MealWithUSDA[] = [
      makeMeal(
        'breakfast',
        [
          { name: 'Eggs', amount: 200 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized,
        { lockAsSupplement: true }
      ),
      makeMeal(
        'lunch',
        [
          { name: 'Chicken Breast', amount: 250 },
          { name: 'Brown Rice', amount: 250 },
          { name: 'Broccoli', amount: 150 },
          { name: 'Olive Oil', amount: 15 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized,
        { lockAsSupplement: true }
      ),
      makeMeal(
        'dinner',
        [
          { name: 'Chicken Breast', amount: 250 },
          { name: 'Brown Rice', amount: 250 },
          { name: 'Broccoli', amount: 150 },
          { name: 'Olive Oil', amount: 15 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        usdaNormalized,
        { lockAsSupplement: true }
      ),
    ];

    const snackBaseline = makeMeal(
      'snack',
      [
        { name: 'Greek Yogurt', amount: 220 },
        { name: 'Whey Protein Powder', amount: 30 },
        { name: 'Rolled Oats', amount: 40 },
        { name: 'Berries', amount: 120 },
        { name: 'Water', amount: 300 },
      ],
      usdaNormalized
    );

    const snackWanted = makeMeal(
      'snack',
      [
        { name: 'Greek Yogurt', amount: 320 }, // must increase, but should never exceed cap (450g)
        { name: 'Whey Protein Powder', amount: 60 },
        { name: 'Rolled Oats', amount: 35 },
        { name: 'Berries', amount: 120 },
        { name: 'Water', amount: 300 },
      ],
      usdaNormalized
    );

    const lockedTotals = sumDay([...lockedMeals]);
    const targetTotals: MacroValues = {
      calories: lockedTotals.calories + snackWanted.totalMacros.calories,
      protein: lockedTotals.protein + snackWanted.totalMacros.protein,
      carbs: lockedTotals.carbs + snackWanted.totalMacros.carbs,
      fats: lockedTotals.fats + snackWanted.totalMacros.fats,
    };

    const optimized: MealWithUSDA[] = await generatorAny.adjustDayWithLP(
      [...lockedMeals, snackBaseline],
      targetTotals,
      usdaNormalized,
      { boundsMode: 'rescue', snackCapMode: 'disabled' }
    );

    const totals = sumDay(optimized);
    assertWithinAbsolute(totals.calories, targetTotals.calories, 5, 'Scenario B calories');
    assertWithinAbsolute(totals.protein, targetTotals.protein, 1, 'Scenario B protein');
    assertWithinAbsolute(totals.carbs, targetTotals.carbs, 1, 'Scenario B carbs');
    assertWithinAbsolute(totals.fats, targetTotals.fats, 1, 'Scenario B fats');

    const snack = optimized.find((m) => m.mealType === 'snack');
    if (!snack) throw new Error('Scenario B missing snack meal');

    const yogurt = snack.ingredients.find((i) => normalizeFoodName(i.name) === normalizeFoodName('Greek Yogurt'));
    if (!yogurt) throw new Error('Scenario B missing Greek Yogurt ingredient');

    if (yogurt.amount > 450.1) {
      throw new Error(`Greek yogurt exceeded cap (got ${yogurt.amount}g, expected <= 450g)`);
    }
    if (yogurt.amount <= 220.1) {
      throw new Error(`Expected yogurt to increase (baseline 220g, got ${yogurt.amount}g)`);
    }
  }

  console.log('✅ Meal integrity + yogurt cap test passed');
}

run().catch((error) => {
  console.error('❌ Meal integrity + yogurt cap test failed');
  console.error(error);
  process.exit(1);
});

