// Goal Strategy Knowledge Base
// Evidence-based facts about goal categories, caloric strategies, and body composition targets

import { ResearchFact } from '@/ai/knowledgeBase';

/**
 * Goal categories supported by the system
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
 * Extended research fact with goal-specific metadata
 */
export interface GoalResearchFact extends ResearchFact {
  goalCategory: GoalCategory | GoalCategory[];
  calorieAdjustment: {
    type: 'surplus' | 'deficit' | 'maintenance' | 'dynamic';
    percentageRange: { min: number; max: number };
  };
  weeklyTargets: {
    weightChange: { min: number; max: number; units: string }; // % of bodyweight
    fatLoss?: { min: number; max: number; units: string };
    muscleGain?: { min: number; max: number; units: string };
  };
  proteinRequirement: {
    min: number;
    max: number;
    units: string; // g/kg
  };
  constraints?: {
    minBodyFat?: number;
    maxBodyFat?: number;
    minExperience?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    maxTimelineWeeks?: number;
    minTimelineWeeks?: number;
  };
  bestFor: string[];
  warnings?: string[];
}

/**
 * Goal Strategy Knowledge Base
 * Evidence-based recommendations for each goal category
 */
export const GOAL_STRATEGY_KNOWLEDGE_BASE: GoalResearchFact[] = [
  // ============================================================================
  // LEAN BULK
  // ============================================================================
  {
    id: 'lean_bulk_strategy',
    content: 'Lean bulking uses a conservative caloric surplus of 5-10% above TDEE to maximize muscle gain while minimizing fat accumulation. This approach typically yields 0.25-0.5% bodyweight gain per week, with the majority being lean mass when combined with progressive resistance training.',
    category: 'nutrition',
    confidence: 0.92,
    source: 'Slater & Phillips, 2011 - Nutrition guidelines for strength sports',
    authors: ['Gary Slater', 'Stuart M. Phillips'],
    year: 2011,
    studyType: 'review',
    formulas: [
      'Surplus = TDEE × 0.05 to 0.10',
      'Weekly gain target = 0.25-0.5% bodyweight'
    ],
    dataPoints: [
      { description: 'Minimum surplus percentage', value: 5, units: '%', context: 'lean_bulk' },
      { description: 'Maximum surplus percentage', value: 10, units: '%', context: 'lean_bulk' },
      { description: 'Weekly weight gain rate', value: 0.375, units: '% BW/week', context: 'lean_bulk' }
    ],
    goalCategory: 'lean_bulk',
    calorieAdjustment: {
      type: 'surplus',
      percentageRange: { min: 0.05, max: 0.10 }
    },
    weeklyTargets: {
      weightChange: { min: 0.25, max: 0.5, units: '% BW/week' },
      muscleGain: { min: 0.1, max: 0.25, units: 'kg/week' }
    },
    proteinRequirement: {
      min: 1.6,
      max: 2.2,
      units: 'g/kg'
    },
    constraints: {
      minExperience: 'beginner'
    },
    bestFor: [
      'Intermediate to advanced lifters',
      'Those wanting to minimize fat gain',
      'Longer-term muscle building phases (12-20 weeks)',
      'Aesthetic-focused athletes'
    ],
    warnings: [
      'Progress may feel slow compared to aggressive bulking',
      'Requires accurate calorie tracking for optimal results'
    ]
  },
  {
    id: 'lean_bulk_protein',
    content: 'During lean bulking, protein intake of 1.6-2.2g/kg bodyweight optimizes muscle protein synthesis while allowing sufficient carbohydrate intake for training performance. Higher protein intakes show diminishing returns for muscle gain.',
    category: 'nutrition',
    confidence: 0.94,
    source: 'Morton et al., 2018 - A systematic review of protein intake for muscle hypertrophy',
    authors: ['Robert W. Morton', 'Kevin T. Murphy', 'Sean R. McKellar'],
    year: 2018,
    studyType: 'meta_analysis',
    formulas: ['Optimal protein = 1.6-2.2g × bodyweight (kg)'],
    dataPoints: [
      { description: 'Minimum effective protein', value: 1.6, units: 'g/kg', context: 'hypertrophy' },
      { description: 'Optimal protein ceiling', value: 2.2, units: 'g/kg', context: 'hypertrophy' }
    ],
    goalCategory: 'lean_bulk',
    calorieAdjustment: {
      type: 'surplus',
      percentageRange: { min: 0.05, max: 0.10 }
    },
    weeklyTargets: {
      weightChange: { min: 0.25, max: 0.5, units: '% BW/week' }
    },
    proteinRequirement: {
      min: 1.6,
      max: 2.2,
      units: 'g/kg'
    },
    bestFor: ['Muscle gain optimization', 'Long-term body composition improvement']
  },

  // ============================================================================
  // DIRTY BULK
  // ============================================================================
  {
    id: 'dirty_bulk_strategy',
    content: 'Aggressive bulking (dirty bulk) uses a 15-20% caloric surplus to maximize muscle gain rate. While this approach builds muscle faster, it also accumulates more fat, typically requiring a longer cutting phase afterward. Best suited for underweight individuals or those prioritizing strength over aesthetics.',
    category: 'nutrition',
    confidence: 0.85,
    source: 'Garthe et al., 2013 - Effect of nutritional intervention on body composition and performance',
    authors: ['Ina Garthe', 'Truls Raastad', 'Jorunn Sundgot-Borgen'],
    year: 2013,
    studyType: 'rct',
    formulas: [
      'Surplus = TDEE × 0.15 to 0.20',
      'Weekly gain target = 0.5-0.75% bodyweight'
    ],
    dataPoints: [
      { description: 'Minimum surplus percentage', value: 15, units: '%', context: 'dirty_bulk' },
      { description: 'Maximum surplus percentage', value: 20, units: '%', context: 'dirty_bulk' },
      { description: 'Weekly weight gain rate', value: 0.625, units: '% BW/week', context: 'dirty_bulk' }
    ],
    goalCategory: 'dirty_bulk',
    calorieAdjustment: {
      type: 'surplus',
      percentageRange: { min: 0.15, max: 0.20 }
    },
    weeklyTargets: {
      weightChange: { min: 0.5, max: 0.75, units: '% BW/week' },
      muscleGain: { min: 0.15, max: 0.35, units: 'kg/week' }
    },
    proteinRequirement: {
      min: 1.6,
      max: 2.0,
      units: 'g/kg'
    },
    constraints: {
      maxBodyFat: 20 // Don't dirty bulk if already above 20% BF
    },
    bestFor: [
      'Underweight individuals',
      'Hardgainers with fast metabolism',
      'Strength athletes prioritizing performance',
      'Off-season powerlifters/strongman'
    ],
    warnings: [
      'Will accumulate significant fat alongside muscle',
      'May require extended cutting phase afterward',
      'Not recommended for those already above 20% body fat',
      'Higher risk of developing insulin resistance with prolonged use'
    ]
  },

  // ============================================================================
  // MINI CUT
  // ============================================================================
  {
    id: 'mini_cut_strategy',
    content: 'Mini cuts are short, aggressive cutting phases (2-6 weeks) using a 15-20% caloric deficit to quickly reduce body fat accumulated during bulking. The short duration minimizes metabolic adaptation and muscle loss while resetting insulin sensitivity.',
    category: 'nutrition',
    confidence: 0.88,
    source: 'Trexler et al., 2014 - Metabolic adaptation to weight loss',
    authors: ['Eric T. Trexler', 'Abbie E. Smith-Ryan', 'Layne E. Norton'],
    year: 2014,
    studyType: 'review',
    formulas: [
      'Deficit = TDEE × 0.15 to 0.20',
      'Duration = 2-6 weeks maximum'
    ],
    dataPoints: [
      { description: 'Minimum deficit percentage', value: 15, units: '%', context: 'mini_cut' },
      { description: 'Maximum deficit percentage', value: 20, units: '%', context: 'mini_cut' },
      { description: 'Maximum duration', value: 6, units: 'weeks', context: 'mini_cut' },
      { description: 'Weekly fat loss rate', value: 0.625, units: '% BW/week', context: 'mini_cut' }
    ],
    goalCategory: 'mini_cut',
    calorieAdjustment: {
      type: 'deficit',
      percentageRange: { min: 0.15, max: 0.20 }
    },
    weeklyTargets: {
      weightChange: { min: -0.75, max: -0.5, units: '% BW/week' },
      fatLoss: { min: 0.3, max: 0.5, units: 'kg/week' }
    },
    proteinRequirement: {
      min: 2.0,
      max: 2.4,
      units: 'g/kg'
    },
    constraints: {
      maxTimelineWeeks: 6,
      minTimelineWeeks: 2,
      minBodyFat: 12 // Don't mini cut if already lean
    },
    bestFor: [
      'Between bulk phases to reset body fat',
      'Maintaining insulin sensitivity during long bulks',
      'Quick aesthetic improvements before events',
      'Intermediate to advanced lifters'
    ],
    warnings: [
      'Not suitable for extended fat loss goals',
      'Requires higher protein to preserve muscle',
      'Should transition to maintenance or bulk afterward, not another cut'
    ]
  },

  // ============================================================================
  // AGGRESSIVE CUT
  // ============================================================================
  {
    id: 'aggressive_cut_strategy',
    content: 'Aggressive cutting uses a 25-30% caloric deficit for rapid fat loss at approximately 1% bodyweight per week. This approach requires very high protein intake (2.3-3.1g/kg) and resistance training to preserve muscle mass. Not sustainable long-term due to metabolic adaptation.',
    category: 'nutrition',
    confidence: 0.91,
    source: 'Helms et al., 2014 - Evidence-based recommendations for natural bodybuilding contest preparation',
    authors: ['Eric R. Helms', 'Alan A. Aragon', 'Peter J. Fitschen'],
    year: 2014,
    studyType: 'review',
    formulas: [
      'Deficit = TDEE × 0.25 to 0.30',
      'Weekly loss target = 1% bodyweight',
      'Protein = 2.3-3.1g/kg lean body mass'
    ],
    dataPoints: [
      { description: 'Minimum deficit percentage', value: 25, units: '%', context: 'aggressive_cut' },
      { description: 'Maximum deficit percentage', value: 30, units: '%', context: 'aggressive_cut' },
      { description: 'Weekly fat loss rate', value: 1.0, units: '% BW/week', context: 'aggressive_cut' },
      { description: 'Minimum protein for muscle preservation', value: 2.3, units: 'g/kg LBM', context: 'aggressive_cut' }
    ],
    goalCategory: 'aggressive_cut',
    calorieAdjustment: {
      type: 'deficit',
      percentageRange: { min: 0.25, max: 0.30 }
    },
    weeklyTargets: {
      weightChange: { min: -1.0, max: -0.75, units: '% BW/week' },
      fatLoss: { min: 0.5, max: 0.8, units: 'kg/week' }
    },
    proteinRequirement: {
      min: 2.3,
      max: 2.7,
      units: 'g/kg'
    },
    constraints: {
      minBodyFat: 15, // Don't aggressive cut if already lean
      maxTimelineWeeks: 12
    },
    bestFor: [
      'Contest prep final phases',
      'Those with higher body fat (>20%)',
      'Time-constrained fat loss goals',
      'Experienced dieters who can handle aggressive deficits'
    ],
    warnings: [
      'Higher risk of muscle loss without proper protein and training',
      'Metabolic adaptation occurs faster',
      'May require diet breaks every 6-8 weeks',
      'Not recommended for beginners or those below 15% body fat',
      'Can negatively impact hormones, sleep, and performance'
    ]
  },

  // ============================================================================
  // RECOMPOSITION
  // ============================================================================
  {
    id: 'recomp_strategy',
    content: 'Body recomposition aims to simultaneously lose fat and gain muscle at maintenance calories. Most effective for beginners, detrained individuals, or those with higher body fat. Progress is slower but sustainable, with body composition improving while weight stays relatively stable.',
    category: 'nutrition',
    confidence: 0.86,
    source: 'Barakat et al., 2020 - Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time?',
    authors: ['Christopher Barakat', 'Jeremy Pearson', 'Guillermo Escalante'],
    year: 2020,
    studyType: 'review',
    formulas: [
      'Calories = TDEE (maintenance)',
      'Protein = 2.0-2.4g/kg for optimal recomp'
    ],
    dataPoints: [
      { description: 'Caloric adjustment', value: 0, units: '%', context: 'recomp' },
      { description: 'Protein requirement', value: 2.2, units: 'g/kg', context: 'recomp' }
    ],
    goalCategory: 'recomp',
    calorieAdjustment: {
      type: 'maintenance',
      percentageRange: { min: -0.05, max: 0.05 }
    },
    weeklyTargets: {
      weightChange: { min: -0.1, max: 0.1, units: '% BW/week' }
    },
    proteinRequirement: {
      min: 2.0,
      max: 2.4,
      units: 'g/kg'
    },
    constraints: {
      minBodyFat: 12 // Recomp works better with some fat to lose
    },
    bestFor: [
      'Beginners with newbie gains potential',
      'Detrained individuals returning to training',
      'Those with moderate to high body fat (15-25%)',
      'People who want to maintain weight while improving composition',
      'Those who struggle with restrictive dieting'
    ],
    warnings: [
      'Progress is slower and harder to measure on the scale',
      'Less effective for lean, trained individuals',
      'Requires patience and consistent training',
      'May need to eventually commit to a dedicated bulk or cut for further progress'
    ]
  },

  // ============================================================================
  // MAINTENANCE
  // ============================================================================
  {
    id: 'maintenance_strategy',
    content: 'Maintenance phases involve eating at TDEE to maintain current body weight and composition. Essential for metabolic recovery after cuts, solidifying gains after bulks, and as a lifestyle approach for those happy with their physique.',
    category: 'nutrition',
    confidence: 0.95,
    source: 'Trexler et al., 2014 - Metabolic adaptation to weight loss',
    authors: ['Eric T. Trexler', 'Abbie E. Smith-Ryan', 'Layne E. Norton'],
    year: 2014,
    studyType: 'review',
    formulas: ['Calories = TDEE'],
    dataPoints: [
      { description: 'Caloric adjustment', value: 0, units: '%', context: 'maintenance' }
    ],
    goalCategory: 'maintenance',
    calorieAdjustment: {
      type: 'maintenance',
      percentageRange: { min: 0, max: 0 }
    },
    weeklyTargets: {
      weightChange: { min: -0.1, max: 0.1, units: '% BW/week' }
    },
    proteinRequirement: {
      min: 1.6,
      max: 2.0,
      units: 'g/kg'
    },
    bestFor: [
      'Recovery after extended cuts',
      'Solidifying gains after bulking phases',
      'Lifestyle maintenance for those at goal physique',
      'Reverse dieting transitions',
      'During high-stress life periods'
    ],
    warnings: [
      'Ensure TDEE is accurately calculated for true maintenance',
      'Weight may fluctuate ±1-2kg due to water and glycogen'
    ]
  },

  // ============================================================================
  // BODY FAT GOAL
  // ============================================================================
  {
    id: 'body_fat_goal_strategy',
    content: 'Body fat goal mode dynamically calculates the required caloric deficit or surplus based on current vs target body fat percentage and timeline. Uses evidence-based fat loss rates (0.5-1% BW/week) to determine safe and achievable timelines.',
    category: 'nutrition',
    confidence: 0.90,
    source: 'Helms et al., 2014 - Evidence-based recommendations for natural bodybuilding contest preparation',
    authors: ['Eric R. Helms', 'Alan A. Aragon', 'Peter J. Fitschen'],
    year: 2014,
    studyType: 'review',
    formulas: [
      'Fat to lose (kg) = bodyweight × (current_bf - target_bf) / 100',
      'Minimum weeks = fat_to_lose / (bodyweight × 0.01)',
      'Deficit = calculated dynamically based on timeline'
    ],
    dataPoints: [
      { description: 'Safe weekly fat loss', value: 0.75, units: '% BW/week', context: 'body_fat_goal' },
      { description: 'Maximum sustainable deficit', value: 30, units: '%', context: 'body_fat_goal' }
    ],
    goalCategory: 'body_fat_goal',
    calorieAdjustment: {
      type: 'dynamic',
      percentageRange: { min: -0.30, max: 0.20 } // Can be deficit or surplus
    },
    weeklyTargets: {
      weightChange: { min: -1.0, max: 0.5, units: '% BW/week' }
    },
    proteinRequirement: {
      min: 2.0,
      max: 2.7,
      units: 'g/kg'
    },
    constraints: {
      minBodyFat: 5, // Essential body fat floor
      maxBodyFat: 45 // Upper limit for calculations
    },
    bestFor: [
      'Those with specific body fat targets',
      'Contest prep with deadline',
      'Photoshoot preparation',
      'Those who know their current and goal body fat'
    ],
    warnings: [
      'Requires accurate body fat measurement or estimation',
      'Very low body fat goals (<8% men, <16% women) may not be sustainable',
      'Timeline may need adjustment if too aggressive'
    ]
  },

  // ============================================================================
  // BODY FAT CONSTRAINTS
  // ============================================================================
  {
    id: 'body_fat_constraints',
    content: 'Body fat percentage constraints define safe ranges for different goal categories. Essential body fat (3-5% men, 10-13% women) should never be targeted. Athletes may sustain 6-13% men, 14-20% women. Fitness levels are 14-17% men, 21-24% women.',
    category: 'nutrition',
    confidence: 0.93,
    source: 'American Council on Exercise (ACE) Body Fat Categories',
    authors: ['American Council on Exercise'],
    year: 2021,
    studyType: 'consensus',
    formulas: [],
    dataPoints: [
      { description: 'Essential fat - men', value: 5, units: '% BF', context: 'minimum_safe' },
      { description: 'Essential fat - women', value: 13, units: '% BF', context: 'minimum_safe' },
      { description: 'Athletes - men', value: 10, units: '% BF', context: 'athletic' },
      { description: 'Athletes - women', value: 17, units: '% BF', context: 'athletic' },
      { description: 'Fitness - men', value: 15.5, units: '% BF', context: 'fitness' },
      { description: 'Fitness - women', value: 22.5, units: '% BF', context: 'fitness' }
    ],
    goalCategory: ['body_fat_goal', 'aggressive_cut', 'mini_cut'],
    calorieAdjustment: {
      type: 'dynamic',
      percentageRange: { min: -0.30, max: 0 }
    },
    weeklyTargets: {
      weightChange: { min: -1.0, max: 0, units: '% BW/week' }
    },
    proteinRequirement: {
      min: 2.0,
      max: 2.7,
      units: 'g/kg'
    },
    bestFor: ['Understanding safe body fat targets'],
    warnings: [
      'Below essential body fat is dangerous and unsustainable',
      'Very lean physiques require careful maintenance strategies'
    ]
  }
];

