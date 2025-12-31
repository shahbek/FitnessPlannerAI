import { BatchMealGeneration, BatchMealGenerator } from '../../services/BatchMealGenerator';
import { isZeroImpactIngredient } from '../../constants/ingredients';

async function run() {
  console.log('🧪 Empty meal repair test (seasoning-only meals never reach USDA/optimizer)');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  generatorAny.currentMealFrequency = 4;

  const userProfile = {
    dietType: 'anything',
    preferences: '',
    allergies: [],
    mealPrepPreference: 'repeat_weekly',
  } as any;

  const emptyBreakfast = {
    mealName: 'Avocado and Bacon Omelette',
    mealType: 'breakfast',
    ingredients: [
      { name: 'Salt', amount: 2 },
      { name: 'Black Pepper', amount: 1 },
    ],
    instructions: ['Season with salt and pepper.'],
  };

  const lunch = {
    mealName: 'Chicken and Rice Bowl',
    mealType: 'lunch',
    ingredients: [
      { name: 'Chicken Breast', amount: 180 },
      { name: 'Brown Rice', amount: 200 },
      { name: 'Broccoli', amount: 150 },
      { name: 'Olive Oil', amount: 10 },
      { name: 'Salt', amount: 2 },
      { name: 'Black Pepper', amount: 1 },
    ],
    instructions: ['Cook and assemble.'],
  };

  const dinner = {
    mealName: 'Salmon and Sweet Potato',
    mealType: 'dinner',
    ingredients: [
      { name: 'Salmon', amount: 180 },
      { name: 'Sweet Potato', amount: 260 },
      { name: 'Broccoli', amount: 150 },
      { name: 'Olive Oil', amount: 10 },
      { name: 'Salt', amount: 2 },
      { name: 'Black Pepper', amount: 1 },
    ],
    instructions: ['Cook and serve.'],
  };

  const snack = {
    mealName: 'Fruit Snack',
    mealType: 'snack',
    ingredients: [
      { name: 'Banana', amount: 150 },
      { name: 'Berries', amount: 120 },
    ],
    instructions: ['Eat immediately.'],
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const meals: BatchMealGeneration = {
    weeklyMeals: dayNames.map((dayName, index) => ({
      dayNumber: index + 1,
      dayName,
      meals: [emptyBreakfast, lunch, dinner, snack] as any,
    })),
  };

  const repaired: BatchMealGeneration = generatorAny.repairEmptyMealsInBatch(meals, userProfile, {
    repeatWeekly: true,
    weekSeed: 1,
  });

  repaired.weeklyMeals.forEach((day) => {
    const breakfast = day.meals.find((m: any) => m.mealType === 'breakfast');
    if (!breakfast) throw new Error(`Missing breakfast after repair for Day ${day.dayNumber}`);

    const substantive = (breakfast.ingredients || []).filter(
      (ing: any) => !isZeroImpactIngredient(ing.name) && Number(ing.amount || 0) > 0.1
    );
    if (substantive.length === 0) {
      throw new Error(`Day ${day.dayNumber} breakfast is still empty after repair`);
    }

    const hasAnyEstimate = substantive.some(
      (ing: any) =>
        Number(ing.estimatedCalories || 0) > 0 ||
        Number(ing.estimatedProtein || 0) > 0 ||
        Number(ing.estimatedCarbs || 0) > 0 ||
        Number(ing.estimatedFats || 0) > 0
    );
    if (!hasAnyEstimate) {
      throw new Error(`Day ${day.dayNumber} repaired breakfast missing fallback macro estimates`);
    }
  });

  console.log('✅ Empty meal repair test passed');
}

run().catch((error) => {
  console.error('❌ Empty meal repair test failed');
  console.error(error);
  process.exit(1);
});

