import { BatchMealGenerator } from '../../services/BatchMealGenerator';
import { dummyTrainingSplit, dummyUsdaData, dummyWeeklyOutline } from '../DummyData/sampleWeek';

async function run() {
  console.log('🧪 SupplementMealsBypassLP test');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  // Pretend LP is available, but make it fail hard if called (we expect bypass when supplements exist)
  generatorAny.optimizerInitialized = true;
  generatorAny.adjustDayWithLP = async () => {
    throw new Error('adjustDayWithLP should not be called when supplement meals are present');
  };

  // Make per-meal adjustment a no-op to keep test fast and deterministic
  generatorAny.adjustMealToPreciseTargets = async (meal: any) => meal;
  generatorAny.calculateDayMacros = () => ({ calories: 2000, protein: 150, carbs: 200, fats: 60 });
  generatorAny.calculateMealMacroTargets = () => ({ calories: 500, protein: 35, carbs: 50, fats: 15 });

  // Create one day with a protein supplement meal
  const meals = [
    {
      mealName: 'Protein Shake (Target Boost)',
      mealType: 'snack',
      instructions: [],
      ingredients: [],
      totalMacros: { calories: 200, protein: 40, carbs: 2, fats: 2 },
      dayNumber: 4,
      dayName: 'Thursday',
      adjustmentLog: ['Precision fallback'],
    },
    {
      mealName: 'Test Lunch',
      mealType: 'lunch',
      instructions: [],
      ingredients: [],
      totalMacros: { calories: 600, protein: 30, carbs: 60, fats: 20 },
      dayNumber: 4,
      dayName: 'Thursday',
    },
  ];

  await generatorAny.adjustMealsToTargets(
    meals,
    dummyWeeklyOutline,
    dummyTrainingSplit,
    dummyUsdaData
  );

  console.log('✅ SupplementMealsBypassLP test passed');
}

run().catch((err) => {
  console.error('❌ SupplementMealsBypassLP test failed');
  console.error(err);
  process.exit(1);
});

