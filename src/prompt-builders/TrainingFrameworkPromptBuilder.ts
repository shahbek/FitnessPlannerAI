// Phase 3: Training Framework Prompt Builder
// Builds context-aware prompts for training framework design

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class TrainingFrameworkPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    feasibility: any,
    metrics: PlanningMetrics
  ): string {
    const { workoutLevel, workoutSplit, trainingDaysPerWeek, equipment } = userProfile;
    const dailyDeficit = metrics.tdee.value - metrics.macros.calories;
    const deficitMagnitude = dailyDeficit > 500 ? 'aggressive' : dailyDeficit > 300 ? 'moderate' : 'conservative';
    
    return `
Design training framework for ${userProfile.goal}:

USER TRAINING PROFILE:
- Experience: ${workoutLevel}
- Split preference: ${workoutSplit}
- Available days: ${trainingDaysPerWeek}/week
- Equipment: ${equipment}

METABOLIC CONTEXT:
- Daily deficit: ${dailyDeficit} cal (${deficitMagnitude})
- Starting calories: ${metrics.tdee.value}
- Ending calories: ~${Math.round(metrics.tdee.value - (userProfile.timelineWeeks * dailyDeficit))}
- Protein target: ${metrics.macros.protein}g (${(metrics.macros.protein / userProfile.weightKg).toFixed(2)}g/kg)

DIETARY CONTEXT:
- Preference: ${userProfile.preferences}
- Macros: ${metrics.macros.protein}p / ${metrics.macros.carbs}c / ${metrics.macros.fat}f
${dietaryConstraints.macroAdjustments.carbs === 'minimize' ? 
  '⚠️ Very low carb - adjust training intensity and volume expectations' : ''}

DESIGN REQUIREMENTS:
1. **Volume**: Set weekly volume per muscle group
   - Consider: deficit magnitude, recovery capacity, carb availability
   - Lower carb = potentially lower max volume tolerance
2. **Frequency**: Distribute across ${trainingDaysPerWeek} days
3. **Progression**: How to progress over ${userProfile.timelineWeeks} weeks
4. **Cardio**: When/how to introduce (if needed)

IMPORTANT: 
- In a deficit, prioritize maintaining strength over building
- Lower carb diets may require volume adjustments
- Don't over-train in aggressive deficits
- Consider energy availability for training intensity

EVIDENCE-BASED REQUIREMENTS:
- Volume should be sustainable given caloric deficit
- Frequency should match user availability and recovery capacity
- Progression should account for metabolic adaptation
- Cardio should complement, not compete with resistance training

Return structured framework with specific volume targets and progression scheme.
`;
  }
}
