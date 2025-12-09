/**
 * Nutrition Calculation Service
 *
 * Centralized, evidence-based nutrition calculations for maintenance calories,
 * macro targets, and day-to-day adjustments. This service is the single source
 * of truth for all caloric and macronutrient calculations.
 *
 * Scientific Foundations:
 * - BMR: Katch-McArdle (when BF% available) or Mifflin-St Jeor
 * - TDEE: Activity factor multipliers from Cunningham (1980) and updated ACSM guidelines
 * - Protein: Helms et al. (2014) - 1.8-2.7g/kg for resistance-trained individuals
 * - Fat: Essential fatty acid requirements (0.7-1.0g/kg) per Helms et al. (2013)
 * - Carbs: Remainder after protein/fat allocation
 */

import { ResearchFact, researchKnowledgeBase } from '../ai/knowledgeBase';
import { 
  GoalCategory, 
  BodyFatGoal, 
  getEffectiveGoalType 
} from '../models/UserProfile';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UserMetrics {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  bodyFat?: number; // Body fat percentage (optional)
  activityLevel?: string | number; // 'sedentary', 'light', etc. or numeric factor
  trainingDaysPerWeek?: number;
}

export interface GoalConfig {
  goal: string; // 'fat_loss', 'muscle_gain', 'recomp', etc.
  timelineWeeks?: number;
  deficitMagnitude?: 'conservative' | 'moderate' | 'aggressive';
  proteinMultiplier?: number; // Override default protein target (g/kg)
  fatMultiplier?: number; // Override default fat target (g/kg)
}

/**
 * New goal category configuration
 * Uses explicit goal categories instead of legacy goal strings
 */
export interface GoalCategoryConfig {
  goalCategory: GoalCategory;
  timelineWeeks?: number;
  bodyFatGoal?: BodyFatGoal;
  proteinMultiplier?: number;
  fatMultiplier?: number;
}

export interface MaintenanceCalories {
  bmr: number;
  bmrFormula: string;
  bmrSource: string;
  activityFactor: number;
  activityFactorSource: string;
  tdee: number;
  tdeeFormula: string;
  confidence: number;
  warnings: string[];
}

export interface MacroTargets {
  calories: number;
  protein: number;
  proteinPerKg: number;
  fat: number;
  fatPerKg: number;
  carbs: number;
  carbPercentage: number;
  sources: string[];
  reasoning: string;
}


export interface DeficitCalculation {
  maintenanceCalories: number;
  deficitCalories: number;
  deficitPercentage: number;
  targetCalories: number;
  expectedWeeklyFatLoss: number;
  reasoning: string;
  warnings: string[];
}

// ============================================================================
// CONSTANTS - Evidence-Based Defaults
// ============================================================================

/**
 * Activity Factor Multipliers
 * Based on Cunningham (1980) and updated ACSM guidelines
 */
export const ACTIVITY_FACTORS = {
  SEDENTARY: 1.2, // Little to no exercise, desk job
  LIGHT: 1.375, // Light exercise 1-3 days/week
  MODERATE: 1.55, // Moderate exercise 3-5 days/week
  ACTIVE: 1.725, // Heavy exercise 6-7 days/week
  VERY_ACTIVE: 1.9, // Very heavy exercise, physical job, or training twice per day
} as const;

/**
 * Activity Level String Mapping
 */
const ACTIVITY_LEVEL_MAP: Record<string, number> = {
  sedentary: ACTIVITY_FACTORS.SEDENTARY,
  light: ACTIVITY_FACTORS.LIGHT,
  moderate: ACTIVITY_FACTORS.MODERATE,
  active: ACTIVITY_FACTORS.ACTIVE,
  very_active: ACTIVITY_FACTORS.VERY_ACTIVE,
  'very active': ACTIVITY_FACTORS.VERY_ACTIVE,
};

/**
 * Protein Targets (g/kg bodyweight)
 * Evidence: Helms et al. (2014) - resistance-trained individuals in energy deficit
 * - Fat Loss: 2.3-3.1g/kg lean mass, ~1.8-2.7g/kg total bodyweight
 * - Muscle Gain: 1.6-2.2g/kg
 * - Maintenance: 1.6-2.0g/kg
 */
export const PROTEIN_TARGETS = {
  FAT_LOSS: {
    CONSERVATIVE: 2.0, // Lower end for beginners or those with high BF%
    MODERATE: 2.2, // Standard recommendation
    AGGRESSIVE: 2.7, // Higher deficit or advanced athletes
  },
  MUSCLE_GAIN: {
    CONSERVATIVE: 1.8,
    MODERATE: 2.0,
    AGGRESSIVE: 2.2,
  },
  MAINTENANCE: {
    CONSERVATIVE: 1.6,
    MODERATE: 1.8,
    AGGRESSIVE: 2.0,
  },
} as const;

/**
 * Fat Targets (g/kg bodyweight)
 * Evidence: Helms et al. (2013) - Essential fatty acid requirements
 * Minimum: ~0.5g/kg for essential fatty acids
 * Optimal: 0.7-1.0g/kg for hormone production and satiety
 */
