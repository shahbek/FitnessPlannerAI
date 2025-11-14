/**
 * Hybrid Meal Optimizer
 *
 * Combines multiple optimization strategies with intelligent fallback:
 *
 * Strategy Selection:
 * 1. Try Linear Programming (LP) first - mathematically optimal
 * 2. If LP fails or unavailable, use Protein-Priority Heuristic
 * 3. Compare results and pick best
 *
 * This ensures we ALWAYS get the best possible result regardless of
 * data quality, ingredient constraints, or solver availability.
 */

import { MacroValues } from '../../types/nutrition';
import { normalizeFoodName, calculateMacrosForAmount } from '../../utils/usdaMapper';
import { ProteinPriorityOptimizer, OptimizableIngredient, OptimizationResult, OptimizationTargets } from './ProteinPriorityOptimizer';
import { LinearProgrammingOptimizer } from './LinearProgrammingOptimizer';
import { isZeroImpactIngredient } from '../../constants/ingredients';

export interface HybridOptimizationResult extends OptimizationResult {
  method: 'lp' | 'protein-priority' | 'hybrid';
  lpAttempted: boolean;
  lpSucceeded: boolean;
}

export class HybridMealOptimizer {
  private lpOptimizer: LinearProgrammingOptimizer;
  private heuristicOptimizer: ProteinPriorityOptimizer;
  private lpInitialized: boolean = false;

  constructor() {
    this.lpOptimizer = new LinearProgrammingOptimizer();
    this.heuristicOptimizer = new ProteinPriorityOptimizer();
  }

  /**
   * Initialize LP optimizer (async)
   * Safe to call multiple times
   */
  async initialize(): Promise<void> {
    if (this.lpInitialized) return;

    try {
      await this.lpOptimizer.initialize();
      this.lpInitialized = true;
      console.log('✅ [HYBRID] LP optimizer initialized');
    } catch (error) {
      console.warn('⚠️ [HYBRID] LP optimizer initialization failed, will use heuristic only:', error);
      this.lpInitialized = false;
    }
  }

