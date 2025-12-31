import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { dummyTrainingSplit, dummyUsdaData, dummyWeeklyOutline } from '../DummyData/sampleWeek';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';

function assertWithinAbsolute(value: number, target: number, epsilon: number, label: string) {
  const delta = Math.abs(value - target);
  if (delta > epsilon) {
    throw new Error(
      `${label} off by ${delta.toFixed(2)} (actual ${value.toFixed(2)} vs target ${target.toFixed(2)})`
    );
  }
}

function makeIngredient(name: string, amount: number) {
  const key = normalizeFoodName(name);
  const entry = dummyUsdaData[key];
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
  ingredientDefs: Array<{ name: string; amount: number }>
): MealWithUSDA {
  const ingredients = ingredientDefs.map((d) => makeIngredient(d.name, d.amount));
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

async function run() {
  console.log('🧪 Carb deficit rescue test (expanded/rescue bounds)');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  // 4 meals/day in this dummy scenario
  generatorAny.currentMealFrequency = 4;

  // Build a day where the ONLY "clean" carb anchor is a small rice portion in lunch+dinner.
  // This intentionally requires scaling rice beyond the legacy 3.5x cap to meet a ~+920 kcal burn day.
  const buildMealsForDay = (dayNumber: number): MealWithUSDA[] => {
    const breakfast = makeMeal(dayNumber, 'breakfast', [
      { name: 'Chicken Breast', amount: 120 },
      { name: 'Almonds', amount: 30 },
    ]);
    const lunch = makeMeal(dayNumber, 'lunch', [
      { name: 'Chicken Breast', amount: 160 },
      { name: 'Brown Rice', amount: 70 },
      { name: 'Broccoli', amount: 120 },
      { name: 'Almonds', amount: 20 },
    ]);
    const dinner = makeMeal(dayNumber, 'dinner', [
      { name: 'Chicken Breast', amount: 160 },
      { name: 'Brown Rice', amount: 70 },
      { name: 'Broccoli', amount: 120 },
      { name: 'Almonds', amount: 20 },
    ]);
    const snack = makeMeal(dayNumber, 'snack', [
      { name: 'Greek Yogurt', amount: 200 },
      { name: 'Almonds', amount: 10 },
    ]);
    return [breakfast, lunch, dinner, snack];
  };

  const weekMeals: MealWithUSDA[] = [];
  for (let day = 1; day <= 7; day++) {
    weekMeals.push(...buildMealsForDay(day));
  }

  const baselineDay1Meals = buildMealsForDay(1);
  const baseline = sumDay(baselineDay1Meals);

  // Simulate a high burn day by adding ~230g carbs (~920 kcal) while holding protein/fats fixed.
  const targetProtein = Math.round(baseline.protein * 10) / 10;
  const targetFats = Math.round(baseline.fats * 10) / 10;
  const targetCarbs = Math.round((baseline.carbs + 230) * 10) / 10;
  const targetCalories = Math.round(targetProtein * 4 + targetCarbs * 4 + targetFats * 9);

  const target: MacroValues = {
    calories: targetCalories,
    protein: targetProtein,
    carbs: targetCarbs,
    fats: targetFats,
  };

  generatorAny.calculateDayMacros = () => target;

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
    if (dayMeals.length !== 4) {
      throw new Error(`Day ${idx + 1} expected 4 meals but found ${dayMeals.length}`);
    }

    const totals = sumDay(dayMeals);
    assertWithinAbsolute(totals.calories, target.calories, 5, `Day ${idx + 1} calories`);
    assertWithinAbsolute(totals.protein, target.protein, 1, `Day ${idx + 1} protein`);
    assertWithinAbsolute(totals.carbs, target.carbs, 1, `Day ${idx + 1} carbs`);
    assertWithinAbsolute(totals.fats, target.fats, 1, `Day ${idx + 1} fats`);
  });

  console.log('✅ Carb deficit rescue test passed');
}

run().catch((error) => {
  console.error('❌ Carb deficit rescue test failed');
  console.error(error);
  process.exit(1);
});

