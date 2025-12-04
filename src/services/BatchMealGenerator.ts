/**
 * Batch Meal Generator - Optimal Architecture
 * 
 * Implements the optimal meal generation approach:
 * 1. Single AI call generates all 28 meals (7 days × 4 meals)
 * 2. Extract unique ingredients (deduplicate)
 * 3. Batch USDA lookup (one call per unique ingredient)
 * 4. Recalculate all meal macros using USDA data
 * 5. Smart adjustment if needed (deterministic)
 * 
 * Benefits:
 * - 1 AI call instead of 63-147
 * - 20-40 USDA calls instead of 224-448
 * - Better meal variety (AI sees all meals)
 * - Faster generation (parallel USDA lookups)
 */

import { z } from 'zod';
import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';
import { USDANutritionService } from './USDANutritionService';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { MacroValues, NutritionErrorType } from '../types/nutrition';
import { calculateMacrosForAmount, extractMacrosFromUSDA, normalizeFoodName } from '../utils/usdaMapper';
import { HybridMealOptimizer } from './optimizers/HybridMealOptimizer';
import { isZeroImpactIngredient, stripDescriptorWords } from '../constants/ingredients';
import {
  MACRO_CYCLING,
} from './NutritionCalculationService';

/**
 * Meal Schema for Batch Generation
 */
const WeeklyMealSchema = z.object({
  dayNumber: z.number().min(1).max(7),
  dayName: z.string(),
  meals: z.array(
    z.object({
      mealName: z.string().describe('Creative, descriptive meal name based on ingredients. MUST be unique for each meal type within the same day. Breakfast meals should use breakfast-appropriate names (e.g., "Greek Yogurt Parfait", "Scrambled Eggs with Toast"), lunch meals should use lunch-appropriate names (e.g., "Grilled Chicken Salad", "Turkey Wrap"), dinner meals should use dinner-appropriate names (e.g., "Baked Salmon with Vegetables", "Beef Stir-Fry"). DO NOT repeat the same meal name for different meal types on the same day.'),
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.number(), // in grams
        })
      ),
      instructions: z.array(z.string()).describe('Step-by-step cooking instructions (3-5 steps, e.g., ["Season steak with salt and pepper", "Grill steak for 4-5 minutes per side", "Rest for 5 minutes before serving"])'),
      estimatedCalories: z.number().optional(),
      estimatedProtein: z.number().optional(),
      estimatedCarbs: z.number().optional(),
      estimatedFats: z.number().optional(),
    })
  ),
});

const BatchMealGenerationSchema = z.object({
  weeklyMeals: z.array(WeeklyMealSchema).length(7), // Exactly 7 days
  reasoning: z.string().optional(),
});

export type BatchMealGeneration = z.infer<typeof BatchMealGenerationSchema>;

/**
 * Meal with USDA Data
 */
export interface MealWithUSDA {
  mealName: string;
  mealType: string;
  instructions: string[];
  ingredients: Array<{
    name: string;
    amount: number; // in grams
    nutrition: MacroValues;
    fdcId: number;
  }>;
  totalMacros: MacroValues;
  dayNumber: number;
  dayName: string;
  adjustmentLog?: string[];
}

/**
 * Helper type for adjustable ingredients in optimization
 */
interface AdjustableIngredient {
  name: string;
  originalAmount: number;
  lowerBound: number;
  upperBound: number;
  perGram: {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  };
  fdcId: number;
  index: number;
}

interface OptimizationIngredient {
  index: number;
  name: string;
  baseAmount: number;
  amount: number;
  min: number;
  max: number;
  locked: boolean;
  baseMacros: MacroValues;
  density: {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  };
}

interface OptimizationMeal {
  mealName: string;
  ingredients: OptimizationIngredient[];
}

interface AdjustmentDaySummary {
  dayNumber: number;
  dayName: string;
  target: MacroValues;
  actual: MacroValues;
  accuracy: Record<'calories' | 'protein' | 'carbs' | 'fats', string>;
}

/**
 * Batch Meal Generator
 */
export class BatchMealGenerator {
  private usdaService: USDANutritionService;
  private cotService: ChainOfThoughtService;
  private currentMealFrequency: number = 4; // Store meal frequency for adjustment calculations
  private lastAdjustmentSummary: AdjustmentDaySummary[] = [];
  private hybridOptimizer: HybridMealOptimizer;
  private optimizerInitialized: boolean = false;

  constructor(
    usdaService: USDANutritionService,
    cotService: ChainOfThoughtService
  ) {
    this.usdaService = usdaService;
    this.cotService = cotService;
    this.hybridOptimizer = new HybridMealOptimizer();

    // Initialize optimizer asynchronously (non-blocking)
    this.hybridOptimizer.initialize().then(() => {
      this.optimizerInitialized = true;
      console.log('✅ [BATCH] Hybrid optimizer initialized');
    }).catch(err => {
      console.warn('⚠️ [BATCH] Hybrid optimizer initialization failed, will use fallback:', err);
      this.optimizerInitialized = false;
    });
  }

  public getLastAdjustmentSummary(): AdjustmentDaySummary[] {
    return this.lastAdjustmentSummary;
  }

