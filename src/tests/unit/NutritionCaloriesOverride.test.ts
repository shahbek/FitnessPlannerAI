import { nutritionCalculationService } from '../../services/NutritionCalculationService';

async function run() {
  console.log('🧪 Nutrition caloriesOverride test');

  const userMetrics = {
    weightKg: 80,
    heightCm: 180,
    age: 30,
    sex: 'male' as const,
    activityLevel: 'moderate',
  };

  const maintenance = await nutritionCalculationService.calculateMaintenanceCalories(userMetrics);

  const targetCalories = 3200;
  const macros = await nutritionCalculationService.calculateMacroTargetsFromCategory(
    userMetrics,
    maintenance,
    {
      goalCategory: 'dirty_bulk',
      timelineWeeks: 12,
      caloriesOverride: targetCalories,
    }
  );

  if (macros.calories !== targetCalories) {
    throw new Error(`Expected caloriesOverride ${targetCalories}, got ${macros.calories}`);
  }

  if (macros.protein <= 0 || macros.fat <= 0) {
    throw new Error(`Expected positive protein/fat, got protein=${macros.protein}, fat=${macros.fat}`);
  }

  if (macros.carbs < 0) {
    throw new Error(`Expected non-negative carbs, got carbs=${macros.carbs}`);
  }

  console.log('✅ Nutrition caloriesOverride test passed');
}

run().catch((err) => {
  console.error('❌ Nutrition caloriesOverride test failed');
  console.error(err);
  process.exit(1);
});

