// Phase 2: Metabolic Calculations Prompt Builder
// Builds context-aware prompts for BMR/TDEE/macro calculations

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class MetabolicPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    feasibility: any,
    metrics: PlanningMetrics
  ): string {
    const { age, sex, weightKg, heightCm, bodyFat, workoutLevel, trainingDaysPerWeek, workoutSplit } = userProfile;
    const lbm = weightKg * (1 - bodyFat / 100);
    
    return `
Calculate evidence-based metabolic metrics:

USER DATA:
- Age: ${age}, Sex: ${sex}
- Weight: ${weightKg}kg, Height: ${heightCm}cm
- Body Fat: ${bodyFat}%
- LBM: ${lbm.toFixed(1)}kg (calculated)

ACTIVITY:
- Training days: ${trainingDaysPerWeek}/week
- Training type: ${workoutSplit}
- Activity level: ${workoutLevel}

DIETARY CONSTRAINTS:
${this.formatConstraints(dietaryConstraints)}
${dietaryConstraints.macroAdjustments.carbs === 'minimize' ? 
  '⚠️ NOTE: Carnivore diet - carbs will be <5g, adjust macros accordingly' : ''}

FEASIBILITY RESULTS:
- Target weekly fat loss: ${feasibility.evidenceLimits?.maxFatLossPerWeek || 0.5}kg
- Adjusted timeline: ${feasibility.evidenceLimits?.minWeeksRequired || userProfile.timelineWeeks} weeks

CALCULATE:
1. BMR (use Katch-McArdle: 370 + 21.6*LBM)
2. TDEE (BMR × activity factor)
3. Target deficit (for ${feasibility.evidenceLimits?.maxFatLossPerWeek || 0.5}kg/week loss)
4. Macro split (protein, fat, carbs)
   - Protein: 2.0-2.4g/kg (muscle preservation during deficit)
   - Adjust carbs/fat based on dietary preference
   - If diet conflicts with calculated macros, prioritize diet and explain

EVIDENCE-BASED REQUIREMENTS:
- Use Katch-McArdle formula for BMR (most accurate for body composition)
- Apply appropriate activity factor based on training frequency
- Ensure protein targets preserve muscle mass during deficit
- Adjust macros to respect dietary constraints

Cite all formulas and sources.
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
}
