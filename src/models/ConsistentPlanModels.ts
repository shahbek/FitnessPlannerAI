// Consistent Plan Models
// Hierarchical data structure with parent references for complete traceability
// Ensures zero contradictions and full macro alignment across all levels

// Macro totals interface (reusable)
export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Macro targets interface
export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinPerKg?: number;
}

// Consistent Ingredient - base level with full macro breakdown
export interface ConsistentIngredient {
  ingredientId: string;
  mealId: string;  // Parent reference
  name: string;
  normalizedName: string;  // Lowercase, normalized for matching
  amount: number;
  unit: string;  // 'g', 'kg', 'ml', 'piece', etc.
  macros: MacroTotals;  // Calculated from amount and per-100g values
  groceryListItemId?: string;  // Traceability link to shopping list
}

// Consistent Meal - with dual macro tracking
export interface ConsistentMeal {
  mealId: string;
  dayId: string;  // Parent reference
  mealType: string;  // 'Breakfast', 'Lunch', 'Dinner', 'Snack'
  recipeReference?: string;  // References canonical meal DB (e.g., "grilled_chicken_avocado_salad_v1.2")
  declaredMacros: MacroTotals;  // From AI generation
  calculatedMacros: MacroTotals;  // Bottom-up sum from ingredients
  ingredients: ConsistentIngredient[];
  traceabilityHash: string;  // Hash of ingredient IDs for grocery list mapping
  recipe?: {
    name: string;
    instructions: string[];
  };
}

// Consistent Day - aggregates meals
export interface ConsistentDay {
  dayId: string;
  weekId: string;  // Parent reference
  dayNumber: number;  // 1-7
  calculatedTotals: MacroTotals;  // Aggregated from meals (bottom-up)
  targetTotals?: MacroTotals;  // From weekly targets (if day-specific)
  meals: ConsistentMeal[];
}

// Consistent Week - aggregates days
export interface ConsistentWeek {
  weekId: string;
  planId: string;  // Parent reference
  weekNumber: number;
  dailyTargets: MacroTargets;  // Target macros per day
  calculatedTotals: MacroTotals;  // Bottom-up aggregated from days
  days: ConsistentDay[];
  shoppingList?: ShoppingListWithTraceability;
}

// Shopping list with full traceability
export interface ShoppingListItemWithTraceability {
  name: string;
  normalizedName: string;
  quantity: string;
  estimatedCost: number;
  priority?: string;
  traceability: {
    sourceIngredientIds: string[];  // Links to ConsistentIngredient[]
    sourceMealIds: string[];  // Links to ConsistentMeal[]
    sourceDayIds: string[];  // Links to ConsistentDay[]
    verificationHash: string;  // Hash of ingredient IDs for verification
  };
}

export interface ShoppingListWithTraceability {
  weekNumber: number;
  categories: Array<{
    category: string;
    items: ShoppingListItemWithTraceability[];
  }>;
  weekTotal: number;
  notes: string[];
}

// Validation discrepancy interface
export interface Discrepancy {
  level: 'weekly' | 'daily' | 'meal' | 'ingredient';
  location: string;  // e.g., "Week 1", "Week 1 Day 3", "Week 1 Day 3 Meal 2"
  macro: 'calories' | 'protein' | 'carbs' | 'fat';
  declared: number;
  calculated: number;
  difference: number;
  percentageDifference: number;
}

// Untraceable item interface
export interface UntraceableItem {
  type: 'grocery_item' | 'ingredient';
  name: string;
  location: string;
  reason: string;
}

// Duplicate meal interface
export interface DuplicateMeal {
  mealName: string;
  recipeReference?: string;
  occurrences: Array<{
    weekNumber: number;
    dayNumber: number;
    mealId: string;
  }>;
}

// Adjustment record
export interface Adjustment {
  type: 'macro_reconciliation' | 'ingredient_adjustment' | 'meal_replacement';
  location: string;
  before: any;
  after: any;
  reason: string;
  success: boolean;
}

export interface FailedAdjustment {
  type: string;
  location: string;
  issue: string;
  reason: string;
}

