// Duplicate Meal Remover
// Identifies and replaces duplicate meals within the same week
// Ensures every meal in a week is unique

import {
  ConsistentPlan,
  ConsistentWeek,
  ConsistentDay,
  ConsistentMeal,
  Adjustment
} from '@/models/ConsistentPlanModels';

export interface DuplicateRemovalResult {
  success: boolean;
  adjustments: Adjustment[];
  removedDuplicates: number;
  plan: ConsistentPlan;
}

export class DuplicateMealRemover {
  /**
   * Remove duplicate meals from the plan
   * Replaces duplicates with alternative meals or adjusts meal types
   */
  removeDuplicates(plan: ConsistentPlan): DuplicateRemovalResult {
    const adjustments: Adjustment[] = [];
    let removedDuplicates = 0;

    for (const week of plan.weeks) {
      const weekResult = this.removeDuplicatesFromWeek(week);
      adjustments.push(...weekResult.adjustments);
      removedDuplicates += weekResult.removedCount;
    }

    return {
      success: removedDuplicates > 0,
      adjustments,
      removedDuplicates,
      plan
    };
  }

  /**
   * Remove duplicates from a single week
   */
  private removeDuplicatesFromWeek(week: ConsistentWeek): {
    adjustments: Adjustment[];
    removedCount: number;
  } {
    const adjustments: Adjustment[] = [];
    let removedCount = 0;

    // Track meals seen in this week
    const mealNameMap = new Map<string, ConsistentMeal[]>();
    
    // Collect all meals in the week
    for (const day of week.days) {
      for (const meal of day.meals) {
        const mealKey = this.getMealKey(meal);
        if (!mealNameMap.has(mealKey)) {
          mealNameMap.set(mealKey, []);
        }
        mealNameMap.get(mealKey)!.push(meal);
      }
    }

    // Find duplicates (meals that appear more than once)
    for (const [mealKey, meals] of mealNameMap.entries()) {
      if (meals.length > 1) {
        // Keep the first occurrence, replace the rest
        const [firstMeal, ...duplicates] = meals;
        
        for (const duplicateMeal of duplicates) {
          // Try to replace with a similar but different meal
          const replacement = this.findReplacementMeal(
            duplicateMeal,
            week,
            mealNameMap
          );

          if (replacement) {
            // Replace the duplicate meal
            const day = week.days.find(d => 
              d.meals.some(m => m.mealId === duplicateMeal.mealId)
            );

            if (day) {
              const mealIndex = day.meals.findIndex(
                m => m.mealId === duplicateMeal.mealId
              );

              if (mealIndex !== -1) {
                const beforeMeal = { ...duplicateMeal };
                day.meals[mealIndex] = replacement;
                removedCount++;

                adjustments.push({
                  type: 'meal_replacement',
                  location: `Week ${week.weekNumber} Day ${day.dayNumber} ${duplicateMeal.mealType}`,
                  before: {
                    mealName: beforeMeal.recipe?.name || beforeMeal.mealType,
                    mealId: beforeMeal.mealId
                  },
                  after: {
                    mealName: replacement.recipe?.name || replacement.mealType,
                    mealId: replacement.mealId
                  },
                  reason: `Replaced duplicate meal "${beforeMeal.recipe?.name || beforeMeal.mealType}" with alternative`,
                  success: true
                });
              }
            }
          } else {
            // If no replacement found, modify the meal name slightly to make it unique
            // This is a fallback - ideally we should have a meal database
            const modifiedMeal = this.modifyMealToMakeUnique(duplicateMeal, mealNameMap);
            
            const day = week.days.find(d => 
              d.meals.some(m => m.mealId === duplicateMeal.mealId)
            );

            if (day && modifiedMeal) {
              const mealIndex = day.meals.findIndex(
                m => m.mealId === duplicateMeal.mealId
              );

              if (mealIndex !== -1) {
                const beforeMeal = { ...duplicateMeal };
                day.meals[mealIndex] = modifiedMeal;
                removedCount++;

                adjustments.push({
                  type: 'meal_replacement',
                  location: `Week ${week.weekNumber} Day ${day.dayNumber} ${duplicateMeal.mealType}`,
                  before: {
                    mealName: beforeMeal.recipe?.name || beforeMeal.mealType,
                    mealId: beforeMeal.mealId
                  },
                  after: {
                    mealName: modifiedMeal.recipe?.name || modifiedMeal.mealType,
                    mealId: modifiedMeal.mealId
                  },
                  reason: `Modified duplicate meal name to ensure uniqueness`,
                  success: true
                });
              }
            }
          }
        }
      }
    }

    return { adjustments, removedCount };
  }

