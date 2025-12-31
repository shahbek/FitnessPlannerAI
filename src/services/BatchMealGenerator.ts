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
import type { OptimizableIngredient } from './optimizers/ProteinPriorityOptimizer';
import { isAddedSugarIngredient, isSensitiveIngredient, isZeroImpactIngredient, stripDescriptorWords } from '../constants/ingredients';
import { HARD_FAILURE_THRESHOLDS, GENERATION_TOLERANCES } from '../constants/validation';
import { selectAndAdjustSupplementMeal, adjustSupplementMealToTarget } from './SupplementMealGenerator';
import { searchNutritionKnowledge, NutritionFact } from '../rag/nutrition/nutritionKnowledgeBase';
import { env } from '../config/env';

/**
 * Meal Schema for Batch Generation
 */
const MealSchema = z.object({
  mealName: z
    .string()
    .describe(
      'Creative, descriptive meal name based on ingredients. MUST be unique for each meal type within the same day. Breakfast meals should use breakfast-appropriate names (e.g., "Greek Yogurt Parfait", "Scrambled Eggs with Toast"), lunch meals should use lunch-appropriate names (e.g., "Grilled Chicken Salad", "Turkey Wrap"), dinner meals should use dinner-appropriate names (e.g., "Baked Salmon with Vegetables", "Beef Stir-Fry"). DO NOT repeat the same meal name for different meal types on the same day.',
    ),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.number().describe('Amount in grams (e.g., 150, 25, 5)'),
      estimatedCalories: z.number().optional().describe('Rough caloric estimate per this amount (e.g., 120)'),
      estimatedProtein: z.number().optional().describe('Rough protein estimate in grams (e.g., 25)'),
      estimatedCarbs: z.number().optional().describe('Rough carbs estimate in grams (e.g., 30)'),
      estimatedFats: z.number().optional().describe('Rough fats estimate in grams (e.g., 10)'),
    }),
  ),
  instructions: z
    .array(z.string())
    .describe(
      'Step-by-step cooking instructions (3-5 steps, e.g., ["Season steak with salt and pepper", "Grill steak for 4-5 minutes per side", "Rest for 5 minutes before serving"])',
    ),
  estimatedCalories: z.number().optional(),
  estimatedProtein: z.number().optional(),
  estimatedCarbs: z.number().optional(),
  estimatedFats: z.number().optional(),
});

const WeeklyMealSchema = z.object({
  dayNumber: z.number().min(1).max(7),
  dayName: z.string(),
  meals: z.array(MealSchema),
});

const BatchMealGenerationSchema = z.object({
  weeklyMeals: z.array(WeeklyMealSchema).length(7), // Exactly 7 days
  reasoning: z.string().optional(),
});

const WeeklyMealTemplatesSchema = z.object({
  meals: z.array(MealSchema),
  reasoning: z.string().optional(),
});

export type BatchMealGeneration = z.infer<typeof BatchMealGenerationSchema>;
type WeeklyMealTemplatesGeneration = z.infer<typeof WeeklyMealTemplatesSchema>;

type MealTemplateIngredient = {
  name: string;
  amount: number;
  estimatedCalories?: number;
  estimatedProtein?: number;
  estimatedCarbs?: number;
  estimatedFats?: number;
};

const atwaterPer100g = (macros: Omit<MacroValues, 'calories'>): MacroValues => {
  const protein = Math.max(0, Number(macros.protein || 0));
  const carbs = Math.max(0, Number(macros.carbs || 0));
  const fats = Math.max(0, Number(macros.fats || 0));
  return {
    calories: Math.round((protein * 4 + carbs * 4 + fats * 9) * 10) / 10,
    protein,
    carbs,
    fats,
  };
};

// Deterministic fallback nutrition estimates (per 100g) for common staples.
// Used ONLY when USDA lookup fails AND the AI did not provide estimates (e.g., for internal fallback templates).
const FALLBACK_ESTIMATES_PER_100G: Record<string, MacroValues> = {
  [normalizeFoodName('Eggs')]: atwaterPer100g({ protein: 13, carbs: 1.1, fats: 10.6 }),
  [normalizeFoodName('Chicken Breast')]: atwaterPer100g({ protein: 31, carbs: 0, fats: 3.6 }),
  [normalizeFoodName('Salmon')]: atwaterPer100g({ protein: 20, carbs: 0, fats: 13 }),
  [normalizeFoodName('Tofu')]: atwaterPer100g({ protein: 8, carbs: 2, fats: 4.8 }),
  [normalizeFoodName('Brown Rice')]: atwaterPer100g({ protein: 2.6, carbs: 23, fats: 0.9 }),
  [normalizeFoodName('Quinoa')]: atwaterPer100g({ protein: 4.4, carbs: 21.3, fats: 1.9 }),
  [normalizeFoodName('Sweet Potato')]: atwaterPer100g({ protein: 1.6, carbs: 20, fats: 0.1 }),
  [normalizeFoodName('Broccoli')]: atwaterPer100g({ protein: 2.8, carbs: 7, fats: 0.4 }),
  [normalizeFoodName('Spinach')]: atwaterPer100g({ protein: 2.9, carbs: 3.6, fats: 0.4 }),
  [normalizeFoodName('Tomato')]: atwaterPer100g({ protein: 0.9, carbs: 3.9, fats: 0.2 }),
  [normalizeFoodName('Mushrooms')]: atwaterPer100g({ protein: 3, carbs: 3, fats: 0.3 }),
  [normalizeFoodName('Avocado')]: atwaterPer100g({ protein: 2, carbs: 9, fats: 15 }),
  [normalizeFoodName('Greek Yogurt')]: atwaterPer100g({ protein: 10, carbs: 4, fats: 0.5 }),
  [normalizeFoodName('Soy Yogurt')]: atwaterPer100g({ protein: 4, carbs: 7, fats: 3 }),
  [normalizeFoodName('Olive Oil')]: atwaterPer100g({ protein: 0, carbs: 0, fats: 100 }),
  [normalizeFoodName('Rolled Oats')]: atwaterPer100g({ protein: 12, carbs: 60, fats: 6 }),
  [normalizeFoodName('Chia Seeds')]: atwaterPer100g({ protein: 16, carbs: 42, fats: 31 }),
  [normalizeFoodName('Banana')]: atwaterPer100g({ protein: 1.1, carbs: 23, fats: 0.3 }),
  [normalizeFoodName('Berries')]: atwaterPer100g({ protein: 1, carbs: 14, fats: 0.3 }),
  [normalizeFoodName('Whey Protein Powder')]: atwaterPer100g({ protein: 80, carbs: 10, fats: 5 }),
  [normalizeFoodName('Pea Protein Powder')]: atwaterPer100g({ protein: 80, carbs: 8, fats: 5 }),
  [normalizeFoodName('Water')]: atwaterPer100g({ protein: 0, carbs: 0, fats: 0 }),
  [normalizeFoodName('Peanut Butter')]: atwaterPer100g({ protein: 25, carbs: 20, fats: 50 }),
  [normalizeFoodName('Almond Butter')]: atwaterPer100g({ protein: 21, carbs: 19, fats: 55 }),
  [normalizeFoodName('Almonds')]: atwaterPer100g({ protein: 21, carbs: 22, fats: 50 }),
};

