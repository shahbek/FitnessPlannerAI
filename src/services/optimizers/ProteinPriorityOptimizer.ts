/**
 * Protein-Priority Optimizer
 *
 * Strategy: Protein is the most critical macro, so we prioritize adjusting
 * high protein-density ingredients FIRST to meet protein targets.
 *
 * Algorithm:
 * 1. Sort ingredients by protein density (g protein / g ingredient)
 * 2. Adjust highest-density ingredients first to meet protein target
 * 3. Then adjust carb-dense and fat-dense ingredients for remaining macros
 * 4. Finally fine-tune calories if needed
 *
 * This mimics how nutritionists think: "Hit protein first, then fill in carbs/fats"
 */

import { MacroValues } from '../../types/nutrition';
import { normalizeFoodName, calculateMacrosForAmount } from '../../utils/usdaMapper';

export interface OptimizableIngredient {
  index: number;
  name: string;
  originalAmount: number;
  currentAmount: number;
  minAmount: number;
  maxAmount: number;
  isLocked: boolean; // Seasonings, etc.
  per100g: MacroValues;
  density: {
    protein: number; // g protein per 1g ingredient
    carbs: number;
    fats: number;
    calories: number;
  };
  fdcId: number;
}

export interface OptimizationResult {
  ingredients: OptimizableIngredient[];
  totalMacros: MacroValues;
  iterations: number;
  converged: boolean;
  log: string[];
}

export interface OptimizationTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  tolerance?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

/**
 * Protein-Priority Optimizer
 * Uses a smart heuristic: prioritize high-density protein sources first
 */
export class ProteinPriorityOptimizer {
  private readonly DEFAULT_TOLERANCE = {
    calories: 10, // ±10 cal
    protein: 2,   // ±2g
    carbs: 2,     // ±2g
    fats: 2,      // ±2g
  };

