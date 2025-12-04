// Phase 8: Meal Templates Prompt Builder
// Builds context-aware prompts for meal template generation

import { UserProfile } from '@/models/UserProfile';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class MealTemplatesPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    metrics: PlanningMetrics,
    nutritionStrategy: any,
    trainingSchedule: any
  ): string {
    const { preferences, mealFrequency, trainingDaysPerWeek } = userProfile;
    const week1Calories = metrics.macros.calories;
    const week8Calories = Math.round(metrics.macros.calories - 200);
    const week16Calories = Math.round(metrics.macros.calories - 400);

    const frequency = mealFrequency || 3;
    return `
Generate meal templates for "${preferences}":

🚨 DIETARY CONSTRAINTS - MANDATORY COMPLIANCE:
${this.buildDetailedConstraints(dietaryConstraints)}

ADJUSTED MACRO TARGETS:
${nutritionStrategy?.adjustedMacros ? JSON.stringify(nutritionStrategy.adjustedMacros) : JSON.stringify(metrics.macros)}

MEAL STRUCTURE:
- Frequency: ${frequency} meals/day
- Average per meal: ${Math.round(metrics.macros.calories / frequency)} cal
- Protein per meal: ~${Math.round(metrics.macros.protein / frequency)}g

TRAINING CONTEXT:
- Training days: ${trainingDaysPerWeek} days/week
- Pre-workout meal: ${nutritionStrategy?.mealTiming?.preWorkout || '1-2 hours before'}
- Post-workout meal: ${nutritionStrategy?.mealTiming?.postWorkout || 'within 2 hours'}

PHASE VARIATIONS:
Create templates for 3 phases:
1. **Foundation** (weeks 1-5): ${week1Calories} cal/day
2. **Progression** (weeks 6-11): ${week8Calories} cal/day  
3. **Peak** (weeks 12-16): ${week16Calories} cal/day

For each phase, provide ${frequency} meal templates:
${this.formatMealStructure(frequency)}

STRICT REQUIREMENTS:
❌ DO NOT include any foods from the exclude list
✅ ONLY use foods from the include list
📊 Each meal must specify exact macros
🍳 Include simple recipes with ingredient amounts

VALIDATION:
Before finalizing, verify EVERY ingredient is allowed in "${preferences}".

EVIDENCE-BASED REQUIREMENTS:
- Protein distribution optimized for muscle preservation
- Meal timing aligned with training schedule
- Phase-specific calorie adjustments
- Dietary compliance at ingredient level
- Practical and diverse meal options

Return structured meal templates with detailed recipes and macros.
`;
  }

  private static buildDetailedConstraints(constraints: DietaryConstraints): string {
    if (constraints.include.includes('all_foods') && constraints.exclude.length === 0) {
      return `- Dietary preference: Flexible (no restrictions)`;
    }

    return `
✅ MUST INCLUDE ONLY:
${constraints.include.map(item => `   - ${this.formatFoodCategory(item)}`).join('\n')}

❌ MUST EXCLUDE (absolutely forbidden):
${constraints.exclude.map(item => `   - ${this.formatFoodCategory(item)}`).join('\n')}

📋 MACRO ADJUSTMENTS FOR THIS DIET:
   - Carbs: ${constraints.macroAdjustments.carbs}
   - Protein: ${constraints.macroAdjustments.protein}
   - Fat: ${constraints.macroAdjustments.fat}

⚠️  IMPORTANT NOTES:
   ${constraints.notes}`;
  }

  private static formatFoodCategory(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private static formatMealStructure(mealFrequency: number): string {
    switch (mealFrequency) {
      case 3:
        return `
- 4-5 different breakfast options (larger portions)
- 4-5 different lunch options (larger portions)  
- 4-5 different dinner options (larger portions)
- Meal types: Breakfast, Lunch, Dinner only`;
      case 4:
        return `
- 3-4 different breakfast options
- 3-4 different lunch options  
- 3-4 different dinner options
- 3-4 different evening snack options
- Meal types: Breakfast, Lunch, Dinner, Evening Snack`;
      case 5:
        return `
- 3-4 different breakfast options
- 3-4 different lunch options  
- 3-4 different dinner options
- 2-3 different mid-morning snack options
- 2-3 different evening snack options
- Meal types: Breakfast, Mid-Morning Snack, Lunch, Dinner, Evening Snack`;
      default:
        return `
- 2-3 different breakfast options
- 2-3 different lunch options  
- 2-3 different dinner options
- 2-3 different mid-morning snack options
- 2-3 different mid-afternoon snack options
- 2-3 different evening snack options
- Meal types: Breakfast, Mid-Morning Snack, Lunch, Mid-Afternoon Snack, Dinner, Evening Snack`;
    }
  }
}