export const FAT_TARGETS = {
  FAT_LOSS: {
    CONSERVATIVE: 0.9, // Higher fat for satiety
    MODERATE: 0.7, // Balanced approach
    AGGRESSIVE: 0.6, // Minimum for deep deficit (not recommended long-term)
  },
  MUSCLE_GAIN: {
    CONSERVATIVE: 0.8,
    MODERATE: 1.0,
    AGGRESSIVE: 1.2,
  },
  MAINTENANCE: {
    CONSERVATIVE: 0.8,
    MODERATE: 0.9,
    AGGRESSIVE: 1.0,
  },
} as const;

/**
 * Caloric Deficit Ranges (% of TDEE)
 * Evidence: Helms et al. (2014) - sustainable fat loss rates
 * - Conservative: 10-15% deficit (~0.5% bodyweight/week)
 * - Moderate: 15-25% deficit (~0.5-1% bodyweight/week)
 * - Aggressive: 25-30% deficit (~1% bodyweight/week, not sustainable long-term)
 */
export const DEFICIT_RANGES = {
  CONSERVATIVE: { MIN: 0.10, MAX: 0.15 },
  MODERATE: { MIN: 0.15, MAX: 0.25 },
  AGGRESSIVE: { MIN: 0.25, MAX: 0.30 },
} as const;

/**
 * Surplus Ranges for Muscle Gain (% of TDEE)
 * Evidence: Slater & Phillips (2011) - lean mass gain rates
 * - Conservative: 5-10% surplus (~0.25% bodyweight/week)
 * - Moderate: 10-15% surplus (~0.5% bodyweight/week)
 * - Aggressive: 15-20% surplus (~0.5-0.75% bodyweight/week)
 */
export const SURPLUS_RANGES = {
  CONSERVATIVE: { MIN: 0.05, MAX: 0.10 },
  MODERATE: { MIN: 0.10, MAX: 0.15 },
  AGGRESSIVE: { MIN: 0.15, MAX: 0.20 },
} as const;

/**
 * Goal Category Calorie Adjustments
 * Maps each GoalCategory to its caloric adjustment strategy
 * 
 * Evidence:
 * - Lean bulk: Slater & Phillips (2011) - conservative surplus
 * - Dirty bulk: Garthe et al. (2013) - aggressive surplus
 * - Mini cut: Trexler et al. (2014) - short-term moderate deficit
 * - Aggressive cut: Helms et al. (2014) - maximum sustainable deficit
 * - Recomp/Maintenance: Barakat et al. (2020) - maintenance calories
 * - Body fat goal: Dynamically calculated based on BF% delta
 */
export const GOAL_CALORIE_ADJUSTMENTS: Record<GoalCategory, {
  type: 'surplus' | 'deficit' | 'maintenance' | 'dynamic';
  range: { MIN: number; MAX: number };
  proteinRange: { MIN: number; MAX: number };
  fatRange: { MIN: number; MAX: number };
}> = {
  lean_bulk: {
    type: 'surplus',
    range: { MIN: 0.05, MAX: 0.10 },
    proteinRange: { MIN: 1.6, MAX: 2.2 },
    fatRange: { MIN: 0.8, MAX: 1.0 },
  },
  dirty_bulk: {
    type: 'surplus',
    range: { MIN: 0.15, MAX: 0.20 },
    proteinRange: { MIN: 1.6, MAX: 2.0 },
    fatRange: { MIN: 1.0, MAX: 1.2 },
  },
  mini_cut: {
    type: 'deficit',
    range: { MIN: 0.15, MAX: 0.20 },
    proteinRange: { MIN: 2.0, MAX: 2.4 },
    fatRange: { MIN: 0.7, MAX: 0.9 },
  },
  aggressive_cut: {
    type: 'deficit',
    range: { MIN: 0.25, MAX: 0.30 },
    proteinRange: { MIN: 2.3, MAX: 2.7 },
    fatRange: { MIN: 0.6, MAX: 0.8 },
  },
  recomp: {
    type: 'maintenance',
    range: { MIN: -0.05, MAX: 0.05 },
    proteinRange: { MIN: 2.0, MAX: 2.4 },
    fatRange: { MIN: 0.8, MAX: 1.0 },
  },
  maintenance: {
    type: 'maintenance',
    range: { MIN: 0, MAX: 0 },
    proteinRange: { MIN: 1.6, MAX: 2.0 },
    fatRange: { MIN: 0.8, MAX: 1.0 },
  },
  body_fat_goal: {
    type: 'dynamic',
    range: { MIN: -0.30, MAX: 0.20 }, // Calculated based on BF% delta
    proteinRange: { MIN: 2.0, MAX: 2.7 },
    fatRange: { MIN: 0.6, MAX: 1.0 },
  },
} as const;


// ============================================================================
// NUTRITION CALCULATION SERVICE
// ============================================================================

export class NutritionCalculationService {
  private knowledgeBaseReady = false;

  constructor() {
    void this.ensureKnowledgeBase();
  }

  /**
   * Ensure knowledge base is initialized
   */
  private async ensureKnowledgeBase(): Promise<void> {
    if (!researchKnowledgeBase.isReady()) {
      await researchKnowledgeBase.initialize();
    }
    this.knowledgeBaseReady = true;
  }

  // ==========================================================================
  // MAINTENANCE CALORIE CALCULATIONS
  // ==========================================================================

