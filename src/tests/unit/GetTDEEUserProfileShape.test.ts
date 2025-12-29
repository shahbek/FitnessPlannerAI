import { getTDEE } from '../../utils/planCalculations';

async function run() {
  console.log('🧪 GetTDEE userProfile shape test');

  const plan = {
    metrics: { tdee: { value: 0 } },
    userProfile: {
      age: 30,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      workoutDaysPerWeek: 4,
    },
  };

  const tdee = getTDEE(plan as any, undefined);
  if (!tdee || tdee <= 0) {
    throw new Error(`Expected computed TDEE > 0, got ${tdee}`);
  }

  console.log(`✅ GetTDEE userProfile shape test passed (TDEE=${tdee})`);
}

run().catch((err) => {
  console.error('❌ GetTDEE userProfile shape test failed');
  console.error(err);
  process.exit(1);
});