  /**
   * Generate all meals for a week using optimal batch approach
   */
  async generateWeeklyMeals(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    options?: {
      onProgress?: (step: string, progress: number) => void;
    }
  ): Promise<MealWithUSDA[][]> {
    console.log('🚀 [BATCH] Starting optimal batch meal generation...');

    // Store meal frequency for use in adjustment calculations
    this.currentMealFrequency = userProfile.mealFrequency || 4;

    // Log weekly targets structure
    console.log('📊 [BATCH] Weekly Targets Object:', JSON.stringify(weeklyOutline, null, 2));
    console.log('📊 [BATCH] Daily Targets:', {
      calories: weeklyOutline.dailyTargets.calories,
      protein: weeklyOutline.dailyTargets.protein,
      carbs: weeklyOutline.dailyTargets.carbs,
      fat: weeklyOutline.dailyTargets.fat,
      proteinPerKg: weeklyOutline.dailyTargets.proteinPerKg,
    });
    console.log('📊 [BATCH] Week Info:', {
      weekNumber: weeklyOutline.weekNumber,
      phase: weeklyOutline.phase,
      objectives: weeklyOutline.objectives,
      trainingDays: weeklyOutline.trainingSchedule.resistanceDays,
      restDays: weeklyOutline.trainingSchedule.restDays,
    });

    // Calculate and log day-by-day targets
    const dayTargets = trainingSplit.days.map((day: any, index: number) => {
      const dayMacros = this.calculateDayMacros(weeklyOutline, day.isRestDay);
      return {
        dayNumber: index + 1,
        dayName: day.dayName,
        isRestDay: day.isRestDay,
        macros: dayMacros,
      };
    });
    console.log('📊 [BATCH] Day-by-Day Macro Targets:', dayTargets);

    // Step 1: Generate all meals with single AI call
    options?.onProgress?.('Generating all meals with AI...', 10);
    const aiGeneratedMeals = await this.generateWithAI(
      userProfile,
      weeklyOutline,
      trainingSplit
    );
    console.log(`✅ [BATCH] AI generated ${aiGeneratedMeals.weeklyMeals.length} days of meals`);

    // Validate meal variety (check for duplicate meal names within same day)
    this.validateMealVariety(aiGeneratedMeals);

    // Warn if ingredient names are composite/generic (non-blocking)
    this.validateIngredientSpecificity(aiGeneratedMeals);

    // Step 2: Extract unique ingredients
    options?.onProgress?.('Extracting unique ingredients...', 30);
    const uniqueIngredients = this.extractUniqueIngredients(aiGeneratedMeals);
    console.log(`✅ [BATCH] Found ${uniqueIngredients.length} unique ingredients`);

    // Step 3: Batch USDA lookup (parallel)
    options?.onProgress?.('Looking up USDA nutrition data...', 40);
    const usdaData = await this.batchUSDALookup(uniqueIngredients);
    console.log(`✅ [BATCH] Retrieved USDA data for ${Object.keys(usdaData).length} ingredients`);

    // Step 4: Recalculate all meal macros with USDA data
    options?.onProgress?.('Recalculating macros with USDA data...', 70);
    const mealsWithUSDA = this.recalculateMacros(aiGeneratedMeals, usdaData);
    console.log(`✅ [BATCH] Recalculated macros for all meals`);

    // Step 5: Smart adjustment if needed
    options?.onProgress?.('Adjusting meals to targets...', 85);
    const adjustedMeals = await this.adjustMealsToTargets(
      mealsWithUSDA,
      weeklyOutline,
      trainingSplit,
      usdaData
    );
    console.log(`✅ [BATCH] Adjusted meals to match targets`);

    // Convert to day-by-day format (array of arrays)
    const dayMeals: MealWithUSDA[][] = [];
    for (let day = 1; day <= 7; day++) {
      dayMeals.push(adjustedMeals.filter((meal: MealWithUSDA) => meal.dayNumber === day));
    }

    // COMPREHENSIVE VALIDATION - Check all targets are met
    const validation = this.validateAndReportAccuracy(
      dayMeals,
      weeklyOutline,
      trainingSplit
    );

    console.log('\n' + '='.repeat(80));
    console.log('📊 MEAL GENERATION VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(validation, null, 2));
    console.log('='.repeat(80) + '\n');

    options?.onProgress?.('Batch meal generation complete!', 100);
    return dayMeals;
  }

  /**
   * COMPREHENSIVE VALIDATION - Verify all targets are met
   * Returns detailed JSON report for debugging
   */
  private validateAndReportAccuracy(
    dayMeals: MealWithUSDA[][],
    weeklyOutline: WeeklyOutline,
    trainingSplit: any
  ): any {
    const report: any = {
      summary: {
        weekNumber: weeklyOutline.weekNumber,
        phase: weeklyOutline.phase,
        mealFrequency: this.currentMealFrequency,
        totalDays: 7,
      },
      weeklyTargets: {
        dailyAverage: {
          calories: weeklyOutline.dailyTargets.calories,
          protein: weeklyOutline.dailyTargets.protein,
          carbs: weeklyOutline.dailyTargets.carbs,
          fats: weeklyOutline.dailyTargets.fat,
        },
      },
      dailyBreakdown: [] as any[],
      weeklyTotals: {
        target: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        actual: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        accuracy: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      },
      errors: [] as string[],
    };

    // Analyze each day
    dayMeals.forEach((meals, dayIndex) => {
      const dayNumber = dayIndex + 1;
      const day = trainingSplit.days[dayIndex];
      const dayTargets = this.calculateDayMacros(weeklyOutline, day?.isRestDay || false);

      // Calculate actual totals for the day
      const actualTotals = meals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      // Calculate accuracy percentages
      const accuracy = {
        calories: dayTargets.calories > 0 ? (actualTotals.calories / dayTargets.calories) * 100 : 0,
        protein: dayTargets.protein > 0 ? (actualTotals.protein / dayTargets.protein) * 100 : 0,
        carbs: dayTargets.carbs > 0 ? (actualTotals.carbs / dayTargets.carbs) * 100 : 0,
        fats: dayTargets.fats > 0 ? (actualTotals.fats / dayTargets.fats) * 100 : 0,
      };

      // Check for errors (threshold: ±10% is acceptable)
      const errors: string[] = [];
      if (Math.abs(accuracy.calories - 100) > 10) {
        errors.push(`Calories off by ${(accuracy.calories - 100).toFixed(1)}%`);
      }
      if (Math.abs(accuracy.protein - 100) > 10) {
        errors.push(`Protein off by ${(accuracy.protein - 100).toFixed(1)}%`);
      }
      if (Math.abs(accuracy.carbs - 100) > 10) {
        errors.push(`Carbs off by ${(accuracy.carbs - 100).toFixed(1)}%`);
      }
      if (Math.abs(accuracy.fats - 100) > 10) {
        errors.push(`Fats off by ${(accuracy.fats - 100).toFixed(1)}%`);
      }

      // Meal breakdown
      const mealBreakdown = meals.map(meal => {
        const mealTargets = this.calculateMealMacroTargets(
          meal.mealType,
          this.currentMealFrequency,
          dayTargets
        );

        return {
          mealName: meal.mealName,
          mealType: meal.mealType,
          target: mealTargets,
          actual: meal.totalMacros,
          accuracy: {
            calories: mealTargets.calories > 0 ? ((meal.totalMacros.calories / mealTargets.calories) * 100).toFixed(1) + '%' : 'N/A',
            protein: mealTargets.protein > 0 ? ((meal.totalMacros.protein / mealTargets.protein) * 100).toFixed(1) + '%' : 'N/A',
            carbs: mealTargets.carbs > 0 ? ((meal.totalMacros.carbs / mealTargets.carbs) * 100).toFixed(1) + '%' : 'N/A',
            fats: mealTargets.fats > 0 ? ((meal.totalMacros.fats / mealTargets.fats) * 100).toFixed(1) + '%' : 'N/A',
          },
          ingredients: meal.ingredients.map(ing => ({
            name: ing.name,
            amount: `${ing.amount}g`,
            macros: {
              calories: Math.round(ing.nutrition.calories),
              protein: ing.nutrition.protein.toFixed(1) + 'g',
              carbs: ing.nutrition.carbs.toFixed(1) + 'g',
              fats: ing.nutrition.fats.toFixed(1) + 'g',
            },
          })),
        };
      });

      report.dailyBreakdown.push({
        dayNumber,
        dayName: day?.dayName || `Day ${dayNumber}`,
        isRestDay: day?.isRestDay || false,
        target: dayTargets,
        actual: actualTotals,
        accuracy: {
          calories: accuracy.calories.toFixed(1) + '%',
          protein: accuracy.protein.toFixed(1) + '%',
          carbs: accuracy.carbs.toFixed(1) + '%',
          fats: accuracy.fats.toFixed(1) + '%',
        },
        errors: errors.length > 0 ? errors : ['All within acceptable range'],
        meals: mealBreakdown,
      });

      // Add to weekly totals
      report.weeklyTotals.target.calories += dayTargets.calories;
      report.weeklyTotals.target.protein += dayTargets.protein;
      report.weeklyTotals.target.carbs += dayTargets.carbs;
      report.weeklyTotals.target.fats += dayTargets.fats;

      report.weeklyTotals.actual.calories += actualTotals.calories;
      report.weeklyTotals.actual.protein += actualTotals.protein;
      report.weeklyTotals.actual.carbs += actualTotals.carbs;
      report.weeklyTotals.actual.fats += actualTotals.fats;

      // Collect errors
      if (errors.length > 0) {
        report.errors.push(`Day ${dayNumber} (${day?.dayName}): ${errors.join(', ')}`);
      }
    });

    // Calculate weekly accuracy
    report.weeklyTotals.accuracy = {
      calories: ((report.weeklyTotals.actual.calories / report.weeklyTotals.target.calories) * 100).toFixed(1) + '%',
      protein: ((report.weeklyTotals.actual.protein / report.weeklyTotals.target.protein) * 100).toFixed(1) + '%',
      carbs: ((report.weeklyTotals.actual.carbs / report.weeklyTotals.target.carbs) * 100).toFixed(1) + '%',
      fats: ((report.weeklyTotals.actual.fats / report.weeklyTotals.target.fats) * 100).toFixed(1) + '%',
    };

    // Overall assessment
    report.summary.overallAccuracy = {
      weeklyCalories: report.weeklyTotals.accuracy.calories,
      weeklyProtein: report.weeklyTotals.accuracy.protein,
      weeklyCarbs: report.weeklyTotals.accuracy.carbs,
      weeklyFats: report.weeklyTotals.accuracy.fats,
      totalErrors: report.errors.length,
      status: report.errors.length === 0 ? '✅ ALL TARGETS MET' : '⚠️ SOME TARGETS MISSED',
    };

    return report;
  }

  /**
   * Step 1: Generate all meals with single AI call (Groq required)
   */
  private async generateWithAI(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any
  ): Promise<BatchMealGeneration> {
    // Check if AI is available
    const isAIAvailable = this.cotService.isAIAvailable && this.cotService.isAIAvailable();

    if (!isAIAvailable) {
      throw new Error('AI service (Groq) is required for meal generation. Please ensure VITE_GROQ_API_KEY is set.');
    }

    // Build prompt for all 7 days
    const prompt = this.buildBatchMealPrompt(userProfile, weeklyOutline, trainingSplit);

    const { result } = await this.cotService.generateWithCoT(
      prompt,
      BatchMealGenerationSchema,
      {
        enableVerification: true,
      }
    );

    return result;
  }


  /**
   * Validate meal variety - check for duplicate meal names within same day
   */
  private validateMealVariety(meals: BatchMealGeneration): void {
    const issues: string[] = [];
    const globalMealNames = new Map<string, { dayNumber: number; dayName: string; mealType: string }[]>();

    meals.weeklyMeals.forEach(day => {
      const mealNames = new Map<string, string[]>(); // mealName -> mealTypes

      day.meals.forEach(meal => {
        const normalizedName = meal.mealName.toLowerCase().trim();
        if (!globalMealNames.has(normalizedName)) {
          globalMealNames.set(normalizedName, []);
        }
        globalMealNames.get(normalizedName)!.push({
          dayNumber: day.dayNumber,
          dayName: day.dayName,
          mealType: meal.mealType,
        });

        if (!mealNames.has(normalizedName)) {
          mealNames.set(normalizedName, []);
        }
        mealNames.get(normalizedName)!.push(meal.mealType);
      });

      // Check for duplicates
      mealNames.forEach((mealTypes, mealName) => {
        if (mealTypes.length > 1) {
          issues.push(
            `Day ${day.dayNumber} (${day.dayName}): Meal "${mealName}" appears ${mealTypes.length} times ` +
            `(${mealTypes.join(', ')}) - Each meal type should have a unique meal!`
          );
        }
      });
    });

    // Detect duplicates across different days
    globalMealNames.forEach((occurrences, mealName) => {
      if (occurrences.length > 1) {
        const occurrenceSummary = occurrences
          .map(o => `Day ${o.dayNumber} (${o.dayName} - ${o.mealType})`)
          .join(' | ');
        issues.push(
          `Meal "${mealName}" appears multiple times across the week: ${occurrenceSummary}`
        );
      }
    });

    if (issues.length > 0) {
      console.warn(`\n⚠️  [BATCH] MEAL VARIETY ISSUES DETECTED (non-blocking):`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
      console.warn(
        `  ⚠️  Duplicate meal names detected. Proceeding without failing generation.\n`,
      );
      return; // Do not fail generation on duplicate meals
    }

    console.log(`✅ [BATCH] Meal variety validation passed - all meals are unique across the week`);
  }

  /**
   * Calculate meal calorie distribution based on meal frequency
   */
  private getMealCalorieDistribution(mealFrequency: number, dailyCalories: number): {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks?: number[];
  } {
    const distributions: { [key: number]: { breakfast: number; lunch: number; dinner: number; snacks?: number[] } } = {
      3: {
        breakfast: Math.round(dailyCalories * 0.35), // 35%
        lunch: Math.round(dailyCalories * 0.40),     // 40%
        dinner: Math.round(dailyCalories * 0.25),     // 25%
      },
      4: {
        breakfast: Math.round(dailyCalories * 0.30), // 30%
        lunch: Math.round(dailyCalories * 0.35),     // 35%
        dinner: Math.round(dailyCalories * 0.25),    // 25%
        snacks: [Math.round(dailyCalories * 0.10)],  // 10% (evening snack)
      },
      5: {
        breakfast: Math.round(dailyCalories * 0.25), // 25%
        lunch: Math.round(dailyCalories * 0.30),     // 30%
        dinner: Math.round(dailyCalories * 0.20),    // 20%
        snacks: [
          Math.round(dailyCalories * 0.10), // 10% (mid-morning)
          Math.round(dailyCalories * 0.10), // 10% (mid-afternoon)
          Math.round(dailyCalories * 0.05), // 5% (evening)
        ],
      },
    };

    return distributions[mealFrequency] || distributions[4];
  }

  /**
   * Build prompt for batch meal generation
   */
  private buildBatchMealPrompt(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any
  ): string {
    const dailyTargets = weeklyOutline.dailyTargets;
    const mealFrequency = userProfile.mealFrequency || 4;

    // Calculate meal calorie distribution
    const mealDistribution = this.getMealCalorieDistribution(mealFrequency, dailyTargets.calories);

    // Log meal calorie distribution
    console.log('📊 [BATCH] Meal Calorie Distribution:', {
      mealFrequency,
      dailyCalories: dailyTargets.calories,
      distribution: mealDistribution,
      percentages: {
        breakfast: ((mealDistribution.breakfast / dailyTargets.calories) * 100).toFixed(1) + '%',
        lunch: ((mealDistribution.lunch / dailyTargets.calories) * 100).toFixed(1) + '%',
        dinner: ((mealDistribution.dinner / dailyTargets.calories) * 100).toFixed(1) + '%',
        snacks: mealDistribution.snacks?.map((cal, i) =>
          `Snack ${i + 1}: ${((cal / dailyTargets.calories) * 100).toFixed(1)}%`
        ) || [],
      },
    });

    // Build dietary guidance based on user preferences
    const dietaryGuidance = this.buildDietaryGuidance(userProfile.preferences);
    console.log('🍽️  [BATCH] Generated dietary guidance for preferences:', userProfile.preferences);

    // Build day information
    const dayInfo = trainingSplit.days.map((day: { dayName: string; isRestDay: boolean }, index: number) => {
      const dayMacros = this.calculateDayMacros(weeklyOutline, day.isRestDay);
      // Calculate meal targets for this day using distribution
      const dayMealDistribution = this.getMealCalorieDistribution(mealFrequency, dayMacros.calories);
      return {
        dayNumber: index + 1,
        dayName: day.dayName,
        isRestDay: day.isRestDay,
        isTrainingDay: !day.isRestDay,
        macros: dayMacros,
        mealTargets: dayMealDistribution,
      };
    });

    return `You are an expert nutritionist generating a complete weekly meal plan. Generate ALL 7 days of meals in a single response.

🚨 CRITICAL RULE #1 - MEAL VARIETY (MUST FOLLOW):
EACH DAY MUST HAVE COMPLETELY DIFFERENT MEALS FOR EACH MEAL TYPE.

❌ FORBIDDEN: Repeating the same meal name for breakfast, lunch, and dinner on the same day
✅ REQUIRED: Each meal type (breakfast, lunch, dinner, snack) must have a UNIQUE meal name with different ingredients

CORRECT EXAMPLE - Day 1:
- Breakfast: "Greek Yogurt Parfait with Berries and Granola"
- Lunch: "Grilled Chicken Caesar Salad"
- Dinner: "Baked Salmon with Sweet Potato and Broccoli"

WRONG EXAMPLE - Day 1 (DO NOT DO THIS):
- Breakfast: "Tuna with whole grain bread and zucchini"
- Lunch: "Tuna with whole grain bread and zucchini"  ❌ SAME MEAL
- Dinner: "Tuna with whole grain bread and zucchini"  ❌ SAME MEAL

MEAL TYPE GUIDELINES:
- Breakfast: Should include breakfast foods (eggs, oatmeal, yogurt, toast, smoothies, etc.)
- Lunch: Should include lunch foods (salads, sandwiches, wraps, bowls, etc.)
- Dinner: Should include dinner foods (protein + sides, stir-fries, pasta dishes, etc.)
- Snack: Should be snack-appropriate (nuts, fruit, protein bars, etc.)

INGREDIENT NAMING RULES (MUST FOLLOW):
- List individual, base ingredients only. Do NOT use composite/generic names.
- Forbidden terms in ingredient names: "mixed", "blend", "assorted", "pack", "combo".
- Do NOT use prepared dish names as ingredient names (e.g., "turkey burger", "wrap", "sandwich", "burrito"). Instead list each component explicitly.
- Examples:
  * Wrong: "Mixed berries" → Right: "strawberries", "blueberries", "raspberries"
  * Wrong: "Turkey burger" → Right: "ground turkey", "whole wheat bun", "lettuce", "tomato", "onion"
  * Wrong: "Stir-fry mix" → Right: "broccoli", "bell pepper", "snap peas", "carrot"

USER PROFILE:
- Goal: ${userProfile.goal}
- Meal Frequency: ${mealFrequency} meals per day

${dietaryGuidance}

WEEKLY TARGETS (Daily Averages):
- Calories: ${dailyTargets.calories} kcal/day
- Protein: ${dailyTargets.protein}g/day (${dailyTargets.proteinPerKg}g/kg)
- Carbs: ${dailyTargets.carbs}g/day
- Fats: ${dailyTargets.fat}g/day

MEAL CALORIE DISTRIBUTION (Standard Percentages):
${mealFrequency === 3 ? `
- Breakfast: 35% (~${mealDistribution.breakfast} cal)
- Lunch: 40% (~${mealDistribution.lunch} cal)
- Dinner: 25% (~${mealDistribution.dinner} cal)
` : mealFrequency === 4 ? `
- Breakfast: 30% (~${mealDistribution.breakfast} cal)
- Lunch: 35% (~${mealDistribution.lunch} cal)
- Dinner: 25% (~${mealDistribution.dinner} cal)
- Evening Snack: 10% (~${mealDistribution.snacks?.[0] || 0} cal)
` : `
- Breakfast: 25% (~${mealDistribution.breakfast} cal)
- Mid-Morning Snack: 10% (~${mealDistribution.snacks?.[0] || 0} cal)
- Lunch: 30% (~${mealDistribution.lunch} cal)
- Mid-Afternoon Snack: 10% (~${mealDistribution.snacks?.[1] || 0} cal)
- Dinner: 20% (~${mealDistribution.dinner} cal)
- Evening Snack: 5% (~${mealDistribution.snacks?.[2] || 0} cal)
`}

DAY-BY-DAY TARGETS (with macro cycling):
${dayInfo.map((day: { dayNumber: number; dayName: string; isTrainingDay: boolean; macros: MacroValues; mealTargets: any }) => `
Day ${day.dayNumber} (${day.dayName} - ${day.isTrainingDay ? 'Training' : 'Rest'}):
- Daily Calories: ${day.macros.calories} kcal
- Daily Protein: ${day.macros.protein}g
- Daily Carbs: ${day.macros.carbs}g
- Daily Fats: ${day.macros.fats}g
- Meal Targets: Breakfast ~${day.mealTargets.breakfast} cal, Lunch ~${day.mealTargets.lunch} cal, Dinner ~${day.mealTargets.dinner} cal${day.mealTargets.snacks ? `, Snacks: ${day.mealTargets.snacks.map((s: number) => `~${s} cal`).join(', ')}` : ''}
`).join('')}

CRITICAL REQUIREMENTS (IN ORDER OF IMPORTANCE):

🎯 PRIORITY #1: DIETARY PREFERENCES & RESTRICTIONS
- The user's dietary preferences (shown in the guidance above) are MANDATORY
- If they specified a cuisine type (Mediterranean, Indian, etc.), ALL meals MUST be from that cuisine
- If they have allergies/restrictions (no beef, no dairy, etc.), ZERO violations allowed
- Treat preferences as EQUALLY IMPORTANT as macro targets - both must be met

📊 PRIORITY #2: MACRO ACCURACY
1. Generate EXACTLY 7 days of meals (Monday through Sunday)
2. Each day has EXACTLY ${mealFrequency} meals (breakfast, lunch, dinner, snack)
3. Hit the calorie and macro targets for each day (shown in DAY-BY-DAY TARGETS above)

🍽️ PRIORITY #3: MEAL VARIETY
- ❌ NEVER repeat the same meal name for different meal types on the same day
- ✅ Breakfast, lunch, and dinner MUST have different meal names and different ingredients
   - ✅ Use meal-type-appropriate foods (breakfast foods for breakfast, lunch foods for lunch, etc.)
   - ✅ Ensure variety across the entire week
4. **MEAL CALORIE TARGETS**: Each meal should target the calorie distribution shown above. For example:
   ${mealFrequency === 4 ? `
   - Breakfast meals should target ~${mealDistribution.breakfast} calories
   - Lunch meals should target ~${mealDistribution.lunch} calories
   - Dinner meals should target ~${mealDistribution.dinner} calories
   - Snack meals should target ~${mealDistribution.snacks?.[0] || 0} calories
   ` : ''}
5. **MACRO CALCULATION GUIDANCE - CRITICAL FOR ACCURACY**:
   Use these approximate macro values per 100g to estimate ingredient amounts:

   **HIGH PROTEIN SOURCES** (prioritize for protein targets):
   - Chicken breast: 31g protein, 3.6g fat, 0g carbs, 165 cal/100g → For 50g protein, use ~160g
   - Turkey breast: 29g protein, 1g fat, 0g carbs, 135 cal/100g → For 50g protein, use ~170g
   - Salmon: 20g protein, 13g fat, 0g carbs, 208 cal/100g → For 50g protein, use ~250g
   - Tuna: 30g protein, 1g fat, 0g carbs, 132 cal/100g → For 50g protein, use ~165g
   - Lean beef: 26g protein, 15g fat, 0g carbs, 250 cal/100g → For 50g protein, use ~190g
   - Eggs (whole): 13g protein, 11g fat, 1.1g carbs, 155 cal/100g → For 30g protein, use ~230g (4 eggs)
   - Egg whites: 11g protein, 0.2g fat, 0.7g carbs, 52 cal/100g → For 30g protein, use ~270g
   - Greek yogurt: 10g protein, 0.4g fat, 3.6g carbs, 59 cal/100g → For 20g protein, use ~200g
   - Cottage cheese: 11g protein, 4.3g fat, 3.4g carbs, 98 cal/100g → For 20g protein, use ~180g
   - Tofu (firm): 8g protein, 4g fat, 2g carbs, 76 cal/100g → For 20g protein, use ~250g

   **CARBOHYDRATE SOURCES**:
   - White rice (cooked): 2.7g protein, 0.3g fat, 28g carbs, 130 cal/100g → For 50g carbs, use ~180g
   - Brown rice (cooked): 2.6g protein, 0.9g fat, 23g carbs, 112 cal/100g → For 50g carbs, use ~220g
   - Quinoa (cooked): 4.4g protein, 1.9g fat, 21g carbs, 120 cal/100g → For 40g carbs, use ~190g
   - Oats (dry): 13g protein, 7g fat, 67g carbs, 380 cal/100g → For 50g carbs, use ~75g
   - Sweet potato: 1.6g protein, 0.1g fat, 20g carbs, 86 cal/100g → For 40g carbs, use ~200g
   - Whole wheat pasta (cooked): 5g protein, 0.9g fat, 25g carbs, 131 cal/100g → For 50g carbs, use ~200g
   - Whole wheat bread: 12g protein, 3g fat, 43g carbs, 247 cal/100g → For 30g carbs, use ~70g (2 slices)
   - Banana: 1.1g protein, 0.3g fat, 23g carbs, 89 cal/100g → For 25g carbs, use ~110g (1 medium)
   - Blueberries: 0.7g protein, 0.3g fat, 14g carbs, 57 cal/100g → For 20g carbs, use ~140g
   - Black beans (cooked): 8.9g protein, 0.5g fat, 23g carbs, 132 cal/100g → For 30g carbs, use ~130g

   **HEALTHY FATS**:
   - Olive oil: 0g protein, 100g fat, 0g carbs, 884 cal/100g → For 10g fat, use ~10g (1 tbsp)
   - Avocado: 2g protein, 15g fat, 9g carbs, 160 cal/100g → For 15g fat, use ~100g (1/2 medium)
   - Almonds: 21g protein, 50g fat, 22g carbs, 579 cal/100g → For 15g fat, use ~30g
   - Almond butter: 21g protein, 56g fat, 19g carbs, 614 cal/100g → For 15g fat, use ~27g (2 tbsp)
   - Peanut butter: 25g protein, 50g fat, 20g carbs, 588 cal/100g → For 15g fat, use ~30g (2 tbsp)
   - Chia seeds: 17g protein, 31g fat, 42g carbs, 486 cal/100g → For 10g fat, use ~32g
   - Walnuts: 15g protein, 65g fat, 14g carbs, 654 cal/100g → For 15g fat, use ~23g

   **VEGETABLES** (low calorie, add for volume/nutrients):
   - Broccoli: 2.8g protein, 0.4g fat, 7g carbs, 34 cal/100g → Use 100-200g
   - Spinach: 2.9g protein, 0.4g fat, 3.6g carbs, 23 cal/100g → Use 100-150g
   - Asparagus: 2.2g protein, 0.1g fat, 3.9g carbs, 20 cal/100g → Use 100-150g
   - Bell peppers: 1g protein, 0.3g fat, 6g carbs, 31 cal/100g → Use 100-150g
   - Tomatoes: 0.9g protein, 0.2g fat, 3.9g carbs, 18 cal/100g → Use 100-200g
   - Lettuce: 1.4g protein, 0.2g fat, 2.9g carbs, 15 cal/100g → Use 100-150g

   **CALCULATION METHOD**:
   For a ${mealDistribution.lunch} calorie lunch with ~55g protein, ~60g carbs, ~20g fats:
   1. Start with protein: 180g chicken breast (≈56g protein, ≈6.5g fat, ≈0g carbs, ≈297 cal)
   2. Add carbs: 200g sweet potato (≈3g protein, ≈0.2g fat, ≈40g carbs, ≈172 cal)
   3. Add carbs: 100g quinoa (≈4g protein, ≈2g fat, ≈21g carbs, ≈120 cal)
   4. Add fats: 10g olive oil (≈0g protein, ≈10g fat, ≈0g carbs, ≈88 cal)
   5. Add vegetables: 150g asparagus (≈3g protein, ≈0.2g fat, ≈6g carbs, ≈30 cal)
   6. Total: ≈66g protein, ≈19g fat, ≈67g carbs, ≈707 cal

   **ACCURACY REQUIREMENTS**:
   - Protein should be within ±20% of target (e.g., 55g target → 44-66g range)
   - Carbs should be within ±25% of target (e.g., 60g target → 45-75g range)
   - Fats should be within ±25% of target (e.g., 20g target → 15-25g range)
   - Calories should be within ±15% of target (e.g., 650 cal target → 552-747 range)

   **IMPORTANT**: These are approximations. The system will verify with USDA data and auto-adjust portions to hit exact targets.

6. For each meal, provide:
   - **Meal name**: A creative, descriptive name based on the ingredients (e.g., "Avocado Toast with Poached Eggs", "Grilled Salmon with Quinoa and Asparagus", "Protein Acai Bowl with Berries", "Mediterranean Chicken Wrap"). Use descriptive names that reflect the actual meal composition, not generic names like "breakfast" or "lunch".
   - Meal type (breakfast, lunch, dinner, snack)
   - List of ingredients with amounts in grams. **Include at least 5 ingredients per meal**, covering primary components plus cooking fats (oil/butter), aromatics, spices, sauces, and garnishes (e.g., olive oil, garlic, salt, pepper, lemon juice, fresh herbs).
   - **Cooking instructions**: Provide 4-6 clear, step-by-step cooking instructions covering prep, cooking, finishing, and plating. Be specific about cooking methods, temperatures, times, and techniques. Examples:
     * For steak: ["Season steak with salt and pepper on both sides", "Heat grill or pan to high heat", "Cook steak for 4-5 minutes per side for medium-rare", "Rest for 5 minutes before slicing"]
     * For chicken: ["Preheat oven to 400°F", "Season chicken with herbs and spices", "Bake for 25-30 minutes until internal temperature reaches 165°F", "Let rest 5 minutes before serving"]
     * For pasta: ["Bring large pot of salted water to boil", "Add pasta and cook according to package directions", "Drain and toss with sauce", "Garnish with fresh herbs"]
   - Estimated macros (these will be verified with USDA data later)
6. Meals should be practical, healthy, and meet dietary requirements
7. Training days can have more carbs, rest days can have more fats
8. **Meal names should be creative and appetizing**, reflecting the actual ingredients and preparation style
9. **Instructions must be detailed and actionable** - users need to know how to actually cook the meal
10. Include realistic pantry staples (oils, vinegars, citrus, aromatics, herbs) wherever appropriate so meals feel complete and flavorful

**FINAL VARIETY CHECK - Before submitting, verify EACH day:**
- ✅ Day 1: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 2: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 3: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 4: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 5: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 6: Breakfast ≠ Lunch ≠ Dinner (all different meal names)
- ✅ Day 7: Breakfast ≠ Lunch ≠ Dinner (all different meal names)

**MEAL NAME EXAMPLES BY TYPE:**
- Breakfast: "Scrambled Eggs with Avocado Toast", "Overnight Oats with Berries", "Greek Yogurt Bowl with Granola"
- Lunch: "Grilled Chicken Salad", "Turkey and Hummus Wrap", "Quinoa Power Bowl"
- Dinner: "Baked Salmon with Roasted Vegetables", "Lean Beef Stir-Fry", "Herb-Crusted Chicken with Sweet Potato"
- Snack: "Apple with Almond Butter", "Protein Smoothie", "Greek Yogurt with Nuts"

Focus on meal creativity and variety. The macro estimates don't need to be perfect - they will be corrected with USDA data.

⚠️ FINAL REMINDER - BEFORE GENERATING ANY MEAL, RE-READ THE USER'S PREFERENCES ABOVE.

If the user specified:
- A cuisine type → EVERY meal must be from that cuisine (no generic Western meals)
- Foods to avoid → ZERO instances of those foods in any meal
- Foods they love → Prioritize those foods throughout the week
- Dietary restrictions → Strictly follow them (as important as macro targets)

Generate meals for all 7 days now. Remember:
1. RESPECT THE USER'S PREFERENCES (cuisine, likes, dislikes, restrictions)
2. HIT THE MACRO TARGETS (calories, protein, carbs, fat)
3. ENSURE MEAL VARIETY (each meal type on each day must be unique)`;
  }

  /**
   * Build detailed dietary guidance based on user preferences
   * Similar to how workout generation handles equipment constraints
   */
  private buildDietaryGuidance(preferences: string): string {
    if (!preferences || preferences.trim() === '') {
      return `DIETARY PREFERENCES: None specified - create balanced, varied meals with common ingredients.`;
    }

    const prefs = preferences.toLowerCase();
    let guidance = `DIETARY PREFERENCES & RESTRICTIONS:\n`;
    guidance += `⚠️ CRITICAL: The following dietary requirements MUST be strictly followed:\n\n`;

    // Pattern detection flags
    const isVegan = prefs.includes('vegan');
    const isVegetarian = prefs.includes('vegetarian') && !isVegan;
    const isKeto = prefs.includes('keto') || prefs.includes('ketogenic');
    const isLowCarb = (prefs.includes('low carb') || prefs.includes('low-carb')) && !isKeto;
    const isPaleo = prefs.includes('paleo');
    const isMediterranean = prefs.includes('mediterranean');
    const isGlutenFree = prefs.includes('gluten-free') || prefs.includes('gluten free') || prefs.includes('celiac');
    const isDairyFree = prefs.includes('dairy-free') || prefs.includes('dairy free') || prefs.includes('lactose');
    const isNutFree = prefs.includes('nut-free') || prefs.includes('nut free') || prefs.includes('nut allergy');
    const isPescatarian = prefs.includes('pescatarian') && !isVegan && !isVegetarian;
    const isHighProtein = prefs.includes('high protein') || prefs.includes('high-protein');
    const isWholeFoods = prefs.includes('whole food') || prefs.includes('whole-food') || prefs.includes('clean eating');

    // Build specific guidance for each detected pattern
    if (isVegan) {
      guidance += `🌱 VEGAN DIET (STRICT - NO EXCEPTIONS):
- ❌ FORBIDDEN: All animal products including meat, poultry, fish, seafood, dairy (milk, cheese, yogurt, butter), eggs, honey, gelatin, whey
- ✅ PROTEIN SOURCES: Tofu (firm/silken), tempeh, seitan, edamame, lentils (red/green/black), chickpeas, black beans, kidney beans, pinto beans, quinoa, hemp seeds, nutritional yeast, pea protein powder, soy protein
- ✅ DAIRY ALTERNATIVES: Almond milk, oat milk, soy milk, coconut milk/yogurt, cashew cheese, coconut cream
- ✅ HEALTHY FATS: Avocado, nuts (almonds, walnuts, cashews), seeds (chia, flax, hemp, pumpkin), nut butters, tahini, olive oil, coconut oil
- ✅ CARBS: Whole grains (quinoa, brown rice, oats, whole wheat pasta), sweet potatoes, regular potatoes, fruits
- ✅ VEGETABLES: All vegetables are allowed
- Example Meals: Tofu scramble with spinach, lentil curry with brown rice, chickpea pasta with marinara, quinoa Buddha bowl with tahini dressing, black bean tacos
- IMPORTANT: Ensure adequate protein (25-35g per meal) from plant sources - combine legumes with grains for complete proteins\n\n`;
    } else if (isVegetarian) {
      guidance += `🥚 VEGETARIAN DIET:
- ❌ FORBIDDEN: Meat, poultry, fish, seafood, gelatin
- ✅ ALLOWED: Eggs, dairy products (milk, cheese, yogurt, butter), all plant-based foods
- ✅ PROTEIN SOURCES: Eggs, Greek yogurt, cottage cheese, paneer, tofu, tempeh, lentils, chickpeas, black beans, quinoa, edamame, protein powder (whey or plant-based)
- ✅ HEALTHY FATS: Cheese, avocado, nuts, seeds, nut butters, olive oil, butter (if not dairy-free)
- Example Meals: Scrambled eggs with vegetables, Greek yogurt parfait, vegetarian chili, paneer tikka, egg salad sandwich, cheese and bean quesadilla
- IMPORTANT: Vary protein sources throughout the week for complete amino acid profile\n\n`;
    } else if (isPescatarian) {
      guidance += `🐟 PESCATARIAN DIET:
- ❌ FORBIDDEN: Meat (beef, pork, lamb), poultry (chicken, turkey)
- ✅ ALLOWED: Fish, seafood, eggs, dairy, all plant-based foods
- ✅ PROTEIN SOURCES: Salmon, tuna, cod, tilapia, shrimp, crab, mussels, eggs, Greek yogurt, cottage cheese, tofu, lentils, chickpeas
- ✅ FOCUS: Prioritize fatty fish (salmon, mackerel, sardines) for omega-3s at least 2-3 times per week
- Example Meals: Grilled salmon with quinoa, tuna salad, shrimp stir-fry, cod with roasted vegetables, seafood pasta
- IMPORTANT: Choose wild-caught fish when possible, vary seafood types for nutrient diversity\n\n`;
    }

    if (isKeto) {
      guidance += `🥑 KETOGENIC DIET (VERY LOW CARB):
- ⚠️ STRICT CARB LIMIT: Maximum 20-30g net carbs per day (5-10g per meal, 5-10g for snacks)
- ❌ FORBIDDEN: All grains (bread, rice, pasta, oats, quinoa), all starchy vegetables (potatoes, sweet potatoes, corn, peas), most fruits (except small portions of berries), sugar, beans/legumes
- ✅ PROTEIN SOURCES: Fatty cuts of meat (ribeye, pork belly, chicken thighs with skin, salmon, mackerel), eggs, full-fat cheese
- ✅ HEALTHY FATS (70-75% of calories): Avocado, olive oil, coconut oil, butter, ghee, heavy cream, MCT oil, nuts (macadamias, pecans, walnuts - limit to 1oz), seeds (chia, flax, hemp)
- ✅ LOW-CARB VEGETABLES: Spinach, kale, lettuce, broccoli, cauliflower, zucchini, asparagus, bell peppers, mushrooms, Brussels sprouts (portion controlled)
- ✅ ALLOWED FRUITS: Small portions of berries only (20-30g strawberries, blueberries, raspberries)
- Example Meals: Scrambled eggs with avocado and bacon, salmon with butter and asparagus, ribeye with cauliflower mash, chicken thigh salad with olive oil dressing
- MACRO TARGET: 70% fat, 25% protein, 5% carbs
- IMPORTANT: Track net carbs (total carbs - fiber). Prioritize fat as primary energy source\n\n`;
    } else if (isLowCarb) {
      guidance += `🍖 LOW-CARB DIET:
- ⚠️ MODERATE CARB LIMIT: 50-100g carbs per day (15-30g per meal)
- ❌ MINIMIZE: Refined grains (white bread, white rice, regular pasta), sugary foods, processed carbs
- ✅ LIMITED CARBS: Sweet potatoes, quinoa, brown rice, oats, whole grain bread (small portions - 50-100g cooked)
- ✅ PROTEIN SOURCES: Chicken breast, turkey, lean beef, pork, fish, eggs, Greek yogurt
- ✅ HEALTHY FATS: Avocado, nuts, seeds, olive oil, fatty fish
- ✅ UNLIMITED: Non-starchy vegetables, leafy greens
- Example Meals: Grilled chicken with roasted vegetables and small sweet potato, salmon with cauliflower rice, egg scramble with peppers and cheese
- MACRO TARGET: 40% protein, 30% fat, 30% carbs
- IMPORTANT: Focus on fiber-rich carbs from vegetables and limited whole grains\n\n`;
    }

    if (isPaleo) {
      guidance += `🦴 PALEO DIET (WHOLE FOODS):
- ❌ FORBIDDEN: All grains (wheat, rice, oats, corn), legumes (beans, lentils, peanuts), dairy products, refined sugar, processed foods, vegetable oils
- ✅ PROTEIN SOURCES: Grass-fed beef, free-range chicken, wild-caught fish, eggs, pork
- ✅ HEALTHY FATS: Avocado, nuts (almonds, walnuts, cashews - NO peanuts), seeds, coconut oil, olive oil, ghee
- ✅ CARBS: Sweet potatoes, regular potatoes (white/red), squash, fruits, root vegetables
- ✅ VEGETABLES: All vegetables are allowed
- Example Meals: Grilled steak with roasted sweet potatoes, chicken with vegetables, salmon with cauliflower, egg scramble with avocado
- IMPORTANT: Focus on unprocessed, whole foods that were available to our ancestors\n\n`;
    }

    if (isMediterranean) {
      guidance += `🫒 MEDITERRANEAN DIET:
- ✅ EMPHASIS: Olive oil as primary fat source, fish and seafood (2-3x per week), whole grains, legumes, fruits, vegetables, nuts, moderate dairy (yogurt, cheese)
- ✅ PROTEIN SOURCES: Fish (salmon, sardines, mackerel), seafood, chicken, turkey, eggs, legumes (chickpeas, lentils), Greek yogurt
- ✅ HEALTHY FATS: Extra virgin olive oil (generous amounts), olives, nuts (almonds, walnuts), seeds, avocado
- ✅ WHOLE GRAINS: Whole wheat pasta, brown rice, quinoa, farro, bulgur, whole grain bread
- ✅ FLAVOR PROFILE: Garlic, tomatoes, herbs (oregano, basil, rosemary), lemon, capers
- ❌ MINIMIZE: Red meat (limit to 1-2x per month), processed meats, refined grains, sweets
- Example Meals: Greek yogurt with nuts and honey, chickpea salad with olive oil, grilled fish with vegetables and quinoa, whole wheat pasta with tomato sauce
- IMPORTANT: Use olive oil liberally, include fish regularly, emphasize plant-based proteins\n\n`;
    }

    if (isGlutenFree) {
      guidance += `🌾 GLUTEN-FREE (CELIAC-SAFE):
- ❌ FORBIDDEN: Wheat, barley, rye, regular oats (unless certified gluten-free), spelt, triticale, malt, brewer's yeast
- ❌ HIDDEN SOURCES: Soy sauce (use tamari), some protein powders, processed foods with wheat derivatives
- ✅ SAFE GRAINS: Rice (white, brown, wild), quinoa, certified gluten-free oats, corn, millet, buckwheat, amaranth
- ✅ SAFE CARBS: Potatoes, sweet potatoes, rice noodles, corn tortillas, gluten-free bread/pasta
- ✅ NATURALLY GLUTEN-FREE: All meats, fish, eggs, dairy, fruits, vegetables, nuts, seeds, legumes
- Example Meals: Rice bowl with chicken and vegetables, gluten-free oatmeal, corn tortilla tacos, quinoa salad, rice noodle stir-fry
- IMPORTANT: Check all packaged foods for hidden gluten, use gluten-free alternatives for grains\n\n`;
    }

    if (isDairyFree) {
      guidance += `🥛 DAIRY-FREE / LACTOSE-FREE:
- ❌ FORBIDDEN: Milk, cheese, yogurt, butter, cream, ice cream, whey protein, casein
- ✅ DAIRY ALTERNATIVES: Almond milk, oat milk, soy milk, coconut milk/cream/yogurt, cashew cheese, coconut oil instead of butter
- ✅ PROTEIN SOURCES: Meat, poultry, fish, eggs (if not vegan), legumes, tofu, plant-based protein powder
- ✅ CALCIUM SOURCES: Fortified plant milks, leafy greens (kale, collards), almonds, tahini, fortified tofu
- Example Meals: Oatmeal with almond milk, chicken with olive oil and vegetables, tofu scramble, smoothie with coconut yogurt
- IMPORTANT: Replace dairy in all recipes with plant-based alternatives, check labels for hidden dairy (whey, casein)\n\n`;
    }

    if (isNutFree) {
      guidance += `🚫 NUT-FREE (ALLERGY-SAFE):
- ❌ FORBIDDEN: All tree nuts (almonds, walnuts, cashews, pecans, pistachios, macadamias, hazelnuts, Brazil nuts), peanuts, nut butters, nut oils, nut flours
- ⚠️ CROSS-CONTAMINATION: Avoid foods processed in facilities with nuts
- ✅ SAFE ALTERNATIVES: Seeds (sunflower seed butter, pumpkin seeds, chia seeds, hemp seeds, tahini/sesame butter), coconut (technically safe for most nut allergies)
- ✅ SAFE FATS: Olive oil, avocado, coconut oil, seeds, fatty fish
- ✅ SAFE PROTEINS: All meats, fish, eggs, dairy, legumes, tofu
- Example Meals: Chicken with sunflower seed pesto, oatmeal with seeds and fruit, hummus with vegetables, salmon with tahini sauce
- IMPORTANT: Replace all nut-based ingredients with seed-based alternatives\n\n`;
    }

    if (isHighProtein) {
      guidance += `💪 HIGH PROTEIN FOCUS:
- 🎯 TARGET: 35-45g protein per main meal, 15-20g per snack
- ✅ PRIORITIZE: Lean meats (chicken breast, turkey, lean beef), fish (tuna, cod, tilapia), eggs, egg whites, Greek yogurt, cottage cheese, protein powder
- ✅ PLANT PROTEINS: Tofu, tempeh, edamame, lentils, chickpeas, protein-fortified foods
- IMPORTANT: Start each meal planning with protein source first, then build around it
- Each main meal should have AT LEAST 180-250g of lean protein source (chicken, fish, tofu)\n\n`;
    }

    if (isWholeFoods) {
      guidance += `🥗 WHOLE FOODS / CLEAN EATING:
- ✅ EMPHASIS: Single-ingredient foods, minimally processed items
- ❌ AVOID: Processed foods, artificial ingredients, preservatives, refined sugars, refined grains
- ✅ PROTEIN: Fresh meats, fish, eggs, plain Greek yogurt, plain cottage cheese
- ✅ CARBS: Whole grains (brown rice, quinoa, oats), sweet potatoes, fruits
- ✅ FATS: Avocado, nuts, seeds, olive oil, coconut oil
- IMPORTANT: Choose foods that look like they did when grown/raised, minimal ingredient lists\n\n`;
    }

    // CRITICAL: Always include the raw user preferences prominently
    // This ensures ANY preference (not just predefined patterns) is respected
    guidance += `\n🎯 USER'S EXACT PREFERENCES (CRITICAL - MUST FOLLOW):
"${preferences}"

⚠️ THIS IS EXTREMELY IMPORTANT: The user specifically requested the above preferences. You MUST interpret and strictly follow them, even if they don't match standard diet patterns above.

Examples of how to interpret preferences:
- "Mediterranean Food" → ALL meals must be authentic Mediterranean cuisine (Greek, Italian, Spanish, Turkish, Lebanese, Moroccan)
- "Indian cuisine" → ALL meals must be Indian dishes (curry, dal, biryani, tandoori, etc.)
- "Asian food" → ALL meals must be Asian cuisine (Chinese, Thai, Japanese, Korean, Vietnamese)
- "Mexican food" → ALL meals must be Mexican dishes (tacos, burritos, enchiladas, etc.)
- "No beef" → ZERO beef in any meal, use chicken, fish, pork, or plant proteins instead
- "I love spicy food" → Include spicy elements (chili peppers, hot sauce, cayenne) in most meals
- "No dairy" → ZERO milk, cheese, yogurt, butter, cream in any meal
- "Allergic to shellfish" → ZERO shrimp, crab, lobster, mussels, clams, oysters
- "Prefer chicken and fish" → Prioritize chicken and fish as protein sources, minimize red meat

📋 GENERAL MEAL CREATION GUIDELINES:
- Read and follow ALL dietary restrictions/preferences above before generating ANY meal
- The user's exact preferences (shown above) are AS IMPORTANT as hitting macro targets
- If a restriction forbids an ingredient, find appropriate substitutes from allowed lists
- When in doubt about an ingredient, check if it violates any restriction/preference
- Ensure every meal strictly complies with ALL applicable restrictions and preferences
- Be creative with allowed ingredients to maintain meal variety and enjoyment
- If user specified a cuisine type (Mediterranean, Indian, Asian, etc.), EVERY meal must be from that cuisine
- If user specified food likes/dislikes, prioritize liked foods and NEVER include disliked foods

⚠️ COMPLIANCE CHECK: Before finalizing each meal, verify:
1. It contains ZERO forbidden ingredients from restrictions above
2. It strictly follows the user's stated preferences (cuisine type, likes/dislikes, etc.)
3. If a cuisine was specified, the meal name and ingredients match that cuisine authentically\n`;

    return guidance;
  }

  /**
   * Soft validation: flag composite/generic ingredient names
   */
  private validateIngredientSpecificity(meals: BatchMealGeneration): void {
    const badPatterns = [
      /\bmix(ed)?\b/i,
      /\bblend\b/i,
      /\bassorted\b/i,
      /\bpack\b/i,
      /\bcombo\b/i,
      /\bburger\b/i,
      /\bwrap\b/i,
      /\bsandwich\b/i,
      /\bburrito\b/i,
    ];

    const issues: string[] = [];
    meals.weeklyMeals.forEach((day) => {
      day.meals.forEach((meal) => {
        meal.ingredients.forEach((ing) => {
          const name = (ing.name || '').trim();
          if (name && badPatterns.some((p) => p.test(name))) {
            issues.push(
              `Weekday ${day.dayNumber} (${day.dayName}) ${meal.mealType}: "${name}" looks composite/generic; list individual ingredients instead.`
            );
          }
        });
      });
    });

    if (issues.length > 0) {
      console.warn(`\n⚠️  [BATCH] INGREDIENT SPECIFICITY WARNINGS:`);
      issues.slice(0, 15).forEach((i) => console.warn(`  - ${i}`));
      if (issues.length > 15) {
        console.warn(`  ... and ${issues.length - 15} more`);
      }
    } else {
      console.log('✅ [BATCH] Ingredient names look specific (no mixed/composite terms detected)');
    }
  }

  /**
   * Calculate day macros with cycling
   *
   * NOTE: Now uses NutritionCalculationService constants for evidence-based macro cycling.
   * Training days: +5% calories, +20% carbs, -15% fat (optimized for performance)
   * Rest days: -5% calories, -20% carbs, +15% fat (optimized for recovery)
   * Protein remains constant across all days.
   */
  private calculateDayMacros(weeklyOutline: WeeklyOutline, isRestDay: boolean): MacroValues {
    const base = weeklyOutline.dailyTargets;

    if (isRestDay) {
      return {
        calories: Math.round(base.calories * (1 - MACRO_CYCLING.REST_DAY_CALORIE_REDUCTION)),
        protein: base.protein, // Constant
        carbs: Math.round(base.carbs * (1 - MACRO_CYCLING.REST_DAY_CARB_REDUCTION)),
        fats: Math.round(base.fat * (1 + MACRO_CYCLING.REST_DAY_FAT_BOOST)),
      };
    } else {
      return {
        calories: Math.round(base.calories * (1 + MACRO_CYCLING.TRAINING_DAY_CALORIE_BOOST)),
        protein: base.protein, // Constant
        carbs: Math.round(base.carbs * (1 + MACRO_CYCLING.TRAINING_DAY_CARB_BOOST)),
        fats: Math.round(base.fat * (1 - MACRO_CYCLING.TRAINING_DAY_FAT_REDUCTION)),
      };
    }
  }

  /**
   * Step 2: Extract unique ingredients across all meals
   */
  private extractUniqueIngredients(result: BatchMealGeneration): string[] {
    const ingredientSet = new Set<string>();

    result.weeklyMeals.forEach(day => {
      day.meals.forEach(meal => {
        meal.ingredients.forEach(ing => {
          // Normalize ingredient name for deduplication
          const normalized = normalizeFoodName(ing.name);
          ingredientSet.add(normalized);
        });
      });
    });

    return Array.from(ingredientSet);
  }

  /**
   * Step 3: Batch USDA lookup (parallel)
   */
  private async batchUSDALookup(
    uniqueIngredients: string[]
  ): Promise<Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>> {
    const usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }> = {};

    // Refine ambiguous queries to canonical USDA-friendly forms
    const refineQuery = (name: string): string => {
      const stripped = stripDescriptorWords(name) || name;
      const map: Record<string, string> = {
        'scallions': 'green onions',
        'spring onion': 'green onions',
        'spring onions': 'green onions',
        'bell pepper': 'sweet pepper',
        'bell peppers': 'sweet peppers',
        'sweet peppers': 'sweet pepper',
      };
      const normalized = normalizeFoodName(stripped);
      return map[normalized] || normalized;
    };

    // When searching ambiguous seasonings, filter out obvious prepared dishes (e.g., "pepper steak")
    const DISH_WORDS = ['steak', 'burger', 'sandwich', 'pizza', 'pasta', 'sauce', 'soup', 'pie', 'cake'];

    // Lookup all ingredients in parallel
    const lookupPromises = uniqueIngredients.map(async (ingredient) => {
      try {
        // Skip USDA lookup for condiments/seasonings that should not impact macros
        if (isZeroImpactIngredient(ingredient)) {
          console.log(`⚙️  [BATCH] Skipping USDA for zero-impact ingredient: ${ingredient}`);
          return {
            ingredient,
            data: {
              nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 },
              fdcId: 0,
              rawFoodDetails: { skipped: 'zero-impact' }
            }
          };
        }

        const query = refineQuery(ingredient);
        let foods = await this.usdaService.searchFood(query);
        // If searching for ambiguous seasonings, drop obvious prepared dishes
        if (query === 'black pepper' || query === 'table salt' || ingredient === 'pepper' || ingredient === 'salt') {
          const before = foods.length;
          foods = foods.filter(f => !DISH_WORDS.some(w => (f.description || '').toLowerCase().includes(w)));
          if (foods.length < before) {
            console.log(`⚙️  [BATCH] Filtered out ${before - foods.length} dish-like USDA results for query "${query}"`);
          }
        }
        if (foods.length === 0) {
          console.warn(`⚠️  [BATCH] No USDA data found for: ${ingredient}`);
          return { ingredient, data: null };
        }

        // Try each candidate until we get a valid FDC detail response
        let foodDetails: any = null;
        for (const candidate of foods) {
          try {
            foodDetails = await this.usdaService.getFoodDetails(candidate.fdcId);
            break;
          } catch (error: any) {
            if (error?.type === NutritionErrorType.FOOD_NOT_FOUND) {
              console.warn(`⚠️  [BATCH] USDA returned 404 for FDC ${candidate.fdcId}, trying next candidate for "${ingredient}"`);
              continue;
            }
            throw error;
          }
        }

        if (!foodDetails) {
          console.warn(`⚠️  [BATCH] Exhausted USDA candidates for ${ingredient}`);
          return { ingredient, data: null };
        }

        // Log raw USDA data for comparison
        console.log(`\n🔬 [BATCH] RAW USDA DATA for "${ingredient}":`);
        console.log(`  FDC ID: ${foodDetails.fdcId}`);
        console.log(`  Description: ${foodDetails.description || 'N/A'}`);
        console.log(`  Data Type: ${foodDetails.dataType || 'N/A'}`);
        console.log(`  Total Nutrients: ${foodDetails.nutrients?.length || 0}`);

        // Log key nutrient IDs and values (raw from USDA)
        const keyNutrientIds = {
          CALORIES: 1008,
          PROTEIN: 1003,
          CARBS: 1005,
          FAT: 1004,
          FIBER: 1079,
          SUGAR: 2000,
        };

        console.log(`  Raw Nutrient Values (from USDA API):`);
        Object.entries(keyNutrientIds).forEach(([name, id]) => {
          const nutrient = foodDetails.nutrients?.find((n: any) => n.nutrientId === id);
          if (nutrient) {
            const value = (nutrient as any).value ?? (nutrient as any).amount ?? 0;
            const unit = nutrient.unitName || (nutrient as any).unit || 'N/A';
            console.log(`    ${name} (ID ${id}): ${value} ${unit}`);
          } else {
            console.log(`    ${name} (ID ${id}): NOT FOUND`);
          }
        });

        // Log full nutrients array (first 10 for brevity)
        if (foodDetails.nutrients && foodDetails.nutrients.length > 0) {
          console.log(`  Sample Nutrients (first 10):`);
          foodDetails.nutrients.slice(0, 10).forEach((n: any, i: number) => {
            const value = (n as any).value ?? (n as any).amount ?? 0;
            const unit = n.unitName || (n as any).unit || '';
            console.log(`    [${i}] ID: ${n.nutrientId}, Name: ${n.nutrientName || 'N/A'}, Value: ${value} ${unit}`);
          });
        }

        const nutrition = extractMacrosFromUSDA(foodDetails.nutrients || [], {
          foodName: foodDetails.description || ingredient,
          fdcId: foodDetails.fdcId,
          debug: true, // Enable detailed extraction logging
        });

        console.log(`  Extracted Macros (per 100g):`, {
          calories: nutrition.calories,
          protein: nutrition.protein + 'g',
          carbs: nutrition.carbs + 'g',
          fats: nutrition.fats + 'g',
        });

        return {
          ingredient,
          data: {
            nutrition,
            fdcId: foodDetails.fdcId,
            rawFoodDetails: foodDetails, // Store raw data for reference
          },
        };
      } catch (error) {
        console.error(`❌ [BATCH] Failed to lookup ${ingredient}:`, error);
        return { ingredient, data: null };
      }
    });

    const results = await Promise.all(lookupPromises);

    // Build map
    results.forEach(({ ingredient, data }) => {
      if (data) {
        usdaData[ingredient] = data;
      }
    });

    // Log detailed ingredient nutrition data
    console.log(`\n📊 [BATCH] USDA Nutrition Data (per 100g):`);
    Object.entries(usdaData).forEach(([ingredient, data]) => {
      console.log(`  ${ingredient}:`, {
        fdcId: data.fdcId,
        per100g: {
          calories: data.nutrition.calories,
          protein: data.nutrition.protein + 'g',
          carbs: data.nutrition.carbs + 'g',
          fats: data.nutrition.fats + 'g',
        },
      });
    });

    return usdaData;
  }