  /**
   * Optimize meal ingredients to hit macro targets
   * PROTEIN-FIRST STRATEGY
   */
  optimize(
    ingredients: OptimizableIngredient[],
    targets: OptimizationTargets,
    options?: {
      maxIterations?: number;
      stepSize?: number;
      proteinPriority?: boolean; // Default true
    }
  ): OptimizationResult {
    const maxIterations = options?.maxIterations ?? 150;
    const initialStepSize = options?.stepSize ?? 5; // grams
    const proteinPriority = options?.proteinPriority ?? true;
    const tolerance = targets.tolerance ?? this.DEFAULT_TOLERANCE;

    const log: string[] = [];
    const working = ingredients.map(ing => ({ ...ing }));

    log.push('🎯 Starting Protein-Priority Optimization');
    log.push(`Target: P=${targets.protein}g C=${targets.carbs}g F=${targets.fats}g Cal=${targets.calories}`);

    // Calculate initial macros
    let current = this.calculateTotalMacros(working);
    log.push(`Initial: P=${current.protein.toFixed(1)}g C=${current.carbs.toFixed(1)}g F=${current.fats.toFixed(1)}g Cal=${current.calories.toFixed(0)}`);

    // Phase 1: PROTEIN PRIORITY - Hit protein target first
    if (proteinPriority && Math.abs(current.protein - targets.protein) > tolerance.protein) {
      log.push('\n📊 PHASE 1: Protein Priority Adjustment');

      // Sort by protein density (highest first)
      const proteinSources = working
        .filter(ing => !ing.isLocked && ing.density.protein > 0.05) // > 5g protein per 100g
        .sort((a, b) => b.density.protein - a.density.protein);

      log.push(`Found ${proteinSources.length} protein sources (sorted by density):`);
      proteinSources.slice(0, 5).forEach((ing, i) => {
        log.push(`  ${i + 1}. ${ing.name}: ${(ing.density.protein * 100).toFixed(1)}g protein/100g`);
      });

      // Adjust top protein sources to hit target
      const proteinGap = targets.protein - current.protein;
      log.push(`Protein gap: ${proteinGap.toFixed(1)}g ${proteinGap > 0 ? '(need more)' : '(need less)'}`);

      let iterations = 0;
      while (
        Math.abs(current.protein - targets.protein) > tolerance.protein &&
        iterations < maxIterations / 2 // Use half iterations for protein
      ) {
        // Focus on top 3 protein sources
        const topSources = proteinSources.slice(0, 3);
        let bestMove: { ingredient: OptimizableIngredient; delta: number; score: number } | null = null;

        for (const ing of topSources) {
          // Try increasing/decreasing
          const gap = targets.protein - current.protein;
          const stepDirection = gap > 0 ? 1 : -1;
          const stepAmount = Math.min(initialStepSize, Math.abs(gap) / ing.density.protein);
          const delta = stepDirection * stepAmount;

          // Check bounds
          const newAmount = ing.currentAmount + delta;
          if (newAmount < ing.minAmount || newAmount > ing.maxAmount) continue;

          // Score = protein improvement / side-effect on other macros
          const proteinContribution = delta * ing.density.protein;
          const carbsSideEffect = Math.abs(delta * ing.density.carbs);
          const fatsSideEffect = Math.abs(delta * ing.density.fats);

          // Prefer moves that improve protein with minimal side effects
          const score = Math.abs(proteinContribution) / (1 + carbsSideEffect + fatsSideEffect);

          if (!bestMove || score > bestMove.score) {
            bestMove = { ingredient: ing, delta, score };
          }
        }

        if (!bestMove) {
          log.push('  No valid protein moves found, exiting phase 1');
          break;
        }

        // Apply best move
        bestMove.ingredient.currentAmount += bestMove.delta;
        current = this.calculateTotalMacros(working);
        iterations++;

        if (iterations % 10 === 0) {
          log.push(`  [${iterations}] Adjusted ${bestMove.ingredient.name} → ${bestMove.ingredient.currentAmount.toFixed(1)}g (P=${current.protein.toFixed(1)}g)`);
        }
      }

      log.push(`✅ Phase 1 complete: Protein at ${current.protein.toFixed(1)}g (target: ${targets.protein}g)`);
    }

    // Phase 2: BALANCE CARBS & FATS
    log.push('\n📊 PHASE 2: Carbs & Fats Balancing');

    let iterations = 0;
    let stepSize = initialStepSize;
    let stuckCount = 0;
    let lastScore = this.calculateScore(current, targets, tolerance);

    while (iterations < maxIterations) {
      // Check convergence
      if (this.hasConverged(current, targets, tolerance)) {
        log.push(`✅ Converged in ${iterations} iterations!`);
        return {
          ingredients: working,
          totalMacros: current,
          iterations,
          converged: true,
          log,
        };
      }

      // Calculate gaps
      const gaps = {
        protein: targets.protein - current.protein,
        carbs: targets.carbs - current.carbs,
        fats: targets.fats - current.fats,
        calories: targets.calories - current.calories,
      };

      // Find best move across all unlocked ingredients
      let bestMove: { ingredient: OptimizableIngredient; delta: number; score: number } | null = null;

      for (const ing of working.filter(i => !i.isLocked)) {
        // Try increasing/decreasing
        for (const direction of [1, -1]) {
          const delta = direction * stepSize;
          const newAmount = ing.currentAmount + delta;

          // Check bounds
          if (newAmount < ing.minAmount || newAmount > ing.maxAmount) continue;

          // Calculate macro changes
          const macroDeltas = {
            protein: delta * ing.density.protein,
            carbs: delta * ing.density.carbs,
            fats: delta * ing.density.fats,
            calories: delta * ing.density.calories,
          };

          // Calculate hypothetical new totals
          const hypothetical = {
            protein: current.protein + macroDeltas.protein,
            carbs: current.carbs + macroDeltas.carbs,
            fats: current.fats + macroDeltas.fats,
            calories: current.calories + macroDeltas.calories,
          };

          // Score the move
          const currentScore = this.calculateScore(current, targets, tolerance);
          const newScore = this.calculateScore(hypothetical, targets, tolerance);
          const improvement = newScore - currentScore;

          if (improvement > 0 && (!bestMove || improvement > bestMove.score)) {
            bestMove = { ingredient: ing, delta, score: improvement };
          }
        }
      }

      // Apply best move
      if (bestMove && bestMove.score > 0) {
        bestMove.ingredient.currentAmount += bestMove.delta;
        current = this.calculateTotalMacros(working);

        // Adaptive step size
        if (bestMove.score > lastScore) {
          stuckCount = 0;
        } else {
          stuckCount++;
          if (stuckCount > 5) {
            stepSize = Math.max(1, stepSize - 1);
            stuckCount = 0;
            log.push(`  ⚡ Reducing step size to ${stepSize}g`);
          }
        }
        lastScore = bestMove.score;

        if (iterations % 15 === 0) {
          log.push(`  [${iterations}] ${bestMove.ingredient.name} → ${bestMove.ingredient.currentAmount.toFixed(1)}g`);
        }
      } else {
        // No improvement found
        if (stepSize > 1) {
          stepSize = Math.max(1, stepSize - 1);
          log.push(`  ⚡ No moves found, reducing step to ${stepSize}g`);
        } else {
          log.push('  No valid moves remaining');
          break;
        }
      }

      iterations++;
    }

    // Final status
    const finalGaps = {
      protein: ((current.protein / targets.protein) * 100).toFixed(1) + '%',
      carbs: ((current.carbs / targets.carbs) * 100).toFixed(1) + '%',
      fats: ((current.fats / targets.fats) * 100).toFixed(1) + '%',
      calories: ((current.calories / targets.calories) * 100).toFixed(1) + '%',
    };

    log.push(`\n📊 Final: P=${current.protein.toFixed(1)}g C=${current.carbs.toFixed(1)}g F=${current.fats.toFixed(1)}g Cal=${current.calories.toFixed(0)}`);
    log.push(`Accuracy: P=${finalGaps.protein} C=${finalGaps.carbs} F=${finalGaps.fats} Cal=${finalGaps.calories}`);

    return {
      ingredients: working,
      totalMacros: current,
      iterations,
      converged: this.hasConverged(current, targets, tolerance),
      log,
    };
  }

