import { BatchMealGenerator } from '../../services/BatchMealGenerator';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  console.log('🧪 MealFrequencyDistribution test');

  const fakeUsdaService = {} as any;
  const fakeCotService = { isAIAvailable: () => false } as any;
  const generator = new BatchMealGenerator(fakeUsdaService, fakeCotService);
  const generatorAny = generator as any;

  const dist5 = generatorAny.getMealCalorieDistribution(5, 2000);
  assert(Array.isArray(dist5.snacks) && dist5.snacks.length === 2, 'mealFrequency=5 should create 2 snacks');
  assert(dist5.breakfast + dist5.lunch + dist5.dinner + dist5.snacks.reduce((a: number, b: number) => a + b, 0) === 2000, 'mealFrequency=5 distribution should sum to daily calories');

  const dist6 = generatorAny.getMealCalorieDistribution(6, 2000);
  assert(Array.isArray(dist6.snacks) && dist6.snacks.length === 3, 'mealFrequency=6 should create 3 snacks');
  assert(dist6.breakfast + dist6.lunch + dist6.dinner + dist6.snacks.reduce((a: number, b: number) => a + b, 0) === 2000, 'mealFrequency=6 distribution should sum to daily calories');

  const dayTargets = { calories: 2000, protein: 150, carbs: 200, fats: 60 };
  const snack1 = generatorAny.calculateMealMacroTargets('snack', 6, dayTargets, 0);
  const snack2 = generatorAny.calculateMealMacroTargets('snack', 6, dayTargets, 1);
  const snack3 = generatorAny.calculateMealMacroTargets('snack', 6, dayTargets, 2);

  assert(snack1.calories === dist6.snacks[0], 'snack1 calories should match distribution');
  assert(snack2.calories === dist6.snacks[1], 'snack2 calories should match distribution');
  assert(snack3.calories === dist6.snacks[2], 'snack3 calories should match distribution');

  assert(snack1.protein === 15, 'snack1 protein should be proportional');
  assert(snack2.protein === 15, 'snack2 protein should be proportional');
  assert(snack3.protein === 7.5, 'snack3 protein should be proportional');

  console.log('✅ MealFrequencyDistribution test passed');
}

run().catch((err) => {
  console.error('❌ MealFrequencyDistribution test failed');
  console.error(err);
  process.exit(1);
});

