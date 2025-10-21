// Phase 1: Feasibility Assessment Prompt Builder
// Builds context-aware prompts for goal feasibility evaluation

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';

export class FeasibilityPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    scientificLimits: any
  ): string {
    const { age, sex, weightKg, heightCm, bodyFat, targetBf, goal, timelineWeeks, workoutLevel, trainingDaysPerWeek } = userProfile;
    
    return `
Assess feasibility of this fitness goal:

USER PROFILE:
- Age: ${age}, Sex: ${sex}
- Weight: ${weightKg}kg, Height: ${heightCm}cm
- Body Fat: ${bodyFat}% → Target: ${targetBf}% (${bodyFat - targetBf}% to lose)
- Goal: ${goal}
- Timeline: ${timelineWeeks} weeks
- Experience: ${workoutLevel}
- Training days: ${trainingDaysPerWeek}/week

DIETARY CONSTRAINTS:
${this.formatConstraints(dietaryConstraints)}

SCIENTIFIC LIMITS:
- Safe fat loss: 0.5-1% bodyweight per week
- Minimum protein: 1.6g/kg for muscle preservation
- Training frequency: minimum 3x/week for hypertrophy
- Maximum sustainable deficit: 25% of TDEE

CRITICAL QUESTIONS:
1. Can user reach ${targetBf}% from ${bodyFat}% in ${timelineWeeks} weeks safely?
2. Is "${userProfile.preferences}" compatible with ${goal} goals?
3. Are there any red flags (too aggressive, insufficient recovery, etc.)?

EVIDENCE-BASED ASSESSMENT REQUIREMENTS:
1. Calculate minimum safe timeline based on fat loss rate
2. Evaluate dietary preference compatibility with goal
3. Assess training frequency adequacy
4. Identify potential risks and mitigation strategies

Return structured assessment with specific calculations and evidence-based recommendations.
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
