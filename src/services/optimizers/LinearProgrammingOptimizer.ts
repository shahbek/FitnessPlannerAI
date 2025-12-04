/**
 * Linear Programming Optimizer
 *
 * Uses GLPK (GNU Linear Programming Kit) to find the mathematically optimal
 * solution to the meal macro optimization problem.
 *
 * Advantages over heuristics:
 * - Guaranteed global optimum (not local minimum)
 * - Handles all constraints simultaneously
 * - Polynomial time complexity
 * - No tuning of step sizes or penalties needed
 *
 * Mathematical Formulation:
 *
 * Decision Variables:
 *   x_i = amount (grams) of ingredient i
 *   d_k^+ = positive deviation for macro k (calories, protein, carbs, fats)
 *   d_k^- = negative deviation for macro k
 *
 * Objective: Minimize weighted deviation from targets
 *   min: Σ w_k * (d_k^+ + d_k^-)
 *
 * Subject to:
 *   Σ (density_i^protein * x_i) + d_protein^- - d_protein^+ = target_protein
 *   Σ (density_i^carbs * x_i) + d_carbs^- - d_carbs^+ = target_carbs
 *   Σ (density_i^fats * x_i) + d_fats^- - d_fats^+ = target_fats
 *   Σ (density_i^calories * x_i) + d_calories^- - d_calories^+ = target_calories
 *
 *   min_i ≤ x_i ≤ max_i  ∀i (adjustable ingredients)
 *   x_i = original_i      ∀i (locked ingredients)
 *   d_k^+, d_k^- ≥ 0     ∀k
 */

import GLPK from 'glpk.js';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount } from '../../utils/usdaMapper';
import type {
  OptimizableIngredient,
  OptimizationResult,
  OptimizationTargets,
} from './ProteinPriorityOptimizer';

type MacroKey = 'protein' | 'carbs' | 'fats' | 'calories';
type MacroWeightConfig = Record<MacroKey, number>;
type MacroTolerance = Record<MacroKey, number>;
type DirectionalWeights = { pos: MacroWeightConfig; neg: MacroWeightConfig };

const DEFAULT_TOLERANCE: MacroTolerance = {
  calories: 25,
  protein: 5,
  carbs: 8,
  fats: 4,
};

export class LinearProgrammingOptimizer {
  private glpkInstance: any = null;
  private glpkConstants: any = null;

  /**
   * Initialize GLPK (async, must be called before optimize)
   */
  async initialize(): Promise<void> {
    if (this.glpkInstance) return;

    try {
      this.glpkInstance = await GLPK();
      // Store constants for easy access
      this.glpkConstants = {
        GLP_MIN: this.glpkInstance.GLP_MIN,
        GLP_MAX: this.glpkInstance.GLP_MAX,
        GLP_DB: this.glpkInstance.GLP_DB,
        GLP_FX: this.glpkInstance.GLP_FX,
        GLP_LO: this.glpkInstance.GLP_LO,
        GLP_UP: this.glpkInstance.GLP_UP,
        GLP_OPT: this.glpkInstance.GLP_OPT,
        GLP_FEAS: this.glpkInstance.GLP_FEAS,
        GLP_MSG_OFF: this.glpkInstance.GLP_MSG_OFF,
      };
      console.log('✅ [LP] GLPK initialized successfully');
    } catch (error) {
      console.error('❌ [LP] Failed to initialize GLPK:', error);
      throw error;
    }
  }

  /**
   * Check if LP optimizer is available
   */
  isAvailable(): boolean {
    return this.glpkInstance !== null;
  }

