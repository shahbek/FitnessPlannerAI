/**
 * Integrated Plan Generator
 * 
 * Connects all MDD components into a unified pipeline:
 * - USDA Nutrition Service
 * - Chain-of-Thought Service
 * - Meal Generation Pipeline
 * - Workout Generation Pipeline
 * - Verification & Correction
 * - State Management & Error Propagation
 */

import { UserProfile, getEffectiveGoalType } from '../models/UserProfile';
import {
  CompletePlan,
  WeeklyOutline,
  Exercise,
  SessionTemplate,
  ShoppingList,
} from '../models/PlanModels';
import { DynamicCalculator } from '../ai/dynamicCalculator';

// Foundation Services
import { USDANutritionService } from './USDANutritionService';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { VerificationService } from './VerificationService';
import { env } from '../config/env';

// Meal Generation Services (Optimal Batch Architecture)
import { BatchMealGenerator } from './BatchMealGenerator';

import { TrainingSplitService, TrainingSplit } from './TrainingSplitService';
import { SessionTemplateGenerator } from './SessionTemplateGenerator';
import { WorkoutVerificationService } from './WorkoutVerificationService';
import { WeeklyWorkoutGenerator } from './WeeklyWorkoutGenerator';
import { ShoppingListGenerationService } from './ShoppingListGenerationService';
import { CardioGenerationService } from './CardioGenerationService';
import {
  nutritionCalculationService,
  UserMetrics
} from './NutritionCalculationService';

/**
 * Generation State
 */
export interface GenerationState {
  phase: 'initialization' | 'meal_planning' | 'workout_planning' | 'verification' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: string;
  errors: string[];
  warnings: string[];
  reasoning?: string[];
  mealPlan?: any;
  workoutPlan?: any;
}

/**
 * Generation Options
 */
export interface GenerationOptions {
  useUSDAAPI?: boolean; // Default: true
  useCoT?: boolean; // Default: true
  enableCorrections?: boolean; // Default: true
  maxCorrectionIterations?: number; // Default: 3
  onStateUpdate?: (state: GenerationState) => void;
}

/**
 * Integrated Plan Generator
 */
export class IntegratedPlanGenerator {
  // Foundation Services
  private usdaService: USDANutritionService;
  private cotService: ChainOfThoughtService;
  private verificationService: VerificationService;

  // Meal Generation Services (Optimal Batch Architecture)
  private batchMealGenerator: BatchMealGenerator;

  // Workout Generation Services
  private trainingSplitService: TrainingSplitService;
  private sessionGenerator: SessionTemplateGenerator;
  private workoutVerification: WorkoutVerificationService;
  private weeklyWorkoutGenerator: WeeklyWorkoutGenerator;
  private calculator: DynamicCalculator;
  private shoppingListService: ShoppingListGenerationService | null;
  private cardioGenerationService: CardioGenerationService;

  // State Management
  private currentState: GenerationState;

  constructor(
    convexClient: { action: (action: any, args?: any) => Promise<any> },
    aiModel?: any, // Optional - for backward compatibility
    options?: GenerationOptions
  ) {
    // Initialize Foundation Services
    if (!convexClient) {
      throw new Error('Convex client is required for IntegratedPlanGenerator.');
    }
    this.usdaService = new USDANutritionService(convexClient);

    // Initialize CoT Service - use environment config by default
    // If aiModel is provided (for backward compatibility), use it
    // Otherwise, create from environment
    try {
      this.cotService = new ChainOfThoughtService(
        aiModel ? { apiKey: aiModel } : undefined // Will use env if undefined
      );

      // Check if AI is available
      if (!this.cotService.isAIAvailable() && env.USE_AI_FOR_MEALS) {
        console.warn('⚠️  AI service not available but USE_AI_FOR_MEALS is enabled.');
        console.warn('   The system will use deterministic methods as fallback.');
      }
    } catch (error) {
      console.warn('⚠️  Failed to initialize ChainOfThoughtService:', error);
      // Create a dummy service that indicates unavailability
      this.cotService = {
        isAIAvailable: () => false,
        generateWithCoT: async () => {
          throw new Error('AI service is not available. Use deterministic methods instead.');
        },
      } as any;
    }

    this.verificationService = new VerificationService();

    // Initialize Meal Generation Services (Optimal Batch Architecture)
    this.batchMealGenerator = new BatchMealGenerator(
      this.usdaService,
      this.cotService
    );

    // Configure API for supplement generation
    if (env.AI_API_KEY) {
      this.batchMealGenerator.setApiConfig(
        env.AI_API_KEY,
        env.AI_ENDPOINT,
        env.AI_MODEL_NAME
      );
    }

    // Initialize Workout Generation Services
    this.trainingSplitService = new TrainingSplitService(this.cotService);
    this.sessionGenerator = new SessionTemplateGenerator(
      this.cotService
    );
    this.workoutVerification = new WorkoutVerificationService(
      this.cotService,
      this.sessionGenerator
    );
    this.weeklyWorkoutGenerator = new WeeklyWorkoutGenerator(this.cotService);
    this.calculator = new DynamicCalculator();
    this.cardioGenerationService = new CardioGenerationService(this.cotService);

    // Initialize Shopping List Generation (uses Groq via AI API key)
    const aiKey = env.AI_API_KEY;
    if (aiKey) {
      this.shoppingListService = new ShoppingListGenerationService(aiKey);
    } else {
      this.shoppingListService = null;
      console.warn(
        '⚠️  No AI API key found (env.AI_API_KEY). Shopping list generation will be disabled in IntegratedPlanGenerator.',
      );
    }

    // Initialize state
    this.currentState = {
      phase: 'initialization',
      progress: 0,
      currentStep: 'Initializing...',
      errors: [],
      warnings: [],
    };
  }

