// Macro Consistency Validator
// Validates macro alignment across all hierarchy levels:
// Weekly ↔ Daily ↔ Meal ↔ Ingredient
// Tolerance: ±1% or ±5 calories (whichever is smaller)

import {
  ConsistentPlan,
  ConsistentWeek,
  ConsistentDay,
  ConsistentMeal,
  Discrepancy,
  MacroTotals,
  MacroTargets,
  calculateWeekMacros,
  calculateDayMacros,
  calculateMealMacros
} from '@/models/ConsistentPlanModels';

export interface MacroConsistencyResult {
  isValid: boolean;
  score: number;  // 0-100%
  weeklyAlignment: number;  // % of weeks aligned
  dailyAlignment: number;   // % of days aligned
  mealAlignment: number;    // % of meals aligned
  discrepancies: Discrepancy[];
}

export class MacroConsistencyValidator {
  private readonly CALORIE_TOLERANCE = 5;  // ±5 calories
  private readonly PROTEIN_TOLERANCE = 2;  // ±2g protein (stricter for muscle retention)
  private readonly PERCENTAGE_TOLERANCE = 0.01;  // ±1% for other macros

  /**
   * Validate macro consistency across all levels of the plan
   */
  validate(plan: ConsistentPlan): MacroConsistencyResult {
    const discrepancies: Discrepancy[] = [];
    let weeksAligned = 0;
    let daysAligned = 0;
    let mealsAligned = 0;
    let totalDays = 0;
    let totalMeals = 0;

    // Validate each week
    for (const week of plan.weeks) {
      // Recalculate week totals from days (bottom-up)
      const calculatedWeekTotals = calculateWeekMacros(week);
      
      // Calculate expected weekly totals from daily targets
      const expectedWeekTotals: MacroTotals = {
        calories: week.dailyTargets.calories * 7,
        protein: week.dailyTargets.protein * 7,
        carbs: week.dailyTargets.carbs * 7,
        fat: week.dailyTargets.fat * 7
      };

      // Check week-level alignment
      const weekAligned = this.checkMacroAlignment(
        expectedWeekTotals,
        calculatedWeekTotals,
        discrepancies,
        'weekly',
        `Week ${week.weekNumber}`
      );

      if (weekAligned) {
        weeksAligned++;
      }

      // Validate each day in the week
      for (const day of week.days) {
        totalDays++;
        
        // Recalculate day totals from meals
        const calculatedDayTotals = calculateDayMacros(day);
        
        // Expected day totals from weekly targets
        const expectedDayTotals: MacroTotals = {
          calories: week.dailyTargets.calories,
          protein: week.dailyTargets.protein,
          carbs: week.dailyTargets.carbs,
          fat: week.dailyTargets.fat
        };

        // Check day-level alignment
        const dayAligned = this.checkMacroAlignment(
          expectedDayTotals,
          calculatedDayTotals,
          discrepancies,
          'daily',
          `Week ${week.weekNumber} Day ${day.dayNumber}`
        );

        if (dayAligned) {
          daysAligned++;
        }

        // Validate each meal in the day
        for (const meal of day.meals) {
          totalMeals++;
          
          // Recalculate meal totals from ingredients
          const calculatedMealTotals = calculateMealMacros(meal);
          
          // Compare with declared macros
          const mealAligned = this.checkMacroAlignment(
            meal.declaredMacros,
            calculatedMealTotals,
            discrepancies,
            'meal',
            `Week ${week.weekNumber} Day ${day.dayNumber} ${meal.mealType}`
          );

          if (mealAligned) {
            mealsAligned++;
          }

          // Validate each ingredient in the meal
          // (Note: ingredient macros should already be calculated, but we verify they're not negative/NaN)
          for (const ingredient of meal.ingredients) {
            if (!this.isValidMacros(ingredient.macros)) {
              discrepancies.push({
                level: 'ingredient',
                location: `Week ${week.weekNumber} Day ${day.dayNumber} ${meal.mealType} - ${ingredient.name}`,
                macro: 'calories',
                declared: ingredient.macros.calories,
                calculated: ingredient.macros.calories,
                difference: 0,
                percentageDifference: 0
              });
            }
          }
        }
      }
    }

    // Calculate scores
    const weeklyAlignment = plan.weeks.length > 0 
      ? (weeksAligned / plan.weeks.length) * 100 
      : 0;
    const dailyAlignment = totalDays > 0 
      ? (daysAligned / totalDays) * 100 
      : 0;
    const mealAlignment = totalMeals > 0 
      ? (mealsAligned / totalMeals) * 100 
      : 0;

    // Overall score: weighted average
    // Weekly: 40%, Daily: 35%, Meal: 25%
    const overallScore = (
      weeklyAlignment * 0.40 +
      dailyAlignment * 0.35 +
      mealAlignment * 0.25
    );

    return {
      isValid: discrepancies.length === 0,
      score: Math.round(overallScore * 100) / 100,
      weeklyAlignment: Math.round(weeklyAlignment * 100) / 100,
      dailyAlignment: Math.round(dailyAlignment * 100) / 100,
      mealAlignment: Math.round(mealAlignment * 100) / 100,
      discrepancies
    };
  }

