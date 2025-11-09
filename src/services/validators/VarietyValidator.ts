// Variety Validator
// Ensures meal variety: no duplicate meals in same week (unless explicitly allowed)
// Tracks meal rotation across weeks

import {
  ConsistentPlan,
  ConsistentMeal,
  DuplicateMeal
} from '@/models/ConsistentPlanModels';

export interface VarietyResult {
  isValid: boolean;
  score: number;  // 0-100%
  duplicateMeals: DuplicateMeal[];
  weeklyRotation: number;  // Measure of variety (0-100%)
}

export class VarietyValidator {
  /**
   * Validate meal variety across the plan
   */
  validate(plan: ConsistentPlan): VarietyResult {
    const duplicateMeals: DuplicateMeal[] = [];
    const mealOccurrences = new Map<string, Array<{
      weekNumber: number;
      dayNumber: number;
      mealId: string;
      mealName: string;
      recipeReference?: string;
    }>>();

    // Collect all meal occurrences
    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          // Use recipe reference if available, otherwise use meal name
          const mealKey = meal.recipeReference || meal.mealType + '_' + 
                         (meal.recipe?.name || meal.mealType);
          
          if (!mealOccurrences.has(mealKey)) {
            mealOccurrences.set(mealKey, []);
          }
          
          mealOccurrences.get(mealKey)!.push({
            weekNumber: week.weekNumber,
            dayNumber: day.dayNumber,
            mealId: meal.mealId,
            mealName: meal.recipe?.name || meal.mealType,
            recipeReference: meal.recipeReference
          });
        }
      }
    }

    // Find duplicates within the same week
    for (const [mealKey, occurrences] of mealOccurrences.entries()) {
      // Group by week
      const byWeek = new Map<number, typeof occurrences>();
      
      for (const occurrence of occurrences) {
        if (!byWeek.has(occurrence.weekNumber)) {
          byWeek.set(occurrence.weekNumber, []);
        }
        byWeek.get(occurrence.weekNumber)!.push(occurrence);
      }

      // Check for duplicates in same week
      for (const [weekNumber, weekOccurrences] of byWeek.entries()) {
        if (weekOccurrences.length > 1) {
          // Found duplicate in same week
          const existingDuplicate = duplicateMeals.find(
            d => d.recipeReference === weekOccurrences[0].recipeReference ||
                 d.mealName === weekOccurrences[0].mealName
          );

          if (existingDuplicate) {
            // Add to existing duplicate entry
            existingDuplicate.occurrences.push(...weekOccurrences);
          } else {
            duplicateMeals.push({
              mealName: weekOccurrences[0].mealName,
              recipeReference: weekOccurrences[0].recipeReference,
              occurrences: [...weekOccurrences]
            });
          }
        }
      }
    }

    // Calculate weekly rotation score
    // Measures how much meals vary across weeks
    const weeklyRotation = this.calculateWeeklyRotation(plan, mealOccurrences);

    // Calculate overall variety score
    // Penalize duplicates: -10% per duplicate meal per week
    let score = 100;
    for (const duplicate of duplicateMeals) {
      const weeksWithDuplicates = new Set(
        duplicate.occurrences.map(o => o.weekNumber)
      );
      score -= weeksWithDuplicates.size * 10;
    }
    score = Math.max(0, score);

    // Factor in weekly rotation
    const finalScore = (score * 0.7) + (weeklyRotation * 0.3);

    return {
      isValid: duplicateMeals.length === 0,
      score: Math.round(finalScore * 100) / 100,
      duplicateMeals,
      weeklyRotation: Math.round(weeklyRotation * 100) / 100
    };
  }

  /**
   * Calculate weekly rotation score
   * Measures how much meals vary from week to week
   */
  private calculateWeeklyRotation(
    plan: ConsistentPlan,
    mealOccurrences: Map<string, Array<{ weekNumber: number; dayNumber: number; mealId: string; mealName: string; recipeReference?: string }>>
  ): number {
    if (plan.weeks.length < 2) {
      return 100;  // Single week = perfect rotation (nothing to compare)
    }

    // Count unique meals per week
    const mealsPerWeek = plan.weeks.map(week => {
      const weekMeals = new Set<string>();
      for (const day of week.days) {
        for (const meal of day.meals) {
          const mealKey = meal.recipeReference || meal.mealType + '_' + 
                         (meal.recipe?.name || meal.mealType);
          weekMeals.add(mealKey);
        }
      }
      return weekMeals.size;
    });

    // Calculate average unique meals per week
    const avgUniqueMeals = mealsPerWeek.reduce((a, b) => a + b, 0) / mealsPerWeek.length;

    // Calculate overlap between consecutive weeks
    let totalOverlap = 0;
    let comparisonCount = 0;

    for (let i = 0; i < plan.weeks.length - 1; i++) {
      const week1Meals = new Set<string>();
      const week2Meals = new Set<string>();

      for (const day of plan.weeks[i].days) {
        for (const meal of day.meals) {
          const mealKey = meal.recipeReference || meal.mealType + '_' + 
                         (meal.recipe?.name || meal.mealType);
          week1Meals.add(mealKey);
        }
      }

      for (const day of plan.weeks[i + 1].days) {
        for (const meal of day.meals) {
          const mealKey = meal.recipeReference || meal.mealType + '_' + 
                         (meal.recipe?.name || meal.mealType);
          week2Meals.add(mealKey);
        }
      }

      // Calculate overlap percentage
      const intersection = new Set([...week1Meals].filter(x => week2Meals.has(x)));
      const union = new Set([...week1Meals, ...week2Meals]);
      const overlap = union.size > 0 ? intersection.size / union.size : 0;
      
      totalOverlap += overlap;
      comparisonCount++;
    }

    const avgOverlap = comparisonCount > 0 ? totalOverlap / comparisonCount : 0;

    // Score: Higher unique meals per week and lower overlap = better
    // Normalize to 0-100
    // If avgUniqueMeals is high (e.g., 15+) and overlap is low (e.g., <0.3), score is high
    const uniqueMealScore = Math.min(100, (avgUniqueMeals / 15) * 100);
    const overlapScore = (1 - avgOverlap) * 100;
    
    return (uniqueMealScore * 0.5) + (overlapScore * 0.5);
  }

  /**
   * Get summary of variety issues
   */
  getVarietySummary(result: VarietyResult): string {
    if (result.duplicateMeals.length === 0) {
      return `✅ No duplicate meals found. Weekly rotation: ${result.weeklyRotation.toFixed(1)}%`;
    }

    const summary: string[] = [];
    summary.push(`❌ Found ${result.duplicateMeals.length} duplicate meal(s) in same week:`);
    
    for (const duplicate of result.duplicateMeals.slice(0, 5)) {
      const weeksWithDuplicates = new Set(
        duplicate.occurrences.map(o => o.weekNumber)
      );
      summary.push(`   - "${duplicate.mealName}" appears ${duplicate.occurrences.length} times in week(s) ${Array.from(weeksWithDuplicates).join(', ')}`);
    }

    if (result.duplicateMeals.length > 5) {
      summary.push(`   ... and ${result.duplicateMeals.length - 5} more duplicate meals`);
    }

    summary.push(`Weekly rotation score: ${result.weeklyRotation.toFixed(1)}%`);

    return summary.join('\n');
  }
}