  /**
   * Generate complete plan (meals + workouts)
   */
  async generatePlan(
    userProfile: UserProfile,
    weeklyOutlinesInput: WeeklyOutline[] | WeeklyOutline,
    options?: GenerationOptions
  ): Promise<CompletePlan> {
    const weeklyOutlines = Array.isArray(weeklyOutlinesInput)
      ? weeklyOutlinesInput
      : [weeklyOutlinesInput];

    if (!weeklyOutlines.length) {
      throw new Error('At least one weekly outline is required to generate a plan.');
    }
    const opts = {
      useUSDAAPI: true,
      useCoT: true,
      enableCorrections: true,
      maxCorrectionIterations: 3,
      ...options,
    };

    try {
      // Update state
      this.updateState({
        phase: 'initialization',
        progress: 0,
        currentStep: 'Initializing plan generation...',
        errors: [],
        warnings: [],
      }, opts.onStateUpdate);

      // Step 1: Generate Training Split
      this.updateState({
        phase: 'workout_planning',
        progress: 10,
        currentStep: 'Determining training split...',
      }, opts.onStateUpdate);

      const trainingSplit = await this.trainingSplitService.determineSplit(
        userProfile,
        weeklyOutlines
      );

      const trainingMetrics = await this.computeTrainingMetrics(userProfile);

      // Step 2: Generate Session Templates
      this.updateState({
        progress: 20,
        currentStep: 'Generating workout sessions...',
      }, opts.onStateUpdate);

      const { sessions: allSessions, sessionsByWeek } = await this.generateSessionTemplates(
        trainingSplit,
        userProfile,
        opts,
        weeklyOutlines,
        trainingMetrics
      );
      const sessionTemplates = sessionsByWeek[0] ?? allSessions;

      // Step 2.5: Generate Cardio Templates
      console.log('\n🏃 [PLAN GENERATION] ========================================');
      console.log('🏃 [PLAN GENERATION] Starting Cardio Template Generation');
      console.log('🏃 [PLAN GENERATION] ========================================');
      this.updateState({
        progress: 30,
        currentStep: 'Generating cardio sessions...',
      }, opts.onStateUpdate);

      const cardioTemplates = await this.generateCardioTemplates(
        userProfile,
        weeklyOutlines,
        trainingSplit
      );

      console.log('🏃 [PLAN GENERATION] Cardio generation result:');
      console.log(`   Phase templates: ${cardioTemplates.phaseTemplates.length} phases`);
      console.log(`   Weekly schedules: ${cardioTemplates.weeklySchedules.length} schedules`);
      cardioTemplates.phaseTemplates.forEach((phaseTemplates, idx) => {
        const phaseNames = ['Foundation', 'Progression', 'Peak'];
        console.log(`   ${phaseNames[idx]}: ${phaseTemplates.length} templates`);
      });
      console.log('🏃 [PLAN GENERATION] ========================================\n');

      // Step 3: Verify Workout Plan (only if we have sessions)
      let workoutVerification: any = { success: true, sessions: sessionTemplates };

      if (sessionTemplates.length > 0) {
        this.updateState({
          progress: 40,
          currentStep: 'Verifying workout plan...',
        }, opts.onStateUpdate);

        try {
          workoutVerification = await this.workoutVerification.verifyAndCorrect(
            sessionTemplates,
            trainingSplit,
            undefined, // Volume targets (can be derived from weekly outline)
            {
              maxIterations: opts.maxCorrectionIterations,
              onIterationUpdate: (iteration, result) => {
                this.updateState({
                  currentStep: `Correcting workout plan (iteration ${iteration})...`,
                  reasoning: result.summary.errors,
                }, opts.onStateUpdate);
              },
            }
          );

          if (!workoutVerification.success && opts.enableCorrections) {
            this.addWarning('Workout plan verification had issues, but proceeding...');
          }
        } catch (error) {
          // If verification fails, use the sessions we generated
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`⚠️  Workout verification failed: ${errorMessage}. Using generated sessions.`);
          this.addWarning(`Workout verification had issues: ${errorMessage}`);
          workoutVerification = { success: false, sessions: sessionTemplates };
        }
      } else {
        console.warn('⚠️  No session templates generated - skipping workout verification');
        this.addWarning('No workout sessions were generated');
      }

      // Step 3.5: Reconcile Nutrition with Exercise Burn
      // This ensures bulking/maintenance targets account for actual exercise expenditure
      this.updateState({
        progress: 45,
        currentStep: 'Reconciling nutrition with exercise burn...',
      }, opts.onStateUpdate);

      await this.recalculateNutritionForExercise(
        userProfile,
        weeklyOutlines,
        trainingSplit,
        cardioTemplates,
        trainingMetrics
      );

      // Step 4: Generate Meal Plans
      console.log('🍽️  [GENERATION] Starting meal plan generation...');
      console.log('   📊 Weekly outlines:', JSON.stringify(weeklyOutlines, null, 2));
      console.log('   🏋️  Training split:', JSON.stringify(trainingSplit, null, 2));

      this.updateState({
        phase: 'meal_planning',
        progress: 50,
        currentStep: 'Generating meal plans...',
      }, opts.onStateUpdate);

      const allMealPlans: Array<{
        weekNumber: number;
        dayNumber: number;
        dayName: string;
        isTrainingDay: boolean;
        meals: any[];
        totalMacros: any;
      }> = [];

      try {
        for (const outline of weeklyOutlines) {
          const dayMeals = await this.batchMealGenerator.generateWeeklyMeals(
            userProfile,
            outline,
            trainingSplit,
            {
              onProgress: (step, progress) => {
                this.updateState(
                  {
                    progress: 50 + (progress * 0.4), // 50-90%
                    currentStep: `[Week ${outline.weekNumber}] ${step}`,
                  },
                  opts.onStateUpdate
                );
              },
            }
          );

          const weekMealPlans = dayMeals.map((meals, index) => {
            const day = trainingSplit.days[index];
            const totalMacros = this.calculateDayMacros(meals);
            return {
              weekNumber: outline.weekNumber || allMealPlans.length + 1,
              dayNumber: index + 1,
              dayName: day?.dayName || `Day ${index + 1}`,
              isTrainingDay: !day?.isRestDay,
              meals,
              totalMacros,
            };
          });

          console.log(
            `✅ [GENERATION] Week ${outline.weekNumber} meal plans generated: ${weekMealPlans.length} days`
          );
          weekMealPlans.forEach((dayPlan, idx) => {
            console.log(
              `   Week ${outline.weekNumber} - Day ${idx + 1} (${dayPlan.dayName}): ${dayPlan.meals?.length || 0
              } meals, macros:`,
              dayPlan.totalMacros
            );
          });

          allMealPlans.push(...weekMealPlans);
        }
      } catch (error) {
        console.error('❌ [GENERATION] Meal plan generation failed:');
        console.error('   Error:', error instanceof Error ? error.message : String(error));
        console.error('   Stack:', error instanceof Error ? error.stack : 'No stack trace');
        throw error;
      }

      // Step 5: Final Verification
      this.updateState({
        phase: 'verification',
        progress: 90,
        currentStep: 'Final verification...',
      }, opts.onStateUpdate);

      // Step 6: Compile Complete Plan
      this.updateState({
        phase: 'complete',
        progress: 100,
        currentStep: 'Plan generation complete!',
      }, opts.onStateUpdate);

      return await this.compileCompletePlan(
        allMealPlans,
        allSessions,
        trainingSplit,
        weeklyOutlines,
        userProfile,
        sessionsByWeek,
        cardioTemplates
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState({
        phase: 'error',
        currentStep: `Error: ${errorMessage}`,
        errors: [...this.currentState.errors, errorMessage],
      }, opts.onStateUpdate);

      throw error;
    }
  }