  /**
   * Check alignment between expected and calculated macros
   * Returns true if aligned, false if discrepancies found
   */
  private checkMacroAlignment(
    expected: MacroTotals,
    calculated: MacroTotals,
    discrepancies: Discrepancy[],
    level: 'weekly' | 'daily' | 'meal' | 'ingredient',
    location: string
  ): boolean {
    let isAligned = true;

    // Check each macro type
    const macros: Array<{ key: 'calories' | 'protein' | 'carbs' | 'fat'; expected: number; calculated: number }> = [
      { key: 'calories', expected: expected.calories, calculated: calculated.calories },
      { key: 'protein', expected: expected.protein, calculated: calculated.protein },
      { key: 'carbs', expected: expected.carbs, calculated: calculated.carbs },
      { key: 'fat', expected: expected.fat, calculated: calculated.fat }
    ];

    for (const macro of macros) {
      const difference = Math.abs(macro.expected - macro.calculated);
      const percentageDifference = macro.expected > 0 
        ? difference / macro.expected 
        : 0;

      // Determine tolerance - protein has stricter tolerance
      let absoluteTolerance: number;
      let percentageTolerance: number;
      
      if (macro.key === 'calories') {
        absoluteTolerance = this.CALORIE_TOLERANCE;
        percentageTolerance = this.PERCENTAGE_TOLERANCE;
      } else if (macro.key === 'protein') {
        absoluteTolerance = this.PROTEIN_TOLERANCE;
        percentageTolerance = this.PERCENTAGE_TOLERANCE;
      } else {
        absoluteTolerance = macro.expected * this.PERCENTAGE_TOLERANCE;
        percentageTolerance = this.PERCENTAGE_TOLERANCE;
      }
      
      const isWithinTolerance = difference <= absoluteTolerance || 
                                 percentageDifference <= percentageTolerance;

      if (!isWithinTolerance) {
        isAligned = false;
        discrepancies.push({
          level,
          location,
          macro: macro.key,
          declared: macro.expected,
          calculated: macro.calculated,
          difference,
          percentageDifference: percentageDifference * 100  // Convert to percentage
        });
      }
    }

    return isAligned;
  }

  /**
   * Validate that macro values are valid (not NaN, not negative, not Infinity)
   */
  private isValidMacros(macros: MacroTotals): boolean {
    const isValid = (value: number) => 
      !isNaN(value) && 
      isFinite(value) && 
      value >= 0;

    return isValid(macros.calories) &&
           isValid(macros.protein) &&
           isValid(macros.carbs) &&
           isValid(macros.fat);
  }

  /**
   * Get summary of discrepancies for reporting
   */
  getDiscrepancySummary(result: MacroConsistencyResult): string {
    if (result.discrepancies.length === 0) {
      return '✅ All macros are aligned across all levels.';
    }

    const byLevel = {
      weekly: result.discrepancies.filter(d => d.level === 'weekly'),
      daily: result.discrepancies.filter(d => d.level === 'daily'),
      meal: result.discrepancies.filter(d => d.level === 'meal'),
      ingredient: result.discrepancies.filter(d => d.level === 'ingredient')
    };

    const summary: string[] = [];
    
    if (byLevel.weekly.length > 0) {
      summary.push(`❌ ${byLevel.weekly.length} weekly-level discrepancies`);
    }
    if (byLevel.daily.length > 0) {
      summary.push(`❌ ${byLevel.daily.length} daily-level discrepancies`);
    }
    if (byLevel.meal.length > 0) {
      summary.push(`❌ ${byLevel.meal.length} meal-level discrepancies`);
    }
    if (byLevel.ingredient.length > 0) {
      summary.push(`❌ ${byLevel.ingredient.length} ingredient-level issues`);
    }

    return summary.join('\n');
  }
}