  /**
   * Optimize meal ingredients using hybrid approach
   *
   * Strategy:
   * 1. Try LP first (best results)
   * 2. Try Protein-Priority heuristic
   * 3. Compare and pick best result
   * 4. If both fail, return original
   */
  async optimize(
    ingredients: OptimizableIngredient[],
    targets: OptimizationTargets,
    options?: {
      forceLp?: boolean; // Force LP only (fail if not available)
      forceHeuristic?: boolean; // Force heuristic only
      compareResults?: boolean; // Try both and compare (slower but best quality)
    }
  ): Promise<HybridOptimizationResult> {
    const log: string[] = [];
    log.push('🔄 Starting Hybrid Optimization');

    // Validate inputs
    if (ingredients.length === 0) {
      throw new Error('No ingredients to optimize');
    }

    const adjustableCount = ingredients.filter(i => !i.isLocked).length;
    if (adjustableCount === 0) {
      log.push('⚠️ No adjustable ingredients, returning original');
      return {
        ingredients,
        totalMacros: this.calculateTotalMacros(ingredients),
        iterations: 0,
        converged: false,
        log,
        method: 'hybrid',
        lpAttempted: false,
        lpSucceeded: false,
      };
    }

    // Strategy 1: Try LP if available and not explicitly disabled
    let lpResult: OptimizationResult | null = null;
    let lpAttempted = false;
    let lpSucceeded = false;

    if (!options?.forceHeuristic && this.lpInitialized && this.lpOptimizer.isAvailable()) {
      lpAttempted = true;
      log.push('📊 Attempting Linear Programming optimization...');

      try {
        lpResult = await this.lpOptimizer.optimize(ingredients, targets, {
          proteinWeight: 2.0, // Protein is most important
          carbsWeight: 1.0,
          fatsWeight: 1.0,
          caloriesWeight: 0.5,
        });

        lpSucceeded = lpResult.converged;
        log.push(`✅ LP ${lpSucceeded ? 'succeeded' : 'completed but did not converge'}`);
        log.push(...lpResult.log.map(line => `  [LP] ${line}`));

        // If LP succeeded and we're not comparing, return immediately
        if (lpSucceeded && !options?.compareResults) {
          return {
            ...lpResult,
            method: 'lp',
            lpAttempted: true,
            lpSucceeded: true,
          };
        }
      } catch (error) {
        log.push(`⚠️ LP failed: ${error}`);
        lpResult = null;
        lpSucceeded = false;
      }
    }

    // Strategy 2: Try Protein-Priority heuristic (always run if comparing or LP failed)
    let heuristicResult: OptimizationResult | null = null;

    if (!options?.forceLp || !lpSucceeded) {
      log.push('📊 Attempting Protein-Priority heuristic optimization...');

      try {
        heuristicResult = this.heuristicOptimizer.optimize(ingredients, targets, {
          maxIterations: 150,
          stepSize: 5,
          proteinPriority: true,
        });

        log.push(`✅ Heuristic ${heuristicResult.converged ? 'converged' : 'completed'}`);
        log.push(...heuristicResult.log.map(line => `  [HEURISTIC] ${line}`));
      } catch (error) {
        log.push(`⚠️ Heuristic failed: ${error}`);
        heuristicResult = null;
      }
    }

    // Strategy 3: Compare results and pick best
    const results = [
      lpResult && { result: lpResult, name: 'LP' },
      heuristicResult && { result: heuristicResult, name: 'Heuristic' },
    ].filter(Boolean) as { result: OptimizationResult; name: string }[];

    if (results.length === 0) {
      log.push('❌ All optimization methods failed, returning original');
      return {
        ingredients,
        totalMacros: this.calculateTotalMacros(ingredients),
        iterations: 0,
        converged: false,
        log,
        method: 'hybrid',
        lpAttempted,
        lpSucceeded: false,
      };
    }

    // Score each result
    const scored = results.map(({ result, name }) => {
      const score = this.scoreResult(result.totalMacros, targets);
      return { result, name, score };
    });

    // Sort by score (lower = better)
    scored.sort((a, b) => a.score - b.score);

    const best = scored[0];
    log.push(`\n🏆 Winner: ${best.name} (score: ${best.score.toFixed(4)})`);

    if (scored.length > 1) {
      log.push('📊 Comparison:');
      scored.forEach(({ name, score }) => {
        log.push(`  ${name}: ${score.toFixed(4)}`);
      });
    }

    return {
      ...best.result,
      log,
      method: best.name === 'LP' ? 'lp' : 'protein-priority',
      lpAttempted,
      lpSucceeded,
    };
  }

  /**
   * Score optimization result (lower = better)
   * Based on weighted distance from targets
   */
  private scoreResult(actual: MacroValues, targets: OptimizationTargets): number {
    const proteinError = Math.abs(actual.protein - targets.protein) / targets.protein;
    const carbsError = Math.abs(actual.carbs - targets.carbs) / targets.carbs;
    const fatsError = Math.abs(actual.fats - targets.fats) / targets.fats;
    const caloriesError = Math.abs(actual.calories - targets.calories) / targets.calories;

    // Weighted sum (protein 2x important)
    return 2 * proteinError + carbsError + fatsError + 0.5 * caloriesError;
  }

  /**
   * Calculate total macros for ingredients
   */
  private calculateTotalMacros(ingredients: OptimizableIngredient[]): MacroValues {
    return ingredients.reduce((sum, ing) => {
      const macros = calculateMacrosForAmount(ing.per100g, ing.currentAmount, 'g');
      return {
        protein: sum.protein + macros.protein,
        carbs: sum.carbs + macros.carbs,
        fats: sum.fats + macros.fats,
        calories: sum.calories + macros.calories,
      };
    }, { protein: 0, carbs: 0, fats: 0, calories: 0 });
  }

