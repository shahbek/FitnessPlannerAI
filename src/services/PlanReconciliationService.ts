// Plan Reconciliation Service
// Automatically fixes macro mismatches by adjusting ingredient quantities
// Uses constraint-based approach to minimize adjustments

import {
  ConsistentPlan,
  ConsistentWeek,
  ConsistentDay,
  ConsistentMeal,
  ConsistentIngredient,
  MacroTotals,
  MacroTargets,
  Adjustment,
  FailedAdjustment,
  calculateMealMacros,
  calculateDayMacros,
  calculateWeekMacros,
  generateIngredientId
} from '@/models/ConsistentPlanModels';

// Standard macro values per 100g (for common ingredients)
// These would ideally come from a canonical ingredient database
const INGREDIENT_MACROS_PER_100G: Record<string, MacroTotals> = {
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  'salmon': { calories: 208, protein: 20, carbs: 0, fat: 12 },
  'eggs': { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  'brown rice': { calories: 111, protein: 2.6, carbs: 23, fat: 0.9 },
  'quinoa': { calories: 120, protein: 4.4, carbs: 22, fat: 1.9 },
  'oats': { calories: 389, protein: 17, carbs: 66, fat: 7 },
  'broccoli': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  'spinach': { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  'olive oil': { calories: 884, protein: 0, carbs: 0, fat: 100 },
  'greek yogurt': { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  'yogurt': { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  'avocado': { calories: 160, protein: 2, carbs: 9, fat: 15 },
  'banana': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
};

export interface ReconciliationResult {
  success: boolean;
  adjustments: Adjustment[];
  failedAdjustments: FailedAdjustment[];
  plan: ConsistentPlan;
}

export class PlanReconciliationService {
  private readonly MIN_INGREDIENT_AMOUNT = 10;  // Minimum 10g

  /**
   * Reconcile macro mismatches in the plan
   * Attempts to fix discrepancies by adjusting ingredient quantities
   * Handles weekly, daily, and meal-level discrepancies
   */
  reconcile(plan: ConsistentPlan): ReconciliationResult {
    const adjustments: Adjustment[] = [];
    const failedAdjustments: FailedAdjustment[] = [];

    // Reconcile at each level: weeks → days → meals
    for (const week of plan.weeks) {
      // First, check week-level discrepancies
      const weekAdjustments = this.reconcileWeekMacros(week);
      adjustments.push(...weekAdjustments.adjustments);
      failedAdjustments.push(...weekAdjustments.failedAdjustments);

      // Then reconcile each day
      for (const day of week.days) {
        const dayAdjustments = this.reconcileDayMacros(day, week.dailyTargets);
        adjustments.push(...dayAdjustments.adjustments);
        failedAdjustments.push(...dayAdjustments.failedAdjustments);

        // Then reconcile each meal
        for (const meal of day.meals) {
          const mealAdjustments = this.reconcileMealMacros(meal);
          adjustments.push(...mealAdjustments.adjustments);
          failedAdjustments.push(...mealAdjustments.failedAdjustments);
        }

        // After fixing meals, recalculate day totals
        day.calculatedTotals = calculateDayMacros(day);
      }

      // After fixing days, recalculate week totals
      week.calculatedTotals = calculateWeekMacros(week);
    }

    return {
      success: failedAdjustments.length === 0,
      adjustments,
      failedAdjustments,
      plan
    };
  }

  /**
   * Reconcile week-level macro discrepancies
   * Distributes adjustments across all days in the week
   */
  private reconcileWeekMacros(week: ConsistentWeek): {
    adjustments: Adjustment[];
    failedAdjustments: FailedAdjustment[];
  } {
    const adjustments: Adjustment[] = [];
    const failedAdjustments: FailedAdjustment[] = [];

    const calculatedTotals = calculateWeekMacros(week);
    const expectedTotals: MacroTotals = {
      calories: week.dailyTargets.calories * 7,
      protein: week.dailyTargets.protein * 7,
      carbs: week.dailyTargets.carbs * 7,
      fat: week.dailyTargets.fat * 7
    };

    const discrepancies = this.findMacroDiscrepancies(expectedTotals, calculatedTotals);
    
    if (discrepancies.length === 0) {
      return { adjustments, failedAdjustments };
    }

    // For large discrepancies, distribute across all days
    // Protein: ZERO TOLERANCE - ANY deficit triggers adjustment
    for (const discrepancy of discrepancies) {
      const dailyTarget = discrepancy.delta / 7;  // Distribute across 7 days
      
      // Thresholds: protein ANY deficit (>0g/day), calories >5 cal/day, others >1g/day
      const threshold = discrepancy.macro === 'protein' 
        ? 0 // ZERO tolerance - any protein deficit must be fixed
        : discrepancy.macro === 'calories' ? 5
        : 1;
      
      // For protein: ALWAYS adjust if there's a deficit (dailyTarget > 0)
      // For others: only if above threshold
      const shouldAdjust = discrepancy.macro === 'protein'
        ? dailyTarget > 0 // Any protein deficit
        : Math.abs(dailyTarget) > threshold;
      
      if (shouldAdjust) {
        for (const day of week.days) {
          const dayAdjustments = this.adjustDayForMacro(day, discrepancy.macro, dailyTarget);
          adjustments.push(...dayAdjustments.adjustments);
          failedAdjustments.push(...dayAdjustments.failedAdjustments);
        }
      }
    }

    return { adjustments, failedAdjustments };
  }

  /**
   * Reconcile day-level macro discrepancies
   */
  private reconcileDayMacros(day: ConsistentDay, dailyTargets: MacroTargets): {
    adjustments: Adjustment[];
    failedAdjustments: FailedAdjustment[];
  } {
    const adjustments: Adjustment[] = [];
    const failedAdjustments: FailedAdjustment[] = [];

    const calculatedTotals = calculateDayMacros(day);
    const expectedTotals: MacroTotals = {
      calories: dailyTargets.calories,
      protein: dailyTargets.protein,
      carbs: dailyTargets.carbs,
      fat: dailyTargets.fat
    };

    const discrepancies = this.findMacroDiscrepancies(expectedTotals, calculatedTotals);

    if (discrepancies.length === 0) {
      return { adjustments, failedAdjustments };
    }

    // Discrepancies already sorted by priority (protein deficits first)

    for (const discrepancy of discrepancies) {
      // CRITICAL: For protein, we MUST fix it - no tolerance
      // Distribute adjustment across meals
      const dayAdjustments = this.adjustDayForMacro(day, discrepancy.macro, discrepancy.delta);
      adjustments.push(...dayAdjustments.adjustments);
      failedAdjustments.push(...dayAdjustments.failedAdjustments);
      
      // If protein and still not fixed, add supplements to meals until deficit is gone
      if (discrepancy.macro === 'protein' && discrepancy.delta > 0) {
        let remainingDeficit = expectedTotals.protein - calculateDayMacros(day).protein;
        let attempts = 0;
        const maxAttempts = day.meals.length * 2; // Try multiple meals if needed
        
        // Keep adding supplements until deficit is resolved or we've tried all meals
        while (remainingDeficit > 0.5 && attempts < maxAttempts) {
          // Sort meals by calorie content (highest first) to prioritize larger meals
          const mealsByCalories = [...day.meals].sort((a, b) => 
            b.declaredMacros.calories - a.declaredMacros.calories
          );
          
          // Try to add full remaining deficit to each meal until one works
          let added = false;
          for (const meal of mealsByCalories) {
            const supplementResult = this.addProteinSupplement(meal, remainingDeficit);
            if (supplementResult.success) {
              const newDeficit = expectedTotals.protein - calculateDayMacros(day).protein;
              adjustments.push({
                type: 'macro_reconciliation',
                location: `Day ${day.dayNumber} ${meal.mealType}`,
                before: { protein: calculateDayMacros(day).protein - supplementResult.newValue! },
                after: { protein: calculateDayMacros(day).protein },
                reason: `Added protein supplement to ensure daily target: ${supplementResult.reason}`,
                success: true
              });
              remainingDeficit = newDeficit;
              added = true;
              break; // Move to next iteration to check if more is needed
            }
          }
          
          if (!added) break; // Couldn't add to any meal, stop trying
          attempts++;
        }
        
        // If still have deficit after all attempts, log as failed adjustment
        if (remainingDeficit > 0.5) {
          failedAdjustments.push({
            type: 'macro_reconciliation',
            location: `Day ${day.dayNumber}`,
            issue: `Protein deficit remains: ${remainingDeficit.toFixed(1)}g after supplement attempts`,
            reason: `Could not add enough protein supplements to meet daily target of ${expectedTotals.protein}g`
          });
        }
      }
    }

    return { adjustments, failedAdjustments };
  }

  /**
   * Adjust a day's macros by modifying meals
   */
  private adjustDayForMacro(
    day: ConsistentDay,
    targetMacro: keyof MacroTotals,
    targetDelta: number
  ): {
    adjustments: Adjustment[];
    failedAdjustments: FailedAdjustment[];
  } {
    const adjustments: Adjustment[] = [];
    const failedAdjustments: FailedAdjustment[] = [];

    // Distribute adjustment across meals
    const perMealDelta = targetDelta / day.meals.length;

    for (const meal of day.meals) {
      const adjustment = this.adjustIngredientForMacro(meal, targetMacro, perMealDelta);
      
      if (adjustment.success) {
          adjustments.push({
            type: 'macro_reconciliation',
            location: `Day ${day.dayNumber} ${meal.mealType}`,
            before: {
              macro: targetMacro,
              value: meal.calculatedMacros[targetMacro]
            },
            after: {
              macro: targetMacro,
              value: adjustment.newValue!
            },
            reason: `Adjusted ${adjustment.ingredientName} to fix day-level ${targetMacro} mismatch`,
            success: true
          });
        } else {
          failedAdjustments.push({
            type: 'macro_reconciliation',
            location: `Day ${day.dayNumber}`,
          issue: `${targetMacro} mismatch: ${targetDelta > 0 ? '+' : ''}${targetDelta.toFixed(1)}`,
          reason: adjustment.reason
        });
      }
    }

    return { adjustments, failedAdjustments };
  }

  /**
   * Reconcile macros for a single meal
   */
  private reconcileMealMacros(meal: ConsistentMeal): {
    adjustments: Adjustment[];
    failedAdjustments: FailedAdjustment[];
  } {
    const adjustments: Adjustment[] = [];
    const failedAdjustments: FailedAdjustment[] = [];

    // Calculate current macros from ingredients
    const calculatedMacros = calculateMealMacros(meal);

    // Find discrepancies
    const discrepancies = this.findMacroDiscrepancies(
      meal.declaredMacros,
      calculatedMacros
    );

    if (discrepancies.length === 0) {
      return { adjustments, failedAdjustments };
    }

    // Discrepancies are already sorted by priority (protein first)

    // Try to fix each discrepancy (protein gets priority)
    for (const discrepancy of discrepancies) {
      // For protein, use a more aggressive adjustment strategy
      const adjustment = discrepancy.macro === 'protein'
        ? this.adjustForProtein(meal, discrepancy.delta)
        : this.adjustIngredientForMacro(meal, discrepancy.macro, discrepancy.delta);

      if (adjustment.success) {
        adjustments.push({
          type: 'macro_reconciliation',
          location: `Meal ${meal.mealId}`,
          before: {
            macro: discrepancy.macro,
            value: calculatedMacros[discrepancy.macro]
          },
          after: {
            macro: discrepancy.macro,
            value: adjustment.newValue
          },
          reason: `Adjusted ${adjustment.ingredientName} to fix ${discrepancy.macro} mismatch`,
          success: true
        });
      } else {
        failedAdjustments.push({
          type: 'macro_reconciliation',
          location: `Meal ${meal.mealId}`,
          issue: `${discrepancy.macro} mismatch: ${discrepancy.delta > 0 ? '+' : ''}${discrepancy.delta.toFixed(1)}`,
          reason: adjustment.reason
        });
      }
    }

    // Update calculated macros after adjustments
    meal.calculatedMacros = calculateMealMacros(meal);

    return { adjustments, failedAdjustments };
  }

  /**
   * Find macro discrepancies between declared and calculated
   * Protein has stricter tolerance (2g) since it's critical for muscle retention
   */
  private findMacroDiscrepancies(
    declared: MacroTotals,
    calculated: MacroTotals
  ): Array<{ macro: keyof MacroTotals; delta: number; priority: number }> {
    const discrepancies: Array<{ macro: keyof MacroTotals; delta: number; priority: number }> = [];
    
    const macros: Array<{ key: keyof MacroTotals; tolerance: number; priority: number }> = [
      { key: 'protein', tolerance: 0, priority: 100 },  // ZERO TOLERANCE - protein MUST match exactly (priority 100 = highest)
      { key: 'calories', tolerance: 5, priority: 8 },
      { key: 'carbs', tolerance: 5, priority: 5 },
      { key: 'fat', tolerance: 3, priority: 5 }
    ];

    for (const macroSpec of macros) {
      const delta = declared[macroSpec.key] - calculated[macroSpec.key];
      
      // For protein: ANY deficit (negative delta) is significant - we CANNOT go below target
      // For other macros: use tolerance
      const isSignificant = macroSpec.key === 'protein'
        ? calculated[macroSpec.key] < declared[macroSpec.key] // Protein below target = ALWAYS significant
        : Math.abs(delta) > macroSpec.tolerance;

      if (isSignificant) {
        // Protein deficits get massive priority boost
        const priorityBoost = macroSpec.key === 'protein' && delta > 0
          ? 1000 + (delta * 10) // Deficit gets huge priority
          : macroSpec.priority + Math.abs(delta);
        
        discrepancies.push({ 
          macro: macroSpec.key, 
          delta, 
          priority: priorityBoost
        });
      }
    }

    // Sort by priority (highest first) - protein deficits get fixed first
    discrepancies.sort((a, b) => b.priority - a.priority);

    return discrepancies;
  }

  /**
   * Special protein adjustment - GUARANTEES protein targets are met
   * If adjustments aren't enough, adds protein supplements automatically
   * NEVER allows protein to go below target
   */
  private adjustForProtein(
    meal: ConsistentMeal,
    targetDelta: number
  ): {
    success: boolean;
    ingredientName?: string;
    newValue?: number;
    reason: string;
  } {
    // CRITICAL: If we need MORE protein (positive delta), we MUST add it
    // If we have TOO MUCH protein (negative delta), we can reduce, but only if we stay above target
    
    // First, try to adjust existing high-protein ingredients
    // Use actual ingredient macros (already calculated for the portion) to derive density
    const proteinIngredients = meal.ingredients
      .map(ing => {
        // Use actual macros from ingredient (already calculated for portion size)
        // Derive density: protein per gram = macros.protein / amount
        const proteinDensity = ing.amount > 0 && ing.macros?.protein
          ? ing.macros.protein / ing.amount // grams protein per gram of ingredient
          : 0;
        
        return {
          ingredient: ing,
          macros: ing.macros,
          proteinDensity
        };
      })
      .filter(item => item.proteinDensity > 0.05) // Only ingredients with >5g protein per 100g (0.05g per gram)
      .sort((a, b) => b.proteinDensity - a.proteinDensity);

    // Try adjusting the highest protein ingredient first
    if (proteinIngredients.length > 0 && targetDelta > 0) {
      const adjustment = this.adjustIngredientForMacro(
        meal,
        'protein',
        targetDelta
      );

      if (adjustment.success) {
        // Verify we didn't go below target
        const newTotal = calculateMealMacros(meal).protein;
        if (newTotal >= meal.declaredMacros.protein) {
          return adjustment;
        }
      }

      // If single ingredient adjustment isn't enough, try multiple
      if (targetDelta > 10) {
        // Distribute adjustment across top 2-3 protein sources
        let remainingDelta = targetDelta;
        const adjustedIngredients: string[] = [];

        for (const item of proteinIngredients.slice(0, 3)) {
          if (remainingDelta < 1) break;

          const partialDelta = remainingDelta / Math.min(3, proteinIngredients.length);
          const partialAdjustment = this.adjustIngredientForMacro(
            meal,
            'protein',
            partialDelta
          );

          if (partialAdjustment.success) {
            adjustedIngredients.push(item.ingredient.name);
            remainingDelta -= partialDelta;
          }
        }

        const newTotal = calculateMealMacros(meal).protein;
        if (newTotal >= meal.declaredMacros.protein && adjustedIngredients.length > 0) {
          return {
            success: true,
            ingredientName: adjustedIngredients.join(', '),
            newValue: newTotal,
            reason: `Adjusted multiple protein sources: ${adjustedIngredients.join(', ')} to fix ${targetDelta.toFixed(1)}g protein deficit`
          };
        }
      }
    }

    // FALLBACK: If we still need more protein, ADD a protein supplement
    // This ensures we NEVER go below protein targets
    if (targetDelta > 0) {
      const proteinBoost = this.addProteinSupplement(meal, targetDelta);
      if (proteinBoost.success) {
        return proteinBoost;
      }
    }

    // Last resort: if we can't add supplements, still try to boost existing ingredients aggressively
    if (targetDelta > 0 && proteinIngredients.length > 0) {
      // Increase all protein ingredients by 20% to try to meet target
      let totalAdded = 0;
      const boostedIngredients: string[] = [];

      for (const item of proteinIngredients.slice(0, 5)) {
        const increaseAmount = item.ingredient.amount * 0.2; // 20% increase
        const currentMacros = item.ingredient.macros;
        if (currentMacros && item.ingredient.amount > 0) {
          // Calculate protein added using actual density
          const proteinAdded = (currentMacros.protein / item.ingredient.amount) * increaseAmount;
          
          // Update amount and recalculate macros proportionally
          const newAmount = item.ingredient.amount + increaseAmount;
          const multiplier = newAmount / item.ingredient.amount; // Proportion increase
          
          item.ingredient.amount = newAmount;
          item.ingredient.macros = {
            calories: Math.round(currentMacros.calories * multiplier),
            protein: Math.round(currentMacros.protein * multiplier * 10) / 10,
            carbs: Math.round(currentMacros.carbs * multiplier * 10) / 10,
            fat: Math.round(currentMacros.fat * multiplier * 10) / 10
          };
          
          totalAdded += proteinAdded;
          boostedIngredients.push(item.ingredient.name);
          
          if (totalAdded >= targetDelta * 0.8) break; // Close enough
        }
      }

      const finalTotal = calculateMealMacros(meal).protein;
      if (finalTotal >= meal.declaredMacros.protein * 0.98) { // Within 2% of target
        return {
          success: true,
          ingredientName: boostedIngredients.join(', '),
          newValue: finalTotal,
          reason: `Aggressively boosted protein sources: ${boostedIngredients.join(', ')} (+${totalAdded.toFixed(1)}g) to meet target`
        };
      }
    }

    // If ALL methods fail, return failure so caller can escalate (e.g., add supplements at day level)
    const currentProtein = calculateMealMacros(meal).protein;
    return {
      success: false, // Report failure so caller can try other methods
      ingredientName: 'Unable to fully boost',
      newValue: currentProtein,
      reason: `Could not fully meet protein target. Current: ${currentProtein.toFixed(1)}g, Target: ${meal.declaredMacros.protein}g, Deficit: ${targetDelta.toFixed(1)}g. Caller should escalate to day-level supplement injection.`
    };
  }

  /**
   * Add a protein supplement to a meal if needed
   * Uses whey protein powder as fallback (highest protein density)
   */
  private addProteinSupplement(
    meal: ConsistentMeal,
    targetProteinGrams: number
  ): {
    success: boolean;
    ingredientName?: string;
    newValue?: number;
    reason: string;
  } {
    // Whey protein: ~80g protein per 100g (0.80g protein per gram)
    // Calculate amount needed in grams
    const proteinDensity = 0.80; // 80g per 100g = 0.8g per gram
    const amountNeeded = targetProteinGrams / proteinDensity; // grams of powder needed
    
    // Minimum viable amount (at least 10g of powder = ~8g protein)
    if (amountNeeded < 10) {
      return {
        success: false,
        reason: `Protein deficit too small (${targetProteinGrams.toFixed(1)}g) to add supplement`
      };
    }

    // Generate ingredient ID
    const ingredientId = generateIngredientId(meal.mealId);
    
    // Create whey protein supplement ingredient
    const supplement: ConsistentIngredient = {
      ingredientId,
      mealId: meal.mealId,
      name: 'Whey Protein Powder',
      normalizedName: 'whey protein powder',
      amount: Math.round(amountNeeded),
      unit: 'g',
      macros: {
        calories: Math.round(amountNeeded * 4.1), // ~410 cal per 100g
        protein: Math.round(targetProteinGrams * 10) / 10,
        carbs: Math.round(amountNeeded * 0.05), // ~5g carbs per 100g = 0.05g per gram
        fat: Math.round(amountNeeded * 0.01) // ~1g fat per 100g = 0.01g per gram
      }
    };

    // Add to meal
    meal.ingredients.push(supplement);
    
    // Update meal macros
    meal.calculatedMacros = calculateMealMacros(meal);

    return {
      success: true,
      ingredientName: 'Whey Protein Powder',
      newValue: meal.calculatedMacros.protein,
      reason: `Added ${amountNeeded.toFixed(0)}g whey protein powder (+${targetProteinGrams.toFixed(1)}g protein) to meet target`
    };
  }

  /**
   * Adjust ingredient quantity to fix a macro discrepancy
   * Uses actual ingredient macros (not per-100g lookup) for accurate density calculation
   */
  private adjustIngredientForMacro(
    meal: ConsistentMeal,
    targetMacro: keyof MacroTotals,
    targetDelta: number
  ): {
    success: boolean;
    ingredientName?: string;
    newValue?: number;
    reason: string;
  } {
    // Find ingredient with highest density of target macro
    // Use actual ingredient macros (already calculated for portion) to derive density
    let bestIngredient: ConsistentIngredient | null = null;
    let bestDensity = 0;

    for (const ingredient of meal.ingredients) {
      // Use actual macros from ingredient (already calculated for portion size)
      // Derive density: macro per gram = macros[targetMacro] / amount
      if (!ingredient.macros || ingredient.amount <= 0) continue;
      
      const density = ingredient.macros[targetMacro] / ingredient.amount;  // grams per gram
      
      if (density > bestDensity) {
        bestDensity = density;
        bestIngredient = ingredient;
      }
    }

    if (!bestIngredient || bestDensity === 0) {
      return {
        success: false,
        reason: `No suitable ingredient found to adjust ${targetMacro}`
      };
    }

    // Calculate required adjustment
    // targetDelta = density * adjustmentAmount
    // adjustmentAmount = targetDelta / density
    const adjustmentAmount = targetDelta / bestDensity;
    const newAmount = bestIngredient.amount + adjustmentAmount;

    // Validate minimum amount
    if (newAmount < this.MIN_INGREDIENT_AMOUNT) {
      return {
        success: false,
        reason: `Adjustment would result in amount ${newAmount.toFixed(1)}g below minimum ${this.MIN_INGREDIENT_AMOUNT}g`
      };
    }

    // Apply adjustment
    const oldAmount = bestIngredient.amount;
    const multiplier = newAmount / bestIngredient.amount; // Proportion increase
    
    bestIngredient.amount = Math.round(newAmount * 10) / 10;  // Round to 1 decimal

    // Recalculate ingredient macros proportionally
    const currentMacros = bestIngredient.macros;
    bestIngredient.macros = {
      calories: Math.round(currentMacros.calories * multiplier),
      protein: Math.round(currentMacros.protein * multiplier * 10) / 10,
      carbs: Math.round(currentMacros.carbs * multiplier * 10) / 10,
      fat: Math.round(currentMacros.fat * multiplier * 10) / 10
    };

    return {
      success: true,
      ingredientName: bestIngredient.name,
      newValue: bestIngredient.macros[targetMacro],
      reason: `Adjusted ${bestIngredient.name} from ${oldAmount.toFixed(1)}g to ${newAmount.toFixed(1)}g`
    };
  }

  /**
   * Get macro values for an ingredient
   * Uses canonical database if available, otherwise tries to infer from ingredient name
   */
  private getIngredientMacros(ingredient: ConsistentIngredient): MacroTotals | null {
    // First, check if ingredient already has macros calculated
    if (ingredient.macros && ingredient.macros.calories > 0) {
      return ingredient.macros;
    }

    // Try to find in known ingredient database
    const normalizedName = ingredient.normalizedName.toLowerCase();
    for (const [key, macros] of Object.entries(INGREDIENT_MACROS_PER_100G)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return macros;
      }
    }

    // If not found, return null (should be handled by caller)
    return null;
  }

  /**
   * Reconcile a specific macro discrepancy at meal level
   */
  reconcileMacroMismatch(
    declared: MacroTotals,
    calculated: MacroTotals,
    ingredients: ConsistentIngredient[]
  ): Adjustment[] {
    const adjustments: Adjustment[] = [];
    const discrepancies = this.findMacroDiscrepancies(declared, calculated);

    for (const discrepancy of discrepancies) {
      // Find best ingredient to adjust
      let bestIngredient: ConsistentIngredient | null = null;
      let bestDensity = 0;

      for (const ingredient of ingredients) {
        const macros = this.getIngredientMacros(ingredient);
        if (!macros) continue;

        const density = macros[discrepancy.macro] / 100;
        if (density > bestDensity) {
          bestDensity = density;
          bestIngredient = ingredient;
        }
      }

      if (bestIngredient && bestDensity > 0) {
        const adjustmentAmount = discrepancy.delta / bestDensity;
        const newAmount = Math.max(
          this.MIN_INGREDIENT_AMOUNT,
          bestIngredient.amount + adjustmentAmount
        );

        const oldAmount = bestIngredient.amount;
        bestIngredient.amount = Math.round(newAmount * 10) / 10;

        // Recalculate macros
        const macros = this.getIngredientMacros(bestIngredient);
        if (macros) {
          const multiplier = bestIngredient.amount / 100;
          bestIngredient.macros = {
            calories: Math.round(macros.calories * multiplier),
            protein: Math.round(macros.protein * multiplier * 10) / 10,
            carbs: Math.round(macros.carbs * multiplier * 10) / 10,
            fat: Math.round(macros.fat * multiplier * 10) / 10
          };
        }

        adjustments.push({
          type: 'macro_reconciliation',
          location: `Ingredient ${bestIngredient.ingredientId}`,
          before: {
            amount: oldAmount,
            macro: discrepancy.macro,
            value: calculated[discrepancy.macro]
          },
          after: {
            amount: newAmount,
            macro: discrepancy.macro,
            value: bestIngredient.macros[discrepancy.macro]
          },
          reason: `Adjusted ${bestIngredient.name} ${discrepancy.macro} mismatch`,
          success: true
        });
      }
    }

    return adjustments;
  }
}