// Validation Report
export interface ValidationReport {
  overallConfidence: number;  // 0-100%
  macroConsistency: {
    score: number;  // 0-100%
    weeklyAlignment: number;  // % of weeks aligned
    dailyAlignment: number;   // % of days aligned
    mealAlignment: number;    // % of meals aligned
    discrepancies: Discrepancy[];
  };
  ingredientTraceability: {
    score: number;  // 0-100%
    traceableItems: number;
    totalItems: number;
    untraceableItems: UntraceableItem[];
  };
  variety: {
    score: number;  // 0-100%
    duplicateMeals: DuplicateMeal[];
    weeklyRotation: number;  // Measure of meal variety across weeks
  };
  adjustments: {
    appliedFixes: Adjustment[];
    failedFixes: FailedAdjustment[];
  };
  checksum: string;  // For reproducibility verification
}

// Consistent Plan - top-level structure
export interface ConsistentPlan {
  planId: string;
  userId: string;
  weeks: ConsistentWeek[];
  validationResults: ValidationReport;
  metadata: {
    generatedAt: string;
    checksum: string;
    version: string;
  };
}

// Utility functions for ID generation and hashing
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

export function generatePlanId(): string {
  return generateId('plan');
}

export function generateWeekId(planId: string): string {
  return generateId('week');
}

export function generateDayId(weekId: string): string {
  return generateId('day');
}

export function generateMealId(dayId: string): string {
  return generateId('meal');
}

export function generateIngredientId(mealId: string): string {
  return generateId('ing');
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\b(breast|fillet|chunk|slice|whole|raw|cooked|fresh|frozen|dried)\b/g, '');
}

/**
 * Simple hash function for browser compatibility
 * Uses djb2 algorithm (deterministic, fast)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export function calculateTraceabilityHash(ingredientIds: string[]): string {
  const sorted = [...ingredientIds].sort().join(',');
  return simpleHash(sorted).substring(0, 16);
}

export function calculatePlanChecksum(plan: ConsistentPlan): string {
  // Create a deterministic checksum from the plan structure
  // Exclude metadata and validationResults for reproducibility
  const planData = {
    planId: plan.planId,
    userId: plan.userId,
    weeks: plan.weeks.map(week => ({
      weekNumber: week.weekNumber,
      dailyTargets: week.dailyTargets,
      calculatedTotals: week.calculatedTotals,
      days: week.days.map(day => ({
        dayNumber: day.dayNumber,
        calculatedTotals: day.calculatedTotals,
        meals: day.meals.map(meal => ({
          mealType: meal.mealType,
          declaredMacros: meal.declaredMacros,
          calculatedMacros: meal.calculatedMacros,
          ingredients: meal.ingredients.map(ing => ({
            normalizedName: ing.normalizedName,
            amount: ing.amount,
            unit: ing.unit,
            macros: ing.macros
          }))
        }))
      }))
    }))
  };
  
  const jsonString = JSON.stringify(planData);
  // Use simpleHash twice and combine for longer checksum
  const hash1 = simpleHash(jsonString);
  const hash2 = simpleHash(jsonString + 'salt');
  return (hash1 + hash2).substring(0, 32);
}

// Aggregation functions for bottom-up calculation
export function aggregateMacros(items: Array<{ macros: MacroTotals }>): MacroTotals {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + (item.macros.calories || 0),
      protein: totals.protein + (item.macros.protein || 0),
      carbs: totals.carbs + (item.macros.carbs || 0),
      fat: totals.fat + (item.macros.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function calculateMealMacros(meal: ConsistentMeal): MacroTotals {
  return aggregateMacros(meal.ingredients);
}

export function calculateDayMacros(day: ConsistentDay): MacroTotals {
  // Sum the calculated macros from each meal (not aggregateMacros which expects .macros)
  return day.meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + (meal.calculatedMacros.calories || 0),
      protein: totals.protein + (meal.calculatedMacros.protein || 0),
      carbs: totals.carbs + (meal.calculatedMacros.carbs || 0),
      fat: totals.fat + (meal.calculatedMacros.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function calculateWeekMacros(week: ConsistentWeek): MacroTotals {
  // Sum the calculated totals from each day (not aggregateMacros which expects .macros)
  return week.days.reduce(
    (totals, day) => ({
      calories: totals.calories + (day.calculatedTotals.calories || 0),
      protein: totals.protein + (day.calculatedTotals.protein || 0),
      carbs: totals.carbs + (day.calculatedTotals.carbs || 0),
      fat: totals.fat + (day.calculatedTotals.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