  /**
   * Helper: Convert meal ingredients to optimizable format
   */
  static prepareIngredients(
    mealIngredients: Array<{
      name: string;
      amount: number;
      nutrition: MacroValues;
      fdcId: number;
    }>,
    usdaData: Record<string, { nutrition: MacroValues; fdcId: number }>,
    options?: {
      seasoningThreshold?: number; // Amount in grams below which ingredient is considered seasoning
      seasoningKeywords?: string[]; // Keywords to identify seasonings
    }
  ): OptimizableIngredient[] {
    const seasoningThreshold = options?.seasoningThreshold ?? 5; // 5g or less
    const seasoningKeywords = options?.seasoningKeywords ?? [
      'salt', 'pepper', 'garlic powder', 'herb', 'spice', 'seasoning',
      'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary',
      'cilantro', 'parsley', 'cinnamon', 'nutmeg', 'vanilla', 'extract',
    ];

    return mealIngredients.map((ing, index) => {
      const normalized = normalizeFoodName(ing.name);
      const usdaEntry = usdaData[normalized];
      const zeroImpact = isZeroImpactIngredient(ing.name);

      // Determine if ingredient should be locked (seasoning)
      const isSmallAmount = ing.amount <= seasoningThreshold;
      const isSeasoningKeyword = seasoningKeywords.some(keyword =>
        ing.name.toLowerCase().includes(keyword)
      );
      const isLocked = zeroImpact || isSmallAmount || isSeasoningKeyword || !usdaEntry;

      // Get per-100g nutrition
      const per100g = zeroImpact
        ? { calories: 0, protein: 0, carbs: 0, fats: 0 }
        : usdaEntry?.nutrition ?? ing.nutrition;

      // Calculate density (per 1g)
      const density = {
        protein: per100g.protein / 100,
        carbs: per100g.carbs / 100,
        fats: per100g.fats / 100,
        calories: per100g.calories / 100,
      };

      // Set bounds (0.25x to 4x for adjustable, fixed for locked)
      let minAmount = isLocked ? ing.amount : Math.max(1, ing.amount * 0.25);
      let maxAmount = isLocked ? ing.amount : Math.min(500, ing.amount * 4.0);

      if (!isLocked) {
        const isFatHeavy = density.fats >= 0.2; // ≥20g fat per 100g
        const isUltraFatHeavy = density.fats >= 0.3; // ≥30g fat per 100g
        const isProteinAnchor = density.protein >= 0.15; // ≥15g protein per 100g

        if (isFatHeavy) {
          const cap = isUltraFatHeavy ? ing.amount * 1.5 : ing.amount * 2;
          maxAmount = Math.min(maxAmount, Math.max(40, cap));
        }

        if (isProteinAnchor) {
          const protectedMin = Math.max(ing.amount * 0.6, minAmount);
          minAmount = Math.min(protectedMin, ing.amount);
        }

        if (maxAmount < minAmount) {
          maxAmount = Math.max(minAmount, ing.amount);
        }
      }

      return {
        index,
        name: ing.name,
        originalAmount: ing.amount,
        currentAmount: ing.amount,
        minAmount,
        maxAmount,
        isLocked,
        per100g,
        density,
        fdcId: ing.fdcId,
      };
    });
  }

  /**
   * Helper: Convert optimized ingredients back to meal format
   */
  static reconstructMeal(
    optimizedIngredients: OptimizableIngredient[],
    originalMeal: {
      mealName: string;
      mealType: string;
      instructions: string[];
      dayNumber: number;
      dayName: string;
    }
  ): {
    mealName: string;
    mealType: string;
    instructions: string[];
    ingredients: Array<{
      name: string;
      amount: number;
      nutrition: MacroValues;
      fdcId: number;
    }>;
    totalMacros: MacroValues;
    dayNumber: number;
    dayName: string;
  } {
    const ingredients = optimizedIngredients.map(ing => {
      const nutrition = calculateMacrosForAmount(ing.per100g, ing.currentAmount, 'g');
      return {
        name: ing.name,
        amount: ing.currentAmount,
        nutrition,
        fdcId: ing.fdcId,
      };
    });

    const totalMacros = ingredients.reduce(
      (sum, ing) => ({
        protein: sum.protein + ing.nutrition.protein,
        carbs: sum.carbs + ing.nutrition.carbs,
        fats: sum.fats + ing.nutrition.fats,
        calories: sum.calories + ing.nutrition.calories,
      }),
      { protein: 0, carbs: 0, fats: 0, calories: 0 }
    );

    return {
      ...originalMeal,
      ingredients,
      totalMacros,
    };
  }
}