  /**
   * Calculate total macros for all ingredients
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
   * Check if optimization has converged (within tolerance)
   */
  private hasConverged(
    current: MacroValues,
    targets: OptimizationTargets,
    tolerance: { calories: number; protein: number; carbs: number; fats: number }
  ): boolean {
    return (
      Math.abs(current.protein - targets.protein) <= tolerance.protein &&
      Math.abs(current.carbs - targets.carbs) <= tolerance.carbs &&
      Math.abs(current.fats - targets.fats) <= tolerance.fats &&
      Math.abs(current.calories - targets.calories) <= tolerance.calories
    );
  }

  /**
   * Calculate fitness score (higher = better)
   * Based on how close we are to targets
   */
  private calculateScore(
    current: MacroValues,
    targets: OptimizationTargets,
    tolerance: { calories: number; protein: number; carbs: number; fats: number }
  ): number {
    // Normalized distance (lower = better, so negate for score)
    const proteinError = Math.abs(current.protein - targets.protein) / targets.protein;
    const carbsError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
    const fatsError = Math.abs(current.fats - targets.fats) / targets.fats;
    const caloriesError = Math.abs(current.calories - targets.calories) / targets.calories;

    // Weighted sum (protein 2x weight)
    const totalError = 2 * proteinError + carbsError + fatsError + 0.5 * caloriesError;

    // Return negative error as score (minimize error = maximize score)
    return -totalError;
  }
}
