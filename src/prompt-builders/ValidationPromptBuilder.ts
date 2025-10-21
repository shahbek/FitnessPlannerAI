// Phase 10: Validation Prompt Builder
// Builds context-aware prompts for plan validation and consistency checking

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';

export class ValidationPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    completePlan: any
  ): string {
    const { weightKg } = userProfile;
    const dailyDeficit = completePlan.metrics?.tdee?.value - completePlan.metrics?.macros?.calories || 0;
    
    return `
Validate complete fitness plan for internal consistency:

USER REQUIREMENTS:
${JSON.stringify(userProfile, null, 2)}

GENERATED PLAN:
${JSON.stringify(completePlan, null, 2)}

CHECK FOR VIOLATIONS:

1. **Dietary Compliance**:
   - Are there ANY meals containing forbidden foods?
   - List specific violations with meal name + ingredient

2. **Macro Consistency**:
   - Do meal macros sum to daily targets (±50 cal tolerance)?
   - Is protein adequate (≥1.6g/kg)?

3. **Training Logic**:
   - Does weekly volume match framework targets?
   - Are exercise IDs in sessions actually in the library?
   - Is equipment used available to user?

4. **Progressive Overload**:
   - Does training intensity increase over phases?
   - Are deloads scheduled if >12 weeks?

5. **Recovery**:
   - Given ${dailyDeficit} cal deficit, is volume sustainable?
   - Are rest days distributed appropriately?

6. **Timeline Feasibility**:
   - Is the timeline realistic for the goal?
   - Are there any red flags in the progression?

7. **Equipment Match**:
   - Do all exercises use available equipment?
   - Are there any equipment mismatches?

Return specific violations with fix suggestions.

EVIDENCE-BASED REQUIREMENTS:
- Dietary compliance at ingredient level
- Macro targets within evidence-based ranges
- Training volume appropriate for deficit
- Progressive overload properly implemented
- Recovery adequate for sustainability
- Timeline realistic for goal achievement

Return structured validation results with specific violations and fixes.
`;
  }
}