/**
 * Get goal strategy by category
 */
export function getGoalStrategy(category: GoalCategory): GoalResearchFact | undefined {
  return GOAL_STRATEGY_KNOWLEDGE_BASE.find(
    fact => fact.goalCategory === category || 
    (Array.isArray(fact.goalCategory) && fact.goalCategory.includes(category))
  );
}

/**
 * Get all facts for a goal category
 */
export function getGoalFacts(category: GoalCategory): GoalResearchFact[] {
  return GOAL_STRATEGY_KNOWLEDGE_BASE.filter(
    fact => fact.goalCategory === category ||
    (Array.isArray(fact.goalCategory) && fact.goalCategory.includes(category))
  );
}

/**
 * Search goal knowledge base by query
 */
export function searchGoalKnowledge(
  query: string,
  filters?: {
    goalCategory?: GoalCategory;
    calorieType?: 'surplus' | 'deficit' | 'maintenance' | 'dynamic';
  }
): GoalResearchFact[] {
  let results = GOAL_STRATEGY_KNOWLEDGE_BASE;

  // Text search
  if (query) {
    const queryLower = query.toLowerCase();
    results = results.filter(fact =>
      fact.content.toLowerCase().includes(queryLower) ||
      fact.id.toLowerCase().includes(queryLower) ||
      fact.bestFor.some(bf => bf.toLowerCase().includes(queryLower))
    );
  }

  // Apply filters
  if (filters) {
    if (filters.goalCategory) {
      results = results.filter(fact =>
        fact.goalCategory === filters.goalCategory ||
        (Array.isArray(fact.goalCategory) && fact.goalCategory.includes(filters.goalCategory!))
      );
    }

    if (filters.calorieType) {
      results = results.filter(fact =>
        fact.calorieAdjustment.type === filters.calorieType
      );
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get calorie adjustment recommendation for a goal category
 */
export function getCalorieAdjustment(
  category: GoalCategory
): { type: 'surplus' | 'deficit' | 'maintenance' | 'dynamic'; range: { min: number; max: number } } | null {
  const strategy = getGoalStrategy(category);
  if (!strategy) return null;

  return {
    type: strategy.calorieAdjustment.type,
    range: strategy.calorieAdjustment.percentageRange
  };
}

/**
 * Get protein requirement for a goal category
 */
export function getProteinRequirement(
  category: GoalCategory
): { min: number; max: number; units: string } | null {
  const strategy = getGoalStrategy(category);
  if (!strategy) return null;

  return strategy.proteinRequirement;
}

/**
 * Validate if a goal is appropriate for user's current state
 */
export function validateGoalForUser(
  category: GoalCategory,
  currentBodyFat?: number,
  targetBodyFat?: number,
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert',
  timelineWeeks?: number,
  sex?: 'male' | 'female'
): { valid: boolean; warnings: string[]; recommendations: string[] } {
  const strategy = getGoalStrategy(category);
  if (!strategy) {
    return { valid: false, warnings: ['Unknown goal category'], recommendations: [] };
  }

  const warnings: string[] = [];
  const recommendations: string[] = [];

  const constraints = strategy.constraints;

  if (constraints) {
    // Body fat constraints
    if (constraints.minBodyFat && currentBodyFat && currentBodyFat < constraints.minBodyFat) {
      warnings.push(
        `Current body fat (${currentBodyFat}%) is below recommended minimum (${constraints.minBodyFat}%) for ${category}`
      );
      recommendations.push('Consider maintenance or lean bulk instead');
    }

    if (constraints.maxBodyFat && currentBodyFat && currentBodyFat > constraints.maxBodyFat) {
      warnings.push(
        `Current body fat (${currentBodyFat}%) is above recommended maximum (${constraints.maxBodyFat}%) for ${category}`
      );
      if (category === 'dirty_bulk') {
        recommendations.push('Consider a cut or recomp first before aggressive bulking');
      }
    }

    // Experience level constraints
    if (constraints.minExperience && experienceLevel) {
      const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
      const userLevel = levels.indexOf(experienceLevel);
      const minLevel = levels.indexOf(constraints.minExperience);
      if (userLevel < minLevel) {
        warnings.push(
          `${category} is typically recommended for ${constraints.minExperience}+ level`
        );
      }
    }

    // Timeline constraints
    if (constraints.maxTimelineWeeks && timelineWeeks && timelineWeeks > constraints.maxTimelineWeeks) {
      warnings.push(
        `Timeline (${timelineWeeks} weeks) exceeds recommended maximum (${constraints.maxTimelineWeeks} weeks) for ${category}`
      );
      recommendations.push('Consider splitting into phases or choosing a different approach');
    }

    if (constraints.minTimelineWeeks && timelineWeeks && timelineWeeks < constraints.minTimelineWeeks) {
      warnings.push(
        `Timeline (${timelineWeeks} weeks) is below recommended minimum (${constraints.minTimelineWeeks} weeks) for ${category}`
      );
    }
  }

  // Body fat goal specific validation
  if (category === 'body_fat_goal' && targetBodyFat !== undefined) {
    const essentialBf = sex === 'female' ? 13 : 5;
    if (targetBodyFat < essentialBf) {
      warnings.push(
        `Target body fat (${targetBodyFat}%) is below essential body fat (${essentialBf}%) for ${sex || 'your sex'}`
      );
      recommendations.push(`Consider a higher target body fat of at least ${essentialBf + 2}%`);
    }

    // Check if target requires surplus (gaining fat is unusual)
    if (currentBodyFat !== undefined && targetBodyFat > currentBodyFat) {
      warnings.push('Target body fat is higher than current - this would require gaining fat');
      recommendations.push('Consider a muscle gain goal instead if you want to increase weight');
    }
  }

  // Add strategy-specific warnings
  if (strategy.warnings) {
    warnings.push(...strategy.warnings);
  }

  return {
    valid: warnings.filter(w => w.includes('below essential') || w.includes('Unknown')).length === 0,
    warnings,
    recommendations
  };
}

/**
 * Calculate body fat goal parameters
 */
export function calculateBodyFatGoalParameters(
  currentWeight: number,
  currentBodyFat: number,
  targetBodyFat: number,
  timelineWeeks: number,
  sex: 'male' | 'female' = 'male'
): {
  fatToLose: number;
  minSafeWeeks: number;
  maxSafeWeeks: number;
  recommendedDeficitPercent: number;
  weeklyLossTarget: number;
  feasibility: 'easy' | 'moderate' | 'aggressive' | 'unsafe';
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Calculate fat mass to lose
  const currentFatMass = currentWeight * (currentBodyFat / 100);
  const targetFatMass = currentWeight * (targetBodyFat / 100);
  const fatToLose = currentFatMass - targetFatMass;

  // Essential body fat check
  const essentialBf = sex === 'female' ? 13 : 5;
  if (targetBodyFat < essentialBf) {
    warnings.push(`Target body fat below essential levels (${essentialBf}%)`);
  }

  // Calculate safe timeline range (0.5-1% BW loss per week)
  const conservativeWeeklyLoss = currentWeight * 0.005; // 0.5% BW/week
  const aggressiveWeeklyLoss = currentWeight * 0.01; // 1% BW/week
  
  const minSafeWeeks = Math.ceil(fatToLose / aggressiveWeeklyLoss);
  const maxSafeWeeks = Math.ceil(fatToLose / conservativeWeeklyLoss);

  // Calculate required weekly loss for timeline
  const requiredWeeklyLoss = fatToLose / timelineWeeks;
  const weeklyLossAsPercent = (requiredWeeklyLoss / currentWeight) * 100;

  // Determine feasibility and deficit
  let feasibility: 'easy' | 'moderate' | 'aggressive' | 'unsafe';
  let recommendedDeficitPercent: number;

  if (weeklyLossAsPercent <= 0.5) {
    feasibility = 'easy';
    recommendedDeficitPercent = 15;
  } else if (weeklyLossAsPercent <= 0.75) {
    feasibility = 'moderate';
    recommendedDeficitPercent = 20;
  } else if (weeklyLossAsPercent <= 1.0) {
    feasibility = 'aggressive';
    recommendedDeficitPercent = 27.5;
    warnings.push('This timeline requires aggressive dieting - higher protein recommended');
  } else {
    feasibility = 'unsafe';
    recommendedDeficitPercent = 30;
    warnings.push(`Timeline too aggressive (${weeklyLossAsPercent.toFixed(1)}% BW/week) - recommend extending to at least ${minSafeWeeks} weeks`);
  }

  return {
    fatToLose: Math.round(fatToLose * 10) / 10,
    minSafeWeeks,
    maxSafeWeeks,
    recommendedDeficitPercent,
    weeklyLossTarget: Math.round(requiredWeeklyLoss * 100) / 100,
    feasibility,
    warnings
  };
}

