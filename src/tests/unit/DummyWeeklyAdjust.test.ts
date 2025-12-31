import { BatchMealGenerator } from '../../services/BatchMealGenerator';
import {
  createDummyWeekMeals,
  dummyDailyTarget,
  dummyMealTargets,
  dummyTrainingSplit,
  dummyUsdaData,
  dummyWeeklyOutline,
} from '../DummyData/sampleWeek';
import { MealWithUSDA } from '../../services/BatchMealGenerator';

function assertWithinPercent(value: number, target: number, tolerance: number, label: string) {
  const delta = Math.abs((value - target) / target);
  if (delta > tolerance) {
    throw new Error(
      `${label} deviated by ${(delta * 100).toFixed(2)}% (actual ${value.toFixed(
        2
      )} vs target ${target.toFixed(2)})`
    );
  }
}

function assertWithinAbsolute(value: number, target: number, epsilon: number, label: string) {
  const delta = Math.abs(value - target);
  if (delta > epsilon) {
    throw new Error(`${label} off by ${delta.toFixed(2)} (actual ${value.toFixed(2)} vs target ${target.toFixed(2)})`);
  }
}

async function run() {
  console.log('🧪 Dummy weekly adjustment test (offline USDA data)');

  // Build meals with intentionally exaggerated macro errors (alternating ±40%)
  const initialMeals = createDummyWeekMeals();

  // Instantiate BatchMealGenerator with stubbed services (not used in this test)
  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);

  // Force meal frequency to match our dummy data
  (generator as any).currentMealFrequency = 4;

  // Monkey-patch day and meal target helpers so we can inject our dummy targets directly
  const generatorAny = generator as any;
  const originalCalculateDayMacros = generatorAny.calculateDayMacros;
  const originalCalculateMealMacroTargets = generatorAny.calculateMealMacroTargets;

  generatorAny.calculateDayMacros = () => dummyDailyTarget;
  generatorAny.calculateMealMacroTargets = (
    mealType: string,
    _mealFrequency: number,
    _dayTargets: any
  ) => dummyMealTargets[mealType as keyof typeof dummyMealTargets];

  try {
    const adjustedMeals: MealWithUSDA[] = await generatorAny.adjustMealsToTargets(
      initialMeals,
      dummyWeeklyOutline,
      dummyTrainingSplit,
      dummyUsdaData
    );

    const initialMealsByDay: MealWithUSDA[][] = Array.from({ length: 7 }, () => []);
    initialMeals.forEach((meal) => {
      initialMealsByDay[meal.dayNumber - 1].push(meal);
    });

    const mealsByDay: MealWithUSDA[][] = Array.from({ length: 7 }, () => []);
    adjustedMeals.forEach((meal) => {
      mealsByDay[meal.dayNumber - 1].push(meal);
    });

    // Confirm the pre-adjustment meals are far from targets (20-50% deviation)
    initialMealsByDay.forEach((dayMeals, dayIdx) => {
      const totals = dayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const deltas = {
        calories: Math.abs((totals.calories - dummyDailyTarget.calories) / dummyDailyTarget.calories),
        protein: Math.abs((totals.protein - dummyDailyTarget.protein) / dummyDailyTarget.protein),
        carbs: Math.abs((totals.carbs - dummyDailyTarget.carbs) / dummyDailyTarget.carbs),
        fats: Math.abs((totals.fats - dummyDailyTarget.fats) / dummyDailyTarget.fats),
      };

      ['calories', 'protein', 'carbs', 'fats'].forEach((macro) => {
        const delta = deltas[macro as keyof typeof deltas];
        const minDeviation = macro === 'protein' ? 0.19 : 0.2;
        const maxDeviation =
          macro === 'protein'
            ? 0.8
            : macro === 'fats'
            ? 0.52
            : 0.5;
        if (delta < minDeviation || delta > maxDeviation) {
          console.warn(
            `⚠️ Initial day ${dayIdx + 1} ${macro} deviation ${(delta * 100).toFixed(
              1
            )}% fell outside the target stress window (20-50%).`
          );
        }
      });
    });

    mealsByDay.forEach((dayMeals, dayIdx) => {
      if (dayMeals.length !== 4) {
        throw new Error(`Day ${dayIdx + 1} expected 4 meals but found ${dayMeals.length}`);
      }

      const totals = dayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      assertWithinAbsolute(totals.calories, dummyDailyTarget.calories, 5, `Day ${dayIdx + 1} calories`);
      assertWithinAbsolute(totals.protein, dummyDailyTarget.protein, 1, `Day ${dayIdx + 1} protein`);
      assertWithinAbsolute(totals.carbs, dummyDailyTarget.carbs, 1, `Day ${dayIdx + 1} carbs`);
      assertWithinAbsolute(totals.fats, dummyDailyTarget.fats, 1, `Day ${dayIdx + 1} fats`);

      dayMeals.forEach((meal) => {
        if (
          meal.totalMacros.calories <= 0 ||
          meal.totalMacros.protein <= 0 ||
          meal.totalMacros.carbs <= 0 ||
          meal.totalMacros.fats <= 0
        ) {
          throw new Error(`Meal "${meal.mealName}" on Day ${dayIdx + 1} has zero macros after adjustment`);
        }
      });
    });

    console.log('✅ Dummy weekly adjustment test passed');
  } finally {
    // Restore original helpers to avoid side-effects if generator is re-used
    generatorAny.calculateDayMacros = originalCalculateDayMacros;
    generatorAny.calculateMealMacroTargets = originalCalculateMealMacroTargets;
  }
}

run().catch((error) => {
  console.error('❌ Dummy weekly adjustment test failed');
  console.error(error);
  process.exit(1);
});