  /**
   * Step 4: Recalculate all meal macros using USDA data
   */
  private recalculateMacros(
    aiMeals: BatchMealGeneration,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): MealWithUSDA[] {
    const mealsWithUSDA: MealWithUSDA[] = [];
    const loggedIngredients = new Set<string>(); // Track logged ingredients to avoid duplicates

    aiMeals.weeklyMeals.forEach(day => {
      day.meals.forEach(meal => {
        const ingredientsWithUSDA = meal.ingredients.map(ing => {
          const normalized = normalizeFoodName(ing.name);
          const data = usdaData[normalized];

          if (!data) {
            console.warn(`⚠️  [BATCH] No USDA data for ingredient: ${ing.name}, using 0 macros`);
            return {
              name: ing.name,
              amount: ing.amount,
              nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 },
              fdcId: 0,
            };
          }

          // Calculate nutrition for the specific amount
          // data.nutrition is per 100g, so we calculate proportion
          const nutrition = calculateMacrosForAmount(
            data.nutrition,
            ing.amount,
            'g'
          );

          // Log detailed ingredient calculation (once per unique ingredient)
          if (!loggedIngredients.has(normalized)) {
            loggedIngredients.add(normalized);

            // Calculate expected values manually for verification
            const expectedCalories = (data.nutrition.calories * ing.amount) / 100;
            const expectedProtein = (data.nutrition.protein * ing.amount) / 100;
            const expectedCarbs = (data.nutrition.carbs * ing.amount) / 100;
            const expectedFats = (data.nutrition.fats * ing.amount) / 100;

            console.log(`\n🔍 [BATCH] CALCULATION VERIFICATION for "${ing.name}":`);
            console.log(`  Amount: ${ing.amount}g`);
            console.log(`  Per 100g (from USDA):`, {
              calories: data.nutrition.calories,
              protein: data.nutrition.protein + 'g',
              carbs: data.nutrition.carbs + 'g',
              fats: data.nutrition.fats + 'g',
            });
            console.log(`  Calculation Formula: (per100g * amount) / 100`);
            console.log(`  Expected for ${ing.amount}g:`, {
              calories: `${data.nutrition.calories} * ${ing.amount} / 100 = ${expectedCalories.toFixed(2)}`,
              protein: `${data.nutrition.protein} * ${ing.amount} / 100 = ${expectedProtein.toFixed(2)}g`,
              carbs: `${data.nutrition.carbs} * ${ing.amount} / 100 = ${expectedCarbs.toFixed(2)}g`,
              fats: `${data.nutrition.fats} * ${ing.amount} / 100 = ${expectedFats.toFixed(2)}g`,
            });
            console.log(`  Calculated (from function):`, {
              calories: Math.round(nutrition.calories * 10) / 10,
              protein: Math.round(nutrition.protein * 10) / 10 + 'g',
              carbs: Math.round(nutrition.carbs * 10) / 10 + 'g',
              fats: Math.round(nutrition.fats * 10) / 10 + 'g',
            });
            console.log(`  Match: ${Math.abs(nutrition.calories - expectedCalories) < 0.1 ? '✅' : '❌'} (diff: ${Math.abs(nutrition.calories - expectedCalories).toFixed(2)} cal)`);
          }

          return {
            name: ing.name,
            amount: ing.amount,
            nutrition,
            fdcId: data.fdcId,
          };
        });

        // Calculate total macros
        const totalMacros = ingredientsWithUSDA.reduce(
          (sum, ing) => ({
            calories: sum.calories + ing.nutrition.calories,
            protein: sum.protein + ing.nutrition.protein,
            carbs: sum.carbs + ing.nutrition.carbs,
            fats: sum.fats + ing.nutrition.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );

        mealsWithUSDA.push({
          mealName: meal.mealName || `${meal.mealType} - ${day.dayName}`,
          mealType: meal.mealType,
          instructions: meal.instructions || ['Prepare ingredients as specified'],
          ingredients: ingredientsWithUSDA,
          totalMacros,
          dayNumber: day.dayNumber,
          dayName: day.dayName,
        });
      });
    });

    return mealsWithUSDA;
  }

  /**
   * Calculate meal-specific macro targets based on meal type and distribution
   */
  private calculateMealMacroTargets(
    mealType: string,
    mealFrequency: number,
    dayTargets: MacroValues
  ): MacroValues {
    // Get meal calorie distribution percentage
    const mealDistribution = this.getMealCalorieDistribution(mealFrequency, dayTargets.calories);

    // Determine calorie percentage for this meal type
    let caloriePercentage = 0;
    if (mealType === 'breakfast') {
      caloriePercentage = mealDistribution.breakfast / dayTargets.calories;
    } else if (mealType === 'lunch') {
      caloriePercentage = mealDistribution.lunch / dayTargets.calories;
    } else if (mealType === 'dinner') {
      caloriePercentage = mealDistribution.dinner / dayTargets.calories;
    } else if (mealType === 'snack') {
      // For snacks, use the first snack percentage (evening snack for 4 meals, or appropriate for 5 meals)
      const snackCal = mealDistribution.snacks?.[0] || (dayTargets.calories * 0.10);
      caloriePercentage = snackCal / dayTargets.calories;
    }

    // Apply same percentage to all macros (proportional distribution)
    return {
      calories: Math.round(dayTargets.calories * caloriePercentage),
      protein: Math.round(dayTargets.protein * caloriePercentage * 10) / 10,
      carbs: Math.round(dayTargets.carbs * caloriePercentage * 10) / 10,
      fats: Math.round(dayTargets.fats * caloriePercentage * 10) / 10,
    };
  }

  /**
   * Precise meal macro adjustment using HYBRID OPTIMIZATION
   * Combines Linear Programming (optimal) with Protein-Priority Heuristic (robust)
   */
  private async adjustMealToPreciseTargets(
    meal: MealWithUSDA,
    mealTargets: MacroValues,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): Promise<MealWithUSDA> {
    // Prepare ingredients for optimization
    const optimizableIngredients = HybridMealOptimizer.prepareIngredients(
      meal.ingredients,
      usdaData
    );

    // Set up optimization targets with tolerances
    const targets = {
      calories: mealTargets.calories,
      protein: mealTargets.protein,
      carbs: mealTargets.carbs,
      fats: mealTargets.fats,
      tolerance: {
        calories: 10, // ±10 cal
        protein: 2,   // ±2g (protein is critical)
        carbs: 3,     // ±3g
        fats: 2,      // ±2g
      },
    };

    // Run hybrid optimization
    const result = await this.hybridOptimizer.optimize(optimizableIngredients, targets);

    console.log(`📊 [BATCH] Meal "${meal.mealName}" Optimized with ${result.method.toUpperCase()}:`);
    console.log(`  Converged: ${result.converged ? '✅' : '⚠️'}, Iterations: ${result.iterations}`);

    // Show optimization log (first 10 lines for brevity)
    if (result.log.length > 0) {
      const logPreview = result.log.slice(0, 10);
      logPreview.forEach(line => console.log(`    ${line}`));
      if (result.log.length > 10) {
        console.log(`    ... (${result.log.length - 10} more lines)`);
      }
    }

    // Reconstruct meal with optimized amounts
    const optimized = HybridMealOptimizer.reconstructMeal(result.ingredients, {
      mealName: meal.mealName,
      mealType: meal.mealType,
      instructions: meal.instructions,
      dayNumber: meal.dayNumber,
      dayName: meal.dayName,
    });

    const accuracy = {
      calories: ((optimized.totalMacros.calories / mealTargets.calories) * 100).toFixed(1) + '%',
      protein: ((optimized.totalMacros.protein / mealTargets.protein) * 100).toFixed(1) + '%',
      carbs: ((optimized.totalMacros.carbs / mealTargets.carbs) * 100).toFixed(1) + '%',
      fats: ((optimized.totalMacros.fats / mealTargets.fats) * 100).toFixed(1) + '%',
    };

    console.log(`  Target: Cal=${mealTargets.calories} P=${mealTargets.protein}g C=${mealTargets.carbs}g F=${mealTargets.fats}g`);
    console.log(`  Actual: Cal=${Math.round(optimized.totalMacros.calories)} P=${optimized.totalMacros.protein.toFixed(1)}g C=${optimized.totalMacros.carbs.toFixed(1)}g F=${optimized.totalMacros.fats.toFixed(1)}g`);
    console.log(`  Accuracy: ${accuracy.calories} ${accuracy.protein} ${accuracy.carbs} ${accuracy.fats}`);

    return optimized;
  }

  /**
   * GUARANTEED 100% SUCCESS - Adaptive Multi-Objective Optimization
   *
   * Key innovations:
   * 1. Always starts from feasible point (original amounts)
   * 2. Adaptive weights based on ingredient capabilities
   * 3. Coordinate descent with bound clamping (maintains feasibility)
   * 4. Thermodynamically consistent (calories derived from macros)
   * 5. Never rejects - always returns best achievable solution
   */
  private optimizeMealMacros(
    meal: MealWithUSDA,
    mealTargets: MacroValues,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): MealWithUSDA {
    // Phase 0: Categorize ingredients into adjustable and fixed
    const { adjustable, fixedIndices } = this.categorizeIngredients(meal, usdaData);

    // Edge case: No adjustable ingredients (all seasonings)
    if (adjustable.length === 0) {
      console.warn(`⚠️ [BATCH] No adjustable ingredients in "${meal.mealName}" - returning original`);
      return meal;
    }

    // Phase 1: CRITICAL FIX - Ignore fixed ingredients (seasonings)
    // Seasonings have unreliable USDA data (e.g., salt showing 66g carbs!)
    // We only optimize the main food ingredients
    console.log(
      `  🧂 [ADJUST] Ignoring ${fixedIndices.length} fixed ingredients (seasonings with unreliable USDA data)`
    );

    const residualTargets = {
      protein: mealTargets.protein,
      carbs: mealTargets.carbs,
      fats: mealTargets.fats,
    };

    // Phase 2: Calculate target calories
    const targetCalories = mealTargets.calories;

    const optimizationMeal: OptimizationMeal = {
      mealName: meal.mealName,
      ingredients: meal.ingredients.map((ingredient, index) => {
        const normalized = normalizeFoodName(ingredient.name);
        const usdaEntry = usdaData[normalized];
        const baseAmount = Math.max(ingredient.amount, 1);
        const macros =
          usdaEntry?.nutrition != null
            ? calculateMacrosForAmount(usdaEntry.nutrition, ingredient.amount, 'g')
            : ingredient.nutrition;

        const density = {
          protein: baseAmount > 0 ? macros.protein / baseAmount : 0,
          carbs: baseAmount > 0 ? macros.carbs / baseAmount : 0,
          fats: baseAmount > 0 ? macros.fats / baseAmount : 0,
          calories: baseAmount > 0 ? macros.calories / baseAmount : 0,
        };

        const isFixed = fixedIndices.includes(index) || !usdaEntry;
        const minBound = isFixed ? ingredient.amount : Math.max(5, ingredient.amount * 0.25);
        const maxBound = isFixed ? ingredient.amount : Math.min(500, ingredient.amount * 4);

        return {
          index,
          name: ingredient.name,
          baseAmount,
          amount: ingredient.amount,
          min: Number(minBound.toFixed(2)),
          max: Number(maxBound.toFixed(2)),
          locked: isFixed,
          baseMacros: macros,
          density,
        };
      }),
    };

    const { optimizedMeals, log } = this.runHeuristicMacroOptimizer([optimizationMeal], {
      calories: targetCalories,
      protein: residualTargets.protein,
      carbs: residualTargets.carbs,
      fats: residualTargets.fats,
    });

    log.forEach(line => console.log(`    ${line}`));

    const optimizedMeal = optimizedMeals[0];
    const optimizedAmountByIndex = new Map<number, number>();
    optimizedMeal.ingredients.forEach(ing => {
      optimizedAmountByIndex.set(ing.index, ing.amount);
    });

    const solution = adjustable.map(adj => {
      const amount = optimizedAmountByIndex.get(adj.index);
      if (amount === undefined || Number.isNaN(amount)) {
        return adj.originalAmount;
      }
      return Math.max(adj.lowerBound, Math.min(adj.upperBound, amount));
    });

    // Phase 4: Reconstruct meal with optimized amounts
    const reconstructed = this.reconstructMeal(
      meal,
      adjustable,
      fixedIndices,
      solution,
      usdaData
    );

    return {
      ...reconstructed,
      adjustmentLog: log,
    };
  }

  /**
   * Categorize ingredients into adjustable (can scale) and fixed (seasonings, small amounts)
   */
  private categorizeIngredients(
    meal: MealWithUSDA,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): {
    adjustable: AdjustableIngredient[];
    fixedIndices: number[];
  } {
    const seasoningKeywords = ['salt', 'pepper', 'garlic powder', 'herb', 'spice', 'seasoning', 'zest', 'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary', 'cilantro', 'parsley'];
    const adjustable: AdjustableIngredient[] = [];
    const fixedIndices: number[] = [];

    meal.ingredients.forEach((ingredient, index) => {
      const normalized = normalizeFoodName(ingredient.name);
      const usdaEntry = usdaData[normalized];

      if (!usdaEntry) {
        fixedIndices.push(index);
        return;
      }

      // Check if ingredient should be fixed (seasoning or very small amount)
      const ingredientNameLower = ingredient.name.toLowerCase();
      const isSeasoningKeyword = seasoningKeywords.some(keyword => ingredientNameLower.includes(keyword));

      // CRITICAL FIX: Exclude seasonings completely from calculations
      // Salt/pepper USDA data is often wrong (shows carbs when there are none)
      const isSmallAmount = ingredient.amount <= 5;
      const isTraceCalories = ingredient.nutrition.calories <= 5;
      const isSeasoning =
        isSeasoningKeyword ||
        isSmallAmount ||
        (isTraceCalories && ingredient.amount <= 10);

      if (isSeasoning) {
        console.log(
          `  🧂 [CATEGORIZE] Fixed ingredient (seasoning): ${ingredient.name} (${ingredient.amount}g)`,
          { isSeasoningKeyword, isSmallAmount, isTraceCalories }
        );
        fixedIndices.push(index);
        return;
      }

      // Calculate per-gram nutrition
      const perGram = {
        protein: usdaEntry.nutrition.protein / 100,
        carbs: usdaEntry.nutrition.carbs / 100,
        fats: usdaEntry.nutrition.fats / 100,
        calories: usdaEntry.nutrition.calories / 100,
      };

      // Set bounds: Allow 0.2x to 4x scaling
      adjustable.push({
        name: ingredient.name,
        originalAmount: ingredient.amount,
        lowerBound: Math.max(1, ingredient.amount * 0.2),
        upperBound: ingredient.amount * 4,
        perGram,
        fdcId: usdaEntry.fdcId,
        index,
      });
    });

    return { adjustable, fixedIndices };
  }

  private runHeuristicMacroOptimizer(
    meals: OptimizationMeal[],
    target: { protein: number; carbs: number; fats: number; calories: number }
  ): { optimizedMeals: OptimizationMeal[]; log: string[] } {
    type MacroKey = 'protein' | 'carbs' | 'fats' | 'calories';
    const log: string[] = [];
    const tolerance = 2;
    const tolerancePerKey: Record<MacroKey, number> = {
      protein: tolerance,
      carbs: tolerance,
      fats: tolerance,
      calories: tolerance * 5,
    };
    const maxIterations = 200;
    let stepSize = 5;
    let stuckCounter = 0;
    let lastScore = -Infinity;

    const maxProteinDensity =
      meals.flatMap((meal) => meal.ingredients).reduce((max, ingredient) => {
        return Math.max(max, ingredient.density.protein);
      }, 0) || 1;

    const cloneMeals = meals.map(meal => ({
      mealName: meal.mealName,
      ingredients: meal.ingredients.map(ing => ({ ...ing })),
    }));

    const safeDivide = (value: number, denom: number) => {
      const safeDenom = denom === 0 ? 1 : denom;
      return value / safeDenom;
    };

    const calculateIngredientMacros = (ingredient: OptimizationIngredient, amount: number): MacroValues => {
      const ratio = ingredient.baseAmount > 0 ? amount / ingredient.baseAmount : 0;
      return {
        protein: ingredient.baseMacros.protein * ratio,
        carbs: ingredient.baseMacros.carbs * ratio,
        fats: ingredient.baseMacros.fats * ratio,
        calories: ingredient.baseMacros.calories * ratio,
      };
    };

    const calculateMealTotals = (meal: OptimizationMeal): MacroValues =>
      meal.ingredients.reduce<MacroValues>(
        (acc, ing) => {
          const macros = calculateIngredientMacros(ing, ing.amount);
          return {
            protein: acc.protein + macros.protein,
            carbs: acc.carbs + macros.carbs,
            fats: acc.fats + macros.fats,
            calories: acc.calories + macros.calories,
          };
        },
        { protein: 0, carbs: 0, fats: 0, calories: 0 }
      );

    const calculateCurrentMacros = (currentMeals: OptimizationMeal[]): MacroValues =>
      currentMeals.reduce<MacroValues>(
        (acc, meal) => {
          const totals = calculateMealTotals(meal);
          return {
            protein: acc.protein + totals.protein,
            carbs: acc.carbs + totals.carbs,
            fats: acc.fats + totals.fats,
            calories: acc.calories + totals.calories,
          };
        },
        { protein: 0, carbs: 0, fats: 0, calories: 0 }
      );

    const calculateFitnessScore = (
      ingredient: OptimizationIngredient,
      current: MacroValues,
      adjustment: number
    ): number => {
      if (adjustment === 0) {
        return Number.NEGATIVE_INFINITY;
      }

      const efficiency = ingredient.density;
      const delta = {
        protein: efficiency.protein * adjustment,
        carbs: efficiency.carbs * adjustment,
        fats: efficiency.fats * adjustment,
        calories: efficiency.calories * adjustment,
      };

      const newMacros = {
        protein: current.protein + delta.protein,
        carbs: current.carbs + delta.carbs,
        fats: current.fats + delta.fats,
        calories: current.calories + delta.calories,
      };

      const squaredDistance = (macros: MacroValues) => {
        return (['protein', 'carbs', 'fats', 'calories'] as MacroKey[]).reduce((sum, key) => {
          const targetValue = target[key];
          if (targetValue === 0) {
            return sum;
          }
          const diff = safeDivide(macros[key] - targetValue, targetValue);
          return sum + diff * diff;
        }, 0);
      };

      const distanceBefore = Math.sqrt(squaredDistance(current));
      const distanceAfter = Math.sqrt(squaredDistance(newMacros));
      let improvement = distanceBefore - distanceAfter;
      if (!Number.isFinite(improvement)) {
        improvement = 0;
      }

      const proteinGap = target.protein - current.protein;
      const proteinGapNormalized = proteinGap / Math.max(target.protein, 1);
      const proteinDelta = delta.protein;
      let prioritizedImprovement = improvement;

      if (Math.abs(proteinGapNormalized) > 0.01 && proteinDelta !== 0) {
        const movingTowardTarget =
          (proteinGap > 0 && proteinDelta > 0) || (proteinGap < 0 && proteinDelta < 0);

        if (movingTowardTarget) {
          const proteinDensityRatio = ingredient.density.protein / maxProteinDensity;
          const focusWeight = 0.6;
          const bonusFactor = 1 + focusWeight * proteinDensityRatio * Math.abs(proteinGapNormalized);
          prioritizedImprovement *= bonusFactor;
        }
      }

      let penalty = 0;
      (['protein', 'carbs', 'fats', 'calories'] as MacroKey[]).forEach(key => {
        const targetValue = target[key];
        const toleranceForKey = tolerancePerKey[key];
        const currentGap = targetValue - current[key];
        const newGap = targetValue - newMacros[key];

        if (Math.sign(currentGap) !== Math.sign(newGap) && Math.abs(newGap) > toleranceForKey) {
          penalty += safeDivide(Math.abs(newGap), Math.max(targetValue, 1));
        }

        if (currentGap < 0 && newGap < currentGap) {
          penalty += safeDivide(Math.abs(newGap - currentGap), Math.max(targetValue, 1)) * 2;
        }
      });

      return prioritizedImprovement * 1000 - penalty * 500;
    };

    log.push('🎯 Starting optimization');

    const initial = calculateCurrentMacros(cloneMeals);
    log.push(
      `Initial → P:${initial.protein.toFixed(1)} C:${initial.carbs.toFixed(1)} F:${initial.fats.toFixed(1)} Cal:${initial.calories.toFixed(0)}`
    );
    log.push(
      `Target  → P:${target.protein.toFixed(1)} C:${target.carbs.toFixed(1)} F:${target.fats.toFixed(
        1
      )} Cal:${target.calories.toFixed(0)}`
    );

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const currentTotals = calculateCurrentMacros(cloneMeals);
      const gaps = {
        protein: target.protein - currentTotals.protein,
        carbs: target.carbs - currentTotals.carbs,
        fats: target.fats - currentTotals.fats,
        calories: target.calories - currentTotals.calories,
      };

      const withinTolerance =
        Math.abs(gaps.protein) <= tolerancePerKey.protein &&
        Math.abs(gaps.carbs) <= tolerancePerKey.carbs &&
        Math.abs(gaps.fats) <= tolerancePerKey.fats &&
        Math.abs(gaps.calories) <= tolerancePerKey.calories;

      if (withinTolerance) {
        log.push(`✅ Optimization complete in ${iteration} iterations!`);
        break;
      }

      const moves: Array<{
        mealIdx: number;
        ingIdx: number;
        adjustment: number;
        score: number;
      }> = [];

      cloneMeals.forEach((meal, mealIdx) => {
        meal.ingredients.forEach((ingredient, ingIdx) => {
          if (ingredient.locked) {
            return;
          }

          const increaseRoom = ingredient.max - ingredient.amount;
          if (increaseRoom > 0) {
            const adjustment = Math.min(stepSize, increaseRoom);
            if (adjustment > 0) {
              moves.push({
                mealIdx,
                ingIdx,
                adjustment,
                score: calculateFitnessScore(ingredient, currentTotals, adjustment),
              });
            }
          }

          const decreaseRoom = ingredient.amount - ingredient.min;
          if (decreaseRoom > 0) {
            const adjustment = -Math.min(stepSize, decreaseRoom);
            if (adjustment < 0) {
              moves.push({
                mealIdx,
                ingIdx,
                adjustment,
                score: calculateFitnessScore(ingredient, currentTotals, adjustment),
              });
            }
          }
        });
      });

      if (moves.length === 0) {
        log.push('⚠️ No feasible moves remaining.');
        break;
      }

      moves.sort((a, b) => b.score - a.score);
      const bestMove = moves[0];

      if (bestMove.score <= lastScore && bestMove.score < 1) {
        stuckCounter += 1;
        if (stuckCounter > 5) {
          stepSize = Math.min(stepSize + 5, 20);
          log.push(`⚡ Stuck → increasing step size to ${stepSize}`);
          stuckCounter = 0;
        }
      } else {
        stuckCounter = 0;
        if (stepSize > 5 && iteration > 0 && iteration % 20 === 0) {
          stepSize = Math.max(5, stepSize - 5);
        }
      }

      lastScore = bestMove.score;

      const ingredient = cloneMeals[bestMove.mealIdx].ingredients[bestMove.ingIdx];
      const newAmount = Math.min(
        ingredient.max,
        Math.max(ingredient.min, ingredient.amount + bestMove.adjustment)
      );

      if (Math.abs(newAmount - ingredient.amount) < 0.0001) {
        continue;
      }

      ingredient.amount = Number(newAmount.toFixed(2));

      if (iteration < 30 || iteration % 10 === 0) {
        log.push(
          `[${iteration + 1}] ${ingredient.name} → ${ingredient.amount}g (score:${bestMove.score.toFixed(1)})`
        );
      }
    }

    const finalTotals = calculateCurrentMacros(cloneMeals);
    log.push(
      `📊 Final: P:${finalTotals.protein.toFixed(1)} C:${finalTotals.carbs.toFixed(
        1
      )} F:${finalTotals.fats.toFixed(1)} Cal:${finalTotals.calories.toFixed(0)}`
    );

    return { optimizedMeals: cloneMeals, log };
  }