  /**
   * Calculate maintenance calories (TDEE) with evidence-based formulas
   *
   * This is the PRIMARY method for determining energy expenditure.
   * All other calorie calculations derive from this baseline.
   */
  async calculateMaintenanceCalories(
    metrics: UserMetrics
  ): Promise<MaintenanceCalories> {
    await this.ensureKnowledgeBase();

    // Step 1: Calculate BMR using best available formula
    const bmrResult = this.calculateBMR(metrics);

    // Step 2: Determine activity factor
    const activityFactorResult = this.determineActivityFactor(metrics);

    // Step 3: Calculate TDEE
    const tdee = Math.round(bmrResult.bmr * activityFactorResult.factor);

    const warnings: string[] = [];

    // Add warnings for edge cases
    if (metrics.bodyFat && metrics.bodyFat < 5) {
      warnings.push('Very low body fat may affect BMR accuracy');
    }
    if (metrics.bodyFat && metrics.bodyFat > 35) {
      warnings.push('High body fat: consider using Katch-McArdle if lean mass is known');
    }
    if (!metrics.bodyFat) {
      warnings.push('Body fat % not provided - using Mifflin-St Jeor (less accurate for athletes)');
    }

    return {
      bmr: bmrResult.bmr,
      bmrFormula: bmrResult.formula,
      bmrSource: bmrResult.source,
      activityFactor: activityFactorResult.factor,
      activityFactorSource: activityFactorResult.source,
      tdee,
      tdeeFormula: `TDEE = BMR × Activity Factor = ${bmrResult.bmr} × ${activityFactorResult.factor.toFixed(3)} = ${tdee} kcal/day`,
      confidence: bmrResult.confidence * activityFactorResult.confidence,
      warnings,
    };
  }

  /**
   * Calculate Basal Metabolic Rate (BMR)
   *
   * Preferred: Katch-McArdle (requires body fat %)
   * Fallback: Mifflin-St Jeor (requires sex, age, height, weight)
   */
  private calculateBMR(metrics: UserMetrics): {
    bmr: number;
    formula: string;
    source: string;
    confidence: number;
  } {
    const hasBodyFat = typeof metrics.bodyFat === 'number' && metrics.bodyFat > 0;

    if (hasBodyFat) {
      // Katch-McArdle: More accurate for athletes with known body composition
      // BMR = 370 + (21.6 × lean body mass in kg)
      const leanBodyMass = metrics.weightKg * (1 - metrics.bodyFat! / 100);
      const bmr = Math.round(370 + 21.6 * leanBodyMass);

      const fact = researchKnowledgeBase.getFactById('katch_mcardle_bmr');

      return {
        bmr,
        formula: `BMR = 370 + (21.6 × LBM) = 370 + (21.6 × ${leanBodyMass.toFixed(1)}) = ${bmr} kcal/day`,
        source: fact?.source || 'Katch & McArdle (1996) - Exercise Physiology',
        confidence: 0.92,
      };
    } else {
      // Mifflin-St Jeor: Good for general population
      // Men: BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
      // Women: BMR = (10 × weight) + (6.25 × height) - (5 × age) - 161
      const genderFactor = metrics.sex === 'male' ? 5 : -161;
      const bmr = Math.round(
        10 * metrics.weightKg +
        6.25 * metrics.heightCm -
        5 * metrics.age +
        genderFactor
      );

      const fact = researchKnowledgeBase.getFactById('mifflin_st_jeor_bmr');

      return {
        bmr,
        formula: `BMR = (10 × ${metrics.weightKg}) + (6.25 × ${metrics.heightCm}) - (5 × ${metrics.age}) + ${genderFactor} = ${bmr} kcal/day`,
        source: fact?.source || 'Mifflin et al. (1990) - American Journal of Clinical Nutrition',
        confidence: 0.88,
      };
    }
  }

  /**
   * Determine activity factor based on training frequency and activity level
   *
   * Priority:
   * 1. Explicit numeric activityLevel
   * 2. String activityLevel mapped to factor
   * 3. Training days per week mapped to factor
   * 4. Default to MODERATE (1.55)
   */
  private determineActivityFactor(metrics: UserMetrics): {
    factor: number;
    source: string;
    confidence: number;
  } {
    let factor: number;
    let source: string;
    let confidence: number;

    // Case 1: Explicit numeric activity factor
    if (typeof metrics.activityLevel === 'number') {
      factor = this.clampActivityFactor(metrics.activityLevel);
      source = 'User-provided activity factor';
      confidence = 0.85;
    }
    // Case 2: String activity level
    else if (
      typeof metrics.activityLevel === 'string' &&
      ACTIVITY_LEVEL_MAP[metrics.activityLevel.toLowerCase()]
    ) {
      factor = ACTIVITY_LEVEL_MAP[metrics.activityLevel.toLowerCase()];
      source = 'ACSM activity level guidelines';
      confidence = 0.88;
    }
    // Case 3: Training days per week
    else if (typeof metrics.trainingDaysPerWeek === 'number') {
      factor = this.mapTrainingDaysToActivityFactor(metrics.trainingDaysPerWeek);
      source = 'Training frequency mapping (ACSM guidelines)';
      confidence = 0.82;
    }
    // Case 4: Default
    else {
      factor = ACTIVITY_FACTORS.MODERATE;
      source = 'Default (moderate activity assumed)';
      confidence = 0.70;
    }

    const activityFact = researchKnowledgeBase.getFactById('activity_factors');

    return {
      factor,
      source: activityFact?.source || source,
      confidence,
    };
  }

