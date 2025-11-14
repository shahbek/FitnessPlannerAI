/**
 * Weekly Workout Generation Integration Test
 *
 * Tests the new weekly batch workout generation system to ensure:
 * - All workouts for a week are generated in a single AI call
 * - Exercise variation exists between similar training days
 * - No duplicate sessions are created
 * - Progressive programming is maintained
 *
 * Run with: tsx src/tests/integration/WeeklyWorkoutGeneration.test.ts
 */

import { config } from 'dotenv';
import { WeeklyWorkoutGenerator } from '../../services/WeeklyWorkoutGenerator';
import { ChainOfThoughtService } from '../../services/ChainOfThoughtService';
import { TrainingSplitService } from '../../services/TrainingSplitService';
import { UserProfile } from '../../models/UserProfile';
import { WeeklyOutline, SessionTemplate } from '../../models/PlanModels';
import { env } from '../../config/env';

config();

async function runTests() {
  console.log('🧪 Testing Weekly Workout Generation (Single AI Call Per Week)');
  console.log('================================================================\n');

  if (!env.AI_API_KEY) {
    console.error('❌ AI_API_KEY not set. Cannot run AI-based tests.');
    process.exit(1);
  }

  const cotService = new ChainOfThoughtService();
  const weeklyWorkoutGenerator = new WeeklyWorkoutGenerator(cotService);
  const trainingSplitService = new TrainingSplitService(cotService);

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

  // Test user profile - Upper/Lower Split
  const userProfile = {
    age: 30,
    sex: 'male',
    gender: 'male',
    heightCm: 180,
    weightKg: 80,
    bodyFat: 15,
    goal: 'muscle_gain',
    timelineWeeks: 12,
    workoutLevel: 'intermediate',
    trainingDaysPerWeek: 4,
    workoutSplit: 'upper_lower',
    equipment: 'gym_membership',
    schedule: 'Monday, Tuesday, Thursday, Friday',
    dietaryRestrictions: [],
    mealFrequency: 4,
    activityLevel: 'moderate',
    preferences: '',
  } as UserProfile;

  // Test weekly outline
  const weeklyOutline: WeeklyOutline = {
    weekNumber: 1,
    phase: 'progression',
    dailyTargets: {
      calories: 2500,
      protein: 160,
      carbs: 250,
      fat: 80,
      proteinPerKg: 2.0,
    },
    trainingSchedule: {
      resistanceDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      cardioDays: [],
      restDays: ['Wednesday', 'Saturday', 'Sunday'],
      weeklyVolume: 'Moderate',
      focusAreas: ['Upper Body', 'Lower Body'],
    },
    cardioSchedule: {
      sessions: 0,
      duration: 0,
      intensity: 'Low',
      type: 'None',
    },
    objectives: ['Build strength', 'Increase muscle mass'],
    expectedOutcomes: ['Strength gains', 'Muscle hypertrophy'],
    adjustments: 'None',
    specialNotes: 'First week of program',
  };

  // Test 1: Generate complete week of workouts
  console.log('\n📋 Test 1: Generate Complete Week of Workouts\n');
  try {
    const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);
    console.log(`   Training Split: ${trainingSplit.splitName}`);
    console.log(`   Training Days: ${trainingSplit.days.filter(d => !d.isRestDay).length}\n`);

    const sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      weeklyOutline
    );

    const expectedSessions = trainingSplit.days.filter(d => !d.isRestDay).length;

    if (sessions.length === expectedSessions) {
      console.log(`   ✓ Generated ${sessions.length} sessions (expected ${expectedSessions})`);

      // Log all sessions
      sessions.forEach((session, idx) => {
        console.log(`\n   📝 Session ${idx + 1}: ${session.name} (${session.templateId})`);
        console.log(`      Duration: ${session.totalDurationMinutes} minutes`);
        console.log(`      Target: ${session.targetMuscles.join(', ')}`);
        console.log(`      Exercises (${session.structure.length}):`);
        session.structure.forEach((exercise, exIdx) => {
          console.log(
            `         ${exIdx + 1}. ${exercise.name} - ${exercise.sets}x${exercise.reps} (${exercise.restSeconds}s)`
          );
        });
      });

      // Validate structure
      const allValid = sessions.every(
        s =>
          s.templateId &&
          s.name &&
          s.structure.length >= 4 &&
          s.structure.length <= 8 &&
          s.structure.every(ex => ex.exerciseId && ex.name && ex.sets > 0 && ex.reps)
      );

      logResult('Generate complete week of workouts', allValid);
    } else {
      throw new Error(`Expected ${expectedSessions} sessions but got ${sessions.length}`);
    }
  } catch (error) {
    logResult('Generate complete week of workouts', false, error);
  }

  // Test 2: Ensure exercise variation between similar days
  console.log('\n📋 Test 2: Exercise Variation Between Similar Days\n');
  try {
    const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);
    const sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      weeklyOutline
    );

    // Group by focus
    const sessionsByFocus = new Map<string, SessionTemplate[]>();
    sessions.forEach(session => {
      const focusKey = session.targetMuscles.sort().join(',');
      if (!sessionsByFocus.has(focusKey)) {
        sessionsByFocus.set(focusKey, []);
      }
      sessionsByFocus.get(focusKey)!.push(session);
    });

    let hasVariation = true;
    for (const [focusKey, focusSessions] of sessionsByFocus.entries()) {
      if (focusSessions.length > 1) {
        console.log(`   Checking variation for focus: ${focusKey}`);
        console.log(`   Found ${focusSessions.length} sessions with this focus\n`);

        for (let i = 0; i < focusSessions.length - 1; i++) {
          for (let j = i + 1; j < focusSessions.length; j++) {
            const session1 = focusSessions[i];
            const session2 = focusSessions[j];

            const exercises1 = new Set(session1.structure.map(e => (e.name || '').toLowerCase()));
            const exercises2 = new Set(session2.structure.map(e => (e.name || '').toLowerCase()));

            const overlap = [...exercises1].filter(ex => exercises2.has(ex));
            const overlapPercentage = (overlap.length / Math.max(exercises1.size, exercises2.size)) * 100;

            console.log(`   "${session1.name}" vs "${session2.name}"`);
            console.log(`   Exercise overlap: ${overlapPercentage.toFixed(1)}%`);

            if (overlap.length > 0) {
              console.log(`   Overlapping: ${Array.from(overlap).join(', ')}\n`);
            }

            if (overlapPercentage >= 70) {
              hasVariation = false;
              console.warn(`   ⚠️  Too much overlap (${overlapPercentage.toFixed(1)}%)`);
            }
          }
        }
      }
    }

    logResult('Exercise variation between similar days', hasVariation);
  } catch (error) {
    logResult('Exercise variation between similar days', false, error);
  }

  // Test 3: No duplicate session IDs
  console.log('\n📋 Test 3: Unique Session IDs\n');
  try {
    const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);
    const sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      weeklyOutline
    );

    const templateIds = new Set<string>();
    let noDuplicates = true;

    sessions.forEach(session => {
      if (templateIds.has(session.templateId)) {
        noDuplicates = false;
        console.error(`   Duplicate templateId: ${session.templateId}`);
      }
      templateIds.add(session.templateId);
    });

    if (noDuplicates) {
      console.log(`   All ${sessions.length} session IDs are unique`);
    }

    logResult('No duplicate session IDs', noDuplicates);
  } catch (error) {
    logResult('No duplicate session IDs', false, error);
  }

  // Test 4: Proper volume distribution
  console.log('\n📋 Test 4: Volume Distribution\n');
  try {
    const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);
    const sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      weeklyOutline
    );

    const weeklyVolume = new Map<string, number>();

    sessions.forEach(session => {
      session.structure.forEach(exercise => {
        const muscles = exercise.targetMuscles || [];
        muscles.forEach(muscle => {
          const current = weeklyVolume.get(muscle) || 0;
          weeklyVolume.set(muscle, current + exercise.sets);
        });
      });
    });

    console.log('   Weekly Volume:');
    let allMusclesHaveVolume = true;
    for (const [muscle, sets] of weeklyVolume.entries()) {
      console.log(`      ${muscle}: ${sets} sets`);
      if (sets < 6) {
        allMusclesHaveVolume = false;
        console.warn(`      ⚠️  ${muscle} has low volume (< 6 sets)`);
      }
    }

    logResult('Proper volume distribution', allMusclesHaveVolume);
  } catch (error) {
    logResult('Proper volume distribution', false, error);
  }

  // Test 5: Progressive programming across weeks
  console.log('\n📋 Test 5: Progressive Programming (Week-to-Week Variation)\n');
  try {
    const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);

    console.log('   Generating Week 1...');
    const week1Sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      weeklyOutline
    );
    console.log(`   ✓ Week 1: ${week1Sessions.length} sessions\n`);

    console.log('   Generating Week 2 with Week 1 context...');
    const week2Outline = { ...weeklyOutline, weekNumber: 2 };
    const week2Sessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
      trainingSplit,
      userProfile,
      week2Outline,
      {
        previousWeekSessions: week1Sessions,
      }
    );
    console.log(`   ✓ Week 2: ${week2Sessions.length} sessions\n`);

    // Check variation
    const week1Exercises = new Set(
      week1Sessions.flatMap(s => s.structure.map(e => (e.name || '').toLowerCase()))
    );
    const week2Exercises = new Set(
      week2Sessions.flatMap(s => s.structure.map(e => (e.name || '').toLowerCase()))
    );

    const overlap = [...week1Exercises].filter(ex => week2Exercises.has(ex));
    const overlapPercentage = (overlap.length / week1Exercises.size) * 100;

    console.log(`   Week 1 exercises: ${week1Exercises.size}`);
    console.log(`   Week 2 exercises: ${week2Exercises.size}`);
    console.log(`   Overlap: ${overlapPercentage.toFixed(1)}%`);

    if (overlap.length > 0 && overlap.length <= 10) {
      console.log(`   Repeated: ${Array.from(overlap).join(', ')}`);
    }

    const hasProgression = overlapPercentage < 70;
    logResult('Progressive programming across weeks', hasProgression);
  } catch (error) {
    logResult('Progressive programming across weeks', false, error);
  }

  // Summary
  console.log('\n================================================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