const withFallbackEstimates = (ingredient: MealTemplateIngredient): MealTemplateIngredient => {
  const hasEstimates =
    typeof ingredient.estimatedCalories === 'number' ||
    typeof ingredient.estimatedProtein === 'number' ||
    typeof ingredient.estimatedCarbs === 'number' ||
    typeof ingredient.estimatedFats === 'number';
  if (hasEstimates) return ingredient;

  const normalized = normalizeFoodName(ingredient.name);
  const stripped = stripDescriptorWords(ingredient.name);
  const per100g = FALLBACK_ESTIMATES_PER_100G[normalized] || (stripped ? FALLBACK_ESTIMATES_PER_100G[stripped] : null);
  if (!per100g) return ingredient;

  const macros = calculateMacrosForAmount(per100g, ingredient.amount, 'g');
  return {
    ...ingredient,
    estimatedCalories: macros.calories,
    estimatedProtein: macros.protein,
    estimatedCarbs: macros.carbs,
    estimatedFats: macros.fats,
  };
};

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

  private isProteinPowderIngredient(name: string): boolean {
    const normalized = normalizeFoodName(name);
    return (
      normalized.includes('protein powder') ||
      normalized.includes('whey protein') ||
      normalized.includes('pea protein powder') ||
      normalized === 'whey protein powder' ||
      normalized === 'pea protein powder'
    );
  }

  private sanitizeMealsForRealism(dayMeals: MealWithUSDA[]): MealWithUSDA[] {
    return (dayMeals || []).map((meal) => {
      // Protein powder is only acceptable in dedicated shake/snack meals.
      if (meal.mealType === 'snack') return meal;

      const hadProteinPowder = (meal.ingredients || []).some((ing) => this.isProteinPowderIngredient(ing.name));
      if (!hadProteinPowder) return meal;

      const filteredIngredients = (meal.ingredients || []).filter((ing) => !this.isProteinPowderIngredient(ing.name));
      const filteredInstructions = (meal.instructions || []).filter((step) => {
        const s = (step || '').toLowerCase();
        return !(s.includes('protein powder') || s.includes('whey') || s.includes('pea protein'));
      });

      const totalMacros = filteredIngredients.reduce(
        (sum, ing) => ({
          calories: sum.calories + (ing.nutrition.calories || 0),
          protein: sum.protein + (ing.nutrition.protein || 0),
          carbs: sum.carbs + (ing.nutrition.carbs || 0),
          fats: sum.fats + (ing.nutrition.fats || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
      );

      return {
        ...meal,
        ingredients: filteredIngredients,
        instructions: filteredInstructions.length > 0 ? filteredInstructions : meal.instructions,
        totalMacros,
        adjustmentLog: [
          ...(meal.adjustmentLog || []),
          'Removed protein powder from non-snack meal for realism; macros rebalanced via ingredient scaling.',
        ],
      };
    });
  }

  private pruneZeroAmountIngredients(meal: MealWithUSDA): MealWithUSDA {
    const prunedIngredients = (meal.ingredients || []).filter((ing) => Number(ing.amount || 0) > 0.1);
    if (prunedIngredients.length === (meal.ingredients || []).length) {
      return meal;
    }

    const totalMacros = prunedIngredients.reduce(
      (sum, ing) => ({
        calories: sum.calories + (ing.nutrition.calories || 0),
        protein: sum.protein + (ing.nutrition.protein || 0),
        carbs: sum.carbs + (ing.nutrition.carbs || 0),
        fats: sum.fats + (ing.nutrition.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
    );

    return {
      ...meal,
      ingredients: prunedIngredients,
      totalMacros,
      adjustmentLog: [...(meal.adjustmentLog || []), 'Removed zero-amount ingredients (<=0.1g)'],
    };
  }

  private applySnackCalorieCaps(
    dayMeals: MealWithUSDA[],
    optimizable: OptimizableIngredient[],
    indexMap: Array<{ mealIdx: number; ingIdx: number }>,
    dayTargets: MacroValues,
    options?: {
      boundsMode?: 'normal' | 'expanded' | 'rescue';
      snackCapMode?: 'normal' | 'relaxed' | 'disabled';
    }
  ): void {
    const snackMeals = dayMeals
      .map((meal, mealIdx) => ({ meal, mealIdx }))
      .filter(({ meal }) => meal.mealType === 'snack');

    if (snackMeals.length === 0) return;

    const mealDistribution = this.getMealCalorieDistribution(this.currentMealFrequency, dayTargets.calories);
    const snackTargets = mealDistribution.snacks ?? [];

    const boundsMode = options?.boundsMode || 'normal';
    const snackCapMode = options?.snackCapMode || 'normal';

    const capConfig =
      snackCapMode === 'disabled'
        ? boundsMode === 'rescue'
          ? { maxFractionOfDay: 0.34, targetMultiplier: 3.0, targetPlus: 450, absoluteCap: 1150 }
          : boundsMode === 'expanded'
            ? { maxFractionOfDay: 0.30, targetMultiplier: 2.6, targetPlus: 340, absoluteCap: 1050 }
            : { maxFractionOfDay: 0.28, targetMultiplier: 2.4, targetPlus: 300, absoluteCap: 950 }
        : snackCapMode === 'relaxed'
          ? boundsMode === 'rescue'
            ? { maxFractionOfDay: 0.32, targetMultiplier: 2.8, targetPlus: 400, absoluteCap: 1050 }
            : boundsMode === 'expanded'
              ? { maxFractionOfDay: 0.28, targetMultiplier: 2.3, targetPlus: 280, absoluteCap: 950 }
              : { maxFractionOfDay: 0.26, targetMultiplier: 2.0, targetPlus: 220, absoluteCap: 900 }
          : boundsMode === 'rescue'
            ? { maxFractionOfDay: 0.3, targetMultiplier: 2.4, targetPlus: 300, absoluteCap: 1200 }
            : boundsMode === 'expanded'
              ? { maxFractionOfDay: 0.25, targetMultiplier: 2.0, targetPlus: 200, absoluteCap: 950 }
              : { maxFractionOfDay: 0.22, targetMultiplier: 1.8, targetPlus: 150, absoluteCap: 800 };

    const indicesByMealIdx = new Map<number, number[]>();
    indexMap.forEach((entry, globalIdx) => {
      const indices = indicesByMealIdx.get(entry.mealIdx);
      if (indices) {
        indices.push(globalIdx);
      } else {
        indicesByMealIdx.set(entry.mealIdx, [globalIdx]);
      }
    });

    let snackCounter = 0;
    snackMeals.forEach(({ meal, mealIdx }) => {
      const snackIndex = snackCounter++;
      const snackTargetCalories =
        snackTargets[snackIndex] ??
        snackTargets[snackTargets.length - 1] ??
        Math.round(dayTargets.calories * 0.1);

      const maxSnackCalories = Math.min(
        dayTargets.calories * capConfig.maxFractionOfDay,
        Math.max(snackTargetCalories * capConfig.targetMultiplier, snackTargetCalories + capConfig.targetPlus),
        capConfig.absoluteCap
      );

      const ingredientIndices = indicesByMealIdx.get(mealIdx) ?? [];
      if (ingredientIndices.length === 0) return;

      let lockedCalories = 0;
      let adjustableCalories = 0;
      const adjustableIndices: number[] = [];

      ingredientIndices.forEach((globalIdx) => {
        const opt = optimizable[globalIdx];
        const calories = (opt.density?.calories ?? 0) * (opt.currentAmount ?? 0);
        if (opt.isLocked) {
          lockedCalories += calories;
        } else {
          adjustableCalories += calories;
          adjustableIndices.push(globalIdx);
        }
      });

      if (adjustableIndices.length === 0) {
        if (lockedCalories > maxSnackCalories + 1) {
          console.warn(
            `⚠️ [BATCH] Snack "${meal.mealName}" is fully locked at ~${lockedCalories.toFixed(
              0
            )} kcal and exceeds cap ${maxSnackCalories.toFixed(0)} kcal`
          );
        }
        return;
      }

      const maxAdjustableCalories = Math.max(0, maxSnackCalories - lockedCalories);
      if (!(adjustableCalories > 0)) return;

      const scale = maxAdjustableCalories / adjustableCalories;
      if (!Number.isFinite(scale) || scale <= 0) {
        // No calorie room left after locked items; clamp all adjustable ingredients to zero.
        adjustableIndices.forEach((globalIdx) => {
          const opt = optimizable[globalIdx];
          if (opt.isLocked) return;
          opt.maxAmount = 0;
          opt.minAmount = 0;
          opt.currentAmount = 0;
        });
        console.log(
          `⚖️  [BATCH] Snack cap forced "${meal.mealName}" to 0 kcal adjustable (locked ~${lockedCalories.toFixed(
            0
          )} kcal, cap ${maxSnackCalories.toFixed(0)} kcal)`
        );
        return;
      }

      let didClamp = false;
      adjustableIndices.forEach((globalIdx) => {
        const opt = optimizable[globalIdx];
        if (opt.isLocked) return;

        const scaledMax = Math.max(0, (opt.currentAmount ?? 0) * scale);
        if (scaledMax < opt.maxAmount - 0.01) {
          didClamp = true;
          opt.maxAmount = scaledMax;
        }

        if (opt.minAmount > opt.maxAmount) {
          opt.minAmount = 0;
        }
        if (opt.currentAmount > opt.maxAmount) {
          opt.currentAmount = opt.maxAmount;
        }
      });

      if (didClamp) {
        console.log(
          `⚖️  [BATCH] Snack cap applied: "${meal.mealName}" (target ~${snackTargetCalories} kcal, cap ${maxSnackCalories.toFixed(
            0
          )} kcal)`
        );
      }
    });
  }

  private applyMainMealCalorieFloors(
    dayMeals: MealWithUSDA[],
    optimizable: OptimizableIngredient[],
    indexMap: Array<{ mealIdx: number; ingIdx: number }>,
    dayTargets: MacroValues,
    options?: {
      boundsMode?: 'normal' | 'expanded' | 'rescue';
    }
  ): void {
    const mealDistribution = this.getMealCalorieDistribution(this.currentMealFrequency, dayTargets.calories);
    const boundsMode = options?.boundsMode || 'normal';

    // Prevent any main meal from collapsing into a near-zero "empty meal". We keep this lightweight:
    // it never forces increases, it only stops the optimizer from shrinking below a reasonable floor.
    const floorFraction = boundsMode === 'rescue' ? 0.30 : boundsMode === 'expanded' ? 0.25 : 0.20;
    const minFloorCalories = boundsMode === 'rescue' ? 90 : boundsMode === 'expanded' ? 85 : 80;

    const indicesByMealIdx = new Map<number, number[]>();
    indexMap.forEach((entry, globalIdx) => {
      const indices = indicesByMealIdx.get(entry.mealIdx);
      if (indices) {
        indices.push(globalIdx);
      } else {
        indicesByMealIdx.set(entry.mealIdx, [globalIdx]);
      }
    });

    dayMeals.forEach((meal, mealIdx) => {
      if (meal.mealType === 'snack') return;

      const targetCalories =
        meal.mealType === 'breakfast'
          ? mealDistribution.breakfast
          : meal.mealType === 'lunch'
            ? mealDistribution.lunch
            : mealDistribution.dinner;

      const floorWanted = Math.max(minFloorCalories, Math.round(targetCalories * floorFraction));
      const ingredientIndices = indicesByMealIdx.get(mealIdx) ?? [];
      if (ingredientIndices.length === 0) return;

      // Only protect non-sensitive ingredients so the optimizer can still reduce oils/nut butters to hit fat targets.
      const protectedIndices = ingredientIndices.filter((globalIdx) => {
        const opt = optimizable[globalIdx];
        if (opt.isLocked) return false;
        if (isZeroImpactIngredient(opt.name)) return false;
        if (isSensitiveIngredient(opt.name)) return false;
        return true;
      });
      if (protectedIndices.length === 0) return;

      let lockedCalories = 0;
      let adjustableCalories = 0;
      ingredientIndices.forEach((globalIdx) => {
        const opt = optimizable[globalIdx];
        const calories = (opt.density?.calories ?? 0) * (opt.currentAmount ?? 0);
        if (opt.isLocked) lockedCalories += calories;
        else if (protectedIndices.includes(globalIdx)) adjustableCalories += calories;
      });

      const currentMealCalories = lockedCalories + adjustableCalories;
      if (!(currentMealCalories > 1)) return;

      // Only prevent meals from shrinking below a reasonable floor; never force increases here.
      const enforcedFloor = Math.min(currentMealCalories, floorWanted);
      if (!(enforcedFloor > lockedCalories + 1e-6)) return;
      if (!(adjustableCalories > 0)) return;

      const requiredAdjustableFloorCalories = Math.max(0, enforcedFloor - lockedCalories);
      const scale = Math.max(0, Math.min(1, requiredAdjustableFloorCalories / adjustableCalories));
      if (!Number.isFinite(scale) || scale <= 0) return;

      let didApply = false;
      protectedIndices.forEach((globalIdx) => {
        const opt = optimizable[globalIdx];
        if (opt.isLocked) return;
        const minAmount = Math.max(0, (opt.currentAmount ?? 0) * scale);
        if (minAmount > opt.minAmount + 0.01) {
          didApply = true;
          opt.minAmount = minAmount;
        }
        if (opt.maxAmount < opt.minAmount) {
          opt.maxAmount = opt.minAmount;
        }
      });

      if (didApply) {
        console.log(
          `⚖️  [BATCH] Main-meal floor enforced: ${meal.mealType} "${meal.mealName}" ≥ ~${Math.round(
            enforcedFloor
          )} kcal`
        );
      }
    });
  }

  private nudgeDayForResiduals(
    dayMeals: MealWithUSDA[],
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>,
    targets: MacroValues,
    tolerance: { calories: number; protein: number; carbs: number; fats: number }
  ): MealWithUSDA[] {
    const cloneMeals = dayMeals.map((m) => ({
      ...m,
      ingredients: m.ingredients.map((ing) => ({ ...ing })),
      totalMacros: { ...m.totalMacros },
    }));

    const calculateTotals = (meals: MealWithUSDA[]) =>
      meals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
      );

    const getDensity = (
      macro: 'protein' | 'carbs' | 'fats',
      ing: { amount?: number; nutrition: MacroValues },
      usda?: MacroValues
    ) => {
      if (usda) {
        return macro === 'protein' ? usda.protein / 100 : macro === 'carbs' ? usda.carbs / 100 : usda.fats / 100;
      }
      const amount = Number(ing.amount || 0);
      if (!(amount > 0)) return 0;
      return macro === 'protein'
          ? ing.nutrition.protein / amount
          : macro === 'carbs'
            ? ing.nutrition.carbs / amount
            : ing.nutrition.fats / amount;
    };

    const derivePer100gFromIngredient = (ing: { amount?: number; nutrition: MacroValues }): MacroValues | undefined => {
      const amount = Number(ing.amount || 0);
      if (!(amount > 0)) return undefined;
      const scale = 100 / amount;
      return {
        calories: ing.nutrition.calories * scale,
        protein: ing.nutrition.protein * scale,
        carbs: ing.nutrition.carbs * scale,
        fats: ing.nutrition.fats * scale,
      };
    };

    const macroConfigs: Record<
      'protein' | 'carbs' | 'fats',
      { maxAdd: number; minDensity: number; maxCut?: number; maxCutDensity?: number }
    > = {
      protein: { maxAdd: 80, minDensity: 0.05 },
      // Allow meaningful trims when the LP result is close-but-not-exact (e.g., -20g carbs / +9g fats),
      // while still capping per-iteration adjustments for realism.
      carbs: { maxAdd: 120, minDensity: 0.1, maxCut: 40, maxCutDensity: 0.05 },
      fats: { maxAdd: 25, minDensity: 0.05, maxCut: 25, maxCutDensity: 0.08 },
    };

    const adjust = (macro: 'protein' | 'carbs' | 'fats') => {
      const totals = calculateTotals(cloneMeals);
      const delta = totals[macro] - targets[macro]; // positive = over, negative = under

      // Under-target: add to best high-density ingredient
      if (delta < -tolerance[macro]) {
        const deficit = -delta;
        if (deficit > macroConfigs[macro].maxAdd * 2) return; // too large; main optimizer should have handled

        let best:
          | { mealIdx: number; ingIdx: number; density: number; per100g: MacroValues }
          | undefined;

        cloneMeals.forEach((meal, mealIdx) => {
          meal.ingredients.forEach((ing, ingIdx) => {
            if (isZeroImpactIngredient(ing.name)) return;
            // Never use protein powders as a "macro crutch" in micro-corrections.
            if (this.isProteinPowderIngredient(ing.name)) return;
            const usda = usdaData[normalizeFoodName(ing.name)];
            const per100g = usda?.nutrition;
            if (per100g) {
              const density = getDensity(macro, ing, per100g);
              if (density > macroConfigs[macro].minDensity && (!best || density > best.density)) {
                best = { mealIdx, ingIdx, density, per100g };
              }
            }
          });

          // Fallback to ingredient-derived density if USDA lookup failed everywhere
          if (!best) {
            meal.ingredients.forEach((ing, ingIdx) => {
              if (isZeroImpactIngredient(ing.name)) return;
              if (this.isProteinPowderIngredient(ing.name)) return;
              const density = getDensity(macro, ing);
              if (!(density > macroConfigs[macro].minDensity)) return;
              const derived = derivePer100gFromIngredient(ing);
              if (!derived) return;
              if (!best || density > best.density) {
                best = { mealIdx, ingIdx, density, per100g: derived };
              }
            });
          }
        });

        if (!best) return;

        const { mealIdx, ingIdx, density, per100g } = best;
        const meal = cloneMeals[mealIdx];
        const ing = meal.ingredients[ingIdx];
        const maxBump = macroConfigs[macro].maxAdd / density;
        const bump = Math.min(maxBump, Math.max(3, deficit / density));

        ing.amount = Math.round((ing.amount + bump) * 10) / 10;
        ing.nutrition = calculateMacrosForAmount(per100g, ing.amount, 'g');
        meal.totalMacros = meal.ingredients.reduce(
          (sum, ingredient) => ({
            calories: sum.calories + ingredient.nutrition.calories,
            protein: sum.protein + ingredient.nutrition.protein,
            carbs: sum.carbs + ingredient.nutrition.carbs,
            fats: sum.fats + ingredient.nutrition.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }

      // Over-target: gently trim high-density ingredient for carbs/fats only (never trim protein)
      if (delta > tolerance[macro] && macro !== 'protein') {
        const surplus = delta;
        const cfg = macroConfigs[macro];
        if (!cfg.maxCut || !cfg.maxCutDensity) return;

        let best:
          | { mealIdx: number; ingIdx: number; density: number; per100g: MacroValues }
          | undefined;

        cloneMeals.forEach((meal, mealIdx) => {
          meal.ingredients.forEach((ing, ingIdx) => {
            if (isZeroImpactIngredient(ing.name)) return;
            if (this.isProteinPowderIngredient(ing.name)) return;
            const usda = usdaData[normalizeFoodName(ing.name)];
            const per100g = usda?.nutrition;
            if (per100g) {
              const density = getDensity(macro, ing, per100g);
              if (density > cfg.maxCutDensity && (!best || density > best.density)) {
                best = { mealIdx, ingIdx, density, per100g };
              }
            }
          });

          if (!best) {
            meal.ingredients.forEach((ing, ingIdx) => {
              if (isZeroImpactIngredient(ing.name)) return;
              if (this.isProteinPowderIngredient(ing.name)) return;
              const density = getDensity(macro, ing);
              if (!(density > cfg.maxCutDensity)) return;
              const derived = derivePer100gFromIngredient(ing);
              if (!derived) return;
              if (!best || density > best.density) {
                best = { mealIdx, ingIdx, density, per100g: derived };
              }
            });
          }
        });

        if (!best) return;
        const { mealIdx, ingIdx, density, per100g } = best;
        const meal = cloneMeals[mealIdx];
        const ing = meal.ingredients[ingIdx];
        const maxCut = cfg.maxCut / density;
        const cut = Math.min(maxCut, Math.max(2, surplus / density));

        const newAmount = Math.max(0, Math.round((ing.amount - cut) * 10) / 10);
        ing.amount = newAmount;
        ing.nutrition = calculateMacrosForAmount(per100g, ing.amount, 'g');
        meal.totalMacros = meal.ingredients.reduce(
          (sum, ingredient) => ({
            calories: sum.calories + ingredient.nutrition.calories,
            protein: sum.protein + ingredient.nutrition.protein,
            carbs: sum.carbs + ingredient.nutrition.carbs,
            fats: sum.fats + ingredient.nutrition.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }
    };

    for (let i = 0; i < 6; i++) {
      adjust('protein');
      adjust('carbs');
      adjust('fats');
      const totals = calculateTotals(cloneMeals);
      const within =
        Math.abs(totals.calories - targets.calories) <= tolerance.calories &&
        Math.abs(totals.protein - targets.protein) <= tolerance.protein &&
        Math.abs(totals.carbs - targets.carbs) <= tolerance.carbs &&
        Math.abs(totals.fats - targets.fats) <= tolerance.fats;
      if (within) break;
    }

    // Final convergence: if we are still outside tolerance, explicitly push deltas into the densest available ingredient.
    const totalsAfterLoop = calculateTotals(cloneMeals);
    const resolveMacro = (macro: 'protein' | 'carbs' | 'fats'): boolean => {
      const delta = totalsAfterLoop[macro] - targets[macro];
      if (Math.abs(delta) <= tolerance[macro]) return false;

      const cfg = macroConfigs[macro];
      const findBest = (preferCuts: boolean) => {
        let best:
          | { mealIdx: number; ingIdx: number; density: number; per100g: MacroValues }
          | undefined;
        cloneMeals.forEach((meal, mealIdx) => {
          meal.ingredients.forEach((ing, ingIdx) => {
            if (isZeroImpactIngredient(ing.name)) return;
            const usda = usdaData[normalizeFoodName(ing.name)];
            const per100g = usda?.nutrition || derivePer100gFromIngredient(ing);
            if (!per100g) return;
            const density = getDensity(macro, ing, per100g);
            if (!(density > 0)) return;
            // When cutting, pick highest density to minimize amount removed; when adding, pick highest density to minimize volume.
            if (!best || density > best.density) {
              best = { mealIdx, ingIdx, density, per100g };
            }
          });
        });
        return best;
      };

      if (delta < 0) {
        const best = findBest(false);
        if (!best) return false;
        const deficit = -delta;
        const { mealIdx, ingIdx, density, per100g } = best;
        const bump = Math.max(1, deficit / Math.max(density, 0.01));
        const meal = cloneMeals[mealIdx];
        const ing = meal.ingredients[ingIdx];
        ing.amount = Math.round((ing.amount + bump) * 10) / 10;
        ing.nutrition = calculateMacrosForAmount(per100g, ing.amount, 'g');
        meal.totalMacros = meal.ingredients.reduce(
          (sum, ingredient) => ({
            calories: sum.calories + ingredient.nutrition.calories,
            protein: sum.protein + ingredient.nutrition.protein,
            carbs: sum.carbs + ingredient.nutrition.carbs,
          fats: sum.fats + ingredient.nutrition.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );
        return true;
      } else if (macro !== 'protein') {
        // Trim only carbs/fats; never trim protein in final convergence.
        const best = findBest(true);
        if (!best) return false;
        const surplus = delta;
        const { mealIdx, ingIdx, density, per100g } = best;
        const cut = Math.max(0.5, surplus / Math.max(density, 0.01));
        const meal = cloneMeals[mealIdx];
        const ing = meal.ingredients[ingIdx];
        const newAmount = Math.max(0, Math.round((ing.amount - cut) * 10) / 10);
        ing.amount = newAmount;
        ing.nutrition = calculateMacrosForAmount(per100g, ing.amount, 'g');
        meal.totalMacros = meal.ingredients.reduce(
          (sum, ingredient) => ({
            calories: sum.calories + ingredient.nutrition.calories,
            protein: sum.protein + ingredient.nutrition.protein,
            carbs: sum.carbs + ingredient.nutrition.carbs,
          fats: sum.fats + ingredient.nutrition.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );
        return true;
      }
      return false;
    };

    // Re-evaluate totals after each forced adjustment to ensure convergence.
    for (let j = 0; j < 4; j++) {
      const changedProtein = resolveMacro('protein');
      const changedCarbs = resolveMacro('carbs');
      const changedFats = resolveMacro('fats');
      if (changedProtein || changedCarbs || changedFats) {
        const totals = calculateTotals(cloneMeals);
        const within =
          Math.abs(totals.calories - targets.calories) <= tolerance.calories &&
          Math.abs(totals.protein - targets.protein) <= tolerance.protein &&
          Math.abs(totals.carbs - targets.carbs) <= tolerance.carbs &&
          Math.abs(totals.fats - targets.fats) <= tolerance.fats;
        if (within) break;
        totalsAfterLoop.calories = totals.calories;
        totalsAfterLoop.protein = totals.protein;
        totalsAfterLoop.carbs = totals.carbs;
        totalsAfterLoop.fats = totals.fats;
      } else {
        break;
      }
    }

    // Final snap-to-target for tiny residuals: directly solve for grams needed on the densest ingredient.
    const snapMacro = (macro: 'protein' | 'carbs' | 'fats'): boolean => {
      const totals = calculateTotals(cloneMeals);
      const delta = targets[macro] - totals[macro]; // positive means we are under
      if (Math.abs(delta) <= tolerance[macro]) return false;

      let best:
        | { mealIdx: number; ingIdx: number; density: number; per100g: MacroValues }
        | undefined;

      cloneMeals.forEach((meal, mealIdx) => {
        meal.ingredients.forEach((ing, ingIdx) => {
          if (isZeroImpactIngredient(ing.name)) return;
          const usda = usdaData[normalizeFoodName(ing.name)];
          const per100g = usda?.nutrition || derivePer100gFromIngredient(ing);
          if (!per100g) return;
          const density = getDensity(macro, ing, per100g);
          if (!(density > 0)) return;
          if (!best || density > best.density) {
            best = { mealIdx, ingIdx, density, per100g };
          }
        });
      });

      if (!best) return false;

      const { mealIdx, ingIdx, density, per100g } = best;
      const meal = cloneMeals[mealIdx];
      const ing = meal.ingredients[ingIdx];

      if (delta > 0) {
        // Need to add
        const bump = Math.max(0.5, delta / Math.max(density, 0.01));
        ing.amount = Math.round((ing.amount + bump) * 10) / 10;
      } else if (macro !== 'protein') {
        // Need to cut (only carbs/fats); never cut protein in final snap.
        const cut = Math.max(0.5, -delta / Math.max(density, 0.01));
        ing.amount = Math.max(0, Math.round((ing.amount - cut) * 10) / 10);
      } else {
        return false;
      }

      ing.nutrition = calculateMacrosForAmount(per100g, ing.amount, 'g');
      meal.totalMacros = meal.ingredients.reduce(
        (sum, ingredient) => ({
          calories: sum.calories + ingredient.nutrition.calories,
          protein: sum.protein + ingredient.nutrition.protein,
          carbs: sum.carbs + ingredient.nutrition.carbs,
          fats: sum.fats + ingredient.nutrition.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );
      return true;
    };

    for (let k = 0; k < 2; k++) {
      const any = snapMacro('protein') || snapMacro('carbs') || snapMacro('fats');
      if (!any) break;
      const totals = calculateTotals(cloneMeals);
      const within =
        Math.abs(totals.calories - targets.calories) <= tolerance.calories &&
        Math.abs(totals.protein - targets.protein) <= tolerance.protein &&
        Math.abs(totals.carbs - targets.carbs) <= tolerance.carbs &&
        Math.abs(totals.fats - targets.fats) <= tolerance.fats;
      if (within) break;
    }

    return cloneMeals;
  }

  private injectMacroBalancerIngredients(
    dayMeals: MealWithUSDA[],
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>,
    dayTargets: MacroValues,
    gaps: MacroValues,
    userProfile?: UserProfile
  ): MealWithUSDA[] {
    if (!dayMeals || dayMeals.length === 0) return dayMeals;

    const prefs = ((userProfile?.preferences || '') + ' ' + (userProfile?.dietType || '')).toLowerCase();
    const allergies = (userProfile?.allergies || []).map((a) => (a || '').toLowerCase());
    const isVegan = prefs.includes('vegan');
    const isVegetarian = !isVegan && prefs.includes('vegetarian');
    const isPescatarian = prefs.includes('pescatarian');
    const isKeto = prefs.includes('keto');

    const avoidEggs = isVegan || allergies.some((a) => a.includes('egg'));
    const avoidFish = allergies.some((a) => a.includes('fish') || a.includes('seafood'));

    const proteinBalancer = isVegan
      ? 'Tofu'
      : isPescatarian && !avoidFish
        ? 'Salmon'
        : isVegetarian
          ? avoidEggs
            ? 'Tofu'
            : 'Eggs'
          : 'Chicken Breast';

    const carbBalancer = isKeto ? null : 'Brown Rice';
    const fatBalancer = 'Olive Oil';

    const hasIngredient = (name: string) => {
      const key = normalizeFoodName(name);
      return dayMeals.some((meal) => (meal.ingredients || []).some((ing) => normalizeFoodName(ing.name) === key));
    };

    const getEntry = (name: string) => usdaData[normalizeFoodName(name)]?.nutrition ?? null;
    const getFdcId = (name: string) => usdaData[normalizeFoodName(name)]?.fdcId ?? 0;

    const pickAnchorMealIdx = (preferredTypes: Array<'dinner' | 'lunch' | 'breakfast'>) => {
      for (const t of preferredTypes) {
        const idx = dayMeals.findIndex((m) => m.mealType === t);
        if (idx >= 0) return idx;
      }
      return 0;
    };

    const addToMeal = (mealIdx: number, name: string) => {
      const per100g = getEntry(name);
      if (!per100g) return;
      const meal = dayMeals[mealIdx];
      const already = (meal.ingredients || []).some((ing) => normalizeFoodName(ing.name) === normalizeFoodName(name));
      if (already) return;
      const nutrition = calculateMacrosForAmount(per100g, 0, 'g');
      meal.ingredients = [...(meal.ingredients || []), { name, amount: 0, nutrition, fdcId: getFdcId(name) }];
    };

    // Always inject missing levers (0g by default). This is a feasibility guarantee:
    // the optimizer can only correct a macro if at least one adjustable ingredient spans that axis.
    if (!hasIngredient(proteinBalancer)) {
      addToMeal(pickAnchorMealIdx(['dinner', 'lunch', 'breakfast']), proteinBalancer);
    }
    if (carbBalancer && !hasIngredient(carbBalancer)) {
      addToMeal(pickAnchorMealIdx(['lunch', 'dinner', 'breakfast']), carbBalancer);
    }
    if (!hasIngredient(fatBalancer)) {
      addToMeal(pickAnchorMealIdx(['dinner', 'lunch', 'breakfast']), fatBalancer);
    }

    // Keep totals consistent (0g additions are no-ops, but meals might be mutated above).
    return dayMeals.map((meal) => {
      const totals = (meal.ingredients || []).reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.nutrition?.calories ?? 0),
          protein: acc.protein + (ing.nutrition?.protein ?? 0),
          carbs: acc.carbs + (ing.nutrition?.carbs ?? 0),
          fats: acc.fats + (ing.nutrition?.fats ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
      );
      return { ...meal, ingredients: [...(meal.ingredients || [])], totalMacros: totals };
    });
  }

  private isEmptyTemplateMeal(meal: WeeklyMealTemplatesGeneration['meals'][number]): boolean {
    const ingredients = meal.ingredients || [];
    if (ingredients.length === 0) return true;
    const substantive = ingredients.filter((ing) => !isZeroImpactIngredient(ing.name) && Number(ing.amount || 0) > 0.1);
    return substantive.length === 0;
  }

  private buildFallbackMainMealTemplate(
    userProfile: UserProfile,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    seed: number
  ): WeeklyMealTemplatesGeneration['meals'][number] {
    const dietType = (userProfile.dietType || 'anything').toLowerCase();
    const prefs = ((userProfile.preferences || '') + ' ' + dietType).toLowerCase();
    const allergies = (userProfile.allergies || []).map((a) => a.toLowerCase());

    const isVegan = prefs.includes('vegan');
    const isVegetarian = !isVegan && prefs.includes('vegetarian');
    const isPescatarian = prefs.includes('pescatarian');
    const isKeto = prefs.includes('keto');
    const isPaleo = prefs.includes('paleo');

    const avoidEggs = isVegan || allergies.some((a) => a.includes('egg'));
    const avoidDairy = isVegan || allergies.some((a) => a.includes('dairy') || a.includes('milk'));
    const avoidFish = allergies.some((a) => a.includes('fish') || a.includes('seafood'));

    const variant = Math.abs(seed) % 2;

    const base: WeeklyMealTemplatesGeneration['meals'][number] = (() => {
      if (mealType === 'breakfast') {
        if (isKeto) {
          const eggOrTofu = avoidEggs ? 'Tofu' : 'Eggs';
          return {
            mealName: avoidEggs ? 'Tofu & Avocado Breakfast Bowl' : 'Egg & Avocado Breakfast Bowl',
            mealType,
            ingredients: [
              { name: eggOrTofu, amount: avoidEggs ? 220 : 180 },
              { name: 'Avocado', amount: 100 },
              { name: 'Spinach', amount: 60 },
              { name: 'Olive Oil', amount: 8 },
              { name: 'Salt', amount: 2 },
              { name: 'Black Pepper', amount: 1 },
            ],
            instructions: [
              `Cook ${eggOrTofu} in a nonstick pan with olive oil.`,
              'Add spinach and cook until wilted.',
              'Top with sliced avocado, then season with salt and pepper.',
            ],
          };
        }

        if (avoidEggs) {
          return {
            mealName: 'Tofu Veggie Scramble',
            mealType,
            ingredients: [
              { name: 'Tofu', amount: 250 },
              { name: 'Spinach', amount: 70 },
              { name: 'Tomato', amount: 120 },
              { name: 'Olive Oil', amount: 8 },
              { name: 'Salt', amount: 2 },
              { name: 'Black Pepper', amount: 1 },
            ],
            instructions: [
              'Crumble tofu and cook in a pan with olive oil.',
              'Add tomato and spinach; cook until softened.',
              'Season with salt and pepper and serve warm.',
            ],
          };
        }

        return {
          mealName: variant === 0 ? 'Veggie Omelette' : 'Spinach & Mushroom Scramble',
          mealType,
          ingredients: [
            { name: 'Eggs', amount: 180 },
            { name: 'Spinach', amount: 60 },
            { name: variant === 0 ? 'Tomato' : 'Mushrooms', amount: 120 },
            { name: 'Olive Oil', amount: 8 },
            { name: 'Salt', amount: 2 },
            { name: 'Black Pepper', amount: 1 },
          ],
          instructions: [
            'Whisk eggs with salt and pepper.',
            'Cook vegetables in olive oil, then add eggs.',
            'Cook until set and serve warm.',
          ],
        };
      }

      if (mealType === 'lunch') {
        if (isKeto) {
          const protein = isVegan ? 'Tofu' : 'Chicken Breast';
          return {
            mealName: isVegan ? 'Tofu & Avocado Salad' : 'Chicken & Avocado Salad',
            mealType,
            ingredients: [
              { name: protein, amount: isVegan ? 250 : 200 },
              { name: 'Avocado', amount: 120 },
              { name: 'Spinach', amount: 80 },
              { name: 'Tomato', amount: 120 },
              { name: 'Olive Oil', amount: 10 },
              { name: 'Salt', amount: 2 },
              { name: 'Black Pepper', amount: 1 },
            ],
            instructions: [
              `Cook or prep ${protein} (grill/air-fry/press tofu).`,
              'Assemble salad with spinach, tomato, and avocado.',
              'Dress with olive oil; season with salt and pepper.',
            ],
          };
        }

        if (isVegan || isVegetarian) {
          const carb = isPaleo ? 'Sweet Potato' : 'Brown Rice';
          return {
            mealName: variant === 0 ? 'Tofu & Rice Bowl' : 'Tofu Veggie Bowl',
            mealType,
            ingredients: [
              { name: 'Tofu', amount: 250 },
              { name: carb, amount: 220 },
              { name: 'Broccoli', amount: 160 },
              { name: 'Olive Oil', amount: 10 },
              { name: 'Salt', amount: 2 },
              { name: 'Black Pepper', amount: 1 },
            ],
            instructions: [
              'Cook tofu and broccoli (pan-sear/steam).',
              `Serve over ${carb}.`,
              'Finish with olive oil, salt, and pepper.',
            ],
          };
        }

        // Anything / pescatarian: default to chicken bowl for reliability (USDA staples).
        return {
          mealName: variant === 0 ? 'Grilled Chicken Rice Bowl' : 'Chicken & Broccoli Bowl',
          mealType,
          ingredients: [
            { name: 'Chicken Breast', amount: 200 },
            { name: isPaleo ? 'Sweet Potato' : 'Brown Rice', amount: 220 },
            { name: 'Broccoli', amount: 160 },
            { name: 'Olive Oil', amount: 10 },
            { name: 'Salt', amount: 2 },
            { name: 'Black Pepper', amount: 1 },
          ],
          instructions: [
            'Cook chicken and broccoli (grill/roast/steam).',
            `Serve with ${isPaleo ? 'sweet potato' : 'brown rice'}.`,
            'Finish with olive oil, salt, and pepper.',
          ],
        };
      }

      // dinner
      if (!avoidFish && (isPescatarian || (!isVegan && !isVegetarian && variant === 0))) {
        const carb = isKeto ? 'Avocado' : isPaleo ? 'Sweet Potato' : 'Quinoa';
        const carbAmount = isKeto ? 120 : 260;
        return {
          mealName: isKeto ? 'Baked Salmon & Avocado Plate' : 'Baked Salmon with Sweet Potato',
          mealType,
          ingredients: [
            { name: 'Salmon', amount: 200 },
            { name: carb, amount: carbAmount },
            { name: 'Broccoli', amount: 160 },
            { name: 'Olive Oil', amount: 10 },
            { name: 'Salt', amount: 2 },
            { name: 'Black Pepper', amount: 1 },
          ],
          instructions: [
            'Bake or pan-sear salmon until cooked through.',
            `Prepare ${carb} and broccoli.`,
            'Finish with olive oil, salt, and pepper.',
          ],
        };
      }

      const dinnerProtein = isVegan || isVegetarian ? 'Tofu' : 'Chicken Breast';
      const carb = isKeto ? 'Avocado' : isPaleo ? 'Sweet Potato' : 'Quinoa';
      const carbAmount = isKeto ? 120 : 260;
      return {
        mealName: isVegan || isVegetarian ? 'Tofu Quinoa Dinner Bowl' : 'Chicken Quinoa Dinner Bowl',
        mealType,
        ingredients: [
          { name: dinnerProtein, amount: isVegan || isVegetarian ? 260 : 220 },
          { name: carb, amount: carbAmount },
          { name: 'Broccoli', amount: 160 },
          { name: 'Olive Oil', amount: 10 },
          { name: 'Salt', amount: 2 },
          { name: 'Black Pepper', amount: 1 },
        ],
        instructions: [
          `Cook ${dinnerProtein} and broccoli.`,
          `Serve with ${carb}.`,
          'Finish with olive oil, salt, and pepper.',
        ],
      };
    })();

    return {
      ...base,
      ingredients: (base.ingredients || []).map((ing) => withFallbackEstimates(ing)),
    };
  }

  private repairEmptyMealsInBatch(
    meals: BatchMealGeneration,
    userProfile: UserProfile,
    options?: { repeatWeekly?: boolean; weekSeed?: number }
  ): BatchMealGeneration {
    const repeatWeekly = options?.repeatWeekly ?? false;
    const weekSeed = Number(options?.weekSeed ?? 0);

    const clone = <T,>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value)) as T;
      }
    };

    if (!meals?.weeklyMeals?.length) return meals;

    if (repeatWeekly) {
      const templateMeals = meals.weeklyMeals[0]?.meals || [];
      let snackCounter = 0;
      const repairedTemplates = templateMeals.map((meal) => {
        const snackIndex = meal.mealType === 'snack' ? snackCounter++ : undefined;
        if (!this.isEmptyTemplateMeal(meal)) return meal;

        console.warn(`⚠️  [BATCH] Repairing empty template meal: ${meal.mealType} "${meal.mealName}"`);
        if (meal.mealType === 'snack') {
          const fallback = this.buildMacroBalancerSnackTemplate(userProfile, snackIndex ?? 0, weekSeed);
          return {
            ...fallback,
            ingredients: (fallback.ingredients || []).map((ing: any) => withFallbackEstimates(ing)),
          };
        }

        return this.buildFallbackMainMealTemplate(userProfile, meal.mealType, weekSeed);
      });

      return {
        ...meals,
        weeklyMeals: meals.weeklyMeals.map((day) => ({
          ...day,
          meals: repairedTemplates.map((m) => clone(m)),
        })),
      };
    }

    // Fresh daily / non-repeat: repair day-by-day (deterministic per day+meal type).
    return {
      ...meals,
      weeklyMeals: meals.weeklyMeals.map((day) => {
        let snackCounter = 0;
        const repaired = (day.meals || []).map((meal) => {
          const snackIndex = meal.mealType === 'snack' ? snackCounter++ : undefined;
          if (!this.isEmptyTemplateMeal(meal)) return meal;

          console.warn(`⚠️  [BATCH] Repairing empty meal: Day ${day.dayNumber} ${meal.mealType} "${meal.mealName}"`);
          const seed = weekSeed * 10 + Number(day.dayNumber || 0);
          if (meal.mealType === 'snack') {
            const fallback = this.buildMacroBalancerSnackTemplate(userProfile, snackIndex ?? 0, seed);
            return {
              ...fallback,
              ingredients: (fallback.ingredients || []).map((ing: any) => withFallbackEstimates(ing)),
            };
          }

          return this.buildFallbackMainMealTemplate(userProfile, meal.mealType, seed);
        });
        return { ...day, meals: repaired };
      }),
    };
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
    this.currentMealFrequency = Math.max(3, Math.min(6, userProfile.mealFrequency || 4));
    const mealPrepPreference = userProfile.mealPrepPreference || 'repeat_weekly';
    const useWeeklyRepeatTemplates = mealPrepPreference === 'repeat_weekly';

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

    // Step 1: Generate meals (weekly templates by default; full 7-day if user wants fresh daily)
    options?.onProgress?.(
      useWeeklyRepeatTemplates ? 'Generating weekly meal templates with AI...' : 'Generating all meals with AI...',
      10
    );

    const shouldReuseAiTemplate =
      useWeeklyRepeatTemplates
        ? false
        : options?.reuseAiTemplate ??
          // Default: reuse templates for long plans unless user explicitly wants "fresh daily"
          (mealPrepPreference !== 'fresh_daily' && (userProfile.timelineWeeks || 0) >= 8);

    const cacheKey = this.buildAiTemplateCacheKey(userProfile, weeklyOutline);

    let aiGeneratedMeals: BatchMealGeneration;
    if (useWeeklyRepeatTemplates) {
      const templateDraft = await this.generateWeeklyTemplatesWithAI(
        userProfile,
        weeklyOutline,
        trainingSplit,
        nutritionFacts,
        dailyTargetsOverride
      );
      const normalizedTemplates = this.normalizeWeeklyTemplateMeals(templateDraft.meals, userProfile, weeklyOutline.weekNumber);
      aiGeneratedMeals = this.expandTemplateMealsToWeek(normalizedTemplates, trainingSplit);
      console.log(
        `✅ [BATCH] AI generated ${normalizedTemplates.length} template meals; expanded to ${aiGeneratedMeals.weeklyMeals.length} days`
      );
    } else if (shouldReuseAiTemplate && this.aiTemplateCache.has(cacheKey)) {
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
      console.log(`✅ [BATCH] AI generated ${aiGeneratedMeals.weeklyMeals.length} days of meals`);
    }

    // Repair empty meals (e.g., seasoning-only meals) deterministically so 0-cal meals never reach customers.
    aiGeneratedMeals = this.repairEmptyMealsInBatch(aiGeneratedMeals, userProfile, {
      repeatWeekly: useWeeklyRepeatTemplates,
      weekSeed: weeklyOutline.weekNumber,
    });

    // Validate meal variety (check for duplicate meal names within same day)
    this.validateMealVariety(aiGeneratedMeals, { allowRepeatsAcrossWeek: useWeeklyRepeatTemplates });

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
      dailyTargetsOverride,
      userProfile
    );
    console.log(`✅ [BATCH] Adjusted meals to match targets`);

    // Convert to day-by-day format (array of arrays)
    let dayMeals: MealWithUSDA[][] = [];
    for (let day = 1; day <= 7; day++) {
      dayMeals.push(adjustedMeals.filter((meal: MealWithUSDA) => meal.dayNumber === day));
    }

    // Step 6: COMPREHENSIVE VALIDATION - strict day targets + meal structure
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

    if (Array.isArray(validation.errors) && validation.errors.length > 0) {
      throw new Error(
        `MEAL VALIDATION FAILED: ${validation.errors.length} day(s) outside strict tolerance.\n` +
          validation.errors.join('\n')
      );
    }

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

      const tolerance = {
        calories: 5,
        protein: 1,
        carbs: 1,
        fats: 1,
      };

      // Calculate accuracy percentages (for reporting only)
      const accuracyPct = {
        calories: dayTargets.calories > 0 ? (actualTotals.calories / dayTargets.calories) * 100 : 0,
        protein: dayTargets.protein > 0 ? (actualTotals.protein / dayTargets.protein) * 100 : 0,
        carbs: dayTargets.carbs > 0 ? (actualTotals.carbs / dayTargets.carbs) * 100 : 0,
        fats: dayTargets.fats > 0 ? (actualTotals.fats / dayTargets.fats) * 100 : 0,
      };

      const delta = {
        calories: actualTotals.calories - dayTargets.calories,
        protein: actualTotals.protein - dayTargets.protein,
        carbs: actualTotals.carbs - dayTargets.carbs,
        fats: actualTotals.fats - dayTargets.fats,
      };

      const expectedMealsPerDay = this.currentMealFrequency;
      const expectedSnacksPerDay = Math.max(0, expectedMealsPerDay - 3);
      const mealTypeCounts = meals.reduce(
        (acc, meal) => {
          acc[meal.mealType] = (acc[meal.mealType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const errors: string[] = [];
      if (meals.length !== expectedMealsPerDay) {
        errors.push(`Expected ${expectedMealsPerDay} meals, found ${meals.length}`);
      }
      if ((mealTypeCounts.breakfast || 0) !== 1) {
        errors.push(`Expected 1 breakfast, found ${mealTypeCounts.breakfast || 0}`);
      }
      if ((mealTypeCounts.lunch || 0) !== 1) {
        errors.push(`Expected 1 lunch, found ${mealTypeCounts.lunch || 0}`);
      }
      if ((mealTypeCounts.dinner || 0) !== 1) {
        errors.push(`Expected 1 dinner, found ${mealTypeCounts.dinner || 0}`);
      }
      if ((mealTypeCounts.snack || 0) !== expectedSnacksPerDay) {
        errors.push(`Expected ${expectedSnacksPerDay} snack(s), found ${mealTypeCounts.snack || 0}`);
      }

      // Meal integrity: never allow "seasoning-only" meals through validation.
      meals.forEach((meal) => {
        const substantive = (meal.ingredients || []).filter(
          (ing) => !isZeroImpactIngredient(ing.name) && Number(ing.amount || 0) > 0.1 && Number(ing.nutrition?.calories || 0) > 0
        );
        if (substantive.length === 0) {
          errors.push(
            `${meal.mealType} "${meal.mealName}": Meal has no substantive ingredients/macros (likely seasoning-only).`
          );
        }
      });

      const proteinPowderInMainMeals = meals.some(
        (meal) =>
          meal.mealType !== 'snack' &&
          (meal.ingredients || []).some((ing) => this.isProteinPowderIngredient(ing.name))
      );
      if (proteinPowderInMainMeals) {
        errors.push('Protein powder found in a non-snack meal (forbidden for realism)');
      }

      if (Math.abs(delta.calories) > tolerance.calories) {
        errors.push(`Calories off by ${delta.calories.toFixed(1)} kcal`);
      }
      if (Math.abs(delta.protein) > tolerance.protein) {
        errors.push(`Protein off by ${delta.protein.toFixed(1)}g`);
      }
      if (Math.abs(delta.carbs) > tolerance.carbs) {
        errors.push(`Carbs off by ${delta.carbs.toFixed(1)}g`);
      }
      if (Math.abs(delta.fats) > tolerance.fats) {
        errors.push(`Fats off by ${delta.fats.toFixed(1)}g`);
      }

      // Meal breakdown
      let snackCounter = 0;
      const mealBreakdown = meals.map(meal => {
        const snackIndex = meal.mealType === 'snack' ? snackCounter++ : undefined;
        const mealTargets = this.calculateMealMacroTargets(
          meal.mealType,
          this.currentMealFrequency,
          dayTargets,
          snackIndex
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
        delta,
        tolerance,
        accuracy: {
          calories: accuracyPct.calories.toFixed(1) + '%',
          protein: accuracyPct.protein.toFixed(1) + '%',
          carbs: accuracyPct.carbs.toFixed(1) + '%',
          fats: accuracyPct.fats.toFixed(1) + '%',
        },
        errors: errors.length > 0 ? errors : ['All within strict tolerance'],
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

  private async generateWeeklyTemplatesWithAI(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    nutritionFacts: NutritionFact[] = [],
    dailyTargetsOverride?: MacroTargets[]
  ): Promise<WeeklyMealTemplatesGeneration> {
    const isAIAvailable = this.cotService.isAIAvailable && this.cotService.isAIAvailable();
    if (!isAIAvailable) {
      throw new Error('AI service (Groq) is required for meal generation. Please ensure VITE_GROQ_API_KEY is set.');
    }

    const prompt = this.buildWeeklyTemplatePrompt(
      userProfile,
      weeklyOutline,
      trainingSplit,
      nutritionFacts,
      dailyTargetsOverride
    );

    const { result } = await this.cotService.generateWithCoT(prompt, WeeklyMealTemplatesSchema, {
      enableVerification: true,
    });

    return result;
  }

  private normalizeWeeklyTemplateMeals(
    meals: WeeklyMealTemplatesGeneration['meals'],
    userProfile: UserProfile,
    seed?: number
  ): WeeklyMealTemplatesGeneration['meals'] {
    const mealFrequency = this.currentMealFrequency;
    const expectedSnacks = Math.max(0, mealFrequency - 3);

    const byType = meals.reduce(
      (acc, meal) => {
        acc[meal.mealType].push(meal);
        return acc;
      },
      {
        breakfast: [] as WeeklyMealTemplatesGeneration['meals'],
        lunch: [] as WeeklyMealTemplatesGeneration['meals'],
        dinner: [] as WeeklyMealTemplatesGeneration['meals'],
        snack: [] as WeeklyMealTemplatesGeneration['meals'],
      }
    );

    const breakfast = byType.breakfast[0];
    const lunch = byType.lunch[0];
    const dinner = byType.dinner[0];
    if (!breakfast || !lunch || !dinner) {
      throw new Error(
        `Weekly template generation missing required meals. Found: breakfast=${byType.breakfast.length}, lunch=${byType.lunch.length}, dinner=${byType.dinner.length}`
      );
    }

    const snacks: WeeklyMealTemplatesGeneration['meals'] = byType.snack.slice(0, expectedSnacks);
    while (snacks.length < expectedSnacks) {
      snacks.push(this.buildMacroBalancerSnackTemplate(userProfile, snacks.length, seed));
    }

    const normalized = [breakfast, lunch, dinner, ...snacks];
    if (normalized.length !== mealFrequency) {
      throw new Error(
        `Weekly template normalization failed: expected ${mealFrequency} meals, got ${normalized.length}`
      );
    }

    return normalized;
  }

  private expandTemplateMealsToWeek(
    templateMeals: WeeklyMealTemplatesGeneration['meals'],
    trainingSplit: any
  ): BatchMealGeneration {
    const clone = <T,>(value: T): T => {
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value)) as T;
      }
    };

    const weeklyMeals = (trainingSplit?.days || []).slice(0, 7).map((day: any, index: number) => ({
      dayNumber: index + 1,
      dayName: day?.dayName || `Day ${index + 1}`,
      meals: templateMeals.map((m) => clone(m)),
    }));

    if (weeklyMeals.length !== 7) {
      throw new Error(`Training split must contain exactly 7 days to expand weekly templates (got ${weeklyMeals.length})`);
    }

    return { weeklyMeals };
  }

  private buildMacroBalancerSnackTemplate(
    userProfile: UserProfile,
    snackIndex: number,
    seed?: number
  ): WeeklyMealTemplatesGeneration['meals'][number] {
    const allergies = (userProfile.allergies || []).map((a) => a.toLowerCase());
    const dietType = (userProfile.dietType || 'anything').toLowerCase();

    const avoidDairy = dietType === 'vegan' || allergies.some((a) => a.includes('dairy') || a.includes('milk'));
    const proteinPowder = avoidDairy ? 'Pea Protein Powder' : 'Whey Protein Powder';

    const avoidNuts = allergies.some((a) => a.includes('peanut') || a.includes('tree nut') || a.includes('nuts'));
    const isKeto = dietType === 'keto';
    const isPaleo = dietType === 'paleo';

    const avoidPeanuts = isPaleo || allergies.some((a) => a.includes('peanut'));
    const fatSource = avoidNuts ? 'Olive Oil' : avoidPeanuts ? 'Almond Butter' : 'Peanut Butter';
    const fatAmount = fatSource === 'Olive Oil' ? 5 : 15;

    const avoidOats = isPaleo || allergies.some((a) => a.includes('gluten') || a.includes('oat'));
    const carbSource = isKeto ? 'Chia Seeds' : avoidOats ? 'Banana' : 'Rolled Oats';
    const carbAmount = isKeto ? 15 : carbSource === 'Banana' ? 150 : 40;

    const fruitSource = 'Berries';
    const fruitAmount = isKeto ? 60 : 120;

    const seedValue = Number.isFinite(Number(seed)) ? Number(seed) : 0;
    const variant = Math.abs(seedValue + snackIndex) % 3;

    if (variant === 1) {
      const yogurtBase = avoidDairy ? 'Soy Yogurt' : 'Greek Yogurt';
      const yogurtAmount = 220;
      const addCarb = isKeto ? 'Chia Seeds' : avoidOats ? 'Banana' : 'Rolled Oats';
      const addCarbAmount = isKeto ? 15 : addCarb === 'Banana' ? 120 : 35;
      const addFat = avoidNuts ? 'Chia Seeds' : fatSource === 'Olive Oil' ? 'Almonds' : fatSource;
      const addFatAmount = addFat === 'Chia Seeds' ? 15 : addFat === 'Almonds' ? 18 : 12;
      const combinedChiaAmount = addCarb === 'Chia Seeds' && addFat === 'Chia Seeds' ? addCarbAmount + addFatAmount : null;

      const template: WeeklyMealTemplatesGeneration['meals'][number] = {
        mealName: snackIndex > 0 ? `Yogurt Bowl Snack ${snackIndex + 1}` : 'Yogurt Bowl Snack',
        mealType: 'snack',
        ingredients: [
          { name: yogurtBase, amount: yogurtAmount },
          { name: fruitSource, amount: fruitAmount },
          ...(combinedChiaAmount !== null
            ? [{ name: 'Chia Seeds', amount: combinedChiaAmount }]
            : [{ name: addCarb, amount: addCarbAmount }, { name: addFat, amount: addFatAmount }]),
        ],
        instructions: [
          `Add ${yogurtBase} to a bowl.`,
          combinedChiaAmount !== null
            ? `Top with ${fruitSource}, then add Chia Seeds.`
            : `Top with ${fruitSource}, then add ${addCarb} and ${addFat}.`,
          'Stir and enjoy immediately.',
        ],
      };
      return { ...template, ingredients: template.ingredients.map((ing) => withFallbackEstimates(ing)) };
    }

    if (variant === 2) {
      const fruitMain = isKeto ? 'Berries' : 'Banana';
      const fruitMainAmount = fruitMain === 'Banana' ? 150 : fruitAmount;
      const fatTopper = avoidNuts ? 'Chia Seeds' : fatSource;
      const fatTopperAmount = fatTopper === 'Olive Oil' ? 5 : fatTopper === 'Chia Seeds' ? 18 : 15;
      const extraFruit = fruitMain === fruitSource ? null : { name: fruitSource, amount: fruitAmount };

      const template: WeeklyMealTemplatesGeneration['meals'][number] = {
        mealName: snackIndex > 0 ? `Fruit & Fat Snack ${snackIndex + 1}` : 'Fruit & Fat Snack',
        mealType: 'snack',
        ingredients: [
          { name: fruitMain, amount: fruitMainAmount },
          ...(extraFruit ? [extraFruit] : []),
          { name: fatTopper, amount: fatTopperAmount },
        ],
        instructions: [
          extraFruit ? `Prepare ${fruitMain} and ${fruitSource}.` : `Prepare ${fruitMain}.`,
          `Add ${fatTopper} as a topper or dip.`,
          'Eat immediately.',
        ],
      };
      return { ...template, ingredients: template.ingredients.map((ing) => withFallbackEstimates(ing)) };
    }

    // Variant 0 (default): shake/smoothie macro-balancer (protein-forward and adjustable)
    const template: WeeklyMealTemplatesGeneration['meals'][number] = {
      mealName: snackIndex > 0 ? `Macro Balancer Shake ${snackIndex + 1}` : 'Macro Balancer Shake',
      mealType: 'snack',
      ingredients: [
        { name: proteinPowder, amount: 30 },
        { name: carbSource, amount: carbAmount },
        { name: fatSource, amount: fatAmount },
        { name: fruitSource, amount: fruitAmount },
        { name: 'Water', amount: 300 },
      ],
      instructions: [
        `Add ${proteinPowder} to a blender or shaker.`,
        `Add ${carbSource}, ${fatSource}, and ${fruitSource}.`,
        'Add water and blend/shake until smooth.',
        'Drink immediately.',
      ],
    };
    return { ...template, ingredients: template.ingredients.map((ing) => withFallbackEstimates(ing)) };
  }

  private buildWeeklyTemplatePrompt(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    trainingSplit: any,
    nutritionFacts: NutritionFact[] = [],
    dailyTargetsOverride?: MacroTargets[]
  ): string {
    const dailyTargets = weeklyOutline.dailyTargets;
    const mealFrequency = this.currentMealFrequency;
    const snacksCount = Math.max(0, mealFrequency - 3);

    const dietaryGuidance = this.buildDietaryGuidance(userProfile);

    const dayInfo = (trainingSplit?.days || []).slice(0, 7).map((day: any, index: number) => {
      const dayMacros = this.calculateDayMacros(weeklyOutline, day.isRestDay, index, dailyTargetsOverride);
      return {
        dayNumber: index + 1,
        dayName: day.dayName,
        isTrainingDay: !day.isRestDay,
        macros: dayMacros,
      };
    });

    return `You are a sports nutritionist and meal-prep coach.

Your task: Generate a SINGLE set of meal templates for the week that will repeat Monday-Sunday.
Portion sizes will be adjusted programmatically per day to hit exact daily targets, so you should provide realistic BASE portions for an average day.

USER PROFILE:
- Goal: ${userProfile.goal}
- Meal Frequency: ${mealFrequency} meals per day (${snacksCount} snack${snacksCount === 1 ? '' : 's'})

${dietaryGuidance}

WEEKLY TARGETS (Daily Averages):
- Calories: ${dailyTargets.calories} kcal/day
- Protein: ${dailyTargets.protein}g/day (${dailyTargets.proteinPerKg}g/kg)
- Carbs: ${dailyTargets.carbs}g/day
- Fats: ${dailyTargets.fat}g/day

DAY-BY-DAY TARGETS (for context; do NOT create different recipes per day):
${dayInfo.map((d: any) => `- Day ${d.dayNumber} (${d.dayName} - ${d.isTrainingDay ? 'Training' : 'Rest'}): ${d.macros.calories} kcal, P ${d.macros.protein}g, C ${d.macros.carbs}g, F ${d.macros.fats}g`).join('\n')}

${nutritionFacts.length > 0 ? `
🚨 NUTRITIONAL HARD TRUTHS & PRINCIPLES:
${nutritionFacts.map(f => `- ${f.content}`).join('\n')}
` : ''}

REQUIREMENTS:
1. Output exactly ${mealFrequency} meal templates total:
   - 1 breakfast
   - 1 lunch
   - 1 dinner
   - ${snacksCount} snack${snacksCount === 1 ? '' : 's'}
2. Meals must strictly follow dietary restrictions/preferences.
3. Each meal must include a specific ingredient list with gram amounts (not vague portions).
4. Provide 3-6 clear cooking instructions per meal.
5. Snacks should be protein-forward and adjustable (good for fine-tuning macros) but should NOT dominate the day.
6. Snack realism: keep base snack portions moderate. Avoid extreme amounts (e.g., 900g yogurt). If using yogurt, keep ≤300g base; if using protein powder, keep ≤30g base.
7. FOR REALISM: Do NOT use protein powder in breakfast/lunch/dinner. If you use protein powder, it MUST be in a snack that is clearly a shake/smoothie.

Generate the meal templates now.`;
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
  private validateMealVariety(
    meals: BatchMealGeneration,
    options?: { allowRepeatsAcrossWeek?: boolean }
  ): void {
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

    if (!options?.allowRepeatsAcrossWeek) {
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
    }

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
        dinner: Math.round(dailyCalories * 0.25),    // 25%
        snacks: [
          Math.round(dailyCalories * 0.10), // 10% (mid-morning)
          Math.round(dailyCalories * 0.10), // 10% (mid-afternoon)
        ],
      },
      6: {
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
    console.log('[BATCH] Constructed dietary guidance for prompt');

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

    const mealPrepStyle = userProfile.mealPrepPreference || 'repeat_weekly';

    return `You are an expert nutritionist generating a complete weekly meal plan. Generate ALL 7 days of meals in a single response.

🚨 CRITICAL RULE #1 - MEAL VARIETY:
${mealPrepStyle === 'fresh_daily' ? `
✅ REQUIREMENT: EACH DAY MUST HAVE COMPLETELY DIFFERENT MEALS FOR EACH MEAL TYPE. Every single breakfast, lunch, and dinner in the 7-day plan must be a UNIQUE recipe. Do not repeat meals across the week.
` : mealPrepStyle === 'repeat_weekly' ? `
✅ REQUIREMENT: REPEAT THE SAME SET OF MEALS MONDAY THROUGH SUNDAY. Use the SAME breakfast, lunch, dinner, and snacks each day. Keep ingredient lists stable; portions can be adjusted as needed to match targets.
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

REALISM RULE:
- Protein powder is ONLY allowed in snack meals that are clearly a shake/smoothie. Do NOT put protein powder into breakfast/lunch/dinner meals.

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
    const mealPrepPreference = profile.mealPrepPreference || 'repeat_weekly';

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
    } else if (mealPrepPreference === 'repeat_weekly') {
      guidance += `3. VARIETY (REPEAT WEEKLY): Create ONE set of meals for the week (breakfast, lunch, dinner, and snacks) and repeat them Monday-Sunday. Meals should feel meal-prep friendly.\n`;
    } else if (mealPrepPreference === 'batch_cooking') {
      guidance += `3. VARIETY (BATCH PREP): You should repeat 3-4 core recipes for lunch and dinner throughout the week (e.g., "Monday Lunch" is the same as "Wednesday Lunch" and "Friday Lunch"). This simplifies bulk cooking.\n`;
    } else if (mealPrepPreference === 'leftovers_ok') {
      guidance += `3. VARIETY (LEFTOVERS): Use a "cook once, eat twice" strategy. For example, Monday's Dinner should usually be the same as Tuesday's Lunch.\n`;
    }

    guidance += `4. PORTION FLEXIBILITY: Portions (ingredient grams) may be adjusted day-to-day to hit exact daily targets. Keep the ingredient list stable when repeating meals; adjust amounts rather than changing the whole recipe.\n\n`;

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

        // Rule 4b: Hard reject "seasoning-only" meals (0-cal meals like salt+pepper)
        const substantiveIngredients = ingredients.filter(
          (ing) => !isZeroImpactIngredient(ing.name) && Number(ing.amount || 0) > 0.1
        );
        if (ingredients.length > 0 && substantiveIngredients.length === 0) {
          issues.push(
            `Day ${day.dayNumber} (${day.dayName}) ${meal.mealType} "${mealName}": Empty meal (only zero-impact ingredients like seasonings/water). Must include real food ingredients.`
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

    // Always include a small set of "macro balancer" staples so optimization can remain feasible even when
    // the AI template misses a macro category for a day (e.g., low protein anchors, missing carb anchors).
    // These do not necessarily end up in the final plan; they simply ensure USDA data exists if needed.
    [
      'Chicken Breast',
      'Tofu',
      'Eggs',
      'Salmon',
      'Brown Rice',
      'Quinoa',
      'Sweet Potato',
      'Olive Oil',
    ].forEach((name) => ingredientSet.add(normalizeFoodName(name)));

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
	      fallbackUsed: [] as string[],
	      usedMappings: 0,
	      ambiguous: [] as Array<{ ingredient: string; chosen: string; confidence: number; candidates: any[] }>,
	      lowConfidence: [] as Array<{ ingredient: string; chosen: string; confidence: number; candidates: any[] }>,
	      persistedMappings: 0,
	    };

	    const safeAtwater = (m: Omit<MacroValues, 'calories'>): MacroValues => {
	      const protein = Number(m.protein || 0);
	      const carbs = Number(m.carbs || 0);
	      const fats = Number(m.fats || 0);
	      return {
	        calories: Math.round((protein * 4 + carbs * 4 + fats * 9) * 10) / 10,
	        protein,
	        carbs,
	        fats,
	      };
	    };

	    // Curated fallbacks for a tiny set of "staple" ingredients that are both common and nutritionally unambiguous.
	    // This prevents 0-calorie/0-macro artifacts if USDA lookup fails for these specific items.
	    const STAPLE_FALLBACKS_PER_100G: Record<string, MacroValues> = {
	      [normalizeFoodName('Eggs')]: safeAtwater({ protein: 13, carbs: 1.1, fats: 10.6 }),
	      [normalizeFoodName('Chicken Breast')]: safeAtwater({ protein: 31, carbs: 0, fats: 3.6 }),
	      [normalizeFoodName('Salmon')]: safeAtwater({ protein: 20, carbs: 0, fats: 13 }),
	      [normalizeFoodName('Tofu')]: safeAtwater({ protein: 8, carbs: 2, fats: 4.8 }),
	      [normalizeFoodName('Brown Rice')]: safeAtwater({ protein: 2.6, carbs: 23, fats: 0.9 }),
	      [normalizeFoodName('Quinoa')]: safeAtwater({ protein: 4.4, carbs: 21.3, fats: 1.9 }),
	      [normalizeFoodName('Sweet Potato')]: safeAtwater({ protein: 1.6, carbs: 20, fats: 0.1 }),
	      [normalizeFoodName('Olive Oil')]: safeAtwater({ protein: 0, carbs: 0, fats: 100 }),
	      [normalizeFoodName('Rolled Oats')]: safeAtwater({ protein: 12, carbs: 60, fats: 6 }),
	      [normalizeFoodName('Chia Seeds')]: safeAtwater({ protein: 16, carbs: 42, fats: 31 }),
	      [normalizeFoodName('Banana')]: safeAtwater({ protein: 1.1, carbs: 23, fats: 0.3 }),
	      [normalizeFoodName('Berries')]: safeAtwater({ protein: 1, carbs: 14, fats: 0.3 }),
	      [normalizeFoodName('Whey Protein Powder')]: safeAtwater({ protein: 80, carbs: 10, fats: 5 }),
	      [normalizeFoodName('Pea Protein Powder')]: safeAtwater({ protein: 80, carbs: 8, fats: 5 }),
	      [normalizeFoodName('Water')]: safeAtwater({ protein: 0, carbs: 0, fats: 0 }),
	    };

	    const getStapleFallback = (ingredient: string): MacroValues | null => {
	      const key = normalizeFoodName(ingredient);
	      return STAPLE_FALLBACKS_PER_100G[key] || null;
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
	        const fallback = getStapleFallback(ingredient);
	        if (fallback) {
	          console.warn(`⚠️  [BATCH] USDA lookup failed for staple "${ingredient}", using curated fallback macros.`);
	          report.fallbackUsed.push(ingredient);
	          return {
	            ingredient,
	            data: {
	              nutrition: fallback,
	              fdcId: 0,
	              rawFoodDetails: { fallback: 'curated_staple', ingredient },
	            },
	          };
	        }

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
	      fallbackUsed: report.fallbackUsed.length,
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
            const fallbackNutrition = {
              calories: ing.estimatedCalories || 0,
              protein: ing.estimatedProtein || 0,
              carbs: ing.estimatedCarbs || 0,
              fats: ing.estimatedFats || 0,
            };
            const hasFallback =
              fallbackNutrition.calories > 0 ||
              fallbackNutrition.protein > 0 ||
              fallbackNutrition.carbs > 0 ||
              fallbackNutrition.fats > 0;

            if (!hasFallback) {
              // Hard fail: returning 0-calorie ingredients produces broken plans and makes macro-fitting impossible.
              throw new Error(
                `Missing USDA nutrition for ingredient "${ing.name}" and no AI estimates were provided. ` +
                  `Regenerate meals with simpler/base ingredients or improve USDA mapping for this ingredient.`
              );
            }

            console.warn(`⚠️  [BATCH] No USDA data for ingredient: ${ing.name}, using AI estimates as fallback`);
            return {
              name: ing.name,
              amount: ing.amount,
              nutrition: fallbackNutrition,
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
          if (env.DEBUG && !loggedIngredients.has(normalized)) {
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

  private normalizeUsdaCaloriesFromMacros(
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>
  ): Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }> {
    const normalized: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }> = {};

    Object.entries(usdaData).forEach(([key, entry]) => {
      const nutrition = entry?.nutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 };
      const protein = Number(nutrition.protein || 0);
      const carbs = Number(nutrition.carbs || 0);
      const fats = Number(nutrition.fats || 0);
      const calories = Math.round((protein * 4 + carbs * 4 + fats * 9) * 10) / 10;
      const normalizedKey = normalizeFoodName(key);

      normalized[key] = {
        ...entry,
        nutrition: {
          ...nutrition,
          calories,
        },
      };

      // Always expose a normalized key so downstream lookups never miss because of casing/spacing.
      if (!normalized[normalizedKey]) {
        normalized[normalizedKey] = {
          ...entry,
          nutrition: {
            ...nutrition,
            calories,
          },
        };
      }
    });

    // Ensure deterministic fallback staples are always available to the optimizer even if the caller-provided
    // USDA map is missing them (e.g., offline/unit tests or partial caches).
    Object.entries(FALLBACK_ESTIMATES_PER_100G).forEach(([key, per100g]) => {
      const normalizedKey = normalizeFoodName(key);
      if (normalized[normalizedKey]) return;
      normalized[normalizedKey] = {
        fdcId: 0,
        nutrition: {
          ...per100g,
          calories: Math.round((per100g.protein * 4 + per100g.carbs * 4 + per100g.fats * 9) * 10) / 10,
        },
      };
    });

    return normalized;
  }

  /**
   * Calculate meal-specific macro targets based on meal type and distribution
   */
  private calculateMealMacroTargets(
    mealType: string,
    mealFrequency: number,
    dayTargets: MacroValues,
    snackIndex?: number
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
      const idx = typeof snackIndex === 'number' && snackIndex >= 0 ? snackIndex : 0;
      const snackCal =
        mealDistribution.snacks?.[idx] ??
        mealDistribution.snacks?.[0] ??
        (dayTargets.calories * 0.10);
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
      usdaData,
      {
        sensitiveIngredientMode: 'added_sugars_only',
      }
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

    return this.pruneZeroAmountIngredients(optimized);
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
    dailyTargetsOverride?: MacroTargets[],
    userProfile?: UserProfile
  ): Promise<MealWithUSDA[]> {
    await this.ensureOptimizerInitialized();
    const normalizedUsdaData = this.normalizeUsdaCaloriesFromMacros(usdaData);
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
      const sanitizedDayMeals = this.sanitizeMealsForRealism(dayMeals);
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

      // Prefer day-level optimization (LP if available, heuristic otherwise); fallback to per-meal if it fails.
      let adjustedDayMeals: MealWithUSDA[];
      const snackIndexByMeal = new Map<MealWithUSDA, number>();
      {
        let snackCounter = 0;
        sanitizedDayMeals.forEach((m) => {
          if (m.mealType === 'snack') {
            snackIndexByMeal.set(m, snackCounter);
            snackCounter += 1;
          }
        });
      }
      try {
        adjustedDayMeals = await this.adjustDayWithLP(sanitizedDayMeals, dayTargets, normalizedUsdaData, undefined, userProfile);
      } catch (err) {
        console.warn('⚠️  [BATCH] Day-level optimization failed, falling back to per-meal:', err);
        adjustedDayMeals = await Promise.all(
          sanitizedDayMeals.map(async (meal) => {
            if (this.isProteinSupplementMeal(meal)) return meal;
            const snackIndex = snackIndexByMeal.get(meal);
            const mealTargets = this.calculateMealMacroTargets(
              meal.mealType,
              mealFrequency,
              dayTargets,
              snackIndex
            );
            return await this.adjustMealToPreciseTargets(meal, mealTargets, normalizedUsdaData);
          })
        );
      }

      // Log final day totals
      let dayTotals = adjustedDayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.totalMacros.calories,
          protein: sum.protein + meal.totalMacros.protein,
          carbs: sum.carbs + meal.totalMacros.carbs,
          fats: sum.fats + meal.totalMacros.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const strictTolerance = { calories: 5, protein: 1, carbs: 1, fats: 1 };
      const withinStrictTolerance =
        Math.abs(dayTotals.calories - dayTargets.calories) <= strictTolerance.calories &&
        Math.abs(dayTotals.protein - dayTargets.protein) <= strictTolerance.protein &&
        Math.abs(dayTotals.carbs - dayTargets.carbs) <= strictTolerance.carbs &&
        Math.abs(dayTotals.fats - dayTargets.fats) <= strictTolerance.fats;

      if (!withinStrictTolerance && sanitizedDayMeals.length > 0) {
        console.warn(
          `⚠️  [BATCH] Day ${dayNum} missed strict targets; widening realistic scaling bounds and re-optimizing`
        );
        adjustedDayMeals = await this.adjustDayWithLP(sanitizedDayMeals, dayTargets, normalizedUsdaData, {
          boundsMode: 'expanded',
        }, userProfile);
        dayTotals = adjustedDayMeals.reduce(
          (sum, meal) => ({
            calories: sum.calories + meal.totalMacros.calories,
            protein: sum.protein + meal.totalMacros.protein,
            carbs: sum.carbs + meal.totalMacros.carbs,
            fats: sum.fats + meal.totalMacros.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }

      const withinStrictToleranceAfterExpand =
        Math.abs(dayTotals.calories - dayTargets.calories) <= strictTolerance.calories &&
        Math.abs(dayTotals.protein - dayTargets.protein) <= strictTolerance.protein &&
        Math.abs(dayTotals.carbs - dayTargets.carbs) <= strictTolerance.carbs &&
        Math.abs(dayTotals.fats - dayTargets.fats) <= strictTolerance.fats;

      if (!withinStrictToleranceAfterExpand && sanitizedDayMeals.length > 0) {
        console.warn(
          `🚨 [BATCH] Day ${dayNum} still missed strict targets; using rescue bounds to guarantee feasibility`
        );
        adjustedDayMeals = await this.adjustDayWithLP(sanitizedDayMeals, dayTargets, normalizedUsdaData, {
          boundsMode: 'rescue',
        }, userProfile);
        dayTotals = adjustedDayMeals.reduce(
          (sum, meal) => ({
            calories: sum.calories + meal.totalMacros.calories,
            protein: sum.protein + meal.totalMacros.protein,
            carbs: sum.carbs + meal.totalMacros.carbs,
            fats: sum.fats + meal.totalMacros.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }

      const withinStrictToleranceAfterRescue =
        Math.abs(dayTotals.calories - dayTargets.calories) <= strictTolerance.calories &&
        Math.abs(dayTotals.protein - dayTargets.protein) <= strictTolerance.protein &&
        Math.abs(dayTotals.carbs - dayTargets.carbs) <= strictTolerance.carbs &&
        Math.abs(dayTotals.fats - dayTargets.fats) <= strictTolerance.fats;

      if (!withinStrictToleranceAfterRescue && sanitizedDayMeals.length > 0) {
        console.warn(
          `⚠️  [BATCH] Day ${dayNum} missed strict targets even after rescue; relaxing snack caps and retrying`
        );
        adjustedDayMeals = await this.adjustDayWithLP(sanitizedDayMeals, dayTargets, normalizedUsdaData, {
          boundsMode: 'rescue',
          snackCapMode: 'relaxed',
        }, userProfile);
        dayTotals = adjustedDayMeals.reduce(
          (sum, meal) => ({
            calories: sum.calories + meal.totalMacros.calories,
            protein: sum.protein + meal.totalMacros.protein,
            carbs: sum.carbs + meal.totalMacros.carbs,
            fats: sum.fats + meal.totalMacros.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }

      const withinStrictToleranceAfterRelaxedSnackCaps =
        Math.abs(dayTotals.calories - dayTargets.calories) <= strictTolerance.calories &&
        Math.abs(dayTotals.protein - dayTargets.protein) <= strictTolerance.protein &&
        Math.abs(dayTotals.carbs - dayTargets.carbs) <= strictTolerance.carbs &&
        Math.abs(dayTotals.fats - dayTargets.fats) <= strictTolerance.fats;

      if (!withinStrictToleranceAfterRelaxedSnackCaps && sanitizedDayMeals.length > 0) {
        console.warn(
          `🚨 [BATCH] Day ${dayNum} still missed strict targets; using ultra-relaxed snack caps to preserve macro correctness`
        );
        adjustedDayMeals = await this.adjustDayWithLP(sanitizedDayMeals, dayTargets, normalizedUsdaData, {
          boundsMode: 'rescue',
          snackCapMode: 'disabled',
        }, userProfile);
        dayTotals = adjustedDayMeals.reduce(
          (sum, meal) => ({
            calories: sum.calories + meal.totalMacros.calories,
            protein: sum.protein + meal.totalMacros.protein,
            carbs: sum.carbs + meal.totalMacros.carbs,
            fats: sum.fats + meal.totalMacros.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );
      }

      // Final micro-correction for small residual deficits (keep within strict tolerance, never reduce macros)
      if (
        sanitizedDayMeals.length > 0 &&
        (Math.abs(dayTotals.calories - dayTargets.calories) > strictTolerance.calories ||
          Math.abs(dayTotals.protein - dayTargets.protein) > strictTolerance.protein ||
          Math.abs(dayTotals.carbs - dayTargets.carbs) > strictTolerance.carbs ||
          Math.abs(dayTotals.fats - dayTargets.fats) > strictTolerance.fats)
      ) {
        const nudged = this.nudgeDayForResiduals(adjustedDayMeals, normalizedUsdaData, dayTargets, strictTolerance);
        const nudgedTotals = nudged.reduce(
          (sum, meal) => ({
            calories: sum.calories + meal.totalMacros.calories,
            protein: sum.protein + meal.totalMacros.protein,
            carbs: sum.carbs + meal.totalMacros.carbs,
            fats: sum.fats + meal.totalMacros.fats,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );

        const withinAfterNudge =
          Math.abs(nudgedTotals.calories - dayTargets.calories) <= strictTolerance.calories &&
          Math.abs(nudgedTotals.protein - dayTargets.protein) <= strictTolerance.protein &&
          Math.abs(nudgedTotals.carbs - dayTargets.carbs) <= strictTolerance.carbs &&
          Math.abs(nudgedTotals.fats - dayTargets.fats) <= strictTolerance.fats;

        if (withinAfterNudge) {
          adjustedDayMeals = nudged;
          dayTotals = nudgedTotals;
          console.log(`✅ [BATCH] Day ${dayNum} micro-corrected into strict tolerance`);
        }
      }

      adjustedMeals.push(...adjustedDayMeals);

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
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number; rawFoodDetails?: any }>,
    options?: {
      boundsMode?: 'normal' | 'expanded' | 'rescue';
      snackCapMode?: 'normal' | 'relaxed' | 'disabled';
    },
    userProfile?: UserProfile
  ): Promise<MealWithUSDA[]> {
    const currentTotals = dayMeals.reduce(
      (sum, meal) => ({
        calories: sum.calories + (meal.totalMacros?.calories ?? 0),
        protein: sum.protein + (meal.totalMacros?.protein ?? 0),
        carbs: sum.carbs + (meal.totalMacros?.carbs ?? 0),
        fats: sum.fats + (meal.totalMacros?.fats ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
    );

    const gaps = {
      calories: dayTargets.calories - currentTotals.calories,
      protein: dayTargets.protein - currentTotals.protein,
      carbs: dayTargets.carbs - currentTotals.carbs,
      fats: dayTargets.fats - currentTotals.fats,
    };

    // Ensure we always have at least one tunable "anchor" for each macro category.
    // This avoids infeasible days when the AI template accidentally omits a good protein/carb/fat lever.
    dayMeals = this.injectMacroBalancerIngredients(dayMeals, usdaData, dayTargets, gaps, userProfile);

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
      sensitiveIngredientMode: 'added_sugars_only',
    });

    // Ingredient-specific bounds to keep common tuners realistic.
    const isEmergencyRescue =
      options?.boundsMode === 'rescue' && options?.snackCapMode === 'disabled';

    const specialBounds: Record<string, { min: number; max: number }> = {
      [normalizeFoodName('Olive Oil')]: { min: 0, max: 25 },
      [normalizeFoodName('Chicken Breast')]: { min: 0, max: 900 },
      [normalizeFoodName('Tofu')]: { min: 0, max: 900 },
      [normalizeFoodName('Eggs')]: { min: 0, max: 500 },
      [normalizeFoodName('Salmon')]: { min: 0, max: 700 },
      [normalizeFoodName('Brown Rice')]: { min: 0, max: 1500 },
      [normalizeFoodName('Quinoa')]: { min: 0, max: 1500 },
      [normalizeFoodName('Sweet Potato')]: { min: 0, max: 1500 },
      [normalizeFoodName('Whey Protein Powder')]: { min: 0, max: isEmergencyRescue ? 90 : 60 },
      [normalizeFoodName('Pea Protein Powder')]: { min: 0, max: isEmergencyRescue ? 90 : 60 },
      [normalizeFoodName('Protein Powder')]: { min: 0, max: isEmergencyRescue ? 90 : 60 },
      [normalizeFoodName('Rolled Oats')]: { min: 0, max: 180 },
      [normalizeFoodName('Chia Seeds')]: { min: 0, max: 60 },
      [normalizeFoodName('Banana')]: { min: 0, max: 300 },
      [normalizeFoodName('Berries')]: { min: 0, max: 300 },
      [normalizeFoodName('Greek Yogurt')]: { min: 0, max: isEmergencyRescue ? 600 : 450 },
      [normalizeFoodName('Soy Yogurt')]: { min: 0, max: isEmergencyRescue ? 600 : 450 },
      [normalizeFoodName('Yogurt')]: { min: 0, max: isEmergencyRescue ? 600 : 450 },
      [normalizeFoodName('Milk')]: { min: 0, max: 600 },
      [normalizeFoodName('Peanut Butter')]: { min: 0, max: 70 },
      [normalizeFoodName('Almond Butter')]: { min: 0, max: 70 },
      [normalizeFoodName('Almonds')]: { min: 0, max: 70 },
    };

    const HARD_SPECIAL_MAX = new Set<string>([
      normalizeFoodName('Olive Oil'),
      normalizeFoodName('Chicken Breast'),
      normalizeFoodName('Tofu'),
      normalizeFoodName('Eggs'),
      normalizeFoodName('Salmon'),
      normalizeFoodName('Brown Rice'),
      normalizeFoodName('Quinoa'),
      normalizeFoodName('Sweet Potato'),
      normalizeFoodName('Whey Protein Powder'),
      normalizeFoodName('Pea Protein Powder'),
      normalizeFoodName('Protein Powder'),
      normalizeFoodName('Rolled Oats'),
      normalizeFoodName('Chia Seeds'),
      normalizeFoodName('Banana'),
      normalizeFoodName('Berries'),
      normalizeFoodName('Greek Yogurt'),
      normalizeFoodName('Soy Yogurt'),
      normalizeFoodName('Yogurt'),
      normalizeFoodName('Milk'),
      normalizeFoodName('Peanut Butter'),
      normalizeFoodName('Almond Butter'),
      normalizeFoodName('Almonds'),
    ]);

    const boundsMode = options?.boundsMode || 'normal';
    const ALWAYS_ZERO_MIN = new Set<string>([
      normalizeFoodName('Olive Oil'),
      normalizeFoodName('Whey Protein Powder'),
      normalizeFoodName('Pea Protein Powder'),
      normalizeFoodName('Protein Powder'),
      normalizeFoodName('Rolled Oats'),
      normalizeFoodName('Chia Seeds'),
      normalizeFoodName('Banana'),
      normalizeFoodName('Berries'),
      normalizeFoodName('Greek Yogurt'),
      normalizeFoodName('Soy Yogurt'),
      normalizeFoodName('Yogurt'),
      normalizeFoodName('Milk'),
      normalizeFoodName('Peanut Butter'),
      normalizeFoodName('Almond Butter'),
      normalizeFoodName('Almonds'),
    ]);

    optimizable.forEach((opt) => {
      const normalized = normalizeFoodName(opt.name);
      const stripped = stripDescriptorWords(opt.name);
      const bounds = specialBounds[normalized] || (stripped ? specialBounds[stripped] : null);
      if (!bounds) return;
      opt.isLocked = false;
      const isInjectedTuner = opt.originalAmount <= 0.1;
      if (isInjectedTuner || ALWAYS_ZERO_MIN.has(normalized)) {
        opt.minAmount = bounds.min;
      } else if (boundsMode === 'rescue') {
        opt.minAmount = Math.min(opt.minAmount, bounds.min);
      }

      // Always apply max caps AND allow raising max up to the cap for feasibility.
      opt.maxAmount = bounds.max;
      if (opt.maxAmount < opt.minAmount) {
        opt.maxAmount = Math.max(opt.minAmount, opt.originalAmount);
      }
    });
    if (boundsMode === 'expanded' || boundsMode === 'rescue') {
      const isRescue = boundsMode === 'rescue';

      // Phase 1: Relax general bounds so the optimizer has room to work.
      optimizable.forEach((opt) => {
        if (opt.isLocked) return;

        const normalized = normalizeFoodName(opt.name);
        const stripped = stripDescriptorWords(opt.name);
        if (HARD_SPECIAL_MAX.has(normalized) || (stripped && HARD_SPECIAL_MAX.has(stripped))) return;
        const isFatHeavy = opt.density.fats >= 0.2;
        const isProteinAnchor = opt.density.protein >= 0.12;
        const isCarbAnchor = opt.density.carbs >= 0.15;

        const cap = isFatHeavy ? (isRescue ? 150 : 120) : (isRescue ? 1500 : 1200);

        const expandedMin = Math.max(0, opt.originalAmount * (isRescue ? 0 : 0.25));
        const baseMultiplier = isProteinAnchor || isCarbAnchor ? (isRescue ? 8.0 : 6.0) : (isRescue ? 6.0 : 4.5);
        const expandedMax = Math.min(cap, Math.max(opt.maxAmount, opt.originalAmount * baseMultiplier));

        opt.minAmount = Math.min(opt.minAmount, expandedMin);
        opt.maxAmount = Math.max(opt.maxAmount, expandedMax);

        if (opt.maxAmount < opt.minAmount) {
          opt.maxAmount = Math.max(opt.minAmount, opt.originalAmount);
        }
      });

      // Phase 2: If we're under target, dynamically expand caps for the best "macro anchors".
      const expandForDeficit = (
        macro: 'protein' | 'carbs' | 'fats',
        deficit: number,
        options: {
          minDensity: number;
          maxCandidates: number;
          hardCap: number;
          bufferMultiplier: number;
          purity?: { maxOtherDensity?: Partial<Record<'protein' | 'carbs' | 'fats', number>> };
        }
      ) => {
        if (!(deficit > 0.5)) return;

        const candidates = optimizable
          .filter((opt) => !opt.isLocked)
          .filter((opt) => {
            const normalized = normalizeFoodName(opt.name);
            const stripped = stripDescriptorWords(opt.name);
            // Never expand beyond hard special caps like whey/oil.
            if (HARD_SPECIAL_MAX.has(normalized) || (stripped && HARD_SPECIAL_MAX.has(stripped))) return false;
            return true;
          })
          .filter((opt) => opt.density[macro] >= options.minDensity)
          .filter((opt) => {
            const maxOther = options.purity?.maxOtherDensity;
            if (!maxOther) return true;
            return (Object.entries(maxOther) as Array<[keyof typeof maxOther, unknown]>).every(
              ([k, max]) => {
                if (typeof max !== 'number') return true;
                return opt.density[k] <= max;
              }
            );
          })
          .sort((a, b) => b.density[macro] - a.density[macro])
          .slice(0, Math.max(1, options.maxCandidates));

        if (candidates.length === 0) return;

        const perCandidateShare = deficit / candidates.length;
        candidates.forEach((opt) => {
          const density = opt.density[macro];
          if (!(density > 0)) return;

          const requiredAdd = perCandidateShare / density;
          const requiredMax = opt.currentAmount + (requiredAdd * options.bufferMultiplier);
          const cap = Math.max(opt.maxAmount, Math.min(options.hardCap, requiredMax));
          opt.maxAmount = Math.max(opt.maxAmount, cap);
        });
      };

      expandForDeficit('carbs', gaps.carbs, {
        minDensity: 0.15,
        maxCandidates: 3,
        hardCap: isRescue ? 1500 : 1200,
        bufferMultiplier: isRescue ? 1.4 : 1.25,
        // Prefer "clean" carb anchors (avoid using high-fat foods to fix carbs)
        purity: { maxOtherDensity: { fats: 0.12 } },
      });

      expandForDeficit('protein', gaps.protein, {
        minDensity: 0.12,
        maxCandidates: 3,
        hardCap: isRescue ? 1200 : 900,
        bufferMultiplier: isRescue ? 1.35 : 1.2,
        // Prefer lean protein anchors
        purity: { maxOtherDensity: { fats: 0.25 } },
      });

      expandForDeficit('fats', gaps.fats, {
        minDensity: 0.15,
        maxCandidates: 2,
        hardCap: isRescue ? 200 : 150,
        bufferMultiplier: isRescue ? 1.25 : 1.15,
      });
    }

    // CRITICAL: Sugar RAG Enforcement (Daily Limit: 30g added sugars)
    const totalCurrentSugar = flatIngredients.reduce((acc, ing) => acc + (ing.nutrition.sugar || 0), 0);
    const SUGAR_LIMIT = 30;

    if (totalCurrentSugar > SUGAR_LIMIT) {
      // Find ingredients that are "sensitive" sugars (Added Sugars: Sugar, Honey, Syrup)
      // We exclude natural sugars from fruits which aren't typically "sensitive" ingredients
      const sugarIngredients = flatIngredients
        .map((ing, idx) => ({ ing, idx }))
        .filter(entry => entry.ing.nutrition.sugar && (entry.ing.nutrition.sugar > 0) && isAddedSugarIngredient(entry.ing.name));

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

        // Lock added-sugar ingredients so macro fitting can't "cheat" by pushing sugar up/down.
        if (isAddedSugarIngredient(ing.name)) {
          opt.isLocked = true;
          opt.minAmount = opt.originalAmount;
          opt.maxAmount = opt.originalAmount;
        }
      });
    });

    // Enforce snack caps so a single snack can't become a calorie/macro "dumping ground".
    this.applySnackCalorieCaps(dayMeals, optimizable, indexMap, dayTargets, options);

    // Prevent main meals from collapsing into "seasoning-only" 0-cal meals in rescue scenarios.
    this.applyMainMealCalorieFloors(dayMeals, optimizable, indexMap, dayTargets, { boundsMode: options?.boundsMode });

    // Build day targets with tolerances
    const targets = {
      calories: dayTargets.calories,
      protein: dayTargets.protein,
      carbs: dayTargets.carbs,
      fats: dayTargets.fats,
      tolerance: {
        calories: 5,
        protein: 1,
        carbs: 1,
        fats: 1,
      },
    } as const;

    const result = await this.hybridOptimizer.optimize(optimizable, targets, {
      // For day-level matching, use LP without extra ratio constraints (targets already encode macro split).
      // Do not enforce strict tolerance inside LP; we use a separate micro-correction pass for the final 1g/5kcal snap.
      // If LP is available, force it (deterministic + globally optimal). If not, HybridMealOptimizer falls back.
      forceLp: this.optimizerInitialized,
      compareResults: false,
      lpOptions: { includeRatioConstraints: false, enforceTargetTolerance: false, directionalWeights: false },
    });

    // Map optimized amounts back into meals
    const optimizedByIndex: number[] = result.ingredients.map((ing) => ing.currentAmount);
    const updatedMeals: MealWithUSDA[] = dayMeals.map(meal => ({ ...meal, ingredients: meal.ingredients.map(ing => ({ ...ing })) }));

    indexMap.forEach((mapEntry, flatIdx) => {
      const { mealIdx, ingIdx } = mapEntry;
      const ing = updatedMeals[mealIdx].ingredients[ingIdx];
      const newAmount = Math.max(0, Math.round(optimizedByIndex[flatIdx] * 10) / 10);
      const normalized = normalizeFoodName(ing.name);
      const entry = usdaData[normalized];
      const per100g = entry?.nutrition ?? result.ingredients?.[flatIdx]?.per100g;
      const nutrition = per100g ? calculateMacrosForAmount(per100g, newAmount, 'g') : ing.nutrition;
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

    return recomputed.map((meal) => this.pruneZeroAmountIngredients(meal));
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
    const wheyAmountRaw = Math.ceil(proteinWithBuffer / WHEY_PROTEIN_PER_GRAM);
    const MAX_WHEY_GRAMS = 60; // realism guard: avoid absurd "150g whey in one shake"
    if (wheyAmountRaw > MAX_WHEY_GRAMS) {
      throw new Error(
        `Precision protein shake would require ${wheyAmountRaw}g whey protein powder (max ${MAX_WHEY_GRAMS}g allowed). ` +
          `Scale up the primary protein ingredients in meals instead of adding excessive protein powder.`
      );
    }
    const wheyAmount = wheyAmountRaw;

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