  /**
   * Optimize meal ingredients using Linear Programming
   */
  async optimize(
    ingredients: OptimizableIngredient[],
    targets: OptimizationTargets,
    options?: {
      proteinWeight?: number; // Default 2.0 (protein is 2x important)
      carbsWeight?: number;   // Default 1.0
      fatsWeight?: number;    // Default 1.0
      caloriesWeight?: number; // Default 0.5
    }
  ): Promise<OptimizationResult> {
    if (!this.glpkInstance) {
      throw new Error('LP optimizer not initialized. Call initialize() first.');
    }

    const log: string[] = [];
    log.push('🎯 Starting Linear Programming Optimization');
    log.push(`Target: P=${targets.protein}g C=${targets.carbs}g F=${targets.fats}g Cal=${targets.calories}`);

    // Base weights for objective function
    const baseWeights: MacroWeightConfig = {
      protein: options?.proteinWeight ?? 2.0,  // Protein is most important
      carbs: options?.carbsWeight ?? 1.0,
      fats: options?.fatsWeight ?? 1.0,
      calories: options?.caloriesWeight ?? 0.5, // Calories follow from macros
    };

    const tolerance = this.normalizeTolerance(targets);
    const weights = this.adjustWeightsForTolerance(baseWeights, targets, tolerance);
    const dirWeights = this.directionalizeWeights(weights);

    log.push(`Base weights: P=${baseWeights.protein}x C=${baseWeights.carbs}x F=${baseWeights.fats}x Cal=${baseWeights.calories}x`);
    log.push(
      `Tolerance-adjusted weights: P=${weights.protein}x C=${weights.carbs}x F=${weights.fats}x Cal=${weights.calories}x`
    );
    log.push(
      `Directional weights: P(+${dirWeights.pos.protein}/-${dirWeights.neg.protein}) C(+${dirWeights.pos.carbs}/-${dirWeights.neg.carbs}) F(+${dirWeights.pos.fats}/-${dirWeights.neg.fats}) Cal(+${dirWeights.pos.calories}/-${dirWeights.neg.calories})`
    );

    // Separate adjustable and locked ingredients
    const adjustable = ingredients.filter(ing => !ing.isLocked);
    const locked = ingredients.filter(ing => ing.isLocked);

    log.push(`Adjustable: ${adjustable.length}, Locked: ${locked.length}`);

    if (adjustable.length === 0) {
      log.push('⚠️ No adjustable ingredients, returning original');
      return {
        ingredients,
        totalMacros: this.calculateTotalMacros(ingredients),
        iterations: 0,
        converged: false,
        log,
      };
    }

    // Calculate locked ingredient contribution
    const lockedContribution = this.calculateTotalMacros(locked);
    log.push(`Locked contribution: P=${lockedContribution.protein.toFixed(1)}g C=${lockedContribution.carbs.toFixed(1)}g F=${lockedContribution.fats.toFixed(1)}g`);

    // Adjust targets to account for locked ingredients
    const adjustedTargets = {
      protein: targets.protein - lockedContribution.protein,
      carbs: targets.carbs - lockedContribution.carbs,
      fats: targets.fats - lockedContribution.fats,
      calories: targets.calories - lockedContribution.calories,
    };

    log.push(`Adjusted targets (excluding locked): P=${adjustedTargets.protein.toFixed(1)}g C=${adjustedTargets.carbs.toFixed(1)}g F=${adjustedTargets.fats.toFixed(1)}g`);

    // Build LP problem
    const lp = this.buildLPProblem(adjustable, adjustedTargets, dirWeights);

    // Solve
    log.push('🔧 Solving LP problem...');
    let result: any;
    let solution: any;
    try {
      const rawResult = this.glpkInstance.solve(lp, this.glpkConstants.GLP_MSG_OFF);
      result = await Promise.resolve(rawResult);
      solution = result?.result ?? result?.mip;

      if (!result || !solution) {
        console.error('❌ [LP] Unexpected GLPK response:', result);
        throw new Error('GLPK returned invalid result structure');
      }
    } catch (error) {
      log.push(`❌ LP solver failed: ${error}`);
      throw error;
    }

    // Check solution status with fallback
    const status = solution.status;
    if (status === undefined || status === null) {
      log.push('⚠️ LP solver returned undefined status - problem may be infeasible');
      return {
        ingredients,
        totalMacros: this.calculateTotalMacros(ingredients),
        iterations: 0,
        converged: false,
        log,
      };
    }

    const statusName = this.getStatusName(status);
    log.push(`Status: ${statusName}`);

    if (status !== this.glpkConstants.GLP_OPT && status !== this.glpkConstants.GLP_FEAS) {
      log.push('⚠️ LP solver did not find optimal solution');
      return {
        ingredients,
        totalMacros: this.calculateTotalMacros(ingredients),
        iterations: 0,
        converged: false,
        log,
      };
    }

    // Extract optimized amounts with validation
    const optimized = ingredients.map(ing => {
      if (ing.isLocked) {
        return { ...ing };
      }

      const varName = `x_${ing.index}`;
      const vars = solution.vars;

      if (!vars || vars[varName] === undefined) {
        log.push(`⚠️ Failed to extract ${varName}, using original amount`);
        return { ...ing };
      }

      const newAmount = vars[varName];

      if (newAmount === undefined || isNaN(newAmount)) {
        log.push(`⚠️ Failed to extract amount for ${ing.name}, using original`);
        return { ...ing };
      }

      return {
        ...ing,
        currentAmount: Number(newAmount.toFixed(2)),
      };
    });

    // Calculate final macros
    const finalMacros = this.calculateTotalMacros(optimized);

    log.push(`\n📊 Final: P=${finalMacros.protein.toFixed(1)}g C=${finalMacros.carbs.toFixed(1)}g F=${finalMacros.fats.toFixed(1)}g Cal=${finalMacros.calories.toFixed(0)}`);
    log.push(`Accuracy: P=${((finalMacros.protein / targets.protein) * 100).toFixed(1)}% C=${((finalMacros.carbs / targets.carbs) * 100).toFixed(1)}% F=${((finalMacros.fats / targets.fats) * 100).toFixed(1)}% Cal=${((finalMacros.calories / targets.calories) * 100).toFixed(1)}%`);

    // Show top 5 adjustments
    log.push('\nTop adjustments:');
    optimized
      .filter(ing => !ing.isLocked)
      .map(ing => {
        const original = ingredients.find(i => i.index === ing.index)!;
        return {
          name: ing.name,
          change: ing.currentAmount - original.currentAmount,
          percent: ((ing.currentAmount / original.currentAmount - 1) * 100).toFixed(0),
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5)
      .forEach(adj => {
        log.push(`  ${adj.name}: ${adj.change > 0 ? '+' : ''}${adj.change.toFixed(1)}g (${adj.percent}%)`);
      });

    return {
      ingredients: optimized,
      totalMacros: finalMacros,
      iterations: 1, // LP is single-step
      converged: status === this.glpkConstants.GLP_OPT,
      log,
    };
  }

  /**
   * Build GLPK LP problem formulation
   */
  private buildLPProblem(
    ingredients: OptimizableIngredient[],
    targets: { protein: number; carbs: number; fats: number; calories: number },
    weights: DirectionalWeights
  ): any {
    const vars: any[] = [];
    const constraints: any[] = [];

    // Decision variables: x_i for each ingredient amount
    ingredients.forEach((ing, idx) => {
      vars.push({
        name: `x_${ing.index}`,
        coef: 0, // Not in objective directly
      });
    });

    // Deviation variables: d_k^+ and d_k^- for each macro
    const macros = ['protein', 'carbs', 'fats', 'calories'] as const;
    macros.forEach(macro => {
      vars.push({
        name: `d_${macro}_pos`,
        coef: weights.pos[macro], // Penalize positive deviation
      });
      vars.push({
        name: `d_${macro}_neg`,
        coef: weights.neg[macro], // Penalize negative deviation
      });
    });

    // Constraints: macro balance equations
    // Σ (density_i * x_i) + d^- - d^+ = target
    macros.forEach(macro => {
      const constraint: any = {
        name: `${macro}_balance`,
        vars: [],
        bnds: {
          type: this.glpkConstants.GLP_FX, // Fixed (equality)
          ub: targets[macro],
          lb: targets[macro],
        },
      };

      // Add ingredient contributions
      ingredients.forEach(ing => {
        constraint.vars.push({
          name: `x_${ing.index}`,
          coef: ing.density[macro], // Macro per gram
        });
      });

      // Add deviation variables
      constraint.vars.push(
        { name: `d_${macro}_pos`, coef: 1 },
        { name: `d_${macro}_neg`, coef: -1 }
      );

      constraints.push(constraint);
    });

    // Ratio constraints (linear):
    // 1) Fat energy share cap: 9*Σ(fat_i * x_i) ≤ α * Σ(cal_i * x_i)
    // 2) Protein energy floor: 4*Σ(prot_i * x_i) ≥ β * Σ(cal_i * x_i)
    // 3) Carb energy floor: 4*Σ(carb_i * x_i) ≥ γ * Σ(cal_i * x_i)
    const RATIO = {
      maxFatEnergyFraction: 0.35,   // ≤35% of calories from fat
      minProteinEnergyFraction: 0.20, // ≥20% of calories from protein
      minCarbEnergyFraction: 0.40,    // ≥40% of calories from carbs
    } as const;

    // Helper to push ratio constraint of form: A*Σ(densityA*x) + B*Σ(densityB*x) ≤ rhs (rhs usually 0)
    const pushRatioConstraint = (
      name: string,
      leftVars: Array<{ name: string; coef: number }>,
      bnds: { type: number; ub: number; lb: number }
    ) => {
      constraints.push({ name, vars: leftVars, bnds });
    };

    // Precompute variable contributions
    const fatLeft: Array<{ name: string; coef: number }> = [];
    const protLeft: Array<{ name: string; coef: number }> = [];
    const carbLeft: Array<{ name: string; coef: number }> = [];
    const calLeft: Array<{ name: string; coef: number }> = [];
    ingredients.forEach(ing => {
      fatLeft.push({ name: `x_${ing.index}`, coef: 9 * ing.density.fats });
      protLeft.push({ name: `x_${ing.index}`, coef: 4 * ing.density.protein });
      carbLeft.push({ name: `x_${ing.index}`, coef: 4 * ing.density.carbs });
      calLeft.push({ name: `x_${ing.index}`, coef: ing.density.calories });
    });

    // Build fat cap: (9*fats_i - α*cal_i) summed over i ≤ 0
    const fatCapVars: Array<{ name: string; coef: number }> = [];
    for (let i = 0; i < ingredients.length; i++) {
      const coef = (fatLeft[i].coef) - (RATIO.maxFatEnergyFraction * calLeft[i].coef);
      fatCapVars.push({ name: fatLeft[i].name, coef });
    }
    pushRatioConstraint('fat_energy_cap', fatCapVars, { type: this.glpkConstants.GLP_UP, ub: 0, lb: -1e12 });

    // Protein floor: (β*cal_i - 4*prot_i) summed over i ≤ 0  => 4Σprot ≥ βΣcal
    const protFloorVars: Array<{ name: string; coef: number }> = [];
    for (let i = 0; i < ingredients.length; i++) {
      const coef = (RATIO.minProteinEnergyFraction * calLeft[i].coef) - (protLeft[i].coef);
      protFloorVars.push({ name: protLeft[i].name, coef });
    }
    pushRatioConstraint('protein_energy_floor', protFloorVars, { type: this.glpkConstants.GLP_UP, ub: 0, lb: -1e12 });

    // Carb floor: (γ*cal_i - 4*carb_i) summed over i ≤ 0  => 4Σcarb ≥ γΣcal
    const carbFloorVars: Array<{ name: string; coef: number }> = [];
    for (let i = 0; i < ingredients.length; i++) {
      const coef = (RATIO.minCarbEnergyFraction * calLeft[i].coef) - (carbLeft[i].coef);
      carbFloorVars.push({ name: carbLeft[i].name, coef });
    }
    pushRatioConstraint('carb_energy_floor', carbFloorVars, { type: this.glpkConstants.GLP_UP, ub: 0, lb: -1e12 });

    // Bounds on ingredient amounts
    const bounds: any[] = [];
    ingredients.forEach(ing => {
      bounds.push({
        name: `x_${ing.index}`,
        type: this.glpkConstants.GLP_DB, // Double bounded
        ub: ing.maxAmount,
        lb: ing.minAmount,
      });
    });

    // Bounds on deviation variables (non-negative)
    macros.forEach(macro => {
      bounds.push(
        {
          name: `d_${macro}_pos`,
          type: this.glpkConstants.GLP_LO,
          lb: 0,
          ub: 0, // Will be ignored for GLP_LO
        },
        {
          name: `d_${macro}_neg`,
          type: this.glpkConstants.GLP_LO,
          lb: 0,
          ub: 0,
        }
      );
    });

    return {
      name: 'MealOptimization',
      objective: {
        direction: this.glpkConstants.GLP_MIN,
        name: 'weighted_deviation',
        vars,
      },
      subjectTo: constraints,
      bounds,
    };
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
   * Get human-readable status name
   */
  private getStatusName(status: number): string {
    if (!this.glpkConstants) return 'Unknown';

    if (status === this.glpkConstants.GLP_OPT) return 'OPTIMAL';
    if (status === this.glpkConstants.GLP_FEAS) return 'FEASIBLE';
    return `STATUS_${status}`;
  }

  /**
   * Ensure we always have tolerance values for every macro
   */
  private normalizeTolerance(targets: OptimizationTargets): MacroTolerance {
    const supplied = (targets.tolerance ?? {}) as Partial<MacroTolerance>;
    const normalized = {
      calories: supplied.calories ?? Math.max(DEFAULT_TOLERANCE.calories, targets.calories * 0.03),
      protein: supplied.protein ?? Math.max(DEFAULT_TOLERANCE.protein, targets.protein * 0.03),
      carbs: supplied.carbs ?? Math.max(DEFAULT_TOLERANCE.carbs, targets.carbs * 0.03),
      fats: supplied.fats ?? Math.max(DEFAULT_TOLERANCE.fats, targets.fats * 0.03),
    };

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    normalized.protein = clamp(normalized.protein, 3, targets.protein * 0.12);
    normalized.carbs = clamp(normalized.carbs, 5, targets.carbs * 0.15);
    normalized.fats = clamp(normalized.fats, 3, targets.fats * 0.15);
    normalized.calories = clamp(normalized.calories, 20, targets.calories * 0.10);

    return normalized;
  }

  /**
   * Increase penalties for macros with tight tolerances so LP prioritizes them
   */
  private adjustWeightsForTolerance(
    baseWeights: MacroWeightConfig,
    targets: OptimizationTargets,
    tolerance: MacroTolerance
  ): MacroWeightConfig {
    const macros: MacroKey[] = ['protein', 'carbs', 'fats', 'calories'];
    const adjusted = { ...baseWeights };
    let totalWeight = 0;

    macros.forEach(macro => {
      const targetValue = Math.max(targets[macro], 1);
      const tolValue = Math.max(tolerance[macro], targetValue * 0.02);
      const relativeTolerance = Math.min(0.5, tolValue / targetValue);
      const scale = Math.min(8, Math.max(1.25, 1 / Math.max(relativeTolerance, 0.02)));
      adjusted[macro] = Number((baseWeights[macro] * scale).toFixed(3));
      totalWeight += adjusted[macro];
    });

    const targetWeight = 6; // Keep objective magnitude stable
    const normalizationFactor = totalWeight > 0 ? targetWeight / totalWeight : 1;

    macros.forEach(macro => {
      adjusted[macro] = Number((adjusted[macro] * normalizationFactor).toFixed(3));
    });

    return adjusted;
  }

  /**
   * Directionalize weights so over/under deviations are treated differently.
   * - Protein: under is much worse than over
   * - Fats: over is much worse than under
   * - Carbs: slight preference to be under
   * - Calories: slight preference to be under
   */
  private directionalizeWeights(weights: MacroWeightConfig): DirectionalWeights {
    const pos: MacroWeightConfig = { ...weights };
    const neg: MacroWeightConfig = { ...weights };

    // Protein: strongly penalize negative (under), reduce penalty for positive (over)
    pos.protein = Number((weights.protein * 0.9).toFixed(3));
    neg.protein = Number((weights.protein * 2.5).toFixed(3));

    // Fats: strongly penalize positive (over), reduce penalty for negative (under)
    pos.fats = Number((weights.fats * 2.2).toFixed(3));
    neg.fats = Number((weights.fats * 0.9).toFixed(3));

    // Carbs: mild bias to be under target
    pos.carbs = Number((weights.carbs * 1.05).toFixed(3));
    neg.carbs = Number((weights.carbs * 0.95).toFixed(3));

    // Calories: mild bias to be under (avoid overshooting calories)
    pos.calories = Number((weights.calories * 1.15).toFixed(3));
    neg.calories = Number((weights.calories * 0.95).toFixed(3));

    return { pos, neg };
  }
}
