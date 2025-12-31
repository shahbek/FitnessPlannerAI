import { IntegratedPlanGenerator } from '../../services/IntegratedPlanGenerator';
import type { WeeklyOutline } from '../../models/PlanModels';
import type { TrainingSplit } from '../../services/TrainingSplitService';
import type { UserProfile } from '../../models/UserProfile';
import { estimateResistanceCalories } from '../../utils/planCalculations';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

async function run() {
  console.log('🧪 Reconciled daily targets burn test');

  const generator = new IntegratedPlanGenerator(
    {
      action: async () => {
        throw new Error('Convex action should not be called in ReconciledDailyTargetsBurn.test');
      },
    },
    undefined,
    { useCoT: false }
  );

  const userProfile: UserProfile = {
    age: 30,
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    timelineWeeks: 8,
    preferences: '',
    workoutLevel: 'intermediate',
    workoutSplit: 'upper_lower',
    trainingDaysPerWeek: 4,
    equipment: 'gym_membership',
    goalCategory: 'mini_cut',
    activityLevel: 'moderate',
  };

  const weeklyOutlines: WeeklyOutline[] = [
    {
      weekNumber: 1,
      phase: 'foundation',
      dailyTargets: { calories: 2000, protein: 160, carbs: 180, fat: 60, proteinPerKg: 2.0 },
      trainingSchedule: {
        resistanceDays: ['Monday'],
        cardioDays: [],
        restDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        weeklyVolume: 'Moderate',
        focusAreas: [],
      },
      cardioSchedule: { sessions: 1, duration: 30, intensity: 'Moderate', type: 'LISS' },
      objectives: [],
      expectedOutcomes: [],
      adjustments: '',
      specialNotes: '',
    },
  ];

  const trainingSplit: TrainingSplit = {
    splitName: 'Test',
    daysPerWeek: 1,
    days: [
      { dayNumber: 1, dayName: 'Monday', focus: ['Full Body'], isRestDay: false, isCardioDay: false, estimatedDuration: 60 },
      { dayNumber: 2, dayName: 'Tuesday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
      { dayNumber: 3, dayName: 'Wednesday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
      { dayNumber: 4, dayName: 'Thursday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
      { dayNumber: 5, dayName: 'Friday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
      { dayNumber: 6, dayName: 'Saturday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
      { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false, estimatedDuration: 0 },
    ],
  };

  const cardioTemplates = {
    weeklySchedules: [
      {
        weekNumber: 1,
        sessions: [
          {
            dayName: 'Monday',
            dayNumber: 1,
            cardioTemplate: { caloriesBurned: 200, type: 'LISS' },
          },
        ],
      },
    ],
  };

  const resistanceBurn = estimateResistanceCalories(60, userProfile.weightKg, 'moderate');
  const expectedMondayCalories = 2000 + resistanceBurn + 200;

  await (generator as any).calculateDailyNutritionTargets(
    userProfile,
    weeklyOutlines,
    trainingSplit,
    cardioTemplates,
    { weightKg: userProfile.weightKg, tdee: 2500 }
  );

  const override = (weeklyOutlines[0] as any).dailyTargetsOverride;
  assert(Array.isArray(override) && override.length === 7, 'Expected dailyTargetsOverride length 7');

  assert(
    override[0].calories === expectedMondayCalories,
    `Expected Monday calories ${expectedMondayCalories}, got ${override[0].calories}`
  );

  assert(override[1].calories === 2000, `Expected Tuesday calories baseline 2000, got ${override[1].calories}`);

  console.log('✅ Reconciled daily targets burn test passed');
}

run().catch((err) => {
  console.error('❌ Reconciled daily targets burn test failed');
  console.error(err);
  process.exit(1);
});