  /**
   * Map training days per week to activity factor
   *
   * Evidence-based mapping:
   * - 0-1 days: Sedentary (1.2)
   * - 2 days: Light (1.35)
   * - 3 days: Moderate (1.5)
   * - 4 days: Active (1.6)
   * - 5 days: Active+ (1.7)
   * - 6+ days: Very Active (1.8)
   */
  private mapTrainingDaysToActivityFactor(days: number): number {
    if (days <= 1) return ACTIVITY_FACTORS.SEDENTARY;
    if (days === 2) return 1.35;
    if (days === 3) return 1.5;
    if (days === 4) return 1.6;
    if (days === 5) return 1.7;
    return 1.8; // 6+ days
  }

  /**
   * Clamp activity factor to reasonable range (1.2 - 1.9)
   */
  private clampActivityFactor(value: number): number {
    return Math.min(Math.max(value, 1.2), 1.9);
  }

  // ==========================================================================
  // MACRO TARGET CALCULATIONS
  // ==========================================================================

  /**
   * Calculate macro targets based on goal and deficit/surplus
   *
   * This method determines protein, fat, and carbs based on:
   * 1. Goal (fat loss, muscle gain, maintenance)
   * 2. Deficit magnitude (conservative, moderate, aggressive)
   * 3. User preferences (optional overrides)
   */
  async calculateMacroTargets(
    metrics: UserMetrics,
    maintenanceCalories: MaintenanceCalories,
    config: GoalConfig
  ): Promise<MacroTargets> {
    await this.ensureKnowledgeBase();

    const goalType = this.normalizeGoal(config.goal);
    const magnitude = config.deficitMagnitude || 'moderate';

    // Step 1: Determine protein target
    const proteinPerKg = config.proteinMultiplier || this.getProteinTarget(goalType, magnitude);
    const protein = Math.round(metrics.weightKg * proteinPerKg * 10) / 10;

    // Step 2: Determine fat target
    const fatPerKg = config.fatMultiplier || this.getFatTarget(goalType, magnitude);
    const fat = Math.round(metrics.weightKg * fatPerKg * 10) / 10;

    // Step 3: Calculate target calories (maintenance +/- deficit/surplus)
    const { targetCalories, deficitCalories } = this.calculateTargetCalories(
      maintenanceCalories.tdee,
      goalType,
      magnitude
    );

    // Step 4: Carbs fill remaining calories
    const proteinCalories = protein * 4;
    const fatCalories = fat * 9;
    const remainingCalories = Math.max(targetCalories - proteinCalories - fatCalories, 0);
    const carbs = Math.round((remainingCalories / 4) * 10) / 10;

    // Step 5: Collect sources
    const sources = this.collectMacroSources(goalType);

    // Step 6: Generate reasoning
    const reasoning = this.generateMacroReasoning(
      goalType,
      magnitude,
      metrics.weightKg,
      proteinPerKg,
      fatPerKg,
      maintenanceCalories.tdee,
      targetCalories,
      deficitCalories
    );

    return {
      calories: Math.round(targetCalories),
      protein,
      proteinPerKg,
      fat,
      fatPerKg,
      carbs,
      carbPercentage: Math.round((carbs * 4 / targetCalories) * 100),
      sources,
      reasoning,
    };
  }

  /**
   * Normalize goal string to standard format
   */
  private normalizeGoal(goal: string): 'fat_loss' | 'muscle_gain' | 'maintenance' {
    const lowerGoal = goal.toLowerCase();
    if (lowerGoal.includes('fat') || lowerGoal.includes('cut') || lowerGoal.includes('loss')) {
      return 'fat_loss';
    }
    if (lowerGoal.includes('muscle') || lowerGoal.includes('gain') || lowerGoal.includes('bulk')) {
      return 'muscle_gain';
    }
    return 'maintenance';
  }

  /**
   * Get protein target based on goal and magnitude
   */
  private getProteinTarget(
    goalType: 'fat_loss' | 'muscle_gain' | 'maintenance',
    magnitude: 'conservative' | 'moderate' | 'aggressive'
  ): number {
    const upperMagnitude = magnitude.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

    if (goalType === 'fat_loss') {
      return PROTEIN_TARGETS.FAT_LOSS[upperMagnitude];
    }
    if (goalType === 'muscle_gain') {
      return PROTEIN_TARGETS.MUSCLE_GAIN[upperMagnitude];
    }
    return PROTEIN_TARGETS.MAINTENANCE[upperMagnitude];
  }

  /**
   * Get fat target based on goal and magnitude
   */
  private getFatTarget(
    goalType: 'fat_loss' | 'muscle_gain' | 'maintenance',
    magnitude: 'conservative' | 'moderate' | 'aggressive'
  ): number {
    const upperMagnitude = magnitude.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

    if (goalType === 'fat_loss') {
      return FAT_TARGETS.FAT_LOSS[upperMagnitude];
    }
    if (goalType === 'muscle_gain') {
      return FAT_TARGETS.MUSCLE_GAIN[upperMagnitude];
    }
    return FAT_TARGETS.MAINTENANCE[upperMagnitude];
  }

