// Phase 7: Nutrition Strategy Prompt Builder
// Builds context-aware prompts for nutrition strategy design

import { UserProfile } from '@/models/UserProfile';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class NutritionStrategyPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    metrics: PlanningMetrics,
    weeklyOutlines: any[]
  ): string {
    const { preferences, mealFrequency, weightKg } = userProfile;
    const macroConflict = this.checkMacroConflict(metrics.macros, dietaryConstraints);
    
    return `
Design nutrition strategy:

DIETARY PREFERENCE: "${preferences}"
${this.formatConstraints(dietaryConstraints)}

MACRO TARGETS (daily average):
- Calories: ${metrics.macros.calories}
- Protein: ${metrics.macros.protein}g (${(metrics.macros.protein / weightKg).toFixed(2)}g/kg)
- Carbs: ${metrics.macros.carbs}g
- Fat: ${metrics.macros.fat}g

${macroConflict ? this.buildMacroConflictSection(metrics.macros, dietaryConstraints, preferences) : ''}

TRAINING SCHEDULE:
${this.formatTrainingSchedule(weeklyOutlines)}

MEAL FREQUENCY: ${mealFrequency} meals/day

STRATEGY DESIGN:
1. **Meal Timing**:
   - Pre-workout meal timing
   - Post-workout nutrition
   - Protein distribution across meals
   
2. **Phase Adjustments**:
   - How nutrition changes from foundation → peak
   - Refeed protocol (if applicable)

CRITICAL: The dietary preference overrides everything. Design within those constraints.

EVIDENCE-BASED REQUIREMENTS:
- Protein timing for muscle preservation
- Carb timing for training performance
- Fat distribution for hormone optimization
- Meal frequency optimization for adherence
- Phase-specific adjustments for metabolic adaptation

Return structured nutrition strategy with specific protocols.
`;
  }

  private static formatConstraints(constraints: DietaryConstraints): string {
    if (constraints.include.includes('all_foods') && constraints.exclude.length === 0) {
      return `- Dietary preference: Flexible (no restrictions)`;
    }
    
    return `
- MUST INCLUDE: ${constraints.include.join(', ')}
- MUST EXCLUDE: ${constraints.exclude.join(', ')}
- Macro adjustments: ${JSON.stringify(constraints.macroAdjustments)}
- Notes: ${constraints.notes}`;
  }

  private static checkMacroConflict(macros: any, constraints: DietaryConstraints): boolean {
    if (constraints.macroAdjustments.carbs.includes('minimize') && macros.carbs > 50) {
      return true;
    }
    if (constraints.macroAdjustments.fat.includes('high') && (macros.fat / macros.calories * 9) < 0.6) {
      return true;
    }
    return false;
  }

  private static buildMacroConflictSection(macros: any, constraints: DietaryConstraints, preferences: string): string {
    return `
⚠️ MACRO CONFLICT DETECTED:
The calculated macros assume a balanced diet, but "${preferences}" requires:
- Carbs: ${constraints.macroAdjustments.carbs}
- Protein: ${constraints.macroAdjustments.protein}
- Fat: ${constraints.macroAdjustments.fat}

YOU MUST adjust macros to fit the diet. Recalculate as:
- Protein: ${macros.protein}g (maintain for muscle)
- Carbs: <5g (dietary requirement)
- Fat: ~${Math.round((macros.calories - macros.protein*4 - 5*4)/9)}g (fill remaining calories)
`;
  }

  private static formatTrainingSchedule(weeklyOutlines: any[]): string {
    return weeklyOutlines.slice(0, 4).map(week => `
Week ${week.weekNumber}: ${week.trainingSchedule?.resistanceDays?.length || 0} training days
  - Training: ${week.trainingSchedule?.resistanceDays?.join(', ') || 'Not specified'}
  - Rest: ${week.trainingSchedule?.restDays?.join(', ') || 'Not specified'}
`).join('\n');
  }
}