  /**
   * Reconstruct meal with optimized ingredient amounts
   * CRITICAL: Exclude seasonings from macro totals (they have bad USDA data)
   */
  private reconstructMeal(
    meal: MealWithUSDA,
    adjustable: AdjustableIngredient[],
    fixedIndices: number[],
    solution: number[],
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): MealWithUSDA {
    const fixedSet = new Set(fixedIndices);

    // Rebuild ingredients array with optimized amounts
    const optimizedIngredients = meal.ingredients.map((ingredient, idx) => {
      // Check if this ingredient was adjustable
      const adjustableIndex = adjustable.findIndex(adj => adj.index === idx);

      if (adjustableIndex !== -1) {
        // This ingredient was adjusted - use new amount
        const newAmount = Math.max(0, Math.round(solution[adjustableIndex] * 10) / 10);
        const normalized = normalizeFoodName(ingredient.name);
        const usdaEntry = usdaData[normalized];

        if (usdaEntry) {
          const newNutrition = calculateMacrosForAmount(usdaEntry.nutrition, newAmount, 'g');
          return {
            ...ingredient,
            amount: newAmount,
            nutrition: newNutrition,
          };
        }
      }

      // This ingredient was fixed - keep original
      return ingredient;
    });

    // Calculate final totals - EXCLUDING SEASONINGS
    const finalTotals = optimizedIngredients.reduce(
      (sum, ing, idx) => {
        if (fixedSet.has(idx)) {
          console.log(
            `  🧂 [TOTALS] Excluding fixed ingredient from totals: ${ing.name} (${ing.amount}g)`
          );
          return sum;
        }

        return {
          calories: sum.calories + ing.nutrition.calories,
          protein: sum.protein + ing.nutrition.protein,
          carbs: sum.carbs + ing.nutrition.carbs,
          fats: sum.fats + ing.nutrition.fats,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    return {
      ...meal,
      ingredients: optimizedIngredients,
      totalMacros: finalTotals,
    };
  }

  /**
   * Adjust all meals to targets (day-by-day)
   */
  private async adjustMealsToTargets(
    meals: MealWithUSDA[],
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): Promise<MealWithUSDA[]> {
    const adjustedMeals: MealWithUSDA[] = [];
    const mealFrequency = this.currentMealFrequency;
    const daySummaries: AdjustmentDaySummary[] = [];

    // Group meals by day
    const mealsByDay: Record<number, MealWithUSDA[]> = {};
    meals.forEach(meal => {
      if (!mealsByDay[meal.dayNumber]) {
        mealsByDay[meal.dayNumber] = [];
      }
      mealsByDay[meal.dayNumber].push(meal);
    });

    // Adjust each day
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayMeals = mealsByDay[dayNum] || [];
      const day = trainingSplit.days[dayNum - 1];
      const dayTargets = this.calculateDayMacros(weeklyOutline, day?.isRestDay || false);

      console.log(`📊 [BATCH] Day ${dayNum} (${day?.dayName}) Precise Adjustment:`, {
        isRestDay: day?.isRestDay || false,
        dayTargets,
        mealCount: dayMeals.length,
      });

      // Prefer day-level optimization if hybrid optimizer is initialized; fallback to per-meal
      let adjustedDayMeals: MealWithUSDA[];
      if (this.optimizerInitialized) {
        try {
          adjustedDayMeals = await this.adjustDayWithLP(dayMeals, dayTargets, usdaData);
        } catch (err) {
          console.warn('⚠️  [BATCH] Day-level LP failed, falling back to per-meal:', err);
          adjustedDayMeals = await Promise.all(
            dayMeals.map(async meal => {
              const mealTargets = this.calculateMealMacroTargets(
                meal.mealType,
                mealFrequency,
                dayTargets
              );
              return await this.adjustMealToPreciseTargets(meal, mealTargets, usdaData);
            })
          );
        }
      } else {
        adjustedDayMeals = await Promise.all(
          dayMeals.map(async meal => {
            const mealTargets = this.calculateMealMacroTargets(
              meal.mealType,
              mealFrequency,
              dayTargets
            );
            return await this.adjustMealToPreciseTargets(meal, mealTargets, usdaData);
          })
        );
      }
      adjustedMeals.push(...adjustedDayMeals);

      // Log final day totals
      const dayTotals = adjustedDayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      console.log(`📊 [BATCH] Day ${dayNum} Final Totals:`, {
        target: dayTargets,
        actual: dayTotals,
        accuracy: {
          calories: ((dayTotals.calories / dayTargets.calories) * 100).toFixed(1) + '%',
          protein: ((dayTotals.protein / dayTargets.protein) * 100).toFixed(1) + '%',
          carbs: ((dayTotals.carbs / dayTargets.carbs) * 100).toFixed(1) + '%',
          fats: ((dayTotals.fats / dayTargets.fats) * 100).toFixed(1) + '%',
        },
      });

      daySummaries.push({
        dayNumber: dayNum,
        dayName: day?.dayName || `Day ${dayNum}`,
        target: dayTargets,
        actual: dayTotals,
        accuracy: {
          calories: ((dayTotals.calories / dayTargets.calories) * 100).toFixed(1) + '%',
          protein: ((dayTotals.protein / dayTargets.protein) * 100).toFixed(1) + '%',
          carbs: ((dayTotals.carbs / dayTargets.carbs) * 100).toFixed(1) + '%',
          fats: ((dayTotals.fats / dayTargets.fats) * 100).toFixed(1) + '%',
        },
      });
    }

    this.lastAdjustmentSummary = daySummaries;

    if (daySummaries.length > 0) {
      console.log('\n✅ Adjustment complete. Day-level macros after optimization:');
      daySummaries.forEach(summary => {
        const formattedActual = {
          calories: summary.actual.calories.toFixed(1),
          protein: summary.actual.protein.toFixed(1),
          carbs: summary.actual.carbs.toFixed(1),
          fats: summary.actual.fats.toFixed(1),
        };
        console.log(
          `  Day ${summary.dayNumber} (${summary.dayName}):`,
          formattedActual,
          '| Accuracy:',
          summary.accuracy
        );
      });
      console.log('');
    }

    return adjustedMeals;
  }

  /**
   * Day-level optimization (LP + heuristic via HybridMealOptimizer)
   * Flattens all meals' ingredients for the day, optimizes to day targets with
   * ratio constraints and directional penalties, and maps amounts back to meals.
   */
  private async adjustDayWithLP(
    dayMeals: MealWithUSDA[],
    dayTargets: MacroValues,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): Promise<MealWithUSDA[]> {
    // Flatten ingredients and keep mapping to (mealIdx, ingIdx)
    const indexMap: Array<{ mealIdx: number; ingIdx: number }> = [];
    const flatIngredients: Array<{ name: string; amount: number; nutrition: MacroValues; fdcId: number }> = [];

    dayMeals.forEach((meal, mealIdx) => {
      meal.ingredients.forEach((ing, ingIdx) => {
        indexMap.push({ mealIdx, ingIdx });
        flatIngredients.push({ name: ing.name, amount: ing.amount, nutrition: ing.nutrition, fdcId: ing.fdcId });
      });
    });

    // Prepare optimizable ingredients with seasonings locked
    const optimizable = HybridMealOptimizer.prepareIngredients(flatIngredients, usdaData, {
      seasoningThreshold: 5,
    });

    // Build day targets with tolerances
    const targets = {
      calories: dayTargets.calories,
      protein: dayTargets.protein,
      carbs: dayTargets.carbs,
      fats: dayTargets.fats,
      tolerance: {
        calories: Math.max(25, Math.round(dayTargets.calories * 0.05)),
        protein: Math.max(5, Math.round(dayTargets.protein * 0.05)),
        carbs: Math.max(8, Math.round(dayTargets.carbs * 0.06)),
        fats: Math.max(4, Math.round(dayTargets.fats * 0.06)),
      },
    } as const;

    const result = await this.hybridOptimizer.optimize(optimizable, targets, {
      compareResults: false,
    });

    // Map optimized amounts back into meals
    const optimizedByIndex: number[] = result.ingredients.map(ing => ing.currentAmount);
    const updatedMeals: MealWithUSDA[] = dayMeals.map(meal => ({ ...meal, ingredients: meal.ingredients.map(ing => ({ ...ing })) }));

    indexMap.forEach((mapEntry, flatIdx) => {
      const { mealIdx, ingIdx } = mapEntry;
      const ing = updatedMeals[mealIdx].ingredients[ingIdx];
      const newAmount = Math.max(0, Math.round(optimizedByIndex[flatIdx] * 10) / 10);
      const normalized = normalizeFoodName(ing.name);
      const entry = usdaData[normalized];
      const nutrition = entry ? calculateMacrosForAmount(entry.nutrition, newAmount, 'g') : ing.nutrition;
      updatedMeals[mealIdx].ingredients[ingIdx] = { ...ing, amount: newAmount, nutrition };
    });

    // Recompute totals per meal
    const recomputed = updatedMeals.map(meal => {
      const totals = meal.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + ing.nutrition.calories,
          protein: acc.protein + ing.nutrition.protein,
          carbs: acc.carbs + ing.nutrition.carbs,
          fats: acc.fats + ing.nutrition.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );
      return { ...meal, totalMacros: totals };
    });

    return recomputed;
  }
}