  /**
   * Calculate target calories based on maintenance and goal
   */
  private calculateTargetCalories(
    tdee: number,
    goalType: 'fat_loss' | 'muscle_gain' | 'maintenance',
    magnitude: 'conservative' | 'moderate' | 'aggressive'
  ): { targetCalories: number; deficitCalories: number } {
    if (goalType === 'maintenance') {
      return { targetCalories: tdee, deficitCalories: 0 };
    }

    let deficitPercentage: number;

    if (goalType === 'fat_loss') {
      const range = DEFICIT_RANGES[magnitude.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'];
      deficitPercentage = (range.MIN + range.MAX) / 2; // Midpoint of range
    } else {
      // muscle_gain
      const range = SURPLUS_RANGES[magnitude.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'];
      deficitPercentage = -((range.MIN + range.MAX) / 2); // Negative for surplus
    }

    const deficitCalories = Math.round(tdee * deficitPercentage);
    const targetCalories = tdee - deficitCalories;

    return { targetCalories, deficitCalories };
  }

  /**
   * Collect research sources for macro calculations
   */
  private collectMacroSources(goalType: 'fat_loss' | 'muscle_gain' | 'maintenance'): string[] {
    const sources = new Set<string>();

    // Add core protein/fat sources
    ['helms_protein_cut', 'peos_protein_peak', 'helms_calorie_deficit'].forEach((id) => {
      const fact = researchKnowledgeBase.getFactById(id);
      if (fact) sources.add(fact.source);
    });

    // Add goal-specific sources
    if (goalType === 'muscle_gain') {
      const muscleFacts = researchKnowledgeBase.searchFacts('hypertrophy protein', 'training');
      muscleFacts.forEach((fact) => sources.add(fact.source));
    }

    return Array.from(sources);
  }

  /**
   * Generate reasoning for macro targets
   */
  private generateMacroReasoning(
    goalType: 'fat_loss' | 'muscle_gain' | 'maintenance',
    magnitude: 'conservative' | 'moderate' | 'aggressive',
    weightKg: number,
    proteinPerKg: number,
    fatPerKg: number,
    tdee: number,
    targetCalories: number,
    deficitCalories: number
  ): string {
    const lines: string[] = [];

    lines.push(`Goal: ${goalType.replace('_', ' ')} (${magnitude})`);
    lines.push(`Maintenance (TDEE): ${tdee} kcal/day`);

    if (deficitCalories !== 0) {
      const sign = deficitCalories > 0 ? '-' : '+';
      lines.push(`${sign}${Math.abs(deficitCalories)} kcal/day (${Math.abs(Math.round((deficitCalories / tdee) * 100))}%)`);
    }

    lines.push(`Target: ${targetCalories} kcal/day`);
    lines.push(`Protein: ${proteinPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * proteinPerKg)}g (evidence-based for ${goalType})`);
    lines.push(`Fat: ${fatPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * fatPerKg)}g (essential fatty acids + hormone production)`);
    lines.push(`Carbs: Remainder after protein/fat = fills remaining calories for energy`);

    return lines.join('\n');
  }


  // ==========================================================================
  // DEFICIT/SURPLUS CALCULATIONS
  // ==========================================================================

  /**
   * Calculate caloric deficit for fat loss goals
   *
   * Returns detailed breakdown of maintenance, deficit, target calories,
   * and expected fat loss rate.
   */
  async calculateDeficit(
    maintenanceCalories: MaintenanceCalories,
    weightKg: number,
    magnitude: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
    timelineWeeks?: number
  ): Promise<DeficitCalculation> {
    await this.ensureKnowledgeBase();

    const range = DEFICIT_RANGES[magnitude.toUpperCase() as 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'];
    const deficitPercentage = (range.MIN + range.MAX) / 2; // Midpoint
    const deficitCalories = Math.round(maintenanceCalories.tdee * deficitPercentage);
    const targetCalories = maintenanceCalories.tdee - deficitCalories;

    // Calculate expected fat loss
    // 1 kg fat = ~7700 kcal deficit
    const weeklyDeficit = deficitCalories * 7;
    const expectedWeeklyFatLoss = weeklyDeficit / 7700; // kg per week

    // Validate against safe fat loss rates (0.5-1% bodyweight/week)
    const safeMinRate = weightKg * 0.005; // 0.5%
    const safeMaxRate = weightKg * 0.01; // 1%

    const warnings: string[] = [];
    if (expectedWeeklyFatLoss < safeMinRate) {
      warnings.push(`Fat loss rate (${expectedWeeklyFatLoss.toFixed(2)}kg/week) is below 0.5% bodyweight - consider increasing deficit slightly`);
    }
    if (expectedWeeklyFatLoss > safeMaxRate) {
      warnings.push(`Fat loss rate (${expectedWeeklyFatLoss.toFixed(2)}kg/week) exceeds 1% bodyweight - consider reducing deficit to preserve muscle mass`);
    }

    // Calculate total expected fat loss over timeline
    let reasoning = `
Maintenance (TDEE): ${maintenanceCalories.tdee} kcal/day
Deficit magnitude: ${magnitude} (${Math.round(deficitPercentage * 100)}% of TDEE)
Daily deficit: ${deficitCalories} kcal
Target calories: ${targetCalories} kcal/day
Weekly deficit: ${weeklyDeficit} kcal
Expected fat loss: ${expectedWeeklyFatLoss.toFixed(2)} kg/week (${((expectedWeeklyFatLoss / weightKg) * 100).toFixed(1)}% bodyweight)
    `.trim();

    if (timelineWeeks) {
      const totalExpectedLoss = expectedWeeklyFatLoss * timelineWeeks;
      reasoning += `\nTotal expected fat loss over ${timelineWeeks} weeks: ${totalExpectedLoss.toFixed(1)} kg`;
    }

    reasoning += `\n\nEvidence: Helms et al. (2014) - safe fat loss rates for resistance-trained individuals`;

    return {
      maintenanceCalories: maintenanceCalories.tdee,
      deficitCalories,
      deficitPercentage: Math.round(deficitPercentage * 100),
      targetCalories,
      expectedWeeklyFatLoss: Math.round(expectedWeeklyFatLoss * 100) / 100,
      reasoning,
      warnings,
    };
  }

  // ==========================================================================
  // GOAL CATEGORY CALCULATIONS
  // ==========================================================================

  /**
   * Calculate macro targets using the new GoalCategory system
   * 
   * This method handles all goal categories including body_fat_goal
   */
  async calculateMacroTargetsFromCategory(
    metrics: UserMetrics,
    maintenanceCalories: MaintenanceCalories,
    config: GoalCategoryConfig
  ): Promise<MacroTargets> {
    await this.ensureKnowledgeBase();

    const { goalCategory, bodyFatGoal, timelineWeeks } = config;
    const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];

    // Handle body_fat_goal specially - calculate dynamic deficit
    if (goalCategory === 'body_fat_goal' && bodyFatGoal) {
      return this.calculateBodyFatGoalMacros(
        metrics,
        maintenanceCalories,
        bodyFatGoal,
        timelineWeeks || 12,
        config.proteinMultiplier,
        config.fatMultiplier
      );
    }

    // For other goals, use the predefined adjustment ranges
    const { targetCalories, adjustmentCalories } = this.calculateCategoryTargetCalories(
      maintenanceCalories.tdee,
      goalCategory
    );

    // Determine protein and fat targets
    const proteinPerKg = config.proteinMultiplier || 
      (adjustment.proteinRange.MIN + adjustment.proteinRange.MAX) / 2;
    const fatPerKg = config.fatMultiplier ||
      (adjustment.fatRange.MIN + adjustment.fatRange.MAX) / 2;

    const protein = Math.round(metrics.weightKg * proteinPerKg * 10) / 10;
    const fat = Math.round(metrics.weightKg * fatPerKg * 10) / 10;

    // Carbs fill remaining calories
    const proteinCalories = protein * 4;
    const fatCalories = fat * 9;
    const remainingCalories = Math.max(targetCalories - proteinCalories - fatCalories, 0);
    const carbs = Math.round((remainingCalories / 4) * 10) / 10;

    // Generate reasoning
    const reasoning = this.generateCategoryMacroReasoning(
      goalCategory,
      metrics.weightKg,
      proteinPerKg,
      fatPerKg,
      maintenanceCalories.tdee,
      targetCalories,
      adjustmentCalories
    );

    return {
      calories: Math.round(targetCalories),
      protein,
      proteinPerKg,
      fat,
      fatPerKg,
      carbs,
      carbPercentage: Math.round((carbs * 4 / targetCalories) * 100),
      sources: this.collectGoalCategorySources(goalCategory),
      reasoning,
    };
  }

  /**
   * Calculate target calories based on goal category
   */
  private calculateCategoryTargetCalories(
    tdee: number,
    goalCategory: GoalCategory
  ): { targetCalories: number; adjustmentCalories: number } {
    const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];
    
    if (adjustment.type === 'maintenance') {
      return { targetCalories: tdee, adjustmentCalories: 0 };
    }

    // Calculate midpoint of range
    const adjustmentPercent = (adjustment.range.MIN + adjustment.range.MAX) / 2;
    
    if (adjustment.type === 'surplus') {
      const surplusCalories = Math.round(tdee * adjustmentPercent);
      return { 
        targetCalories: tdee + surplusCalories, 
        adjustmentCalories: surplusCalories 
      };
    } else {
      // deficit
      const deficitCalories = Math.round(tdee * adjustmentPercent);
      return { 
        targetCalories: tdee - deficitCalories, 
        adjustmentCalories: -deficitCalories 
      };
    }
  }

  /**
   * Calculate macros for body fat goal
   * Dynamically determines deficit based on current/target BF% and timeline
   */
  private async calculateBodyFatGoalMacros(
    metrics: UserMetrics,
    maintenanceCalories: MaintenanceCalories,
    bodyFatGoal: BodyFatGoal,
    timelineWeeks: number,
    proteinMultiplier?: number,
    fatMultiplier?: number
  ): Promise<MacroTargets> {
    const { currentBf, targetBf } = bodyFatGoal;
    const tdee = maintenanceCalories.tdee;
    const weightKg = metrics.weightKg;

    // Calculate fat mass to lose/gain
    const currentFatMass = weightKg * (currentBf / 100);
    const targetFatMass = weightKg * (targetBf / 100);
    const fatMassChange = currentFatMass - targetFatMass; // Positive = loss, negative = gain

    // Determine if this is fat loss or gain
    const isLosing = fatMassChange > 0;

    // Calculate required weekly change
    const weeklyFatChange = fatMassChange / timelineWeeks;
    const weeklyCalorieChange = weeklyFatChange * 7700; // 7700 kcal per kg fat
    const dailyCalorieChange = weeklyCalorieChange / 7;

    // Calculate adjustment percentage
    let adjustmentPercent = dailyCalorieChange / tdee;
    
    // Clamp to safe ranges
    if (isLosing) {
      adjustmentPercent = Math.min(adjustmentPercent, 0.30); // Max 30% deficit
    } else {
      adjustmentPercent = Math.max(adjustmentPercent, -0.20); // Max 20% surplus
    }

    const targetCalories = Math.round(tdee - (tdee * adjustmentPercent));
    const adjustmentCalories = Math.round(tdee * adjustmentPercent);

    // Determine protein and fat targets based on deficit magnitude
    let proteinPerKg: number;
    let fatPerKg: number;

    if (isLosing) {
      // Higher protein for fat loss to preserve muscle
      if (adjustmentPercent > 0.25) {
        proteinPerKg = proteinMultiplier || 2.5; // Aggressive cut
        fatPerKg = fatMultiplier || 0.7;
      } else if (adjustmentPercent > 0.15) {
        proteinPerKg = proteinMultiplier || 2.2; // Moderate cut
        fatPerKg = fatMultiplier || 0.8;
      } else {
        proteinPerKg = proteinMultiplier || 2.0; // Conservative cut
        fatPerKg = fatMultiplier || 0.9;
      }
    } else {
      // Building phase - moderate protein
      proteinPerKg = proteinMultiplier || 1.8;
      fatPerKg = fatMultiplier || 1.0;
    }

    const protein = Math.round(weightKg * proteinPerKg * 10) / 10;
    const fat = Math.round(weightKg * fatPerKg * 10) / 10;

    // Carbs fill remaining calories
    const proteinCalories = protein * 4;
    const fatCalories = fat * 9;
    const remainingCalories = Math.max(targetCalories - proteinCalories - fatCalories, 0);
    const carbs = Math.round((remainingCalories / 4) * 10) / 10;

    // Generate detailed reasoning
    const reasoning = this.generateBodyFatGoalReasoning(
      currentBf,
      targetBf,
      timelineWeeks,
      fatMassChange,
      weeklyFatChange,
      adjustmentPercent,
      tdee,
      targetCalories,
      proteinPerKg,
      fatPerKg,
      weightKg
    );

    return {
      calories: Math.round(targetCalories),
      protein,
      proteinPerKg,
      fat,
      fatPerKg,
      carbs,
      carbPercentage: Math.round((carbs * 4 / targetCalories) * 100),
      sources: [
        'Helms et al. (2014) - Evidence-based contest preparation',
        'Body fat goal calculation based on 7700 kcal/kg fat'
      ],
      reasoning,
    };
  }

  /**
   * Generate reasoning for goal category macros
   */
  private generateCategoryMacroReasoning(
    goalCategory: GoalCategory,
    weightKg: number,
    proteinPerKg: number,
    fatPerKg: number,
    tdee: number,
    targetCalories: number,
    adjustmentCalories: number
  ): string {
    const lines: string[] = [];
    const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];
    const goalLabel = goalCategory.replace(/_/g, ' ');

    lines.push(`Goal: ${goalLabel}`);
    lines.push(`Maintenance (TDEE): ${tdee} kcal/day`);

    if (adjustmentCalories !== 0) {
      const sign = adjustmentCalories > 0 ? '+' : '';
      const percentChange = Math.round(Math.abs(adjustmentCalories) / tdee * 100);
      lines.push(`Adjustment: ${sign}${adjustmentCalories} kcal/day (${percentChange}% ${adjustment.type})`);
    }

    lines.push(`Target: ${targetCalories} kcal/day`);
    lines.push(`Protein: ${proteinPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * proteinPerKg)}g`);
    lines.push(`Fat: ${fatPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * fatPerKg)}g`);
    lines.push(`Carbs: Remainder after protein/fat allocation`);

    return lines.join('\n');
  }

