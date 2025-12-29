import { extractPlanMetrics } from '../../utils/planMetricsExtractor';

async function run() {
  console.log('🧪 PlanTargetsOverrideExtractor test');

  const plan = {
    userProfile: {
      age: 30,
      gender: 'male',
      height: 180,
      weight: 80,
      workoutDaysPerWeek: 4,
      goalCategory: 'dirty_bulk',
    },
    metrics: {
      tdee: { value: 3000, formula: 'test', source: 'test' },
      bmr: { value: 1800, formula: 'test', source: 'test' },
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
    phaseAwareFramework: {
      nutritionApproach: {
        caloricStrategy: {
          deficitMagnitude: 'test',
          dailyDeficitCalories: 0,
          weeklyDeficitCalories: 0,
        },
        macroTargets: { proteinPerKg: 2.0 },
      },
      trainingApproach: { frequencyPerWeek: 4, sessionDurationMinutes: 60, split: 'test', periodization: 'test', volumePerMuscleWeekly: {} },
    },
    weeklyOutlines: [
      {
        weekNumber: 1,
        phase: 'foundation',
        dailyTargets: { calories: 3000, protein: 160, carbs: 350, fat: 80, proteinPerKg: 2.0 },
        dailyTargetsOverride: Array.from({ length: 7 }, () => ({
          calories: 3200,
          protein: 170,
          carbs: 380,
          fat: 85,
          proteinPerKg: 2.1,
        })),
        trainingSchedule: { resistanceDays: ['Monday'], cardioDays: [], restDays: [], weeklyVolume: '', focusAreas: [] },
        cardioSchedule: { sessions: 1, duration: 20, intensity: 'Low', type: 'Walking' },
        objectives: [],
        expectedOutcomes: [],
        adjustments: '',
        specialNotes: '',
      },
    ],
  };

  const metrics = extractPlanMetrics(plan);

  if (Math.round(metrics.targetCalories) !== 3200) {
    throw new Error(`Expected targetCalories=3200 from dailyTargetsOverride average, got ${metrics.targetCalories}`);
  }

  if (metrics.dailyDeficit !== 3000 - 3200) {
    throw new Error(`Expected dailyDeficit=-200, got ${metrics.dailyDeficit}`);
  }

  if (metrics.weeklyDeficit !== (3000 - 3200) * 7) {
    throw new Error(`Expected weeklyDeficit=-1400, got ${metrics.weeklyDeficit}`);
  }

  console.log('✅ PlanTargetsOverrideExtractor test passed');
}

run().catch((err) => {
  console.error('❌ PlanTargetsOverrideExtractor test failed');
  console.error(err);
  process.exit(1);
});

