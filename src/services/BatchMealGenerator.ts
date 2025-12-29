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
import { UserProfile, getEffectiveGoalType } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';
import { USDANutritionService } from './USDANutritionService';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { MacroValues, NutritionErrorType } from '../types/nutrition';
import { MacroTargets } from './NutritionCalculationService';
import { calculateMacrosForAmount, extractMacrosFromUSDA, normalizeFoodName } from '../utils/usdaMapper';
import { HybridMealOptimizer } from './optimizers/HybridMealOptimizer';
import { isZeroImpactIngredient, stripDescriptorWords, isSensitiveIngredient } from '../constants/ingredients';
import { HARD_FAILURE_THRESHOLDS, GENERATION_TOLERANCES } from '../constants/validation';
import { selectAndAdjustSupplementMeal, adjustSupplementMealToTarget } from './SupplementMealGenerator';
import { searchNutritionKnowledge, NutritionFact } from '../rag/nutrition/nutritionKnowledgeBase';
import { env } from '../config/env';

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
          amount: z.number().describe('Amount in grams (e.g., 150, 25, 5)'),
          estimatedCalories: z.number().optional().describe('Rough caloric estimate per this amount (e.g., 120)'),
          estimatedProtein: z.number().optional().describe('Rough protein estimate in grams (e.g., 25)'),
          estimatedCarbs: z.number().optional().describe('Rough carbs estimate in grams (e.g., 30)'),
          estimatedFats: z.number().optional().describe('Rough fats estimate in grams (e.g., 10)'),
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
  private lastIngredientResolutionReport: any = null;
  private hybridOptimizer: HybridMealOptimizer;
  private optimizerInitialized: boolean = false;

  // AI-generated supplement meals for protein backup
  private supplementMeals: import('./SupplementMealGenerator').SupplementMeal[] = [];
  private supplementMealsCacheKey: string | null = null;
  private aiTemplateCache = new Map<string, BatchMealGeneration>();
  private usdaDataCache = new Map<
    string,
    Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  >();
  private apiConfig: { apiKey: string; endpoint: string; model: string } | null = null;

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

  /**
   * Set API configuration for AI-based generation
   */
  setApiConfig(apiKey: string, endpoint: string, model: string): void {
    this.apiConfig = { apiKey, endpoint, model };
  }

  public getLastAdjustmentSummary(): AdjustmentDaySummary[] {
    return this.lastAdjustmentSummary;
  }

  public getLastIngredientResolutionReport(): any {
    return this.lastIngredientResolutionReport;
  }

  private isProteinSupplementMeal(meal: MealWithUSDA): boolean {
    if (meal.mealName === 'Protein Shake (Target Boost)') return true;
    const logs = meal.adjustmentLog || [];
    return logs.some((l) => {
      const line = l.toLowerCase();
      return line.includes('protein supplement') || line.includes('precision fallback');
    });
  }

  private async ensureOptimizerInitialized(): Promise<void> {
    if (this.optimizerInitialized) return;
    try {
      await this.hybridOptimizer.initialize();
      this.optimizerInitialized = true;
      console.log('✅ [BATCH] Hybrid optimizer initialized (on-demand)');
    } catch (err) {
      console.warn('⚠️ [BATCH] Hybrid optimizer initialization failed, will use fallback:', err);
      this.optimizerInitialized = false;
    }
  }

  /**
   * Generate all meals for a week using optimal batch approach
   */
  async generateWeeklyMeals(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    dailyTargetsOverride?: MacroTargets[],
    options?: {
      onProgress?: (step: string, progress: number) => void;
      reuseAiTemplate?: boolean;
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
      const dayMacros = this.calculateDayMacros(weeklyOutline, day.isRestDay, index, dailyTargetsOverride);
      return {
        dayNumber: index + 1,
        dayName: day.dayName,
        isRestDay: day.isRestDay,
        macros: dayMacros,
      };
    });
    console.log('📊 [BATCH] Day-by-Day Macro Targets:', dayTargets);

    // Fetch nutrition knowledge (Hard Truths)
    const nutritionFacts = searchNutritionKnowledge('', { minPriority: 5 });
    console.log(`🧠 [BATCH] Retrieved ${nutritionFacts.length} nutritional hard truths from RAG`);

    // Step 0: Generate high-protein supplement meals for backup
    options?.onProgress?.('Generating protein supplement meals...', 5);
    const supplementKey = this.buildSupplementMealsCacheKey(userProfile);
    if (!this.supplementMealsCacheKey || this.supplementMealsCacheKey !== supplementKey || this.supplementMeals.length === 0) {
      await this.generateSupplementMealsForPlan(userProfile);
      this.supplementMealsCacheKey = supplementKey;
      console.log(`✅ [BATCH] Generated ${this.supplementMeals.length} protein supplement meals for backup`);
    } else {
      console.log(`⚡️ [BATCH] Reusing cached protein supplement meals (${this.supplementMeals.length})`);
    }

    // Step 1: Generate all meals with single AI call
    options?.onProgress?.('Generating all meals with AI...', 10);
    const shouldReuseAiTemplate =
      options?.reuseAiTemplate ??
      // Default: reuse templates for long plans unless user explicitly wants "fresh daily"
      (userProfile.mealPrepPreference !== 'fresh_daily' && (userProfile.timelineWeeks || 0) >= 8);

    const cacheKey = this.buildAiTemplateCacheKey(userProfile, weeklyOutline);

    let aiGeneratedMeals: BatchMealGeneration;
    if (shouldReuseAiTemplate && this.aiTemplateCache.has(cacheKey)) {
      const cached = this.aiTemplateCache.get(cacheKey)!;
      aiGeneratedMeals = this.deepCloneAiTemplate(cached);
      console.log(`⚡️ [BATCH] Reusing cached AI meal template for key: ${cacheKey}`);
    } else {
      aiGeneratedMeals = await this.generateWithAI(
        userProfile,
        weeklyOutline,
        trainingSplit,
        nutritionFacts,
        dailyTargetsOverride
      );
      if (shouldReuseAiTemplate) {
        this.aiTemplateCache.set(cacheKey, this.deepCloneAiTemplate(aiGeneratedMeals));
        console.log(`💾 [BATCH] Cached AI meal template for key: ${cacheKey}`);
      }
    }
    console.log(`✅ [BATCH] AI generated ${aiGeneratedMeals.weeklyMeals.length} days of meals`);

    // Validate meal variety (check for duplicate meal names within same day)
    this.validateMealVariety(aiGeneratedMeals);

    // Warn if ingredient names are composite/generic (non-blocking)
    this.validateIngredientSpecificity(aiGeneratedMeals);

    // Validate realistic portion sizes (critical for quality)
    this.validateRealisticPortions(aiGeneratedMeals, weeklyOutline, userProfile);

    // Validate meal health (detect unhealthy cooking methods, incomplete meals, etc.)
    this.validateMealHealth(aiGeneratedMeals);

    // Step 2: Extract unique ingredients
    options?.onProgress?.('Extracting unique ingredients...', 30);
    const uniqueIngredients = this.extractUniqueIngredients(aiGeneratedMeals);
    console.log(`✅ [BATCH] Found ${uniqueIngredients.length} unique ingredients`);

    // Step 3: Batch USDA lookup (parallel)
    options?.onProgress?.('Looking up USDA nutrition data...', 40);
    let usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>;
    const cachedUsda = shouldReuseAiTemplate ? this.usdaDataCache.get(cacheKey) : undefined;
    if (cachedUsda) {
      const missing = uniqueIngredients.filter((name) => !cachedUsda[name]);
      if (missing.length === 0) {
        usdaData = cachedUsda;
        console.log(`⚡️ [BATCH] Reusing cached USDA lookup results for key: ${cacheKey}`);
      } else {
        const lookedUp = await this.batchUSDALookup(missing);
        usdaData = { ...cachedUsda, ...lookedUp };
        this.usdaDataCache.set(cacheKey, usdaData);
        console.log(
          `♻️ [BATCH] Extended cached USDA lookup for key: ${cacheKey} (+${missing.length} ingredients)`
        );
      }
    } else {
      usdaData = await this.batchUSDALookup(uniqueIngredients);
      if (shouldReuseAiTemplate) {
        this.usdaDataCache.set(cacheKey, usdaData);
      }
    }
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
      usdaData,
      dailyTargetsOverride
    );
    console.log(`✅ [BATCH] Adjusted meals to match targets`);

    // Convert to day-by-day format (array of arrays)
    let dayMeals: MealWithUSDA[][] = [];
    for (let day = 1; day <= 7; day++) {
      dayMeals.push(adjustedMeals.filter((meal: MealWithUSDA) => meal.dayNumber === day));
    }

    // Step 6: PROTEIN SUPPLEMENTATION - Ensure protein targets are ALWAYS met
    // This is a CRITICAL fallback when LP optimizer can't hit protein targets
    options?.onProgress?.('Ensuring protein targets...', 90);
    dayMeals = await this.ensureProteinTargets(
      userProfile,
      dayMeals,
      weeklyOutline,
      trainingSplit,
      usdaData,
      dailyTargetsOverride
    );
    console.log(`✅ [BATCH] Ensured protein targets are met for all days`);

    // Step 6.5: Re-adjust to calorie targets after supplementation (supplements locked)
    // Protein supplementation can add calories; this pass brings totals back to the correct day targets.
    options?.onProgress?.('Finalizing calories after supplements...', 93);
    const postSupplementAdjustedMeals = await this.adjustMealsToTargets(
      dayMeals.flat(),
      weeklyOutline,
      trainingSplit,
      usdaData,
      dailyTargetsOverride
    );
    dayMeals = [];
    for (let day = 1; day <= 7; day++) {
      dayMeals.push(postSupplementAdjustedMeals.filter((meal: MealWithUSDA) => meal.dayNumber === day));
    }

    // Step 6.75: GUARANTEE protein targets after any calorie-only adjustments
    // Even with supplement meals locked, per-meal adjustments can occasionally reduce protein in other meals.
    // Protein is the only hard-fail invariant, so we re-run supplementation as the final step before validation.
    options?.onProgress?.('Guaranteeing final protein targets...', 95);
    dayMeals = await this.ensureProteinTargets(
      userProfile,
      dayMeals,
      weeklyOutline,
      trainingSplit,
      usdaData,
      dailyTargetsOverride
    );

    // COMPREHENSIVE VALIDATION - Check all targets are met
    const validation = this.validateAndReportAccuracy(
      dayMeals,
      weeklyOutline,
      trainingSplit,
      dailyTargetsOverride
    );

    console.log('\n' + '='.repeat(80));
    console.log('📊 MEAL GENERATION VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(validation, null, 2));
    console.log('='.repeat(80) + '\n');

    // HARD VALIDATION: Protein targets MUST be met
    // - Cuts (fat loss): NEVER undershoot protein
    // - Other goals: allow small deficit (threshold) before hard-failing
    const effectiveGoal = getEffectiveGoalType(userProfile.goalCategory || 'maintenance');
    const strictProtein = effectiveGoal === 'fat_loss' || userProfile.goal === 'fat_loss';
    const PROTEIN_TOLERANCE_PERCENTAGE = strictProtein ? 0 : HARD_FAILURE_THRESHOLDS.PROTEIN_DEFICIT_PERCENTAGE;
    const proteinErrors: string[] = [];

    const PROTEIN_EPSILON_GRAMS = 0.5; // avoid false-fails from rounding/USDA float math

    validation.dailyBreakdown.forEach((day: any) => {
      const actualProtein = Number(day?.actual?.protein ?? 0);
      const targetProtein = Number(day?.target?.protein ?? 0);
      if (targetProtein <= 0) return;

      const deficit = targetProtein - actualProtein;
      const deficitPercentage = deficit / targetProtein;

      const isFailure = strictProtein
        ? deficit > PROTEIN_EPSILON_GRAMS
        : deficitPercentage > PROTEIN_TOLERANCE_PERCENTAGE;

      if (isFailure) {
        proteinErrors.push(
          `Day ${day.dayNumber} (${day.dayName}): Protein ${actualProtein.toFixed(1)}g vs target ${targetProtein.toFixed(1)}g (${deficit.toFixed(1)}g deficit, ${((actualProtein / targetProtein) * 100).toFixed(1)}% accuracy)`
        );
      }
    });

    if (proteinErrors.length > 0) {
      console.error('\n🚨 CRITICAL: PROTEIN TARGETS NOT MET!');
      console.error('The following days have protein below acceptable threshold:');
      proteinErrors.forEach(err => console.error(`  ❌ ${err}`));
      console.error('\nThis is a HARD FAILURE - protein targets are critical for muscle retention.');

      // Throw error to prevent invalid plan from being saved
      throw new Error(
        `PROTEIN VALIDATION FAILED: ${proteinErrors.length} day(s) below protein target.\n` +
        proteinErrors.join('\n') +
        '\n\nProtein targets are critical for muscle retention and cannot be compromised.'
      );
    }

    // Also check weekly protein totals
    const weeklyActualProtein = Number(validation?.weeklyTotals?.actual?.protein ?? 0);
    const weeklyTargetProtein = Number(validation?.weeklyTotals?.target?.protein ?? 0);
    if (weeklyTargetProtein > 0) {
      const weeklyDeficit = weeklyTargetProtein - weeklyActualProtein;
      const weeklyDeficitPercentage = weeklyDeficit / weeklyTargetProtein;

	      const isWeeklyFailure = strictProtein
	        ? weeklyDeficit > PROTEIN_EPSILON_GRAMS * 7
	        : weeklyDeficitPercentage > PROTEIN_TOLERANCE_PERCENTAGE;

	      if (isWeeklyFailure) {
	        throw new Error(
	          `WEEKLY PROTEIN VALIDATION FAILED: Total weekly protein ${weeklyActualProtein.toFixed(1)}g ` +
	            `vs target ${weeklyTargetProtein.toFixed(1)}g (${weeklyDeficit.toFixed(1)}g deficit).\n` +
	            `Weekly accuracy: ${((weeklyActualProtein / weeklyTargetProtein) * 100).toFixed(1)}%\n` +
	            `Protein targets are critical for muscle retention and cannot be compromised.`
	        );
	      }
	    }

    console.log('✅ PROTEIN VALIDATION PASSED: All days meet protein targets');

    options?.onProgress?.('Batch meal generation complete!', 100);
    return dayMeals;
  }

  private buildAiTemplateCacheKey(userProfile: UserProfile, weeklyOutline: WeeklyOutline): string {
    const goal = userProfile.goalCategory || userProfile.goal || 'unknown_goal';
    const mealFrequency = userProfile.mealFrequency || 4;
    const phase = (weeklyOutline.phase || 'unknown_phase').toLowerCase();
    const prefs = (userProfile.preferences || '').toLowerCase().trim();
    const dietType = (userProfile.dietType || '').toLowerCase();
    const cuisine = (userProfile.cuisinePreferences || []).join(',').toLowerCase();
    const prep = (userProfile.mealPrepPreference || '').toLowerCase();
    return [goal, phase, `meals:${mealFrequency}`, `diet:${dietType}`, `cuisine:${cuisine}`, `prep:${prep}`, `prefs:${prefs}`]
      .join('|');
  }

  private buildSupplementMealsCacheKey(userProfile: UserProfile): string {
    const goal = userProfile.goalCategory || userProfile.goal || 'unknown_goal';
    const prefs = (userProfile.preferences || '').toLowerCase().trim();
    const dietType = (userProfile.dietType || '').toLowerCase();
    const allergies = (userProfile.allergies || []).join(',').toLowerCase();
    const cuisine = (userProfile.cuisinePreferences || []).join(',').toLowerCase();
    return [goal, `diet:${dietType}`, `allergies:${allergies}`, `cuisine:${cuisine}`, `prefs:${prefs}`].join('|');
  }

  private deepCloneAiTemplate(template: BatchMealGeneration): BatchMealGeneration {
    try {
      // Node 17+/modern browsers
      return structuredClone(template);
    } catch {
      return JSON.parse(JSON.stringify(template)) as BatchMealGeneration;
    }
  }

  /**
   * COMPREHENSIVE VALIDATION - Verify all targets are met
   * Returns detailed JSON report for debugging
   */
  private validateAndReportAccuracy(
    dayMeals: MealWithUSDA[][],
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    dailyTargetsOverride?: MacroTargets[]
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
      const dayTargets = this.calculateDayMacros(
        weeklyOutline,
        day?.isRestDay || false,
        dayIndex,
        dailyTargetsOverride
      );

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
    trainingSplit: any,
    nutritionFacts: NutritionFact[] = [],
    dailyTargetsOverride?: MacroTargets[]
  ): Promise<BatchMealGeneration> {
    // Check if AI is available
    const isAIAvailable = this.cotService.isAIAvailable && this.cotService.isAIAvailable();

    if (!isAIAvailable) {
      throw new Error('AI service (Groq) is required for meal generation. Please ensure VITE_GROQ_API_KEY is set.');
    }

    // Build prompt for all 7 days
    const prompt = this.buildBatchMealPrompt(userProfile, weeklyOutline, trainingSplit, nutritionFacts, dailyTargetsOverride);

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
    trainingSplit: any,
    nutritionFacts: NutritionFact[] = [],
    dailyTargetsOverride?: MacroTargets[]
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
    const dietaryGuidance = this.buildDietaryGuidance(userProfile);
    console.log('[BatchMealGenerator] Full User Profile used for prompt:', JSON.stringify(userProfile, null, 2));
    console.log('[BatchMealGenerator] Constructed Dietary Guidance snippet:', dietaryGuidance);

    // Build day information
    const dayInfo = trainingSplit.days.map((day: { dayName: string; isRestDay: boolean }, index: number) => {
      const dayMacros = this.calculateDayMacros(weeklyOutline, day.isRestDay, index, dailyTargetsOverride);
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

    const mealPrepStyle = userProfile.mealPrepPreference || 'fresh_daily';

    return `You are an expert nutritionist generating a complete weekly meal plan. Generate ALL 7 days of meals in a single response.

🚨 CRITICAL RULE #1 - MEAL VARIETY:
${mealPrepStyle === 'fresh_daily' ? `
✅ REQUIREMENT: EACH DAY MUST HAVE COMPLETELY DIFFERENT MEALS FOR EACH MEAL TYPE. Every single breakfast, lunch, and dinner in the 7-day plan must be a UNIQUE recipe. Do not repeat meals across the week.
` : mealPrepStyle === 'batch_cooking' ? `
✅ REQUIREMENT: YOU MUST USE REPETITION TO ASSIST BATCH PREP. Choose 3-4 core recipes for lunch and dinner and repeat them throughout the week (e.g., Monday Lunch == Wednesday Lunch == Friday Lunch).
` : `
✅ REQUIREMENT: YOU MUST USE A "COOK ONCE, EAT TWICE" LEFTOVER STRATEGY. Usually, the dinner from one day should be the lunch for the following day (e.g., Monday Dinner == Tuesday Lunch).
`}

❌ FORBIDDEN: Repeating the same meal name for breakfast, lunch, and dinner ON THE SAME DAY. Each meal type (breakfast, lunch, dinner, snack) within a single day MUST be different.

MEAL TYPE GUIDELINES:
- Breakfast: Should include breakfast foods (eggs, oatmeal, yogurt, toast, smoothies, etc.)
- Lunch: Should include lunch foods (salads, sandwiches, wraps, bowls, etc.)
- Dinner: Should include dinner foods (protein + sides, stir-fries, pasta dishes, etc.)
- Snack: Should be snack-appropriate (nuts, fruit, protein bars, smoothies, etc.). Snacks are flexible gap-fillers and may be small or substantial depending on the remaining daily calorie/macro gap after main meals.

INGREDIENT NAMING RULES (MUST FOLLOW):
- List individual, base ingredients only. Do NOT use composite/generic names.
- Forbidden terms in ingredient names: "mixed", "blend", "assorted", "pack", "combo".
- Do NOT use prepared dish names as ingredient names (e.g., "turkey burger", "wrap", "sandwich", "burrito"). Instead list each component explicitly.
- **RAW INGREDIENT DECOMPOSITION**: For complex traditional dishes, ALWAYS use the authentic dish name as the \`mealName\` property, but list the RAW components as ingredients. 
  - *Example*: For "Ugali and Sukumawiki", ingredients should be ["Maize Flour", "Water", "Kale/Collard Greens", "Onion", "Tomato", "Oil", "Salt"]. 
  - NEVER use the dish name (e.g., "Ugali") as an ingredient itself.

🚨 CUISINE AUTHENTICITY:
- If a user specifies a regional cuisine (e.g., "Kenyan", "Nigerian", "Indian"), you MUST use recognized, authentic dish names for that region.
- Avoid generic names like "Kenyan Breakfast Platter" or "African Stew". Instead use "Ugali with Sukumawiki", "Jollof Rice with Grilled Chicken", "Githeri", etc.
- Research or use your internal knowledge of the specific cuisine to ensure the meal composition is culturally accurate while hitting the macro targets.

USER PROFILE:
- Goal: ${userProfile.goal}
- Meal Frequency: ${mealFrequency} meals per day

${dietaryGuidance}

WEEKLY TARGETS (Daily Averages):
- Calories: ${dailyTargets.calories} kcal/day
- Protein: ${dailyTargets.protein}g/day (${dailyTargets.proteinPerKg}g/kg)
- Carbs: ${dailyTargets.carbs}g/day
- Fats: ${dailyTargets.fat}g/day



DAY-BY-DAY TARGETS:
${dayInfo.map((day: { dayNumber: number; dayName: string; isTrainingDay: boolean; macros: MacroValues; mealTargets: any }) => `
Day ${day.dayNumber} (${day.dayName} - ${day.isTrainingDay ? 'Training' : 'Rest'}):
- Daily Calories: ${day.macros.calories} kcal
- Daily Protein: ${day.macros.protein}g
- Daily Carbs: ${day.macros.carbs}g
- Daily Fats: ${day.macros.fats}g
- Meal Targets: Breakfast ~${day.mealTargets.breakfast} cal, Lunch ~${day.mealTargets.lunch} cal, Dinner ~${day.mealTargets.dinner} cal${day.mealTargets.snacks ? `, Snacks: ${day.mealTargets.snacks.map((s: number) => `~${s} cal`).join(', ')}` : ''}
`).join('')}

${nutritionFacts.length > 0 ? `
🚨 NUTRITIONAL HARD TRUTHS & PRINCIPLES:
${nutritionFacts.map(f => `- ${f.content}`).join('\n')}
` : ''}

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

🍽️ PRIORITY #3: MEAL VARIETY & LOGIC
- ✅ Within any single day: Breakfast ≠ Lunch ≠ Dinner.
- ✅ Across the week: ${mealPrepStyle === 'fresh_daily' ? 'Maximize variety' : 'Follow the prep strategy mentioned above'}.
- ✅ Portions: If a meal/recipe name is repeated, the ingredients and weights MUST be 100% identical

    4. **MEAL CALORIE TARGETS & SNACK STRATEGY**:
       - 🚨 **PRIMARY GOAL**: The SUM of all meals for the day MUST equal the Daily Calorie Target (±100 kcal).
       - **MAIN MEALS (Breakfast, Lunch, Dinner)**: These correspond to the bulk of the calories. DO NOT CAP THEM. If a day requires 3500kcal, your Breakfast/Lunch/Dinner might need to be 1000-1200kcal each. This is correct. Do not shrink them.
       - **SNACKS AS SUPPLEMENTS**: Treat snacks as "Gap Fillers".
         - First, maximize the main meals to be substantial and satisfying.
         - Then, size the Snack(s) to bridge the gap to the final Daily Target.
         - If the gap is small (150kcal), generate a small snack. If the gap is large (500kcal), generate a substantial snack.
       - **DO NOT** generate small main meals and rely on massive snacks to make up the difference (unless specified).
       - **DO NOT** undershoot the total.
       
5. **MACRO CALCULATION GUIDANCE - CRITICAL FOR ACCURACY**:
   Use these approximate macro values per 100g to estimate ingredient amounts:

    **HIGH PROTEIN SOURCES** (for protein targets):
    - Lean Poultry (Breast): 30g protein, 2g fat, 140 cal/100g
    - Lean Red Meat: 26g protein, 10g fat, 200 cal/100g
    - Oily Fish (Salmon): 20g protein, 12g fat, 200 cal/100g
    - White Fish (Cod/Tilapia): 18g protein, 1g fat, 85 cal/100g
    - Eggs (Large): 6g protein, 5g fat, 70 cal/item
    - Plant Protein (Tofu/Tempeh): 10-20g protein, 5-10g fat, 100-200 cal/100g
    - Legumes (Lentils/Beans): 8g protein, 20g carbs, 120 cal/100g

    **CARBOHYDRATE SOURCES**:
    - Grains (Rice/Quinoa cooked): 2.5g protein, 25g carbs, 120 cal/100g
    - Starchy Veg (Potato/Sweet Potato): 2g protein, 20g carbs, 90 cal/100g
    - Pasta/Bread: 4g protein, 25-45g carbs, 130-250 cal/100g
    - Fruits: 1g protein, 12-23g carbs, 50-90 cal/100g

    **HEALTHY FATS**:
    - Oils/Butter: 0g protein, 100g fat, 880 cal/100g (9g per tbsp)
    - Nuts/Seeds: 15-20g protein, 50g fat, 600 cal/100g

    > [!IMPORTANT]
    > These examples are for MATHEMATICAL REFERENCE ONLY. Do not use them as a default menu. You MUST prioritize the USER'S CUISINE and DISLIKES above these examples.

    **CALCULATION EXAMPLE**:
    To hit ~500 cal with ~40g protein:
    1. Protein: 150g of a 25g protein/100g source (≈38g protein, ≈10g fat, ≈240 cal)
    2. Carbs: 150g of a 20g carb/100g source (≈30g carbs, ≈135 cal)
    3. Fats: 1/2 tbsp oil + fiber veg (≈120 cal)
    Total: ~40g protein, ~30g carbs, ~15g fat, ~500 cal.

    **ACCURACY REQUIREMENTS**:
    - Protein: ±15% of target
    - Calories: ±10% of target

   **IMPORTANT**: These are approximations. The system will verify with USDA data and auto-adjust portions to hit exact targets.

🚨 **CRITICAL: REALISTIC PORTION SIZES - MUST FOLLOW**:
   You MUST use realistic, authentic serving sizes. Unrealistic portions will be rejected.

   **INGREDIENT-SPECIFIC MAXIMUM LIMITS (per serving)**:
   - Flour/Bread/Pasta: MAX 150g (typical: 50-100g for bread/pasta, 30-80g for flour in baked goods)
   - Rice/Grains (cooked): MAX 200g (typical: 100-150g)
   - Potatoes/Sweet Potatoes: MAX 300g (typical: 150-250g)
   - Green Bananas/Plantains: MIN 200g for main dishes like Matoke (typical: 200-400g), not 50g!
   - Onions: MAX 100g (typical: 50-80g for cooking)
   - Leafy Greens (Kale, Spinach): MAX 200g (typical: 100-150g)
   - Protein Sources: 100-250g depending on type (chicken breast: 150-200g, beef: 150-250g)
   - Oils/Fats: MAX 15g (typical: 5-10g for cooking)
   - Legumes/Beans (cooked): MAX 250g (typical: 150-200g)

   **PROTEIN-RICH MEAL REQUIREMENT**:
   - EVERY main meal (breakfast, lunch, dinner) MUST have at least 25g protein
   - Snacks MUST have at least 15g protein
   - Protein density: Aim for at least 0.15g protein per calorie (e.g., 500 cal meal = 75g protein minimum)
   - Prioritize lean protein sources: chicken, fish, lean beef, eggs, legumes, tofu
   - If a dish is low in protein (e.g., chapati, ugali), you MUST pair it with a protein source (meat, beans, eggs)

🚨 **HEALTH & COOKING METHOD REQUIREMENTS** (SYSTEMATIC DETECTION):

   **FORBIDDEN COOKING METHODS** (automatically detected and rejected):
   - Deep frying: Any instruction containing "fry", "fried", "deep fry", "deep-fried" is FORBIDDEN
   - Heavy pan-frying with excessive oil (>15g oil indicates deep frying)
   - These methods create unhealthy trans fats and excessive calorie density
   - Examples of FORBIDDEN: "Fry mandazi in oil", "Deep-fried chicken", "Fried dough"

   **REQUIRED COOKING METHODS** (preferred):
   - Grilling, baking, steaming, boiling, light sautéing (≤10g oil), roasting
   - These methods preserve nutrients and minimize unhealthy fat absorption
   - For traditional fried foods, use healthier alternatives: "Baked mandazi" instead of "Fried mandazi"

   **AUTOMATIC HEALTH VALIDATION** (system will check):
   1. Cooking method: Does NOT use deep frying or heavy frying
   2. Sugar content: Added sugars ≤15g per serving
   3. Protein density: ≥0.15g protein per calorie for main meals
   4. Refined carbs: If using refined flour/grains, MUST pair with ≥25g protein
   5. Meal completeness: At least 3 ingredients (not single-ingredient meals like "Mango" or "Banana")

   **UNHEALTHY PATTERN DETECTION** (systematic rules, not manual lists):
   The system automatically rejects meals that:
   - Contain "fry" or "fried" in instructions (deep-fried foods like mandazi, donuts)
   - Have >15g added sugar
   - Have refined carbs without adequate protein pairing
   - Are single-ingredient (incomplete meals)
   - Have protein density <0.15g per calorie

   **EXAMPLES OF UNHEALTHY MEALS TO AVOID**:
   ❌ "Mandazi" with "Fry mandazi in oil" instruction → Use "Baked mandazi" instead
   ❌ "Fried chicken" → Use "Grilled chicken" or "Baked chicken" instead
   ❌ "Chapati" alone (refined carbs, no protein) → Make "Chapati with beans/eggs"
   ❌ Just "Mango" (incomplete) → Make "Mango with Greek Yogurt and Nuts"

   **EXAMPLES OF HEALTHY ALTERNATIVES**:
   ✅ "Baked mandazi" (if culturally appropriate, use baking instead of frying)
   ✅ "Grilled chicken" instead of fried
   ✅ "Chapati with beans/eggs" (protein pairing)
   ✅ "Mango Protein Smoothie" (complete meal with protein)

   **CALORIE RANGE VALIDATION**:
   - Breakfast: Must be within ±10% of target (e.g., if target is 600 cal, range is 540-660 cal)
   - Lunch: Must be within ±10% of target
   - Dinner: Must be within ±10% of target
   - Snacks: Must be within ±15% of target (more flexible for smaller meals)
   - If a meal is outside range, adjust ingredient amounts to bring it within range

6. For each meal, provide:
   - **Meal name**: A creative, descriptive name based on the ingredients (e.g., "Avocado Toast with Poached Eggs", "Grilled Salmon with Quinoa and Asparagus", "Protein Acai Bowl with Berries", "Mediterranean Chicken Wrap"). Use descriptive names that reflect the actual meal composition, not generic names like "breakfast" or "lunch".
   - Meal type (breakfast, lunch, dinner, snack)
   - List of ingredients with amounts in grams. **Include at least 5 ingredients per meal**, covering primary components plus cooking fats (oil/butter), aromatics, spices, sauces, and garnishes (e.g., olive oil, garlic, salt, pepper, lemon juice, fresh herbs).
   - **Estimated Macros PER INGREDIENT**: Provide rough estimates for calories, protein, carbs, and fats for EACH ingredient. These will be used as a fallback if USDA data lookup fails for rare items.
   - **Cooking instructions**: Provide 4-6 clear, step-by-step cooking instructions covering prep, cooking, finishing, and plating. Be specific about cooking methods, temperatures, times, and techniques. Examples:
     * For steak: ["Season steak with salt and pepper on both sides", "Heat grill or pan to high heat", "Cook steak for 4-5 minutes per side for medium-rare", "Rest for 5 minutes before slicing"]
     * For chicken: ["Preheat oven to 400°F", "Season chicken with herbs and spices", "Bake for 25-30 minutes until internal temperature reaches 165°F", "Let rest 5 minutes before serving"]
     * For pasta: ["Bring large pot of salted water to boil", "Add pasta and cook according to package directions", "Drain and toss with sauce", "Garnish with fresh herbs"]
   - Estimated macros (these will be verified with USDA data later)
6. **HEALTH & PROTEIN PRIORITY**:
   - Meals MUST be protein-rich (see protein requirements above)
   - Limit unhealthy options: Avoid excessive fried foods, refined carbs without protein pairing
   - Ensure balanced macros: Even traditional dishes should be paired with protein sources
   - Example: Chapati alone is NOT acceptable - pair with beans, meat, or eggs
   - Example: Matoke alone is NOT acceptable - pair with groundnuts, beans, or meat

7. Training days can have more carbs, rest days can have more fats
8. **Meal names should be creative and appetizing**, reflecting the actual ingredients and preparation style
9. **Instructions must be detailed and actionable** - users need to know how to actually cook the meal
10. Include realistic pantry staples (oils, vinegars, citrus, aromatics, herbs) wherever appropriate so meals feel complete and flavorful

**PORTION SIZE VALIDATION CHECKLIST** (verify before submitting):
- ✅ No ingredient exceeds its maximum limit (see limits above)
- ✅ Traditional dishes use culturally appropriate portions (e.g., Matoke uses 200-400g plantain, not 50g)
- ✅ Each meal has adequate protein (25g+ for main meals, 15g+ for snacks)
- ✅ Each meal is within calorie target range (±10% for main meals, ±15% for snacks)
- ✅ Protein density is adequate (0.15g protein per calorie minimum)

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

🚨 FATAL EXCLUSIONS (DOUBLE CHECK):
${(userProfile.dislikedIngredients || []).length > 0 ? `- STRICTLY FORBIDDEN: ZERO instances of ${(userProfile.dislikedIngredients || []).join(', ').toUpperCase()} in ANY meal.` : ''}
${(userProfile.cuisinePreferences || []).length > 0 ? `- CUISINE REQUIREMENT: ALL main meals MUST be authentic ${(userProfile.cuisinePreferences || []).join(', ').toUpperCase()} dishes.` : ''}

Generate all 7 days of meals now.`;
  }

  /**
   * Build detailed dietary guidance based on user preferences
   * Similar to how workout generation handles equipment constraints
   */
  private buildDietaryGuidance(profile: UserProfile): string {
    const preferences = profile.preferences || '';
    const dietType = profile.dietType || 'None';
    const allergies = profile.allergies || [];
    const cuisinePreferences = profile.cuisinePreferences || [];
    const dislikedIngredients = profile.dislikedIngredients || [];
    const likedIngredients = profile.likedIngredients || [];
    const mealComplexity = profile.mealComplexity || 'moderate';
    const mealPrepPreference = profile.mealPrepPreference || 'fresh_daily';

    let guidance = `DIETARY PROFILE & CRITICAL CONSTRAINTS:\n`;
    guidance += `=========================================\n\n`;

    guidance += `🎯 DIET TYPE: ${dietType.toUpperCase()}\n`;
    guidance += `🏗️ CUISINE STYLE: ${cuisinePreferences.length > 0 ? cuisinePreferences.join(', ').toUpperCase() : 'ANY / VARIED'}\n`;
    guidance += `🛑 ALLERGIES (FATAL - ZERO TOLERANCE): ${allergies.length > 0 ? allergies.join(', ').toUpperCase() : 'NONE'}\n`;
    guidance += `❌ DISLIKED / FORBIDDEN INGREDIENTS: ${dislikedIngredients.length > 0 ? dislikedIngredients.join(', ').toUpperCase() : 'NONE'}\n`;
    guidance += `❤️ PREFERRED / LIKED INGREDIENTS: ${likedIngredients.length > 0 ? likedIngredients.join(', ').toUpperCase() : 'NONE'}\n`;
    guidance += `🍳 MEAL COMPLEXITY: ${mealComplexity.toUpperCase()}\n`;
    guidance += `📦 MEAL PREP STYLE: ${mealPrepPreference.toUpperCase()}\n`;
    guidance += `📝 ADDITIONAL NOTES: "${preferences}"\n\n`;

    guidance += `⚠️ CRITICAL COMPLIANCE RULES (MANDATORY):\n`;
    guidance += `1. CUISINE ADHERENCE: If a cuisine is specified (e.g., "${cuisinePreferences.join(', ')}"), EVERY main meal must be authentically from that cuisine. No generic Western meals.\n`;
    guidance += `2. FATAL EXCLUSIONS: You MUST NOT include any ingredients listed in ALLERGIES or DISLIKED INGREDIENTS.\n`;

    // Strategy based on prep preference
    if (mealPrepPreference === 'fresh_daily') {
      guidance += `3. VARIETY (MAXIMAL): Every single breakfast, lunch, and dinner in the 7-day plan must be a UNIQUE recipe. Do not repeat meals.\n`;
    } else if (mealPrepPreference === 'batch_cooking') {
      guidance += `3. VARIETY (BATCH PREP): You should repeat 3-4 core recipes for lunch and dinner throughout the week (e.g., "Monday Lunch" is the same as "Wednesday Lunch" and "Friday Lunch"). This simplifies bulk cooking.\n`;
    } else if (mealPrepPreference === 'leftovers_ok') {
      guidance += `3. VARIETY (LEFTOVERS): Use a "cook once, eat twice" strategy. For example, Monday's Dinner should usually be the same as Tuesday's Lunch.\n`;
    }

    guidance += `4. PORTION CONSISTENCY: If a meal/recipe is repeated on different days, the ingredient AMOUNTS in grams must remain EXACTLY identical. Do not adjust a repeated recipe to fit daily targets; instead, allow the daily totals to be slightly off or adjust non-repeated snacks.\n\n`;

    // Complexity guidance
    if (mealComplexity === 'simple') {
      guidance += `👨‍🍳 COOKING GUIDANCE (SIMPLE): Keep recipes to 5-8 ingredients. Use quick cooking methods (stir-fry, boiling, raw). Avoid complex prep like marinating for hours.\n`;
    } else if (mealComplexity === 'complex') {
      guidance += `👨‍🍳 COOKING GUIDANCE (CHEF): Feel free to use 12+ ingredients per meal. Use advanced techniques: slow roasting, fermenting, marinating, and multiple pan components.\n`;
    } else {
      guidance += `👨‍🍳 COOKING GUIDANCE (MODERATE): Use 7-10 ingredients per meal. Standard home cooking techniques.\n`;
    }

    // Inject diet-specific rules if detected
    const lowPrefs = (preferences + ' ' + dietType).toLowerCase();
    if (lowPrefs.includes('vegan')) {
      guidance += `🌱 VEGAN DIET RULES: No meat, poultry, fish, dairy, eggs, or honey. Use plant proteins (tofu, lentils, beans, seitan) exclusively.\n`;
    } else if (lowPrefs.includes('vegetarian')) {
      guidance += `🥚 VEGETARIAN DIET RULES: No meat, poultry, or fish. Dairy and eggs are allowed.\n`;
    } else if (lowPrefs.includes('pescatarian')) {
      guidance += `🐟 PESCATARIAN DIET RULES: No meat or poultry. Fish, seafood, eggs, and dairy are allowed.\n`;
    }

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
   * Validate realistic portion sizes for ingredients
   * Catches unrealistic portions like 500g flour for chapati or 50g green banana for matoke
   */
  private validateRealisticPortions(
    meals: BatchMealGeneration,
    weeklyOutline: WeeklyOutline,
    userProfile: UserProfile
  ): void {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Define ingredient-specific maximum limits (in grams)
    const ingredientLimits: Record<string, { max: number; typical: string; cultural?: Record<string, { min?: number; max: number; typical: string }> }> = {
      'wheat flour': { max: 150, typical: '50-100g for bread/pasta, 30-80g for baked goods' },
      'flour': { max: 150, typical: '50-100g for bread/pasta, 30-80g for baked goods' },
      'maize flour': { max: 150, typical: '80-120g for ugali' },
      'rice': { max: 200, typical: '100-150g cooked' },
      'potato': { max: 300, typical: '150-250g' },
      'sweet potato': { max: 300, typical: '150-250g' },
      'green banana': {
        max: 400,
        typical: '200-400g for main dishes like Matoke',
        cultural: {
          'kenyan': { min: 200, max: 400, typical: '200-400g for Matoke (NOT 50g!)' }
        }
      },
      'plantain': {
        max: 400,
        typical: '200-400g for main dishes',
        cultural: {
          'kenyan': { min: 200, max: 400, typical: '200-400g for Matoke (NOT 50g!)' }
        }
      },
      'onion': { max: 100, typical: '50-80g for cooking' },
      'kale': { max: 200, typical: '100-150g' },
      'spinach': { max: 200, typical: '100-150g' },
      'collard greens': { max: 200, typical: '100-150g' },
      'oil': { max: 15, typical: '5-10g for cooking' },
      'olive oil': { max: 15, typical: '5-10g for cooking' },
      'vegetable oil': { max: 15, typical: '5-10g for cooking' },
      'chicken breast': { max: 250, typical: '150-200g' },
      'beef': { max: 300, typical: '150-250g' },
      'beans': { max: 250, typical: '150-200g cooked' },
      'lentils': { max: 250, typical: '150-200g cooked' },
    };

    const cuisine = (userProfile.cuisinePreferences || [])[0]?.toLowerCase() || '';

    meals.weeklyMeals.forEach((day) => {
      day.meals.forEach((meal) => {
        const mealName = (meal.mealName || '').toLowerCase();
        const isChapati = mealName.includes('chapati');
        const isMatoke = mealName.includes('matoke') || mealName.includes('matooke');

        meal.ingredients.forEach((ing) => {
          const name = normalizeFoodName(ing.name || '');
          const amount = ing.amount || 0;

          // Check against ingredient limits
          for (const [key, limit] of Object.entries(ingredientLimits)) {
            if (name.includes(key)) {
              // Check cultural-specific limits first
              if (limit.cultural && cuisine && limit.cultural[cuisine]) {
                const culturalLimit = limit.cultural[cuisine];
                if (culturalLimit.min && amount < culturalLimit.min) {
                  issues.push(
                    `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": ${ing.name} is ${amount}g, but ${cuisine} cuisine requires MIN ${culturalLimit.min}g (typical: ${culturalLimit.typical})`
                  );
                }
                if (amount > culturalLimit.max) {
                  issues.push(
                    `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": ${ing.name} is ${amount}g, exceeds MAX ${culturalLimit.max}g for ${cuisine} cuisine (typical: ${culturalLimit.typical})`
                  );
                }
              } else {
                // Use general limits
                if (amount > limit.max) {
                  issues.push(
                    `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": ${ing.name} is ${amount}g, exceeds MAX ${limit.max}g (typical: ${limit.typical})`
                  );
                }
              }
              break;
            }
          }

          // Special checks for known problematic dishes
          if (isChapati && (name.includes('flour') || name.includes('wheat'))) {
            if (amount > 100) {
              issues.push(
                `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": Chapati uses ${amount}g flour, should be 50-100g per serving (NOT 500g!)`
              );
            }
          }

          if (isMatoke && (name.includes('green banana') || name.includes('plantain'))) {
            if (amount < 200) {
              issues.push(
                `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": Matoke uses ${amount}g green banana/plantain, should be 200-400g per serving (NOT 50g!)`
              );
            }
          }
        });

        // Check for low protein in main meals
        const estimatedProtein = meal.estimatedProtein || 0;
        const estimatedCalories = meal.estimatedCalories || 0;
        const proteinDensity = estimatedCalories > 0 ? estimatedProtein / estimatedCalories : 0;

        if (meal.mealType !== 'snack') {
          if (estimatedProtein < 25) {
            warnings.push(
              `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": Only ${estimatedProtein.toFixed(1)}g protein, should have at least 25g for main meals`
            );
          }
          if (proteinDensity < 0.15 && estimatedCalories > 0) {
            warnings.push(
              `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": Protein density is ${(proteinDensity * 100).toFixed(1)}% (${estimatedProtein}g/${estimatedCalories}cal), should be at least 15% (0.15g per calorie)`
            );
          }
        } else {
          if (estimatedProtein < 15) {
            warnings.push(
              `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${meal.mealName}": Only ${estimatedProtein.toFixed(1)}g protein, should have at least 15g for snacks`
            );
          }
        }
      });
    });

    if (issues.length > 0) {
      console.error(`\n❌ [BATCH] UNREALISTIC PORTION SIZES DETECTED (${issues.length} issues):`);
      issues.slice(0, 20).forEach((i) => console.error(`  - ${i}`));
      if (issues.length > 20) {
        console.error(`  ... and ${issues.length - 20} more`);
      }
      console.error(`\n⚠️  These meals may be regenerated or adjusted. Consider regenerating if issues are severe.`);
    } else {
      console.log('✅ [BATCH] Portion sizes look realistic');
    }

    if (warnings.length > 0) {
      console.warn(`\n⚠️  [BATCH] PROTEIN WARNINGS (${warnings.length} warnings):`);
      warnings.slice(0, 15).forEach((w) => console.warn(`  - ${w}`));
      if (warnings.length > 15) {
        console.warn(`  ... and ${warnings.length - 15} more`);
      }
    }
  }

  /**
   * Validate meal health - systematically detect unhealthy meals
   * Based on cooking methods, ingredient patterns, and nutritional characteristics
   * NOT based on manual food lists - uses systematic rules
   */
  private validateMealHealth(meals: BatchMealGeneration): void {
    const issues: string[] = [];
    const warnings: string[] = [];

    meals.weeklyMeals.forEach((day) => {
      day.meals.forEach((meal) => {
        const mealName = meal.mealName || '';
        const instructions = (meal.instructions || []).join(' ').toLowerCase();
        const estimatedCalories = meal.estimatedCalories || 0;
        const estimatedProtein = meal.estimatedProtein || 0;
        const ingredients = meal.ingredients || [];

        // Rule 1: Detect unhealthy cooking methods (deep frying)
        const hasDeepFrying = /deep\s*fry|deep\s*fried|deep-fry|deep-fried/.test(instructions);
        const hasFrying = /\bfry\b|\bfried\b/.test(instructions);

        // Check for excessive oil (indicates deep frying)
        const totalOil = ingredients.reduce((sum, ing) => {
          const ingName = (ing.name || '').toLowerCase();
          if (ingName.includes('oil') && !ingName.includes('olive') && !ingName.includes('coconut')) {
            return sum + (ing.amount || 0);
          }
          return sum;
        }, 0);

        if (hasDeepFrying || (hasFrying && totalOil > 15)) {
          issues.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Uses deep-frying or heavy frying (unhealthy cooking method). Use grilling, baking, or steaming instead.`
          );
        }

        // Rule 2: Check for high added sugar
        const addedSugar = ingredients.reduce((sum, ing) => {
          const ingName = (ing.name || '').toLowerCase();
          if (ingName.includes('sugar') || ingName.includes('honey') || ingName.includes('syrup') || ingName.includes('molasses')) {
            return sum + (ing.amount || 0);
          }
          return sum;
        }, 0);

        if (addedSugar > 15) {
          warnings.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": High added sugar (${addedSugar}g). Should be ≤15g per serving.`
          );
        }

        // Rule 3: Check for refined carbs without adequate protein
        const hasRefinedCarbs = ingredients.some(ing => {
          const ingName = (ing.name || '').toLowerCase();
          return ingName.includes('flour') || ingName.includes('white rice') ||
            (ingName.includes('bread') && !ingName.includes('whole grain'));
        });

        if (hasRefinedCarbs && estimatedProtein < 20 && estimatedCalories > 500) {
          warnings.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Contains refined carbs but only ${estimatedProtein.toFixed(1)}g protein. Should pair with ≥25g protein source.`
          );
        }

        // Rule 4: Check for incomplete meals (single ingredient)
        if (ingredients.length === 1) {
          issues.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Incomplete meal (only 1 ingredient: ${ingredients[0].name}). Add complementary ingredients for a balanced meal.`
          );
        }

        // Rule 5: Check protein density
        if (estimatedCalories > 300) {
          const proteinDensity = estimatedCalories > 0 ? estimatedProtein / estimatedCalories : 0;
          const minProteinDensity = meal.mealType === 'snack' ? 0.10 : 0.15;
          const minProtein = meal.mealType === 'snack' ? 15 : 25;

          if (proteinDensity < minProteinDensity && estimatedProtein < minProtein) {
            warnings.push(
              `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Low protein density (${(proteinDensity * 100).toFixed(1)}%, ${estimatedProtein.toFixed(1)}g/${estimatedCalories}cal). Should be ≥${(minProteinDensity * 100).toFixed(0)}% (≥${minProtein}g protein).`
            );
          }
        }

        // Rule 6: Check for excessive calorie density (unless high-calorie target)
        if (estimatedCalories > 1000) {
          warnings.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Very high calories (${estimatedCalories}cal). Consider splitting into smaller portions or reducing calorie-dense ingredients.`
          );
        }
      });
    });

    if (issues.length > 0) {
      console.error(`\n❌ [BATCH] UNHEALTHY MEALS DETECTED (${issues.length} critical issues):`);
      issues.slice(0, 20).forEach((i) => console.error(`  - ${i}`));
      if (issues.length > 20) {
        console.error(`  ... and ${issues.length - 20} more`);
      }
      console.error(`\n⚠️  These meals should be regenerated with healthier alternatives.`);
    } else {
      console.log('✅ [BATCH] No critical health issues detected');
    }

    if (warnings.length > 0) {
      console.warn(`\n⚠️  [BATCH] HEALTH WARNINGS (${warnings.length} warnings):`);
      warnings.slice(0, 15).forEach((w) => console.warn(`  - ${w}`));
      if (warnings.length > 15) {
        console.warn(`  ... and ${warnings.length - 15} more`);
      }
    }
  }

  /**
   * Calculate day macros
   *
   * Returns consistent daily macro targets (same for all days).
   */
  private calculateDayMacros(
    weeklyOutline: WeeklyOutline,
    _isRestDay: boolean,
    dayIndex?: number,
    dailyTargetsOverride?: MacroTargets[]
  ): MacroValues {
    // If specific daily targets are provided, use them
    if (dailyTargetsOverride && dayIndex !== undefined && dailyTargetsOverride[dayIndex]) {
      const target = dailyTargetsOverride[dayIndex];
      return {
        calories: target.calories,
        protein: target.protein,
        carbs: target.carbs,
        fats: target.fat,
      };
    }

    const base = weeklyOutline.dailyTargets;

    return {
      calories: base.calories,
      protein: base.protein,
      carbs: base.carbs,
      fats: base.fat,
    };
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

    // Include supplement ingredients so any fallback meals can be USDA-grounded too
    // This keeps "protein safety net" macros aligned with the same USDA truth.
    if (this.supplementMeals.length > 0) {
      this.supplementMeals.forEach((m) => {
        (m.ingredients || []).forEach((ing: any) => {
          const normalized = normalizeFoodName(ing.name);
          ingredientSet.add(normalized);
        });
      });
    } else {
      // Ensure the precision fallback ingredient can be USDA-looked up if needed
      ingredientSet.add(normalizeFoodName('Whey Protein Powder'));
    }

    return Array.from(ingredientSet);
  }

  /**
   * Step 3: Batch USDA lookup (parallel)
   */
	  private async batchUSDALookup(
	    uniqueIngredients: string[]
	  ): Promise<Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>> {
	    const usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }> = {};
	    const report = {
	      totalUniqueIngredients: uniqueIngredients.length,
	      zeroImpactSkipped: [] as string[],
	      noUsdaFound: [] as string[],
	      usedMappings: 0,
	      ambiguous: [] as Array<{ ingredient: string; chosen: string; confidence: number; candidates: any[] }>,
	      lowConfidence: [] as Array<{ ingredient: string; chosen: string; confidence: number; candidates: any[] }>,
	      persistedMappings: 0,
	    };

	    // Refine ambiguous queries to canonical USDA-friendly forms
	    const refineQuery = (name: string): string => {
	      // IMPORTANT: Do NOT strip nutrition-critical descriptors here.
	      // We want USDA search to see the richest possible query first.
	      // USDANutritionService already tries descriptor-stripped fallbacks internally.
	      const normalized = normalizeFoodName(name);
	      const map: Record<string, string> = {
	        'scallions': 'green onions',
	        'spring onion': 'green onions',
	        'spring onions': 'green onions',
	        'bell pepper': 'sweet pepper',
	        'bell peppers': 'sweet peppers',
	        'sweet peppers': 'sweet pepper',
	      };
	      return map[normalized] || normalized;
	    };

    // When searching ambiguous seasonings, filter out obvious prepared dishes (e.g., "pepper steak")
    const DISH_WORDS = ['steak', 'burger', 'sandwich', 'pizza', 'pasta', 'sauce', 'soup', 'pie', 'cake'];

	    // Preload user/system mappings once per batch so resolution can be deterministic across plans.
	    // Must use the same query keys we will actually resolve with (after refinement).
	    const mappingKeys = Array.from(new Set(uniqueIngredients.map((i) => refineQuery(i))));
	    await this.usdaService.preloadIngredientMappings(mappingKeys);

	    const mappingsToPersist: Array<{
	      name: string;
	      fdcId: number;
	      description: string;
	      dataType?: string;
	      confidence?: number;
	      source: string;
	    }> = [];

	    // Lookup all ingredients in parallel
	    const lookupPromises = uniqueIngredients.map(async (ingredient) => {
	      try {
	        // Skip USDA lookup for condiments/seasonings that should not impact macros
	        if (isZeroImpactIngredient(ingredient)) {
	          console.log(`⚙️  [BATCH] Skipping USDA for zero-impact ingredient: ${ingredient}`);
	          report.zeroImpactSkipped.push(ingredient);
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
	        const resolved = await this.usdaService.resolveFoodDetailsWithConfidence(query);

	        if (resolved.usedMapping) {
	          report.usedMappings += 1;
	        } else {
	          if (resolved.isAmbiguous) {
	            report.ambiguous.push({
	              ingredient,
	              chosen: resolved.foodDetails.description,
	              confidence: resolved.confidence,
	              candidates: resolved.candidates,
	            });
	          } else if (resolved.confidence < 0.75) {
	            report.lowConfidence.push({
	              ingredient,
	              chosen: resolved.foodDetails.description,
	              confidence: resolved.confidence,
	              candidates: resolved.candidates,
	            });
	          }
	        }

	        // Persist only high-confidence, non-ambiguous selections (so "learned" mappings don't lock in a bad guess).
	        if (!resolved.usedMapping && !resolved.isAmbiguous && resolved.confidence >= 0.85) {
	          mappingsToPersist.push({
	            name: query,
	            fdcId: resolved.foodDetails.fdcId,
	            description: resolved.foodDetails.description,
	            dataType: resolved.foodDetails.dataType,
	            confidence: resolved.confidence,
	            source: 'auto_high_confidence',
	          });
	        }

	        const shouldLogDetails = env.DEBUG || resolved.isAmbiguous || resolved.confidence < 0.75;
	        if (shouldLogDetails) {
	          console.log(`\n🔬 [BATCH] USDA RESOLUTION for "${ingredient}" (query="${query}")`);
	          console.log(`  Chosen: ${resolved.foodDetails.description} (FDC ${resolved.foodDetails.fdcId}, ${resolved.foodDetails.dataType || 'N/A'})`);
	          console.log(`  Confidence: ${(resolved.confidence * 100).toFixed(0)}%${resolved.isAmbiguous ? ' (AMBIGUOUS)' : ''}${resolved.usedMapping ? ' (MAPPED)' : ''}`);
	          if (resolved.candidates?.length) {
	            console.log(`  Top candidates:`);
	            resolved.candidates.slice(0, 3).forEach((c: any, idx: number) => {
	              console.log(`    ${idx + 1}. ${c.description} (FDC ${c.fdcId}, ${c.dataType || 'N/A'}, score=${c.score})`);
	            });
	          }
	          console.log(`  Extracted Macros (per 100g):`, resolved.macrosPer100g);
	        }

	        return {
	          ingredient,
	          data: {
	            nutrition: resolved.macrosPer100g,
	            fdcId: resolved.foodDetails.fdcId,
	            rawFoodDetails: resolved.foodDetails, // Store raw data for reference
	          },
	        };
	      } catch (error) {
	        console.error(`❌ [BATCH] Failed to lookup ${ingredient}:`, error);
	        report.noUsdaFound.push(ingredient);
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

	    // Persist learned mappings once per batch (best-effort, non-blocking for meal generation).
	    if (mappingsToPersist.length > 0) {
	      const unique = new Map<string, any>();
	      mappingsToPersist.forEach((m) => unique.set(normalizeFoodName(m.name), m));
	      const deduped = Array.from(unique.values());
	      await this.usdaService.upsertIngredientMappings(deduped);
	      report.persistedMappings = deduped.length;
	    }

	    this.lastIngredientResolutionReport = report;

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

	    console.log(`\n🧾 [BATCH] USDA Resolution Summary:`, {
	      totalUniqueIngredients: report.totalUniqueIngredients,
	      zeroImpactSkipped: report.zeroImpactSkipped.length,
	      noUsdaFound: report.noUsdaFound.length,
	      usedMappings: report.usedMappings,
	      ambiguous: report.ambiguous.length,
	      lowConfidence: report.lowConfidence.length,
	      persistedMappings: report.persistedMappings,
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
            console.warn(`⚠️  [BATCH] No USDA data for ingredient: ${ing.name}, using AI fallback if available`);
            return {
              name: ing.name,
              amount: ing.amount,
              nutrition: {
                calories: ing.estimatedCalories || 0,
                protein: ing.estimatedProtein || 0,
                carbs: ing.estimatedCarbs || 0,
                fats: ing.estimatedFats || 0,
              },
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
    if (this.isProteinSupplementMeal(meal)) return meal;

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
        // More conservative bounds to prevent unrealistic portions
        const nameLower = ingredient.name.toLowerCase();
        const ingredientMaxLimits: Record<string, number> = {
          'flour': 150,
          'wheat flour': 150,
          'maize flour': 150,
          'rice': 200,
          'potato': 300,
          'sweet potato': 300,
          'green banana': 400,
          'plantain': 400,
          'onion': 100,
          'kale': 200,
          'spinach': 200,
          'collard greens': 200,
          'oil': 15,
          'olive oil': 15,
          'vegetable oil': 15,
        };

        let maxBound = isFixed ? ingredient.amount : Math.min(500, ingredient.amount * 2.0); // Changed from 4x to 2x
        for (const [key, limit] of Object.entries(ingredientMaxLimits)) {
          if (nameLower.includes(key)) {
            maxBound = Math.min(maxBound, limit);
            break;
          }
        }

        const minBound = isFixed ? ingredient.amount : Math.max(5, ingredient.amount * 0.5); // Changed from 0.25x to 0.5x

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

      // Set bounds: More conservative scaling (0.5x to 2x) to prevent unrealistic portions
      // Apply ingredient-specific maximum limits
      const nameLower = ingredient.name.toLowerCase();
      const ingredientMaxLimits: Record<string, number> = {
        'flour': 150,
        'wheat flour': 150,
        'maize flour': 150,
        'rice': 200,
        'potato': 300,
        'sweet potato': 300,
        'green banana': 400,
        'plantain': 400,
        'onion': 100,
        'kale': 200,
        'spinach': 200,
        'collard greens': 200,
        'oil': 15,
        'olive oil': 15,
        'vegetable oil': 15,
      };

      let maxBound = ingredient.amount * 2.0; // Changed from 4x to 2x
      for (const [key, limit] of Object.entries(ingredientMaxLimits)) {
        if (nameLower.includes(key)) {
          maxBound = Math.min(maxBound, limit);
          break;
        }
      }

      adjustable.push({
        name: ingredient.name,
        originalAmount: ingredient.amount,
        lowerBound: Math.max(1, ingredient.amount * 0.5), // Changed from 0.2x to 0.5x
        upperBound: maxBound,
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
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>,
    dailyTargetsOverride?: MacroTargets[]
  ): Promise<MealWithUSDA[]> {
    await this.ensureOptimizerInitialized();
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
      const dayTargets = this.calculateDayMacros(
        weeklyOutline,
        day?.isRestDay || false,
        dayNum - 1,
        dailyTargetsOverride
      );

      console.log(`📊 [BATCH] Day ${dayNum} (${day?.dayName}) Precise Adjustment:`, {
        isRestDay: day?.isRestDay || false,
        dayTargets,
        mealCount: dayMeals.length,
      });

      // Prefer day-level optimization if hybrid optimizer is initialized; fallback to per-meal
      let adjustedDayMeals: MealWithUSDA[];
      const hasLockedSupplements = dayMeals.some((m) => this.isProteinSupplementMeal(m));
      if (this.optimizerInitialized && !hasLockedSupplements) {
        try {
          adjustedDayMeals = await this.adjustDayWithLP(dayMeals, dayTargets, usdaData);
        } catch (err) {
          console.warn('⚠️  [BATCH] Day-level LP failed, falling back to per-meal:', err);
          adjustedDayMeals = await Promise.all(
            dayMeals.map(async meal => {
              if (this.isProteinSupplementMeal(meal)) return meal;
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
        if (hasLockedSupplements && this.optimizerInitialized) {
          console.log('⚙️  [BATCH] Skipping day-level LP because protein supplement meals must remain locked');
        }
        adjustedDayMeals = await Promise.all(
          dayMeals.map(async meal => {
            if (this.isProteinSupplementMeal(meal)) return meal;
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

    // CRITICAL: Sugar RAG Enforcement (Daily Limit: 30g added sugars)
    const totalCurrentSugar = flatIngredients.reduce((acc, ing) => acc + (ing.nutrition.sugar || 0), 0);
    const SUGAR_LIMIT = 30;

    if (totalCurrentSugar > SUGAR_LIMIT) {
      // Find ingredients that are "sensitive" sugars (Added Sugars: Sugar, Honey, Syrup)
      // We exclude natural sugars from fruits which aren't typically "sensitive" ingredients
      const sugarIngredients = flatIngredients
        .map((ing, idx) => ({ ing, idx }))
        .filter(entry => entry.ing.nutrition.sugar && (entry.ing.nutrition.sugar > 0) && isSensitiveIngredient(entry.ing.name));

      const totalAddedSugar = sugarIngredients.reduce((acc, entry) => acc + (entry.ing.nutrition.sugar || 0), 0);

      if (totalAddedSugar > 0) {
        // How much do we need to cut from added sugars?
        const excess = totalCurrentSugar - SUGAR_LIMIT;
        // Scale down added sugars proportionally to attempt to hit the limit
        const targetAddedSugar = Math.max(0, totalAddedSugar - excess);
        const sugarScaleFactor = targetAddedSugar / totalAddedSugar;

        console.log(`⚖️  [BATCH] Daily total sugar (${totalCurrentSugar.toFixed(1)}g) exceeds RAG limit (${SUGAR_LIMIT}g). Added sugar found: ${totalAddedSugar.toFixed(1)}g. Scaling added-sugar ingredients by ${((1 - sugarScaleFactor) * 100).toFixed(1)}%.`);

        sugarIngredients.forEach(entry => {
          const opt = optimizable[entry.idx];
          opt.originalAmount *= sugarScaleFactor;
          // Note: These will be locked by the sensitive ingredient check later, 
          // but we'll manually ensure they are locked at the new amount below if needed.
        });
      } else if (totalCurrentSugar > SUGAR_LIMIT + 10) {
        console.warn(`⚠️ [BATCH] Daily sugar (${totalCurrentSugar.toFixed(1)}g) exceeds limit, but no "Added Sugars" found to scale. This likely comes from natural sources (fruits).`);
      }
    }

    // Lock protein supplementation meals (their macros may not be backed by USDA entries)
    // and enforce sensitive ingredient locking.
    dayMeals.forEach((meal, mealIdx) => {
      const lockMeal = this.isProteinSupplementMeal(meal);

      meal.ingredients.forEach((ing, ingIdx) => {
        // Find this ingredient in the flat 'optimizable' array
        const globalIdx = indexMap.findIndex(m => m.mealIdx === mealIdx && m.ingIdx === ingIdx);
        if (globalIdx === -1) return;

        const opt = optimizable[globalIdx];

        if (lockMeal) {
          opt.isLocked = true;
          opt.minAmount = opt.originalAmount;
          opt.maxAmount = opt.originalAmount;
        }

        // Handle Sensitive Ingredient Locking (Sugar, Oils, Butter)
        // This ensures that sensitive ingredients remain fixed for health/sugar compliance.
        if (isSensitiveIngredient(ing.name)) {
          opt.isLocked = true;
          opt.minAmount = opt.originalAmount;
          opt.maxAmount = opt.originalAmount;
        }
      });
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

  /**
   * Generate high-protein supplement meals for backup using AI
   * These will be used when regular meals don't hit protein targets
   */
  private async generateSupplementMealsForPlan(userProfile: UserProfile): Promise<void> {
    const { generateSupplementMeals } = await import('./SupplementMealGenerator');

    // Use API config if set, otherwise try to get from userProfile or env
    const apiKey = this.apiConfig?.apiKey || userProfile.apiKey || '';
    const endpoint = this.apiConfig?.endpoint || userProfile.endpoint || 'groq';
    const model = this.apiConfig?.model || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      console.warn('⚠️ [BATCH] No API key for supplement meal generation, using defaults');
      const { getDefaultSupplementMeals } = await import('./SupplementMealGenerator');
      // @ts-ignore - we'll handle this
      this.supplementMeals = (await import('./SupplementMealGenerator')).getDefaultSupplementMeals?.() || [];
      return;
    }

    try {
      this.supplementMeals = await generateSupplementMeals(
        userProfile,
        apiKey,
        endpoint,
        model,
        {
          count: 4,
          preferences: userProfile.preferences,
        }
      );
    } catch (error) {
      console.warn('⚠️ [BATCH] Failed to generate supplement meals with AI, using defaults:', error);
      // Fallback to default meals
      this.supplementMeals = [];
    }
  }

  /**
   * PROTEIN SUPPLEMENTATION - GUARANTEED to meet protein targets
   * 
   * Uses AI-generated supplement meals from the plan, adjusted with LP algorithm
   * to hit exact protein targets. Zero tolerance for failures.
   */
  private async ensureProteinTargets(
    userProfile: UserProfile,
    dayMeals: MealWithUSDA[][],
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>,
    dailyTargetsOverride?: MacroTargets[]
  ): Promise<MealWithUSDA[][]> {
    const effectiveGoal = getEffectiveGoalType(userProfile.goalCategory || 'maintenance');
    const strictProtein = effectiveGoal === 'fat_loss' || userProfile.goal === 'fat_loss';
    const PROTEIN_TOLERANCE = strictProtein ? 0 : GENERATION_TOLERANCES.PROTEIN_PERCENTAGE; // % (0% for cuts)
    const usedMealNames: string[] = []; // Track used supplement meals for variety

    const supplementedDayMeals: MealWithUSDA[][] = [];

    for (let dayIdx = 0; dayIdx < dayMeals.length; dayIdx++) {
      const dayNum = dayIdx + 1;
      let meals = [...dayMeals[dayIdx]];
      const day = trainingSplit.days[dayIdx];
      const dayTargets = this.calculateDayMacros(
        weeklyOutline,
        day?.isRestDay || false,
        dayIdx,
        dailyTargetsOverride
      );

      // Helper to calculate totals
      const calculateTotals = (mealList: MealWithUSDA[]) => mealList.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      let currentTotals = calculateTotals(meals);
      let proteinAccuracy = currentTotals.protein / dayTargets.protein;
      let proteinDeficit = dayTargets.protein - currentTotals.protein;

      let supplementsAdded = 0;
      const MAX_SUPPLEMENTS = 3;

      // LOOP: Add supplement meals until protein target is met
      const needsMoreProtein = (): boolean => {
        if (strictProtein) return proteinDeficit > 0.5;
        return proteinAccuracy < (1 - PROTEIN_TOLERANCE) && proteinDeficit > 2;
      };

      while (needsMoreProtein() && supplementsAdded < MAX_SUPPLEMENTS) {
        console.log(`⚠️ [PROTEIN] Day ${dayNum}: ${currentTotals.protein.toFixed(1)}g vs target ${dayTargets.protein}g (${(proteinAccuracy * 100).toFixed(1)}%)`);
        console.log(`   Need to add ${proteinDeficit.toFixed(1)}g protein`);

        // Select and adjust a supplement meal
        const adjusted = this.supplementMeals.length > 0
          ? selectAndAdjustSupplementMeal(this.supplementMeals, proteinDeficit, {
            maxCalories: proteinDeficit > 40 ? 500 : 400,
            usedMealNames,
          })
          : null;

        if (adjusted) {
          usedMealNames.push(adjusted.originalMeal.name);

          // Convert to MealWithUSDA format
          const supplementMeal = this.convertSupplementToMeal(
            adjusted,
            dayNum,
            day?.dayName || `Day ${dayNum}`,
            usdaData
          );
          meals.push(supplementMeal);
          supplementsAdded++;

          console.log(`   ✅ Added "${adjusted.originalMeal.name}" (scale: ${adjusted.scaleFactor.toFixed(2)}x):`);
          console.log(`      +${adjusted.adjustedMacros.protein.toFixed(1)}g protein, +${adjusted.adjustedMacros.calories} kcal`);
        } else {
          // Fallback: create precision shake
          console.log(`   ⚠️ No supplement meals available, using precision fallback`);
          const fallback = this.createPrecisionProteinShake(
            proteinDeficit,
            dayNum,
            day?.dayName || `Day ${dayNum}`,
            usdaData
          );
          meals.push(fallback);
          supplementsAdded++;

          console.log(`   ✅ Added precision shake: +${fallback.totalMacros.protein}g protein`);
        }

        // Recalculate
        currentTotals = calculateTotals(meals);
        proteinAccuracy = currentTotals.protein / dayTargets.protein;
        proteinDeficit = dayTargets.protein - currentTotals.protein;
      }

      // FINAL FALLBACK: Precision shake if still short
      if (needsMoreProtein()) {
        console.log(`🚨 [FINAL FALLBACK] Day ${dayNum}: Still ${proteinDeficit.toFixed(1)}g short`);
        const fallback = this.createPrecisionProteinShake(
          proteinDeficit,
          dayNum,
          day?.dayName || `Day ${dayNum}`,
          usdaData
        );
        meals.push(fallback);
        currentTotals = calculateTotals(meals);
        console.log(`   ✅ GUARANTEED: ${currentTotals.protein.toFixed(1)}g protein (${(currentTotals.protein / dayTargets.protein * 100).toFixed(1)}%)`);
      }

      if (supplementsAdded > 0) {
        console.log(`📊 Day ${dayNum} Final: ${currentTotals.protein.toFixed(1)}g protein (${(currentTotals.protein / dayTargets.protein * 100).toFixed(1)}% of ${dayTargets.protein}g target)`);
      }

      supplementedDayMeals.push(meals);
    }

    return supplementedDayMeals;
  }

  /**
   * Convert an adjusted supplement meal to MealWithUSDA format
   */
  private convertSupplementToMeal(
    adjusted: import('./SupplementMealGenerator').AdjustedSupplementMeal,
    dayNum: number,
    dayName: string,
    usdaData?: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): MealWithUSDA {
    const toUsdaKey = (name: string) => normalizeFoodName(name);
    const ingredients = adjusted.adjustedIngredients.map((ing) => {
      const key = toUsdaKey(ing.name);
      const entry = usdaData?.[key];
      const nutrition = entry ? calculateMacrosForAmount(entry.nutrition, ing.adjustedAmount, 'g') : ing.macros;
      return {
        name: ing.name,
        amount: ing.adjustedAmount,
        nutrition,
        fdcId: entry?.fdcId ?? 0,
      };
    });

    const totalMacros = ingredients.reduce(
      (sum, ing) => ({
        calories: sum.calories + (ing.nutrition.calories || 0),
        protein: sum.protein + (ing.nutrition.protein || 0),
        carbs: sum.carbs + (ing.nutrition.carbs || 0),
        fats: sum.fats + (ing.nutrition.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
    );

    return {
      mealName: adjusted.originalMeal.name,
      mealType: 'snack',
      instructions: adjusted.originalMeal.instructions,
      ingredients,
      totalMacros,
      dayNumber: dayNum,
      dayName: dayName,
      adjustmentLog: [
        `Protein supplement meal (scale: ${adjusted.scaleFactor.toFixed(2)}x)`,
        `Provides: ${totalMacros.protein.toFixed(1)}g protein, ${totalMacros.calories} kcal`,
        ...(usdaData ? ['USDA-based macros applied when available'] : []),
      ],
    };
  }

  /**
   * Create a precision protein shake that EXACTLY fills the protein gap
   * This is the final fallback that GUARANTEES protein targets are met
   */
  private createPrecisionProteinShake(
    proteinNeeded: number,
    dayNum: number,
    dayName: string,
    usdaData?: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): MealWithUSDA {
    const wheyKey = normalizeFoodName('Whey Protein Powder');
    const wheyUsda = usdaData?.[wheyKey];

    const WHEY_PROTEIN_PER_GRAM = wheyUsda ? wheyUsda.nutrition.protein / 100 : 0.80;
    const WHEY_CALORIES_PER_GRAM = wheyUsda ? wheyUsda.nutrition.calories / 100 : 3.6;
    const WHEY_CARBS_PER_GRAM = wheyUsda ? wheyUsda.nutrition.carbs / 100 : 0.05;
    const WHEY_FAT_PER_GRAM = wheyUsda ? wheyUsda.nutrition.fats / 100 : 0.02;

    const proteinWithBuffer = proteinNeeded * 1.05;
    const wheyAmount = Math.ceil(proteinWithBuffer / WHEY_PROTEIN_PER_GRAM);

    const macros: MacroValues = wheyUsda
      ? calculateMacrosForAmount(wheyUsda.nutrition, wheyAmount, 'g')
      : {
        protein: Math.round(wheyAmount * WHEY_PROTEIN_PER_GRAM * 10) / 10,
        carbs: Math.round(wheyAmount * WHEY_CARBS_PER_GRAM * 10) / 10,
        fats: Math.round(wheyAmount * WHEY_FAT_PER_GRAM * 10) / 10,
        calories: Math.round(wheyAmount * WHEY_CALORIES_PER_GRAM),
      };

    return {
      mealName: 'Protein Shake (Target Boost)',
      mealType: 'snack',
      instructions: [
        `Add ${wheyAmount}g whey protein powder to shaker bottle`,
        'Add 300ml cold water',
        'Shake vigorously for 30 seconds',
        'Drink immediately',
      ],
      ingredients: [
        {
          name: 'Whey Protein Powder',
          amount: wheyAmount,
          nutrition: macros,
          fdcId: wheyUsda?.fdcId ?? 172120,
        },
        {
          name: 'Water',
          amount: 300,
          nutrition: { protein: 0, carbs: 0, fats: 0, calories: 0 },
          fdcId: 0,
        },
      ],
      totalMacros: macros,
      dayNumber: dayNum,
      dayName: dayName,
      adjustmentLog: [
        `Precision fallback to guarantee protein target`,
        `Required: ${proteinNeeded.toFixed(1)}g, Provides: ${macros.protein}g protein`,
        ...(wheyUsda ? ['USDA-based whey macros used'] : ['Fallback whey macros used']),
      ],
    };
  }
}
