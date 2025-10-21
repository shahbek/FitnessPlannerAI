// Phase 9: Shopping List Prompt Builder
// Builds context-aware prompts for shopping list generation

import { UserProfile } from '@/types';

export class ShoppingListPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    mealTemplates: any[],
    timeline: number
  ): string {
    const { mealFrequency } = userProfile;
    
    return `
Generate shopping list from meal templates:

MEAL TEMPLATES:
${this.summarizeMealTemplates(mealTemplates)}

TIMELINE: ${timeline} weeks
MEAL FREQUENCY: ${mealFrequency}/day

Create comprehensive shopping list:
1. Aggregate all ingredients across all meals
2. Calculate weekly quantities (assume meal rotation)
3. Organize by store category (meat, dairy, produce, pantry, supplements)
4. Estimate costs (optional)
5. Mark priority items (staples needed weekly vs occasional)

Format for practical grocery shopping.

EVIDENCE-BASED REQUIREMENTS:
- Realistic quantities based on meal frequency and timeline
- Organized by grocery store layout
- Priority items clearly marked
- Cost estimates for budget planning
- Seasonal and availability considerations

Return structured shopping list with categories and quantities.
`;
  }

  private static summarizeMealTemplates(mealTemplates: any[]): string {
    if (!mealTemplates || mealTemplates.length === 0) {
      return 'No meal templates available';
    }
    
    const mealNames = mealTemplates.map(meal => meal.name).filter(Boolean);
    const uniqueMeals = [...new Set(mealNames)];
    
    return uniqueMeals.slice(0, 10).join(', ') + (uniqueMeals.length > 10 ? `... and ${uniqueMeals.length - 10} more` : '');
  }
}
