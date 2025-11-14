/**
 * Integration Tests for Workout Generation Pipeline
 *
 * Verifies the AI-only workout flow:
 * 1. Training split determination
 * 2. Session template generation (six fully described exercises)
 * 3. Weekly workout verification
 *
 * Run with: tsx src/tests/integration/WorkoutGenerationPipeline.test.ts
 */

import { config } from 'dotenv';
import { TrainingSplitService } from '../../services/TrainingSplitService';
import { SessionTemplateGenerator } from '../../services/SessionTemplateGenerator';
import { WorkoutVerificationService } from '../../services/WorkoutVerificationService';
import { UserProfile } from '../../models/UserProfile';
import { ChainOfThoughtService } from '../../services/ChainOfThoughtService';

config();

async function runTests() {
  console.log('🧪 Testing Workout Generation Pipeline Integration');
  console.log('================================================\n');

  const cotProvider = createCoTProvider();
  const trainingSplitService = new TrainingSplitService(cotProvider as any);
  const sessionGenerator = new SessionTemplateGenerator(cotProvider as any);
  const workoutVerification = new WorkoutVerificationService(
    cotProvider as any,
    sessionGenerator
  );

  let passed = 0;
  let failed = 0;

  const logResult = (name: string, success: boolean, error?: unknown) => {
    if (success) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.error(`❌ ${name}`);
      if (error instanceof Error) {
        console.error(`   Error: ${error.message}`);
      } else {
        console.error(`   Error: ${String(error)}`);
      }
      failed++;
    }
  };

  const beginnerProfile: UserProfile = {
    age: 25,
    gender: 'male',
    height: 175,
    weight: 70,
    activityLevel: 'low',
    goal: 'weight_loss',
    workoutLevel: 'beginner',
    equipment: 'home',
    trainingDaysPerWeek: 3,
  };

  const intermediateProfile: UserProfile = {
    age: 30,
    gender: 'male',
    height: 180,
    weight: 75,
    activityLevel: 'moderate',
    goal: 'muscle_gain',
    workoutLevel: 'intermediate',
    equipment: 'full',
    trainingDaysPerWeek: 4,
  };

  try {
    const split = await trainingSplitService.determineSplit(beginnerProfile);

    if (split.days.length !== 7) {
      throw new Error(`Expected 7 days, got ${split.days.length}`);
    }

    const trainingDays = split.days.filter(d => !d.isRestDay);
    if (trainingDays.length !== beginnerProfile.trainingDaysPerWeek) {
      throw new Error(
        `Expected ${beginnerProfile.trainingDaysPerWeek} training days, got ${trainingDays.length}`
      );
    }

    const restDays = split.days.filter(d => d.isRestDay);
    if (restDays.length < 1) {
      throw new Error('At least one rest day required');
    }

    console.log(`   Split: ${split.splitName}`);
    console.log(`   Training days: ${trainingDays.length}`);
    console.log(`   Rest days: ${restDays.length}`);
    logResult('Training split service generates split for user', true);
  } catch (error) {
    logResult('Training split service generates split for user', false, error);
  }

  let baseSession = null;
  try {
    baseSession = await sessionGenerator.generateSessionTemplate(
      ['chest', 'back'],
      intermediateProfile,
      'progression'
    );

    if (!baseSession?.structure || baseSession.structure.length !== 6) {
      throw new Error('Session template must contain exactly 6 exercises');
    }

    baseSession.structure.forEach((exercise, index) => {
      if (!exercise.name) {
        throw new Error(`Exercise ${index + 1} missing name`);
      }
      if (!exercise.targetMuscles || exercise.targetMuscles.length === 0) {
        throw new Error(`Exercise ${exercise.name} missing target muscles`);
      }
      if (!exercise.reps || exercise.sets <= 0) {
        throw new Error(`Exercise ${exercise.name} missing set/rep scheme`);
      }
    });

    console.log(`   Generated session: ${baseSession.name}`);
    baseSession.structure.forEach((exercise) => {
      console.log(
        `   - ${exercise.name}: ${exercise.sets} sets × ${exercise.reps} (${exercise.targetMuscles?.join(', ')})`
      );
    });

    logResult('Session generator produces six detailed exercises with AI', true);
  } catch (error) {
    logResult('Session generator produces six detailed exercises with AI', false, error);
  }

  try {
    const split = await trainingSplitService.determineSplit(intermediateProfile);
    const trainingDays = split.days.filter(d => !d.isRestDay);

    const sessions = [];
    for (const day of trainingDays) {
      const focus = day.focus && day.focus.length > 0 ? day.focus : ['full_body'];
      const session = await sessionGenerator.generateSessionTemplate(
        focus,
        intermediateProfile,
        'progression'
      );

      sessions.push({
        ...session,
        templateId: `${session.templateId}-${day.dayName.toLowerCase()}`,
        name: `${day.dayName} Workout`,
      });
    }

    const verification = workoutVerification.verifyWeeklyWorkout(
      sessions as any,
      split
    );

    if (!verification.volumeVerification || !verification.recoveryVerification || !verification.muscleBalanceVerification) {
      throw new Error('Verification did not run properly');
    }

    const issues = [
      ...(verification.volumeVerification.issues || []),
      ...(verification.recoveryVerification.issues || []),
      ...(verification.muscleBalanceVerification.imbalances || []),
    ].filter(Boolean);

    console.log(`   Verification summary: ${verification.passed ? 'pass' : 'warnings only'}`);
    console.log(`   Rest days: ${verification.recoveryVerification.restDays}`);
    if (issues.length > 0) {
      console.log(`   ⚠️  Verification issues (${issues.length}):`);
      issues.forEach((issue) => console.log(`      - ${issue}`));
    }

    logResult('Workout verification checks volume and recovery', true);
  } catch (error) {
    logResult('Workout verification checks volume and recovery', false, error);
  }

  console.log('\n================================================');
  console.log(`Tests: ${passed + failed} total`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

function createCoTProvider() {
  const liveCoT = new ChainOfThoughtService();

  if (liveCoT.isAIAvailable()) {
    console.log('✅ Using live ChainOfThoughtService for workout pipeline tests');
    return liveCoT;
  }

  console.warn('⚠️  AI API key missing. Using deterministic mock ChainOfThoughtService for tests.');

  const mockSplit = {
    splitName: 'Mock AI Split',
    daysPerWeek: 4,
    days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((dayName, index) => ({
      dayNumber: index + 1,
      dayName,
      focus: index < 4 ? ['full_body'] : [],
      isRestDay: index >= 4,
      isCardioDay: false,
    })),
    reasoning: 'Mocked split for integration tests',
  };

  const mockSession = {
    templateId: 'mock-session',
    name: 'Mock Strength Session',
    exercises: [
      {
        exerciseId: 'mock-back-squat',
        name: 'Back Squat',
        primaryMuscles: ['quads', 'glutes', 'hamstrings'],
        sets: 4,
        reps: '8-10',
        restSeconds: 120,
        order: 1,
        notes: 'Keep chest tall and drive through heels',
      },
      {
        exerciseId: 'mock-bench-press',
        name: 'Barbell Bench Press',
        primaryMuscles: ['chest', 'shoulders', 'triceps'],
        sets: 4,
        reps: '8-10',
        restSeconds: 90,
        order: 2,
        notes: 'Control the descent and pause on the chest',
      },
      {
        exerciseId: 'mock-bent-row',
        name: 'Bent-Over Row',
        primaryMuscles: ['back', 'lats', 'biceps'],
        sets: 4,
        reps: '10',
        restSeconds: 90,
        order: 3,
        notes: 'Drive elbows back and squeeze shoulder blades',
      },
      {
        exerciseId: 'mock-lunge',
        name: 'Walking Lunge',
        primaryMuscles: ['glutes', 'hamstrings', 'quads'],
        sets: 3,
        reps: '12 each leg',
        restSeconds: 75,
        order: 4,
        notes: 'Keep long stride and tall torso',
      },
      {
        exerciseId: 'mock-overhead-press',
        name: 'Overhead Press',
        primaryMuscles: ['shoulders', 'triceps'],
        sets: 3,
        reps: '8-10',
        restSeconds: 90,
        order: 5,
        notes: 'Brace core and press straight overhead',
      },
      {
        exerciseId: 'mock-plank',
        name: 'Weighted Plank',
        primaryMuscles: ['core'],
        sets: 3,
        reps: '45 sec',
        restSeconds: 60,
        order: 6,
        notes: 'Maintain neutral spine and active glutes',
      },
    ],
    estimatedDuration: 60,
    totalVolume: {
      totalSets: 21,
      setsPerMuscleGroup: { quads: 7, chest: 4, back: 4, shoulders: 3, core: 3 },
    },
    reasoning: 'Mock reasoning',
  };

  return {
    isAIAvailable: () => true,
    async generateWithCoT(_prompt: string, schema: any) {
      const candidates = [mockSplit, mockSession];
      for (const candidate of candidates) {
        try {
          const parsed = schema.parse(candidate);
          return {
            result: parsed,
            reasoning: {
              steps: [],
              finalResult: 'mock-result',
            },
          };
        } catch {
          // Try next candidate
        }
      }

      throw new Error('Mock ChainOfThoughtService cannot satisfy requested schema.');
    },
  };
}

runTests().catch((error) => {
  console.error('Unhandled error while running tests:', error);
  process.exit(1);
});