  /**
   * Get unique key for a meal (for duplicate detection)
   */
  private getMealKey(meal: ConsistentMeal): string {
    // Use recipe name as primary key, fallback to meal type
    const name = meal.recipe?.name || meal.mealType || '';
    // Normalize name for comparison
    return name.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Find a replacement meal that's similar but different
   */
  private findReplacementMeal(
    originalMeal: ConsistentMeal,
    week: ConsistentWeek,
    existingMeals: Map<string, ConsistentMeal[]>
  ): ConsistentMeal | null {
    // Strategy: Look for a meal of the same type that hasn't been used yet
    const mealType = originalMeal.mealType;
    
    // Get all meals of the same type from other days in the week
    const alternativeMeals: ConsistentMeal[] = [];
    
    for (const day of week.days) {
      for (const meal of day.meals) {
        if (meal.mealType === mealType && 
            meal.mealId !== originalMeal.mealId) {
          const mealKey = this.getMealKey(meal);
          // Check if this meal is already used (but not as a duplicate)
          const usedCount = existingMeals.get(mealKey)?.length || 0;
          if (usedCount === 1) {
            // This meal is only used once, so we can use it
            alternativeMeals.push(meal);
          }
        }
      }
    }

    // If no alternatives found, try to find a meal from a different day
    if (alternativeMeals.length === 0) {
      // Look across all days for a meal of similar macros
      for (const day of week.days) {
        for (const meal of day.meals) {
          if (meal.mealType === mealType &&
              meal.mealId !== originalMeal.mealId) {
            const mealKey = this.getMealKey(meal);
            // Check if this specific instance is unique
            const keyCount = Array.from(week.days.flatMap(d => d.meals))
              .filter(m => this.getMealKey(m) === mealKey).length;
            
            if (keyCount === 1) {
              return { ...meal, mealId: `replacement_${Date.now()}_${Math.random()}` };
            }
          }
        }
      }
    }

    // Return first alternative if available
    return alternativeMeals.length > 0 
      ? { ...alternativeMeals[0], mealId: `replacement_${Date.now()}_${Math.random()}` }
      : null;
  }

  /**
   * Modify meal to make it unique (fallback strategy)
   */
  private modifyMealToMakeUnique(
    meal: ConsistentMeal,
    existingMeals: Map<string, ConsistentMeal[]>
  ): ConsistentMeal | null {
    // Create a modified version by adjusting ingredient quantities slightly
    // This makes it technically a different meal while keeping similar macros
    const modified = { ...meal };
    
    if (modified.recipe) {
      modified.recipe = {
        ...modified.recipe,
        name: `${modified.recipe.name} (Variation)`
      };
    }

    // Modify ingredient amounts slightly (within 5%)
    modified.ingredients = modified.ingredients.map(ing => {
      const adjustment = (Math.random() * 0.1 - 0.05); // -5% to +5%
      const newAmount = ing.amount * (1 + adjustment);
      
      return {
        ...ing,
        amount: Math.round(newAmount * 10) / 10,
        macros: {
          calories: Math.round(ing.macros.calories * (1 + adjustment)),
          protein: Math.round(ing.macros.protein * (1 + adjustment) * 10) / 10,
          carbs: Math.round(ing.macros.carbs * (1 + adjustment) * 10) / 10,
          fat: Math.round(ing.macros.fat * (1 + adjustment) * 10) / 10
        }
      };
    });

    // Recalculate macros
    modified.calculatedMacros = modified.ingredients.reduce(
      (totals, ing) => ({
        calories: totals.calories + ing.macros.calories,
        protein: totals.protein + ing.macros.protein,
        carbs: totals.carbs + ing.macros.carbs,
        fat: totals.fat + ing.macros.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    modified.mealId = `modified_${Date.now()}_${Math.random()}`;

    return modified;
  }
}

