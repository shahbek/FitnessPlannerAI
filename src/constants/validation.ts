/**
 * Validation Constants
 * 
 * Centralized validation thresholds for nutrition and fitness plan generation.
 * These constants ensure consistency across all validation layers.
 * 
 * PROTEIN IS CRITICAL:
 * - Protein targets are the MOST important macro for muscle retention
 * - Deficits below target are NOT acceptable
 * - We have different tolerances at different stages:
 *   - Generation: Allows slight variance (10%) during meal creation
 *   - Validation: Flags discrepancies but allows small absolute tolerance
 *   - Reconciliation: ZERO tolerance - any deficit must be fixed
 */

// ============================================================================
// GENERATION TOLERANCES
// Used during meal/plan generation - slightly permissive to allow optimization
// ============================================================================

export const GENERATION_TOLERANCES = {
  /**
   * Calorie tolerance during generation (5%)
   * Allows meal optimizer to work within reasonable bounds
   */
  CALORIE_PERCENTAGE: 0.05,

  /**
   * Protein tolerance during generation (10%)
   * IMPORTANT: This is the MAXIMUM acceptable variance during generation
   * The reconciliation service will still attempt to hit exact targets
   */
  PROTEIN_PERCENTAGE: 0.10,

  /**
   * Carbohydrate tolerance during generation (15%)
   * Carbs are more flexible as they primarily affect energy, not muscle
   */
  CARBS_PERCENTAGE: 0.15,

  /**
   * Fat tolerance during generation (15%)
   * Fats are flexible as long as minimum essential fats are met
   */
  FAT_PERCENTAGE: 0.15,
} as const;

// ============================================================================
// VALIDATION TOLERANCES
// Used during plan consistency validation - flags discrepancies
// ============================================================================

export const VALIDATION_TOLERANCES = {
  /**
   * Calorie tolerance for validation (±5 calories)
   */
  CALORIE_ABSOLUTE: 5,

  /**
   * Protein tolerance for validation (±2g)
   * STRICTER than other macros due to importance for muscle retention
   * Evidence: Helms et al. (2014) - protein is critical during deficit
   */
  PROTEIN_ABSOLUTE: 2,

  /**
   * General percentage tolerance for validation (1%)
   */
  PERCENTAGE: 0.01,
} as const;

// ============================================================================
// RECONCILIATION TOLERANCES
// Used during plan reconciliation - attempts to fix all discrepancies
// ============================================================================

export const RECONCILIATION_TOLERANCES = {
  /**
   * Protein: ZERO TOLERANCE
   * Any protein deficit MUST be fixed - add supplements if needed
   * This ensures users always meet their muscle-sparing protein targets
   */
  PROTEIN: 0,

  /**
   * Calorie tolerance for reconciliation (±5 calories)
   */
  CALORIE: 5,

  /**
   * Carb tolerance for reconciliation (±5g)
   */
  CARBS: 5,

  /**
   * Fat tolerance for reconciliation (±3g)
   */
  FAT: 3,
} as const;

// ============================================================================
// HARD FAILURE THRESHOLDS
// If these are exceeded, generation MUST fail - not continue
// ============================================================================

export const HARD_FAILURE_THRESHOLDS = {
  /**
   * If protein is more than 10% below target, fail the generation
   * This prevents invalid plans from being saved
   */
  PROTEIN_DEFICIT_PERCENTAGE: 0.10,

  /**
   * If calories are more than 15% off target, flag as error
   */
  CALORIE_DEVIATION_PERCENTAGE: 0.15,

  /**
   * Minimum protein per kg bodyweight (absolute floor)
   * Based on: Helms et al. (2014) - minimum for muscle retention
   */
  MIN_PROTEIN_PER_KG: 1.6,
} as const;

// ============================================================================
// CARDIO REQUIREMENTS
// Cardio is MANDATORY for all fitness plans
// ============================================================================

export const CARDIO_REQUIREMENTS = {
  /**
   * Minimum cardio sessions per week
   */
  MIN_SESSIONS_PER_WEEK: 2,

  /**
   * Minimum duration per session (minutes)
   */
  MIN_DURATION_MINUTES: 20,

  /**
   * Valid intensity levels
   */
  VALID_INTENSITIES: ['Very Low', 'Low', 'Moderate', 'High', 'Very High', 'Variable'] as const,

  /**
   * Valid phase names (MUST be lowercase)
   */
  VALID_PHASES: ['foundation', 'progression', 'peak'] as const,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a value is within tolerance of a target
 */
export function isWithinTolerance(
  actual: number,
  target: number,
  toleranceAbsolute: number,
  tolerancePercentage?: number
): boolean {
  const absoluteDiff = Math.abs(actual - target);
  
  if (absoluteDiff <= toleranceAbsolute) {
    return true;
  }
  
  if (tolerancePercentage !== undefined && target > 0) {
    const percentageDiff = absoluteDiff / target;
    return percentageDiff <= tolerancePercentage;
  }
  
  return false;
}

/**
 * Check if protein is below target (CRITICAL - never acceptable)
 */
export function isProteinBelowTarget(actual: number, target: number): boolean {
  return actual < target;
}

/**
 * Get protein deficit severity
 */
export function getProteinDeficitSeverity(
  actual: number,
  target: number
): 'ok' | 'warning' | 'critical' {
  if (actual >= target) return 'ok';
  
  const deficit = target - actual;
  const deficitPercentage = deficit / target;
  
  if (deficitPercentage > HARD_FAILURE_THRESHOLDS.PROTEIN_DEFICIT_PERCENTAGE) {
    return 'critical';
  }
  
  if (deficit > VALIDATION_TOLERANCES.PROTEIN_ABSOLUTE) {
    return 'warning';
  }
  
  return 'ok';
}

