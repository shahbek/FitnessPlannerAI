import { IntegratedPlanGenerator } from '../../services/IntegratedPlanGenerator';
import type { WeeklyOutline, SessionTemplate } from '../../models/PlanModels';
import type { TrainingSplit } from '../../services/TrainingSplitService';
import type { UserProfile } from '../../models/UserProfile';

const buildWeeklyOutlines = (weeks: number): WeeklyOutline[] => {
  const phases = (week: number): string => {
    if (week <= 4) return 'foundation';
    if (week <= 8) return 'progression';
    return 'peak';
  };

  const emptySchedule = {
    resistanceDays: ['Monday', 'Wednesday', 'Friday'],
    cardioDays: [],
    restDays: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'],
    weeklyVolume: 'Moderate',
    focusAreas: [],
  };

  return Array.from({ length: weeks }, (_, i) => {
    const weekNumber = i + 1;
    return {
      weekNumber,
      phase: phases(weekNumber),
      dailyTargets: {
        calories: 2500,
        protein: 160,
        carbs: 280,
        fat: 70,
        proteinPerKg: 2,
      },
      trainingSchedule: emptySchedule,
      cardioSchedule: { sessions: 0, duration: 0, intensity: 'Low', type: 'None' },
      objectives: ['Test'],
      expectedOutcomes: [],
      adjustments: 'None',
      specialNotes: '',
    };
  });
};

const buildTrainingSplit = (): TrainingSplit => ({
  splitName: 'Test Split',
  daysPerWeek: 3,
  days: [
    { dayNumber: 1, dayName: 'Monday', focus: ['Full Body'], isRestDay: false, isCardioDay: false },
    { dayNumber: 2, dayName: 'Tuesday', focus: [], isRestDay: true, isCardioDay: false },
    { dayNumber: 3, dayName: 'Wednesday', focus: ['Full Body'], isRestDay: false, isCardioDay: false },
    { dayNumber: 4, dayName: 'Thursday', focus: [], isRestDay: true, isCardioDay: false },
    { dayNumber: 5, dayName: 'Friday', focus: ['Full Body'], isRestDay: false, isCardioDay: false },
    { dayNumber: 6, dayName: 'Saturday', focus: [], isRestDay: true, isCardioDay: false },
    { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false },
  ],
});

const buildUserProfile = (): UserProfile => ({
  age: 30,
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  timelineWeeks: 12,
  preferences: 'none',
  workoutLevel: 'intermediate',
  workoutSplit: 'full_body',
  trainingDaysPerWeek: 3,
  equipment: 'gym_membership',
  goalCategory: 'maintenance',
});

const run = async () => {
  console.log('🧪 Phase-cached workouts test');

  const generator = new IntegratedPlanGenerator(
    {
      // Not used in this unit test
      action: async () => {
        throw new Error('Convex action should not be called in PhaseCachedWorkouts.test');
      },
    },
    undefined,
    { useCoT: false }
  );

  let aiCalls = 0;
  const mockWeeklyWorkoutGenerator = {
    generateWeeklyWorkouts: async (
      _trainingSplit: TrainingSplit,
      _userProfile: UserProfile,
      outline: WeeklyOutline
    ): Promise<SessionTemplate[]> => {
      aiCalls += 1;
      const w = outline.weekNumber;
      return [
        {
          templateId: `test-workout-w${w}-a`,
          name: `Week ${w} A`,
          targetMuscles: ['full body'],
          totalDurationMinutes: 60,
          structure: [
            { exerciseId: 'squat', name: 'Squat', sets: 3, reps: '8-10', restSeconds: 120 },
            { exerciseId: 'bench', name: 'Bench', sets: 3, reps: '8-10', restSeconds: 120 },
            { exerciseId: 'row', name: 'Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { exerciseId: 'curl', name: 'Curl', sets: 2, reps: '12-15', restSeconds: 60 },
          ],
        },
      ];
    },
  };

  (generator as any).weeklyWorkoutGenerator = mockWeeklyWorkoutGenerator;

  const trainingSplit = buildTrainingSplit();
  const userProfile = buildUserProfile();
  const weeklyOutlines = buildWeeklyOutlines(12);

  const { sessionsByWeek } = await (generator as any).generateSessionTemplates(
    trainingSplit,
    userProfile,
    { useCoT: false },
    weeklyOutlines,
    { weightKg: 80, tdee: 2500 }
  );

  if (aiCalls > 3) {
    throw new Error(`Expected <= 3 AI workout calls with phase caching, got ${aiCalls}`);
  }

  const templateIds = sessionsByWeek.flat().map((s: SessionTemplate) => s.templateId);
  const unique = new Set(templateIds);
  if (unique.size !== templateIds.length) {
    throw new Error(`Expected unique templateIds per week; got duplicates: ${templateIds.join(', ')}`);
  }

  console.log(`✅ Phase caching used (${aiCalls} AI calls, ${templateIds.length} sessions)`);
};

run().catch((err) => {
  console.error('❌ PhaseCachedWorkouts test failed');
  console.error(err);
  process.exit(1);
});

