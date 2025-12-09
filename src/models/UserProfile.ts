// User Profile Model
// Defines the structure for user input data

/**
 * Goal categories supported by the system
 * 
 * - lean_bulk: Conservative surplus (5-10%), minimize fat gain
 * - dirty_bulk: Aggressive surplus (15-20%), maximize muscle gain
 * - mini_cut: Short cutting phase (2-6 weeks), 15-20% deficit
 * - aggressive_cut: Fast fat loss (25-30% deficit), requires high protein
 * - recomp: Body recomposition at maintenance calories
 * - maintenance: Maintain current physique at TDEE
 * - body_fat_goal: Specific body fat percentage target (mutually exclusive with other goals)
 */
export type GoalCategory = 
  | 'lean_bulk' 
  | 'dirty_bulk' 
  | 'mini_cut' 
  | 'aggressive_cut' 
  | 'recomp' 
  | 'maintenance'
  | 'body_fat_goal';

/**
 * Body fat goal configuration
 * Only used when goalCategory === 'body_fat_goal'
 */
export interface BodyFatGoal {
  currentBf: number;  // Current body fat percentage
  targetBf: number;   // Target body fat percentage
}

/**
 * Legacy goal type for backward compatibility
 * @deprecated Use GoalCategory instead
 */
export type LegacyGoal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'strength' | 'endurance';

export interface UserProfile {
  // Basic Information
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  
  /**
   * Current body fat percentage (optional, improves BMR accuracy)
   * Note: For body_fat_goal mode, use bodyFatGoal.currentBf instead
   */
  bodyFat?: number;

  // Goals and Preferences
  /**
   * New goal category system
   * When set to 'body_fat_goal', bodyFatGoal must also be provided.
   * Optional for backward compatibility - will be derived from legacy `goal` field if not set.
   */
  goalCategory?: GoalCategory;
  
  /**
   * Body fat goal configuration
   * Required when goalCategory === 'body_fat_goal'
   */
  bodyFatGoal?: BodyFatGoal;
  
  /**
   * @deprecated Use goalCategory instead. Kept for backward compatibility.
   * When goalCategory is not set, this is used to derive the effective goal.
   */
  goal?: LegacyGoal;
  
  /**
   * @deprecated Use bodyFatGoal.targetBf instead when goalCategory === 'body_fat_goal'
   */
  targetBf?: number;
  
  timelineWeeks: number;
  preferences: string; // Dietary preferences and restrictions
  mealFrequency?: number; // Meals per day

  // Training Information
  workoutLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  workoutSplit: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'body_part' | 'custom';
  trainingDaysPerWeek: number;
  equipment: 'gym_membership' | 'home_gym' | 'home_gym_advanced' | 'bodyweight' | 'calisthenics' | 'minimal_equipment' | 'minimal';
  activityLevel?: string;
  schedule?: string; // User's available training times (e.g., "Monday-Friday: 6-7 AM")

  // API Configuration
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

export interface NormalizedUserProfile extends UserProfile {
  // Normalized values
  lbm: number; // Lean body mass
  bmi: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

  // Parsed preferences
  dietaryConstraints: {
    include: string[];
    exclude: string[];
    macroAdjustments: {
      carbs: string;
      protein: string;
      fat: string;
    };
    notes: string;
  };
}

/**
 * Helper to convert legacy goal to new GoalCategory
 * Used for backward compatibility during migration
 */
export function legacyGoalToCategory(goal: LegacyGoal, deficitMagnitude?: 'conservative' | 'moderate' | 'aggressive'): GoalCategory {
  switch (goal) {
    case 'fat_loss':
      return deficitMagnitude === 'aggressive' ? 'aggressive_cut' : 'mini_cut';
    case 'muscle_gain':
      return deficitMagnitude === 'aggressive' ? 'dirty_bulk' : 'lean_bulk';
    case 'maintenance':
      return 'maintenance';
    case 'strength':
      return 'lean_bulk'; // Strength training typically needs a surplus
    case 'endurance':
      return 'recomp'; // Endurance athletes often do well with recomp
    default:
      return 'maintenance';
  }
}

/**
 * Helper to get effective goal type for calculations
 * Returns 'fat_loss', 'muscle_gain', or 'maintenance'
 */
export function getEffectiveGoalType(goalCategory: GoalCategory): 'fat_loss' | 'muscle_gain' | 'maintenance' {
  switch (goalCategory) {
    case 'lean_bulk':
    case 'dirty_bulk':
      return 'muscle_gain';
    case 'mini_cut':
    case 'aggressive_cut':
    case 'body_fat_goal': // Body fat goals typically involve fat loss
      return 'fat_loss';
    case 'recomp':
    case 'maintenance':
      return 'maintenance';
    default:
      return 'maintenance';
  }
}

/**
 * Check if a goal category requires body fat inputs
 */
export function requiresBodyFatInput(goalCategory: GoalCategory): boolean {
  return goalCategory === 'body_fat_goal';
}

/**
 * Get human-readable label for goal category
 */
export function getGoalCategoryLabel(goalCategory: GoalCategory): string {
  const labels: Record<GoalCategory, string> = {
    lean_bulk: 'Lean Bulk',
    dirty_bulk: 'Aggressive Bulk',
    mini_cut: 'Mini Cut',
    aggressive_cut: 'Aggressive Cut',
    recomp: 'Body Recomposition',
    maintenance: 'Maintenance',
    body_fat_goal: 'Body Fat Goal'
  };
  return labels[goalCategory] || goalCategory;
}

/**
 * Get description for goal category
 */
export function getGoalCategoryDescription(goalCategory: GoalCategory): string {
  const descriptions: Record<GoalCategory, string> = {
    lean_bulk: 'Build muscle with minimal fat gain (5-10% surplus)',
    dirty_bulk: 'Maximum muscle gain, accepting fat gain (15-20% surplus)',
    mini_cut: 'Short 2-6 week cut between bulk phases (15-20% deficit)',
    aggressive_cut: 'Fast fat loss for experienced dieters (25-30% deficit)',
    recomp: 'Lose fat and gain muscle at maintenance calories',
    maintenance: 'Maintain current physique at TDEE',
    body_fat_goal: 'Target a specific body fat percentage'
  };
  return descriptions[goalCategory] || '';
}
