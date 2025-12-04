/**
 * Cardio Generation Debug Test
 * 
 * Tests the cardio generation system to see what data we get from AI.
 * Generates phase-specific cardio templates and weekly schedules.
 * 
 * Run with: tsx src/tests/manual/CardioGenerationDebug.ts
 */

import 'dotenv/config';
import { CardioGenerationService } from '../../services/CardioGenerationService';
import { ChainOfThoughtService } from '../../services/ChainOfThoughtService';
import { TrainingSplitService, TrainingSplit } from '../../services/TrainingSplitService';
import { UserProfile } from '../../models/UserProfile';
import { WeeklyOutline } from '../../models/PlanModels';
import { CardioTemplate, WeeklyCardioSchedule } from '../../models/CardioModels';

async function main() {
  console.log('🏃 Cardio Generation Debug Test');
  console.log('================================================================\n');

  // Check for required API keys
  const aiKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY;
  if (!aiKey) {
    console.error('❌ AI API key (VITE_GROQ_API_KEY, GROQ_API_KEY, or AI_API_KEY) is required.');
    process.exit(1);
  }

  const cotService = new ChainOfThoughtService();
  if (!cotService.isAIAvailable()) {
    console.error('❌ Chain-of-Thought service is not available. Ensure your AI API key is valid.');
    process.exit(1);
  }

  const cardioService = new CardioGenerationService(cotService);
  const trainingSplitService = new TrainingSplitService(cotService);

  // Test user profiles for different goals
  const testProfiles: Array<{ name: string; profile: UserProfile; outlines: WeeklyOutline[] }> = [
    {
      name: 'Fat Loss - Intermediate',
      profile: {
        age: 30,
        sex: 'male',
        gender: 'male',
        heightCm: 180,
        weightKg: 85,
        bodyFat: 20,
        targetBf: 12,
        goal: 'fat_loss',
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
      } as UserProfile,
      outlines: [
        {
          weekNumber: 1,
          phase: 'foundation',
          dailyTargets: {
            calories: 2200,
            protein: 187,
            carbs: 200,
            fat: 73,
            proteinPerKg: 2.2,
          },
          trainingSchedule: {
            resistanceDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
            cardioDays: ['Wednesday', 'Saturday'],
            restDays: ['Sunday'],
            weeklyVolume: 'Moderate',
            focusAreas: ['Fat loss', 'Muscle preservation'],
          },
          cardioSchedule: {
            sessions: 3,
            duration: 30,
            intensity: 'Moderate',
            type: 'HIIT',
          },
          objectives: ['Establish cardio routine', 'Build aerobic base'],
          expectedOutcomes: ['Improved cardiovascular fitness', 'Increased calorie burn'],
          adjustments: 'None',
          specialNotes: 'Foundation phase - gradual introduction',
        },
        {
          weekNumber: 6,
          phase: 'progression',
          dailyTargets: {
            calories: 2000,
            protein: 187,
            carbs: 150,
            fat: 67,
            proteinPerKg: 2.2,
          },
          trainingSchedule: {
            resistanceDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
            cardioDays: ['Wednesday', 'Saturday'],
            restDays: ['Sunday'],
            weeklyVolume: 'High',
            focusAreas: ['Fat loss', 'Muscle preservation'],
          },
          cardioSchedule: {
            sessions: 4,
            duration: 35,
            intensity: 'High',
            type: 'HIIT',
          },
          objectives: ['Increase cardio volume', 'Maximize calorie burn'],
          expectedOutcomes: ['Accelerated fat loss', 'Improved conditioning'],
          adjustments: 'Increased frequency and intensity',
          specialNotes: 'Progression phase - increased demands',
        },
        {
          weekNumber: 12,
          phase: 'peak',
          dailyTargets: {
            calories: 1800,
            protein: 187,
            carbs: 100,
            fat: 60,
            proteinPerKg: 2.2,
          },
          trainingSchedule: {
            resistanceDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
            cardioDays: ['Wednesday', 'Saturday', 'Sunday'],
            restDays: [],
            weeklyVolume: 'Very High',
            focusAreas: ['Maximum fat loss', 'Muscle preservation'],
          },
          cardioSchedule: {
            sessions: 5,
            duration: 40,
            intensity: 'Very High',
            type: 'HIIT',
          },
          objectives: ['Peak fat loss', 'Maintain muscle mass'],
          expectedOutcomes: ['Maximum fat loss', 'Peak conditioning'],
          adjustments: 'Maximum cardio volume',
          specialNotes: 'Peak phase - maximum effort',
        },
      ],
    },
    {
      name: 'Muscle Gain - Beginner',
      profile: {
        age: 25,
        sex: 'male',
        gender: 'male',
        heightCm: 175,
        weightKg: 70,
        bodyFat: 15,
        targetBf: 12,
        goal: 'muscle_gain',
        timelineWeeks: 16,
        workoutLevel: 'beginner',
        trainingDaysPerWeek: 3,
        workoutSplit: 'full_body',
        equipment: 'gym_membership',
        schedule: 'Monday, Wednesday, Friday',
        dietaryRestrictions: [],
        mealFrequency: 5,
        activityLevel: 'moderate',
        preferences: '',
      } as UserProfile,
      outlines: [
        {
          weekNumber: 1,
          phase: 'foundation',
          dailyTargets: {
            calories: 2800,
            protein: 140,
            carbs: 350,
            fat: 78,
            proteinPerKg: 2.0,
          },
          trainingSchedule: {
            resistanceDays: ['Monday', 'Wednesday', 'Friday'],
            cardioDays: ['Sunday'],
            restDays: ['Tuesday', 'Thursday', 'Saturday'],
            weeklyVolume: 'Moderate',
            focusAreas: ['Muscle growth', 'Strength'],
          },
          cardioSchedule: {
            sessions: 1,
            duration: 20,
            intensity: 'Low',
            type: 'LISS',
          },
          objectives: ['Build muscle', 'Minimal cardio interference'],
          expectedOutcomes: ['Muscle growth', 'Improved recovery'],
          adjustments: 'None',
          specialNotes: 'Minimal cardio for muscle gain',
        },
      ],
    },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testCase of testProfiles) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 Testing: ${testCase.name}`);
    console.log('='.repeat(70));

    try {
      // Generate training split
      const trainingSplit = await trainingSplitService.determineSplit(
        testCase.profile,
        testCase.outlines
      );
      console.log(`\n✅ Training Split: ${trainingSplit.splitName}`);
      console.log(`   Training Days: ${trainingSplit.days.filter(d => !d.isRestDay).length}`);

      const resistanceDays = trainingSplit.days.filter(d => !d.isRestDay).map(d => d.dayName);

      // Test each phase
      const phases = ['foundation', 'progression', 'peak'] as const;
      
      for (const phase of phases) {
        const phaseWeeks = testCase.outlines.filter(w => 
          w.phase.toLowerCase() === phase.toLowerCase()
        );

        if (phaseWeeks.length === 0) {
          console.log(`\n⏭️  Skipping ${phase} phase - no weeks in this phase`);
          continue;
        }

        console.log(`\n${'-'.repeat(70)}`);
        console.log(`🏋️  PHASE: ${phase.toUpperCase()}`);
        console.log('-'.repeat(70));

        totalTests++;

        try {
          // Generate phase-specific cardio templates
          console.log(`\n📝 Generating ${phase} cardio templates...`);
          const templates = await cardioService.generatePhaseCardioTemplates(
            testCase.profile,
            phaseWeeks,
            phase
          );

          console.log(`\n✅ Generated ${templates.length} cardio templates for ${phase} phase\n`);

          // Display each template in detail
          templates.forEach((template, idx) => {
            console.log(`\n   Template ${idx + 1}: ${template.name}`);
            console.log(`   ┌─────────────────────────────────────────────────────────`);
            console.log(`   │ ID: ${template.templateId}`);
            console.log(`   │ Type: ${template.type}`);
            console.log(`   │ Intensity: ${template.intensity}`);
            console.log(`   │ Duration: ${template.durationMinutes} minutes`);
            console.log(`   │ Difficulty: ${template.difficulty}`);
            console.log(`   │ Phase: ${template.phase}`);
            
            if (template.targetHeartRate) {
              console.log(`   │ Heart Rate: ${template.targetHeartRate.zone} (${template.targetHeartRate.min}-${template.targetHeartRate.max} bpm)`);
            }
            
            if (template.caloriesBurned) {
              console.log(`   │ Calories: ~${Math.round(template.caloriesBurned)} cal`);
            }
            
            console.log(`   │ Equipment: ${template.equipment.join(', ')}`);
            console.log(`   │ Recovery Time: ${template.recoveryTime} hours`);
            
            // Structure details
            if (template.structure) {
              console.log(`   │`);
              console.log(`   │ Structure:`);
              if (template.structure.warmup) {
                console.log(`   │   Warmup: ${template.structure.warmup.durationMinutes} min - ${template.structure.warmup.description}`);
              }
              
              if (template.structure.mainWorkout) {
                console.log(`   │   Main Workout Type: ${template.structure.mainWorkout.type}`);
                
                if (template.structure.mainWorkout.type === 'interval' && template.structure.mainWorkout.intervals) {
                  template.structure.mainWorkout.intervals.forEach((interval, i) => {
                    console.log(`   │     Interval ${i + 1}: ${interval.rounds} rounds`);
                    console.log(`   │       Work: ${interval.workDurationSeconds}s @ ${interval.intensity}`);
                    console.log(`   │       Rest: ${interval.restDurationSeconds}s`);
                    if (interval.description) {
                      console.log(`   │       ${interval.description}`);
                    }
                  });
                }
                
                if (template.structure.mainWorkout.type === 'steady' && template.structure.mainWorkout.steadyState) {
                  const ss = template.structure.mainWorkout.steadyState;
                  console.log(`   │     Steady State: ${ss.durationMinutes} min @ ${ss.intensity}`);
                  if (ss.description) {
                    console.log(`   │       ${ss.description}`);
                  }
                }
                
                if (template.structure.mainWorkout.type === 'progressive' && template.structure.mainWorkout.progressive) {
                  template.structure.mainWorkout.progressive.forEach((stage, i) => {
                    console.log(`   │     Stage ${i + 1}: ${stage.durationMinutes} min @ ${stage.intensity}`);
                    if (stage.description) {
                      console.log(`   │       ${stage.description}`);
                    }
                  });
                }
                
                if (template.structure.mainWorkout.type === 'circuit' && template.structure.mainWorkout.circuit) {
                  template.structure.mainWorkout.circuit.forEach((circuit, i) => {
                    console.log(`   │     Circuit ${i + 1}: ${circuit.exercise}`);
                    console.log(`   │       ${circuit.durationSeconds}s work / ${circuit.restSeconds}s rest`);
                    console.log(`   │       ${circuit.rounds} rounds`);
                  });
                }
              }
              
              if (template.structure.cooldown) {
                console.log(`   │   Cooldown: ${template.structure.cooldown.durationMinutes} min - ${template.structure.cooldown.description}`);
              }
              
              console.log(`   │   Total Duration: ${template.structure.totalDurationMinutes} minutes`);
            }
            
            // Progression/Regression
            if (template.progressionOptions.length > 0) {
              console.log(`   │`);
              console.log(`   │ Progression Options:`);
              template.progressionOptions.forEach(opt => {
                console.log(`   │   • ${opt}`);
              });
            }
            
            if (template.regressionOptions.length > 0) {
              console.log(`   │`);
              console.log(`   │ Regression Options:`);
              template.regressionOptions.forEach(opt => {
                console.log(`   │   • ${opt}`);
              });
            }
            
            // Form cues
            if (template.formCues.length > 0) {
              console.log(`   │`);
              console.log(`   │ Form Cues:`);
              template.formCues.forEach(cue => {
                console.log(`   │   • ${cue}`);
              });
            }
            
            // Contraindications
            if (template.contraindications.length > 0) {
              console.log(`   │`);
              console.log(`   │ Contraindications:`);
              template.contraindications.forEach(contra => {
                console.log(`   │   ⚠️  ${contra}`);
              });
            }
            
            if (template.notes) {
              console.log(`   │`);
              console.log(`   │ Notes: ${template.notes}`);
            }
            
            console.log(`   └─────────────────────────────────────────────────────────`);
          });

          // Generate weekly schedules for each week in this phase
          for (const outline of phaseWeeks) {
            console.log(`\n📅 Generating weekly schedule for Week ${outline.weekNumber}...`);
            
            try {
              const schedule = await cardioService.generateWeeklyCardioSchedule(
                testCase.profile,
                outline,
                templates,
                resistanceDays
              );

              console.log(`\n✅ Weekly Cardio Schedule for Week ${outline.weekNumber}:`);
              console.log(`   ┌─────────────────────────────────────────────────────────`);
              console.log(`   │ Week: ${schedule.weekNumber}`);
              console.log(`   │ Phase: ${schedule.phase}`);
              console.log(`   │`);
              console.log(`   │ Total Weekly Volume:`);
              console.log(`   │   Sessions: ${schedule.totalWeeklyVolume.sessions}`);
              console.log(`   │   Total Minutes: ${schedule.totalWeeklyVolume.totalMinutes}`);
              console.log(`   │   Total Calories: ~${Math.round(schedule.totalWeeklyVolume.totalCalories)} cal`);
              console.log(`   │`);
              console.log(`   │ Sessions (${schedule.sessions.length}):`);
              
              schedule.sessions.forEach((session, idx) => {
                const template = session.cardioTemplate;
                console.log(`   │`);
                console.log(`   │   Session ${idx + 1}:`);
                console.log(`   │     Day: ${session.dayName} (Day ${session.dayNumber})`);
                console.log(`   │     Template: ${template.name} (${template.templateId})`);
                console.log(`   │     Type: ${template.type}`);
                console.log(`   │     Intensity: ${template.intensity}`);
                console.log(`   │     Duration: ${template.durationMinutes} min`);
                console.log(`   │     Timing: ${session.timing}`);
                if (template.caloriesBurned) {
                  console.log(`   │     Calories: ~${Math.round(template.caloriesBurned)} cal`);
                }
                if (template.targetHeartRate) {
                  console.log(`   │     Heart Rate: ${template.targetHeartRate.zone} (${template.targetHeartRate.min}-${template.targetHeartRate.max} bpm)`);
                }
                if (session.notes) {
                  console.log(`   │     Notes: ${session.notes}`);
                }
              });
              
              console.log(`   │`);
              console.log(`   │ Progression Notes:`);
              console.log(`   │   ${schedule.progressionNotes}`);
              console.log(`   │`);
              console.log(`   │ Recovery Strategy:`);
              console.log(`   │   ${schedule.recoveryStrategy}`);
              console.log(`   └─────────────────────────────────────────────────────────`);

              // Validate schedule structure
              const isValid = 
                schedule.weekNumber === outline.weekNumber &&
                schedule.sessions.length === schedule.totalWeeklyVolume.sessions &&
                schedule.sessions.every(s => s.cardioTemplate) &&
                schedule.sessions.every(s => s.dayNumber >= 1 && s.dayNumber <= 7);

              if (isValid) {
                console.log(`\n✅ Schedule validation: PASSED`);
                passedTests++;
              } else {
                console.log(`\n❌ Schedule validation: FAILED`);
                console.log(`   Check: weekNumber, session count, template references, day numbers`);
              }

            } catch (error) {
              console.error(`\n❌ Failed to generate schedule for Week ${outline.weekNumber}:`, error);
            }
          }

          // Validate templates
          const templatesValid = templates.every(t => 
            t.templateId &&
            t.name &&
            t.type &&
            t.intensity &&
            t.durationMinutes > 0 &&
            t.structure &&
            t.structure.totalDurationMinutes > 0 &&
            t.equipment.length > 0 &&
            t.difficulty &&
            t.phase === phase
          );

          if (templatesValid) {
            console.log(`\n✅ Template validation: PASSED`);
            passedTests++;
          } else {
            console.log(`\n❌ Template validation: FAILED`);
            console.log(`   Check: templateId, name, type, intensity, duration, structure, equipment, difficulty, phase`);
          }

        } catch (error) {
          console.error(`\n❌ Failed to generate ${phase} templates:`, error);
          if (error instanceof Error) {
            console.error(`   Error: ${error.message}`);
            if (error.stack) {
              console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
            }
          }
        }
      }

    } catch (error) {
      console.error(`\n❌ Test case failed: ${testCase.name}`, error);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`📋 Total: ${totalTests}`);
  console.log(`📈 Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`);
  console.log('='.repeat(70));

  // Export sample data as JSON for inspection
  console.log(`\n💾 Sample Data Export`);
  console.log('='.repeat(70));
  console.log('\nTo inspect the full data structure, check the generated templates and schedules above.');
  console.log('All data follows the CardioTemplate and WeeklyCardioSchedule interfaces.\n');
}

main().catch((error) => {
  console.error('❌ Cardio generation debug test failed.');
  console.error(error);
  if (error instanceof Error && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});