  /**
   * Generate detailed reasoning for body fat goal
   */
  private generateBodyFatGoalReasoning(
    currentBf: number,
    targetBf: number,
    timelineWeeks: number,
    fatMassChange: number,
    weeklyFatChange: number,
    adjustmentPercent: number,
    tdee: number,
    targetCalories: number,
    proteinPerKg: number,
    fatPerKg: number,
    weightKg: number
  ): string {
    const lines: string[] = [];
    const isLosing = fatMassChange > 0;

    lines.push(`Body Fat Goal: ${currentBf}% → ${targetBf}%`);
    lines.push(`Timeline: ${timelineWeeks} weeks`);
    lines.push(`Fat mass to ${isLosing ? 'lose' : 'gain'}: ${Math.abs(fatMassChange).toFixed(1)} kg`);
    lines.push(`Weekly target: ${Math.abs(weeklyFatChange).toFixed(2)} kg/week`);
    lines.push('');
    lines.push(`Maintenance (TDEE): ${tdee} kcal/day`);
    
    const sign = isLosing ? '-' : '+';
    const percentChange = Math.round(Math.abs(adjustmentPercent) * 100);
    lines.push(`Calculated ${isLosing ? 'deficit' : 'surplus'}: ${sign}${percentChange}%`);
    lines.push(`Target: ${targetCalories} kcal/day`);
    lines.push('');
    lines.push(`Protein: ${proteinPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * proteinPerKg)}g`);
    lines.push(`Fat: ${fatPerKg}g/kg × ${weightKg}kg = ${Math.round(weightKg * fatPerKg)}g`);

    // Add feasibility notes
    const weeklyPercentChange = (Math.abs(weeklyFatChange) / weightKg) * 100;
    if (weeklyPercentChange > 1) {
      lines.push('');
      lines.push(`⚠️ Warning: Weekly loss rate (${weeklyPercentChange.toFixed(1)}% BW) exceeds safe maximum of 1%`);
      lines.push('Consider extending timeline for sustainable results');
    }

    return lines.join('\n');
  }