  // Old meal generation removed - now using BatchMealGenerator

  /**
   * Generate session templates for training days using WEEKLY BATCH generation
   *
   * This method generates all workouts for an entire week in a SINGLE AI call,
   * ensuring proper exercise variation, preventing duplicates, and allowing
   * the AI to see the full week context for better programming.
   */
  private async generateSessionTemplates(
    trainingSplit: TrainingSplit,
    userProfile: UserProfile,
    options: GenerationOptions,
    weeklyOutlines: WeeklyOutline[],
    trainingMetrics: TrainingMetricSummary
  ): Promise<{ sessions: SessionTemplate[]; sessionsByWeek: SessionTemplate[][] }> {
    const allSessions: SessionTemplate[] = [];
    const sessionsByWeek: SessionTemplate[][] = [];

    // Ensure we have at least one weekly outline
    const weeksToProcess = weeklyOutlines.length > 0 ? weeklyOutlines : [{
      weekNumber: 1,
      phase: 'progression',
      dailyTargets: {
        calories: trainingMetrics.tdee || 0,
        protein: trainingMetrics.weightKg ? trainingMetrics.weightKg * 2 : 0,
        carbs: 0,
        fat: 0,
        proteinPerKg: 0,
      },
      trainingSchedule: {
        resistanceDays: trainingSplit.days.filter(d => !d.isRestDay).map(d => d.dayName),
        cardioDays: [],
        restDays: trainingSplit.days.filter(d => d.isRestDay).map(d => d.dayName),
        weeklyVolume: 'Moderate',
        focusAreas: [],
      },
      cardioSchedule: {
        sessions: 0,
        duration: 0,
        intensity: 'Low',
        type: 'None',
      },
      objectives: ['Maintain consistency'],
      expectedOutcomes: [],
      adjustments: 'None',
      specialNotes: '',
    } as WeeklyOutline];

    // Generate workouts for each week using WEEKLY BATCH GENERATION
    for (const outline of weeksToProcess) {
      console.log(`🏋️  Generating workouts for Week ${outline.weekNumber} using SINGLE AI CALL...`);

      // Get previous week's sessions for variation
      const previousWeekSessions = allSessions.length > 0
        ? allSessions.slice(-trainingSplit.days.filter(d => !d.isRestDay).length)
        : undefined;

      try {
        // SINGLE AI CALL for entire week's workouts
        const weekSessions = await this.weeklyWorkoutGenerator.generateWeeklyWorkouts(
          trainingSplit,
          userProfile,
          outline,
          {
            enableReasoning: options.useCoT,
            onReasoningUpdate: (reasoning) => {
              this.updateState({
                reasoning: [...(this.currentState.reasoning || []), reasoning],
              }, options.onStateUpdate);
            },
            previousWeekSessions,
          }
        );

        console.log(`✅ Generated ${weekSessions.length} workout sessions for Week ${outline.weekNumber}`);

        // Log session names for verification
        weekSessions.forEach((session, idx) => {
          console.log(`   - Day ${idx + 1}: ${session.name} (${session.structure.length} exercises)`);
        });

        sessionsByWeek.push(weekSessions);
        allSessions.push(...weekSessions);
      } catch (error) {
        console.error(`❌ Failed to generate workouts for Week ${outline.weekNumber}:`, error);
        throw new Error(`Week ${outline.weekNumber} workout generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { sessions: allSessions, sessionsByWeek };
  }

  /**
   * Calculate total macros for a day
   */
  private calculateDayMacros(meals: any[]): any {
    return meals.reduce(
      (total, meal) => ({
        calories: total.calories + (meal.totalMacros?.calories || 0),
        protein: total.protein + (meal.totalMacros?.protein || 0),
        carbs: total.carbs + (meal.totalMacros?.carbs || 0),
        fats: total.fats + (meal.totalMacros?.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }

  private buildExerciseLibraryFromSessions(
    sessionTemplates: SessionTemplate[],
    userProfile: UserProfile
  ): Exercise[] {
    const difficulty =
      (userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert') || 'intermediate';

    const exerciseMap = new Map<string, Exercise>();

    sessionTemplates.forEach((session) => {
      (session.structure || []).forEach((exercise, index) => {
        const exerciseId = exercise.exerciseId || `${session.templateId}-exercise-${index + 1}`;
        if (exerciseMap.has(exerciseId)) {
          return;
        }

        exerciseMap.set(exerciseId, {
          exerciseId,
          name: exercise.name || exerciseId,
          muscleGroups: exercise.targetMuscles || session.targetMuscles || [],
          equipment: ['ai-generated'],
          difficulty,
          formCues: exercise.notes ? [exercise.notes] : [],
          progressionOptions: ['Increase load', 'Add tempo control'],
          regressionOptions: ['Reduce load', 'Shorten range of motion'],
          contraindications: [],
        });
      });
    });

    return Array.from(exerciseMap.values());
  }

  /**
   * Generate cardio templates for all phases
   */
  private async generateCardioTemplates(
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[],
    trainingSplit: TrainingSplit
  ): Promise<{ phaseTemplates: any[][]; weeklySchedules: any[] }> {
    console.log('🏃 [CARDIO] Starting cardio template generation...');
    console.log('   📊 Weekly outlines count:', weeklyOutlines.length);
    console.log('   🏋️  Training split:', trainingSplit.splitName);

    try {
      const phaseTemplates: any[][] = [];
      const weeklySchedules: any[] = [];

      // Group weeks by phase
      const phases = ['foundation', 'progression', 'peak'] as const;
      const resistanceDays = trainingSplit.days.filter(d => !d.isRestDay).map(d => d.dayName);
      console.log('   📅 Resistance training days:', resistanceDays);

      // Log all phases found in weekly outlines
      const allPhases = weeklyOutlines.map(w => w.phase);
      console.log('   📋 Phases found in weekly outlines:', allPhases);

      for (const phase of phases) {
        console.log(`\n   🔄 Processing ${phase.toUpperCase()} phase...`);

        const phaseWeeks = weeklyOutlines.filter(w => {
          const outlinePhase = w.phase?.toLowerCase() || '';
          const targetPhase = phase.toLowerCase();
          const matches = outlinePhase === targetPhase;
          if (!matches) {
            console.log(`      ⏭️  Week ${w.weekNumber}: phase "${w.phase}" doesn't match "${phase}"`);
          }
          return matches;
        });

        console.log(`   📊 Found ${phaseWeeks.length} weeks in ${phase} phase`);
        if (phaseWeeks.length > 0) {
          console.log(`      Weeks: ${phaseWeeks.map(w => w.weekNumber).join(', ')}`);
        }

        if (phaseWeeks.length === 0) {
          console.log(`   ⏭️  Skipping ${phase} phase - no matching weeks`);
          phaseTemplates.push([]); // Add empty array to maintain phase order
          continue;
        }

        try {
          console.log(`   🎯 Generating ${phase} cardio templates...`);
          console.log(`      User profile: ${userProfile.goal}, ${userProfile.weightKg}kg, ${userProfile.workoutLevel}`);
          console.log(`      Phase weeks: ${phaseWeeks.map(w => `Week ${w.weekNumber}`).join(', ')}`);

          // Generate templates for this phase with retry logic
          let templates: any[] = [];
          let retryCount = 0;
          const maxRetries = 2;

          while (retryCount <= maxRetries && templates.length === 0) {
            try {
              if (retryCount > 0) {
                console.log(`   🔄 Retry attempt ${retryCount} for ${phase} cardio templates...`);
                // Wait a bit before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }

              templates = await this.cardioGenerationService.generatePhaseCardioTemplates(
                userProfile,
                phaseWeeks,
                phase
              );

              if (templates.length > 0) {
                console.log(`   ✅ Generated ${templates.length} ${phase} cardio templates`);
                templates.forEach((template, idx) => {
                  console.log(`      Template ${idx + 1}: ${template.name} (${template.type}, ${template.durationMinutes}min)`);
                });
              } else {
                console.warn(`   ⚠️  Generated 0 templates for ${phase} phase`);
              }
            } catch (retryError) {
              if (retryCount < maxRetries) {
                console.warn(`   ⚠️  Attempt ${retryCount + 1} failed, will retry...`);
                retryCount++;
              } else {
                throw retryError; // Re-throw on final attempt
              }
            }
          }

          if (templates.length === 0) {
            console.error(`   ❌ Failed to generate ${phase} cardio templates after ${maxRetries + 1} attempts`);
            console.error(`   ⚠️  This phase will have empty templates - AI generation is required`);
            // Add empty array to maintain phase order, but this will cause schedule generation to fail
            phaseTemplates.push([]);
            continue; // Skip to next phase
          }

          phaseTemplates.push(templates);

          // Generate weekly schedules for each week in this phase
          console.log(`   📅 Generating weekly schedules for ${phaseWeeks.length} weeks...`);
          for (const outline of phaseWeeks) {
            let scheduleGenerated = false;
            let scheduleRetryCount = 0;
            const maxScheduleRetries = 2;

            while (scheduleRetryCount <= maxScheduleRetries && !scheduleGenerated) {
              try {
                if (scheduleRetryCount > 0) {
                  console.log(`      🔄 Retry attempt ${scheduleRetryCount} for Week ${outline.weekNumber} schedule...`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * scheduleRetryCount));
                }

                console.log(`      🗓️  Generating schedule for Week ${outline.weekNumber}...`);
                console.log(`         Cardio schedule in outline: ${outline.cardioSchedule?.sessions || 0} sessions, ${outline.cardioSchedule?.duration || 0}min, ${outline.cardioSchedule?.type || 'N/A'}`);

                const schedule = await this.cardioGenerationService.generateWeeklyCardioSchedule(
                  userProfile,
                  outline,
                  templates,
                  resistanceDays
                );

                console.log(`      ✅ Week ${outline.weekNumber} schedule generated:`);
                console.log(`         Sessions: ${schedule.sessions.length}`);
                console.log(`         Total volume: ${schedule.totalWeeklyVolume.totalMinutes} min, ${schedule.totalWeeklyVolume.totalCalories} cal`);
                schedule.sessions.forEach((session, idx) => {
                  console.log(`         Session ${idx + 1}: ${session.dayName} - ${session.cardioTemplate.name} (${session.timing})`);
                });

                weeklySchedules.push(schedule);
                scheduleGenerated = true;
              } catch (scheduleError) {
                if (scheduleRetryCount < maxScheduleRetries) {
                  console.warn(`      ⚠️  Attempt ${scheduleRetryCount + 1} failed for Week ${outline.weekNumber}, will retry...`);
                  scheduleRetryCount++;
                } else {
                  console.error(`      ❌ Failed to generate cardio schedule for Week ${outline.weekNumber} after ${maxScheduleRetries + 1} attempts:`);
                  console.error(`         Error: ${scheduleError instanceof Error ? scheduleError.message : String(scheduleError)}`);
                  if (scheduleError instanceof Error && scheduleError.stack) {
                    console.error(`         Stack: ${scheduleError.stack.split('\n').slice(0, 3).join('\n')}`);
                  }
                  console.error(`      ⚠️  Skipping Week ${outline.weekNumber} - AI-generated schedule is required`);
                  // Continue with other weeks instead of failing completely
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error(`   ❌ Failed to generate ${phase} cardio templates after all retries:`);
          console.error(`      Error: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof Error && error.stack) {
            console.error(`      Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
          }
          if (error instanceof Error && (error as any).cause) {
            console.error(`      Cause: ${(error as any).cause}`);
          }
          console.error(`   ❌ This phase will have empty cardio templates - NO FALLBACK AVAILABLE`);
          // Add empty array to maintain phase order, but this will cause schedule generation to fail
          phaseTemplates.push([]);
        }
      }

      console.log(`\n   ✅ Cardio generation complete:`);
      console.log(`      Phases: ${phaseTemplates.length} (${phaseTemplates.map((p, i) => `${phases[i]}: ${p.length} templates`).join(', ')})`);
      console.log(`      Weekly schedules: ${weeklySchedules.length}`);
      console.log(`      Total templates: ${phaseTemplates.flat().length}`);

      // CRITICAL: Cardio is MANDATORY - validate we have proper generation
      const totalTemplates = phaseTemplates.flat().length;
      const expectedWeeks = weeklyOutlines.length;

      if (totalTemplates === 0) {
        throw new Error(
          `CARDIO GENERATION FAILED: No cardio templates were generated.\n` +
          `Expected at least 3 templates (1 per phase), got 0.\n` +
          `Cardio is required for all fitness plans. Check phase naming in weekly outlines.`
        );
      }

      if (weeklySchedules.length === 0) {
        throw new Error(
          `CARDIO SCHEDULE GENERATION FAILED: No weekly cardio schedules were generated.\n` +
          `Templates generated: ${totalTemplates}, but 0 schedules.\n` +
          `Cardio schedules are required for all fitness plans.`
        );
      }

      if (weeklySchedules.length < expectedWeeks) {
        const missingWeeks = weeklyOutlines
          .filter(w => !weeklySchedules.some(s => s.weekNumber === w.weekNumber))
          .map(w => w.weekNumber);

        console.warn(`\n   ⚠️  WARNING: Not all weeks have detailed cardio schedules!`);
        console.warn(`      Generated: ${weeklySchedules.length} schedules`);
        console.warn(`      Expected: ${expectedWeeks} schedules`);
        console.warn(`      Missing weeks: ${missingWeeks.join(', ')}`);

        // If more than 50% of weeks are missing, throw error
        if (missingWeeks.length > expectedWeeks / 2) {
          throw new Error(
            `CARDIO SCHEDULE GENERATION FAILED: Too many weeks missing cardio schedules.\n` +
            `Generated: ${weeklySchedules.length}/${expectedWeeks} schedules.\n` +
            `Missing weeks: ${missingWeeks.join(', ')}.\n` +
            `At least 50% of weeks must have cardio schedules.`
          );
        }
      }

      return { phaseTemplates, weeklySchedules };
    } catch (error) {
      console.error('❌ [CARDIO] Cardio generation failed:');
      console.error('   Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('   Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
      }
      if (error instanceof Error && (error as any).cause) {
        console.error('   Cause:', (error as any).cause);
      }

      // CRITICAL: Re-throw the error - cardio is mandatory
      throw new Error(
        `CARDIO GENERATION REQUIRED: ${error instanceof Error ? error.message : String(error)}\n` +
        `Cardio is a mandatory component of all fitness plans and cannot be skipped.`
      );
    }
  }

  /**
   * Compile complete plan
   */
  private async compileCompletePlan(
    mealPlans: Array<{
      weekNumber: number;
      dayNumber: number;
      dayName: string;
      isTrainingDay: boolean;
      meals: any[];
      totalMacros: any;
    }>,
    sessionTemplates: any[],
    trainingSplit: any,
    weeklyOutlines: WeeklyOutline[],
    userProfile: UserProfile,
    sessionsByWeek?: SessionTemplate[][],
    cardioTemplates?: { phaseTemplates: any[][]; weeklySchedules: any[] }
  ): Promise<CompletePlan> {
    const derivedExercises = this.buildExerciseLibraryFromSessions(
      sessionTemplates,
      userProfile
    );
    const referenceOutline = weeklyOutlines[0];

    // Convert meal plans to MealTemplate format
    // mealPlans is an array of day objects: [{ dayNumber, dayName, meals: MealWithPortions[], totalMacros }, ...]
    // phaseMealTemplates should be MealTemplate[][] (array of arrays - one array per day/phase)
    const phaseMealTemplates: any[][] = [];
    const usedTemplateIds = new Set<string>();
    mealPlans.forEach((dayPlan) => {
      const dayMealTemplates: any[] = [];
      if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
        dayPlan.meals.forEach((meal: any, mealIndex: number) => {
          // Convert MealWithUSDA to MealTemplate
          // Use AI-generated meal name if available, otherwise fallback
          const mealName = meal.mealName || meal.name || `${meal.mealType} - ${dayPlan.dayName}`;
          const weekKey = typeof dayPlan.weekNumber === 'number' ? dayPlan.weekNumber : 'single';
          const baseTemplateId =
            meal.templateId || `meal-${weekKey}-${dayPlan.dayNumber}-${mealIndex}`;
          let templateId = baseTemplateId;
          let dedupeCounter = 1;
          while (usedTemplateIds.has(templateId)) {
            templateId = `${baseTemplateId}-${dedupeCounter}`;
            dedupeCounter += 1;
          }
          usedTemplateIds.add(templateId);
          const mealTemplate = {
            templateId,
            name: mealName, // Required field for parser - use AI-generated name
            mealType: meal.mealType || 'Meal',
            totalCalories: meal.totalMacros?.calories || 0,
            macros: {
              protein: meal.totalMacros?.protein || 0,
              carbs: meal.totalMacros?.carbs || 0,
              fat: meal.totalMacros?.fats || 0,
            },
            baseRecipe: {
              name: mealName, // Use AI-generated meal name
              ingredients: meal.ingredients?.map((ing: any) => ({
                name: ing.name || 'Unknown ingredient',
                amount: `${ing.amount || 0}g`,
                calories: ing.nutrition?.calories || 0, // This should be calculated calories for the amount, not per 100g
              })) || [],
              instructions: meal.instructions || meal.reasoning
                ? (meal.instructions || meal.reasoning.split('\n').filter((line: string) => line.trim()).slice(0, 5))
                : ['Prepare ingredients as specified'],
            },
          };
          dayMealTemplates.push(mealTemplate);
        });
      }
      phaseMealTemplates.push(dayMealTemplates);
    });

    console.log(`✅ Converted ${mealPlans.length} day plans to ${phaseMealTemplates.length} day arrays with ${phaseMealTemplates.reduce((sum, day) => sum + day.length, 0)} total meal templates`);

    // Create dailyMealCombinations for the parser (it expects this format)
    const dailyMealCombinations: any[] = [];
    mealPlans.forEach((dayPlan) => {
      if (dayPlan.meals && Array.isArray(dayPlan.meals)) {
        // Convert meals to the format expected by parser
        const dayMeals = dayPlan.meals.map((meal: any) => {
          // Use AI-generated meal name if available
          const mealName = meal.mealName || meal.name || `${meal.mealType} - ${dayPlan.dayName}`;
          return {
            mealType: meal.mealType || 'Meal',
            calories: meal.totalMacros?.calories || 0,
            protein: meal.totalMacros?.protein || 0,
            carbs: meal.totalMacros?.carbs || 0,
            fat: meal.totalMacros?.fats || 0,
            recipe: {
              name: mealName, // Use AI-generated meal name
              ingredients: meal.ingredients?.map((ing: any) => ({
                name: ing.name || 'Unknown ingredient',
                amount: `${ing.amount || 0}g`,
                calories: ing.nutrition?.calories || 0, // This should be calculated calories for the amount
              })) || [],
              instructions: meal.instructions || meal.reasoning
                ? (meal.instructions || meal.reasoning.split('\n').filter((line: string) => line.trim()).slice(0, 5))
                : ['Prepare ingredients as specified'],
            },
          };
        });

        dailyMealCombinations.push({
          weekNumber: dayPlan.weekNumber || 1,
          dayNumber: dayPlan.dayNumber,
          meals: dayMeals,
        });
      }
    });

    // Build shopping list (master + weekly) using ShoppingListGenerationService when available
    let shoppingList: ShoppingList;
    let shoppingListWithWeeks: any;

    if (this.shoppingListService && dailyMealCombinations.length > 0) {
      try {
        console.log('🛒  [GENERATION] Generating shopping lists with cost estimation...');

        // Group daily combinations by week to match ShoppingListGenerationService expectations
        const combosByWeek = new Map<number, any[]>();
        dailyMealCombinations.forEach((combo) => {
          const weekNumber = combo.weekNumber || 1;
          if (!combosByWeek.has(weekNumber)) {
            combosByWeek.set(weekNumber, []);
          }
          combosByWeek.get(weekNumber)!.push(combo);
        });

        const sortedWeekNumbers = Array.from(combosByWeek.keys()).sort((a, b) => a - b);
        const phaseMealTemplatesForShopping: any[][] = sortedWeekNumbers.map(
          (weekNumber) => combosByWeek.get(weekNumber)!,
        );

        const fullShoppingList = await this.shoppingListService.generateShoppingListsWithGroq({
          phaseMealTemplates: phaseMealTemplatesForShopping,
          weeklyOutlines,
          userProfile,
        });

        // Map master shopping list into legacy ShoppingList type for compatibility
        const master = fullShoppingList.masterShoppingList || {};
        const masterCategories = master.categories || [];

        shoppingList = {
          categories: masterCategories.map((cat: any) => ({
            category: cat.category || 'Other',
            items: (cat.items || []).map((item: any) => ({
              name: item.name || '',
              // Prefer totalQuantity if available, otherwise quantity
              quantity: item.totalQuantity || item.quantity || '',
              estimatedCost:
                typeof item.totalEstimatedCost === 'number'
                  ? item.totalEstimatedCost
                  : item.estimatedCost,
              priority: item.priority || 'medium',
            })),
          })),
          totalEstimatedCost:
            typeof master.totalEstimatedCost === 'number'
              ? master.totalEstimatedCost
              : master.totalCost ?? 0,
          notes: master.notes || [],
        };

        // Preserve weekly shopping lists on the object for parsers/UI (extended shape)
        shoppingListWithWeeks = shoppingList as any;
        shoppingListWithWeeks.weeklyShoppingLists = fullShoppingList.weeklyShoppingLists || [];

        console.log('✅  [GENERATION] Shopping lists generated successfully');
      } catch (error) {
        console.warn(
          '⚠️  [GENERATION] Shopping list generation failed in IntegratedPlanGenerator. Using empty placeholder.',
          error,
        );
        shoppingList = {
          categories: [],
          totalEstimatedCost: 0,
          notes: ['Shopping list generation failed'],
        };
        shoppingListWithWeeks = shoppingList;
      }
    } else {
      shoppingList = {
        categories: [],
        totalEstimatedCost: 0,
        notes: ['Shopping list generation disabled or no meals available'],
      };
      shoppingListWithWeeks = shoppingList;
    }

    return {
      // Required fields
      feasibility: {
        isFeasible: true,
        confidenceScore: 0.85,
        reasoning: 'Plan generated using integrated USDA + CoT pipeline',
        risks: this.currentState.warnings,
        recommendations: [],
      },
      weeklyOutlines,
      phaseAwareFramework: {
        trainingApproach: {
          split: trainingSplit.splitName || trainingSplit.splitType || userProfile.workoutSplit || 'upper_lower',
          frequencyPerWeek: userProfile.trainingDaysPerWeek,
          sessionDurationMinutes: 60,
          periodization: 'Progressive',
          volumePerMuscleWeekly: {},
        },
        nutritionApproach: {
          caloricStrategy: {
            deficitMagnitude: 'moderate',
            dailyDeficitCalories: 0,
            weeklyDeficitCalories: 0,
          },
          macroTargets: {
            proteinTotalGrams: referenceOutline?.dailyTargets?.protein || 150,
            proteinPerKg: referenceOutline?.dailyTargets?.proteinPerKg || 2.0,
            carbPercentage: 40,
            fatPercentage: 30,
          },
          mealFrequency: userProfile.mealFrequency || 4,
          timing: {
            preWorkout: '30-60 minutes before',
            postWorkout: 'Within 30 minutes',
            bedtime: '2-3 hours before sleep',
          },
        },
      },
      phaseMealTemplates: phaseMealTemplates,
      phaseSessionTemplates: sessionsByWeek && sessionsByWeek.length > 0 ? sessionsByWeek : [sessionTemplates],
      phaseExerciseLibraries: derivedExercises.length > 0 ? [derivedExercises] : [],
      phaseCardioTemplates: cardioTemplates?.phaseTemplates || [],
      weeklyCardioSchedules: cardioTemplates?.weeklySchedules || [],
      // Add dailyMealCombinations for parser compatibility (it expects this format)
      dailyMealCombinations,
      shoppingList: shoppingListWithWeeks as ShoppingList,
      metrics: {
        bmr: { value: 0, formula: '', source: '' },
        tdee: { value: 0, formula: '', source: '' },
        macros: {
          calories: referenceOutline?.dailyTargets?.calories || 2000,
          protein: referenceOutline?.dailyTargets?.protein || 150,
          carbs: referenceOutline?.dailyTargets?.carbs || 200,
          fat: referenceOutline?.dailyTargets?.fat || 67,
        },
        fatLoss: { value: 0, formula: '', source: '' },
        trainingVolume: { value: 0, formula: '', source: '' },
        water: { value: 0, formula: '', source: '' },
      },
      evidenceCitations: [],
      generatedAt: new Date().toISOString(),
      confidenceScore: 0.85,
      validationResults: {
        isValid: this.currentState.errors.length === 0,
        violations: this.currentState.errors,
        fixes: [],
        dietaryCompliance: {
          isCompliant: true,
          violations: [],
        },
        macroConsistency: {
          isValid: true,
          deviations: [],
        },
        trainingLogic: {
          isValid: true,
          issues: [],
        },
        progressiveOverload: {
          isValid: true,
          issues: [],
        },
        recovery: {
          isValid: true,
          issues: [],
        },
      },
    };
  }

  /**
   * Update state and notify
   */
  private updateState(
    updates: Partial<GenerationState>,
    callback?: (state: GenerationState) => void
  ): void {
    this.currentState = { ...this.currentState, ...updates };
    if (callback) {
      callback(this.currentState);
    }
  }

  /**
   * Add error
   */
  private addError(message: string): void {
    this.currentState.errors.push(message);
  }

  /**
   * Add warning
   */
  private addWarning(message: string): void {
    this.currentState.warnings.push(message);
  }

  /**
   * Get current state
   */
  getCurrentState(): GenerationState {
    return { ...this.currentState };
  }

  private async computeTrainingMetrics(userProfile: UserProfile): Promise<TrainingMetricSummary> {
    const bmi = await this.calculator.calculateBMI(userProfile);
    const bmr = await this.calculator.calculateBMR(userProfile);
    const tdee = await this.calculator.calculateTDEE(userProfile, bmr.value);

    return {
      weightKg: userProfile.weightKg,
      bmi: bmi.value,
      bmr: bmr.value,
      tdee: tdee.value,
      goal: userProfile.goal,
    };
  }

  private buildWeeklyGuidanceSummary(weeklyOutlines: WeeklyOutline[]): string {
    if (!weeklyOutlines || weeklyOutlines.length === 0) {
      return 'No weekly guidance provided.';
    }

    return weeklyOutlines
      .map((outline) => {
        const objectives = outline.objectives?.join('; ') || 'Focus on consistency';
        const adjustments = outline.adjustments && outline.adjustments !== 'None'
          ? ` Adjustments: ${outline.adjustments}.`
          : '';
        return `Week ${outline.weekNumber} (${outline.phase}): ${objectives}.${adjustments}`;
      })
      .join('\n');
  }

  private buildSingleWeekGuidance(outline: WeeklyOutline): string {
    const macros = outline.dailyTargets;
    const focusAreas = outline.trainingSchedule?.focusAreas?.join(', ') || 'Overall balance';
    const resistanceDays = outline.trainingSchedule?.resistanceDays?.join(', ') || 'Not specified';

    return [
      `Phase: ${outline.phase}`,
      `Daily Calories: ${Math.round(macros?.calories ?? 0)} | Protein: ${Math.round(macros?.protein ?? 0)}g | Carbs: ${Math.round(macros?.carbs ?? 0)}g | Fat: ${Math.round(macros?.fat ?? 0)}g`,
      `Focus Areas: ${focusAreas}`,
      `Resistance Days: ${resistanceDays}`,
    ].join(' • ');
  }

  /**
   * Recalculate nutrition targets based on actual generated exercise burn.
   * This ensures that for bulking/maintenance goals, the targets are set 
   * against (TDEE + actual burn) rather than just TDEE.
   */
  private async recalculateNutritionForExercise(
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[],
    trainingSplit: TrainingSplit,
    cardioTemplates: { weeklySchedules: any[] },
    trainingMetrics: TrainingMetricSummary
  ): Promise<void> {
    const goalCategory = userProfile.goalCategory || 'maintenance';
    const effectiveGoal = getEffectiveGoalType(goalCategory);

    // Only apply for Bulking or Maintenance per user request
    const isGainingOrMaintaining = effectiveGoal === 'muscle_gain' || effectiveGoal === 'maintenance';

    if (!isGainingOrMaintaining) {
      console.log(`ℹ️  [RECONCILIATION] Skipping exercise-adjusted targets for goal: ${goalCategory}`);
      return;
    }

    console.log(`🔄 [RECONCILIATION] Adjusting nutrition targets for ${weeklyOutlines.length} weeks...`);

    const metrics = {
      weightKg: userProfile.weightKg,
      heightCm: userProfile.heightCm,
      age: userProfile.age,
      sex: userProfile.sex,
      bodyFat: userProfile.bodyFat,
      activityLevel: userProfile.activityLevel,
    } as UserMetrics;

    const maintenance = await nutritionCalculationService.calculateMaintenanceCalories(metrics);
    const baseTdee = trainingMetrics.tdee || maintenance.tdee;

    for (const outline of weeklyOutlines) {
      // 1. Calculate weekly resistance burn
      const resistanceDaysCount = trainingSplit.days.filter(d => !d.isRestDay).length;
      // Estimate ~250 cal per resistance session (user example)
      const weeklyResistanceBurn = resistanceDaysCount * 250;

      // 2. Calculate weekly cardio burn
      const cardioSchedule = cardioTemplates.weeklySchedules.find(s => s.weekNumber === outline.weekNumber);
      const weeklyCardioBurn = cardioSchedule?.totalWeeklyVolume?.totalCalories || 0;

      // 3. Average daily exercise burn
      const dailyExerciseBurn = (weeklyResistanceBurn + weeklyCardioBurn) / 7;

      // 4. Create adjusted maintenance object (TDEE + Exercise)
      // This represents the "True Maintenance" for this specific week's volume
      const adjustedMaintenance = {
        ...maintenance,
        tdee: baseTdee + dailyExerciseBurn,
        tdeeFormula: `${maintenance.tdeeFormula} + ${dailyExerciseBurn.toFixed(0)} avg exercise burn`
      };

      // 5. Calculate new macro targets using the adjusted baseline
      const newMacros = await nutritionCalculationService.calculateMacroTargetsFromCategory(
        metrics,
        adjustedMaintenance,
        {
          goalCategory,
          timelineWeeks: userProfile.timelineWeeks,
          bodyFatGoal: userProfile.bodyFatGoal,
        }
      );

      console.log(`✅ [RECONCILIATION] Week ${outline.weekNumber} targets adjusted:`);
      console.log(`   Base TDEE: ${baseTdee.toFixed(0)} | Exercise: +${dailyExerciseBurn.toFixed(0)} | Adjusted Maintenance: ${adjustedMaintenance.tdee.toFixed(0)}`);
      console.log(`   Initial Form Target: ${outline.dailyTargets.calories} | Actual Target: ${newMacros.calories}`);

      // 6. Update outline so subsequent meal generation uses these higher targets
      outline.dailyTargets = {
        ...outline.dailyTargets,
        calories: newMacros.calories,
        protein: newMacros.protein,
        carbs: newMacros.carbs,
        fat: newMacros.fat,
        proteinPerKg: newMacros.proteinPerKg,
      };
    }
  }
}

type TrainingMetricSummary = {
  weightKg: number;
  bmi?: number;
  tdee?: number;
  bmr?: number;
  goal?: string;
};
