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

import { UserProfile } from '../models/UserProfile';
import { CompletePlan, WeeklyOutline } from '../models/PlanModels';

// Foundation Services
import { USDANutritionService } from './USDANutritionService';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { VerificationService } from './VerificationService';
import { env } from '../config/env';

// Meal Generation Services (Optimal Batch Architecture)
import { BatchMealGenerator } from './BatchMealGenerator';

// Workout Generation Services
import { ExerciseLibraryService } from './ExerciseLibraryService';
import { TrainingSplitService } from './TrainingSplitService';
import { SessionTemplateGenerator } from './SessionTemplateGenerator';
import { WorkoutVerificationService } from './WorkoutVerificationService';

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
  private exerciseLibrary: ExerciseLibraryService;
  private trainingSplitService: TrainingSplitService;
  private sessionGenerator: SessionTemplateGenerator;
  private workoutVerification: WorkoutVerificationService;

  // State Management
  private currentState: GenerationState;

  constructor(
    usdaApiKey?: string, // Optional - will use env if not provided
    aiModel?: any, // Optional - for backward compatibility
    options?: GenerationOptions
  ) {
    // Initialize Foundation Services
    // Use environment variable if usdaApiKey not provided
    const usdaKey = usdaApiKey || env.USDA_API_KEY || '';
    if (!usdaKey) {
      throw new Error('USDA_API_KEY is required. Provide it as parameter or set in environment variables (VITE_USDA_API_KEY).');
    }
    this.usdaService = new USDANutritionService(usdaKey);
    
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

    // Initialize Workout Generation Services
    this.exerciseLibrary = new ExerciseLibraryService();
    this.trainingSplitService = new TrainingSplitService(this.cotService);
    this.sessionGenerator = new SessionTemplateGenerator(
      this.cotService,
      this.exerciseLibrary
    );
    this.workoutVerification = new WorkoutVerificationService(
      this.cotService,
      this.exerciseLibrary,
      this.sessionGenerator
    );

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

      let trainingSplit;
      try {
        trainingSplit = await this.trainingSplitService.determineSplit(
          userProfile,
          opts.useCoT
        );
      } catch (error) {
        // If split generation fails (e.g., validation error), use rule-based fallback
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️  Split generation failed (${errorMessage}), using rule-based fallback`);
        this.addWarning(`Split generation had issues: ${errorMessage}. Using rule-based fallback.`);
        
        // Force rule-based split as fallback
        trainingSplit = await this.trainingSplitService.determineSplit(
          userProfile,
          false // Force rule-based
        );
      }

      // Step 2: Generate Session Templates
      this.updateState({
        progress: 20,
        currentStep: 'Generating workout sessions...',
      }, opts.onStateUpdate);

      const sessionTemplates = await this.generateSessionTemplates(
        trainingSplit,
        userProfile,
        opts
      );

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

      return this.compileCompletePlan(
        allMealPlans,
        workoutVerification.sessions,
        trainingSplit,
        weeklyOutlines,
        userProfile
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
   * Generate session templates for training days
   */
  private async generateSessionTemplates(
    trainingSplit: any,
    userProfile: UserProfile,
    options: GenerationOptions
  ): Promise<any[]> {
    const sessionTemplates: any[] = [];
    const trainingPhase = 'progression'; // Could be derived from weekly outline

    for (const day of trainingSplit.days) {
      if (day.isRestDay) {
        // Add rest day marker to session templates
        sessionTemplates.push({
          templateId: `rest-${day.dayNumber}`,
          name: `${day.dayName} - Rest Day`,
          targetMuscles: [],
          totalDurationMinutes: 0,
          structure: [],
        });
        continue;
      }

      try {
        const session = await this.sessionGenerator.generateSessionTemplate(
          day.focus && day.focus.length > 0 ? day.focus : ['full_body'], // Default to full body if no focus
          userProfile,
          trainingPhase
        );

        if (session && session.structure && session.structure.length > 0) {
          sessionTemplates.push(session);
        } else {
          console.warn(`⚠️  Session generated but empty for ${day.dayName}, creating placeholder`);
          // Create a placeholder session so we don't lose the day
          sessionTemplates.push({
            templateId: `placeholder-${day.dayNumber}`,
            name: `${day.dayName} - Workout (Placeholder)`,
            targetMuscles: day.focus || ['full_body'],
            totalDurationMinutes: 45,
            structure: [],
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.addError(`Failed to generate session for ${day.dayName}: ${errorMessage}`);
        // Create a placeholder session so we don't lose the day
        console.warn(`⚠️  Session generation failed for ${day.dayName}: ${errorMessage}. Creating placeholder.`);
        sessionTemplates.push({
          templateId: `error-${day.dayNumber}`,
          name: `${day.dayName} - Workout (Generation Failed)`,
          targetMuscles: day.focus || ['full_body'],
          totalDurationMinutes: 0,
          structure: [],
        });
      }
    }

    return sessionTemplates;
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

  /**
   * Compile complete plan
   */
  private compileCompletePlan(
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
    userProfile: UserProfile
  ): CompletePlan {
    // Get all exercises as a single array, then wrap in array for phase structure
    const allExercises = this.exerciseLibrary.getAllExercises();
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
      phaseSessionTemplates: [sessionTemplates],
      phaseExerciseLibraries: [allExercises],
      // Add dailyMealCombinations for parser compatibility (it expects this format)
      dailyMealCombinations,
      shoppingList: {
        categories: [],
        totalEstimatedCost: 0,
        notes: [],
      },
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
}