  /**
   * Collect sources for goal category
   */
  private collectGoalCategorySources(goalCategory: GoalCategory): string[] {
    const sources: string[] = [];

    switch (goalCategory) {
      case 'lean_bulk':
      case 'dirty_bulk':
        sources.push('Slater & Phillips (2011) - Nutrition guidelines for strength sports');
        break;
      case 'mini_cut':
        sources.push('Trexler et al. (2014) - Metabolic adaptation to weight loss');
        break;
      case 'aggressive_cut':
        sources.push('Helms et al. (2014) - Evidence-based recommendations for contest preparation');
        break;
      case 'recomp':
        sources.push('Barakat et al. (2020) - Body Recomposition');
        break;
      case 'maintenance':
        sources.push('ACSM Guidelines for Exercise and Nutrition');
        break;
    }

    // Add common sources
    sources.push('Morton et al. (2018) - Protein intake for muscle hypertrophy');

    return sources;
  }

  /**
   * Calculate body fat goal feasibility
   * Returns warnings if the goal is too aggressive
   */
  calculateBodyFatGoalFeasibility(
    weightKg: number,
    currentBf: number,
    targetBf: number,
    timelineWeeks: number,
    sex: 'male' | 'female' = 'male'
  ): {
    feasible: boolean;
    feasibility: 'easy' | 'moderate' | 'aggressive' | 'unsafe';
    fatToChange: number;
    weeklyChange: number;
    recommendedWeeks: number;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Essential body fat minimums
    const essentialBf = sex === 'female' ? 13 : 5;
    const athleteBf = sex === 'female' ? 17 : 10;

    // Check target validity
    if (targetBf < essentialBf) {
      warnings.push(`Target ${targetBf}% is below essential body fat (${essentialBf}%)`);
      recommendations.push(`Minimum safe target: ${essentialBf + 2}%`);
    }

    if (targetBf < athleteBf && targetBf >= essentialBf) {
      warnings.push(`Target ${targetBf}% is athlete-level and may be difficult to maintain`);
    }

    // Calculate change required
    const currentFatMass = weightKg * (currentBf / 100);
    const targetFatMass = weightKg * (targetBf / 100);
    const fatToChange = currentFatMass - targetFatMass;
    const isLosing = fatToChange > 0;

    // Weekly change rate
    const weeklyChange = fatToChange / timelineWeeks;
    const weeklyChangePercent = (Math.abs(weeklyChange) / weightKg) * 100;

    // Recommended timeline (0.5-1% BW/week for fat loss)
    const conservativeWeeklyLoss = weightKg * 0.005;
    const aggressiveWeeklyLoss = weightKg * 0.01;
    const recommendedWeeks = isLosing 
      ? Math.ceil(Math.abs(fatToChange) / aggressiveWeeklyLoss)
      : Math.ceil(Math.abs(fatToChange) / (weightKg * 0.005)); // Slower for gain

    // Determine feasibility
    let feasibility: 'easy' | 'moderate' | 'aggressive' | 'unsafe';
    let feasible = true;

    if (!isLosing) {
      // Gaining fat (unusual but possible)
      feasibility = 'moderate';
      warnings.push('Goal requires gaining body fat - unusual goal');
    } else if (weeklyChangePercent <= 0.5) {
      feasibility = 'easy';
    } else if (weeklyChangePercent <= 0.75) {
      feasibility = 'moderate';
    } else if (weeklyChangePercent <= 1.0) {
      feasibility = 'aggressive';
      warnings.push('Aggressive timeline - requires strict adherence');
      recommendations.push('Higher protein intake recommended (2.3-2.7g/kg)');
    } else {
      feasibility = 'unsafe';
      feasible = false;
      warnings.push(`Weekly loss rate ${weeklyChangePercent.toFixed(1)}% exceeds safe maximum of 1%`);
      recommendations.push(`Extend timeline to at least ${recommendedWeeks} weeks`);
    }

    // Check for unrealistic target
    if (currentBf <= targetBf && isLosing) {
      feasible = false;
      feasibility = 'unsafe';
      warnings.push('Target body fat is higher than or equal to current');
    }

    return {
      feasible,
      feasibility,
      fatToChange: Math.round(fatToChange * 10) / 10,
      weeklyChange: Math.round(weeklyChange * 100) / 100,
      recommendedWeeks,
      warnings,
      recommendations,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================


  /**
   * Validate user metrics for calculation
   */
  validateMetrics(metrics: UserMetrics): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (metrics.weightKg <= 0 || metrics.weightKg > 300) {
      errors.push('Weight must be between 0 and 300 kg');
    }
    if (metrics.heightCm <= 0 || metrics.heightCm > 250) {
      errors.push('Height must be between 0 and 250 cm');
    }
    if (metrics.age <= 0 || metrics.age > 120) {
      errors.push('Age must be between 0 and 120 years');
    }
    if (metrics.bodyFat !== undefined && (metrics.bodyFat < 3 || metrics.bodyFat > 50)) {
      errors.push('Body fat percentage must be between 3% and 50%');
    }

    return { valid: errors.length === 0, errors };
  }
}

// Export singleton instance
export const nutritionCalculationService = new NutritionCalculationService();
