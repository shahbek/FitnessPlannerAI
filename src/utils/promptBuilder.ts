// Generic Prompt Builder with Constraint Propagation
// Builds dynamic prompts that explicitly pass dietary constraints and preferences

import { parseMultiplePreferences, extractFoodDislikes, extractFoodPreferences } from './preferenceParser';
import { formatFoodCategory, checkMacroConflict, calculateAdjustedFat } from './dietaryConstraints';

export interface UserProfile {
  preferences: string;
  mealFrequency: number;
  // Goal can come from either goalCategory (new) or goal (legacy)
  goalCategory?: string;
  goal?: string;
  timelineWeeks: number;
  targetBf?: number;
  experienceLevel?: string;
  [key: string]: any;
}

export interface Metrics {
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  [key: string]: any;
}

export function buildMealPrompt(userProfile: UserProfile, metrics: Metrics): string {
  const dietaryConstraints = parseMultiplePreferences(userProfile.preferences);
  const foodDislikes = extractFoodDislikes(userProfile.preferences);
  const foodPreferences = extractFoodPreferences(userProfile.preferences);
  
  const constraintSection = buildConstraintSection(dietaryConstraints, foodDislikes, foodPreferences);
  const macroSection = buildMacroSection(metrics.macros, dietaryConstraints);
  
  return `
Create phase-specific meal templates for this user:

USER DIETARY PREFERENCE: "${userProfile.preferences}"
${constraintSection}

MACRO TARGETS (may need adjustment based on dietary constraints):
${macroSection}

MEAL REQUIREMENTS:
- Frequency: ${userProfile.mealFrequency} meals per day
- Total daily calories: ${metrics.macros.calories}
- Must comply with dietary constraints above

INSTRUCTIONS:
1. **STRICT COMPLIANCE**: Every meal must respect the dietary constraints
2. **MACRO ADJUSTMENT**: If standard macros conflict with diet (e.g., carnivore won't hit carb targets), 
   adjust macros to fit the diet and explain the adjustment in your response
3. **FOOD VARIETY**: Provide diverse options within the allowed foods
4. **PRACTICAL**: Use commonly available ingredients
5. **PHASE APPROPRIATE**: Adjust meal complexity across foundation/progression/peak phases

🔬 **CRITICAL NUTRITIONAL RESEARCH REQUIREMENT**:
For EVERY ingredient in EVERY meal, you MUST research and provide ACCURATE nutritional data:

**REQUIRED FOR EACH INGREDIENT:**
- **Exact weight/volume** (e.g., "100g avocado", "2 slices whole grain bread", "1 large egg")
- **Real calories per serving** (from USDA database or verified nutrition sources)
- **Actual protein content** (grams per serving)
- **Actual carbohydrate content** (grams per serving) 
- **Actual fat content** (grams per serving)
- **Fiber content** (if significant)
- **Key micronutrients** (if notable, e.g., "rich in vitamin C")

**EXAMPLES OF ACCURATE RESEARCH:**
❌ WRONG: "Avocado toast: ~400 calories, ~15g protein, ~30g carbs, ~20g fat"
✅ CORRECT: "2 slices whole grain bread (60g): 160 cal, 6g protein, 30g carbs, 2g fat
            + 1 medium avocado (150g): 240 cal, 3g protein, 13g carbs, 22g fat
            + 1 tsp olive oil (5ml): 40 cal, 0g protein, 0g carbs, 4.5g fat
            = TOTAL: 440 cal, 9g protein, 43g carbs, 28.5g fat"

**RESEARCH SOURCES TO USE:**
- USDA FoodData Central database
- Nutrition.gov verified data
- USDA National Nutrient Database
- Food manufacturer nutrition labels
- Registered dietitian resources

**VALIDATION REQUIREMENTS:**
- Each ingredient's macros must be verifiable
- Total meal macros must equal sum of ingredient macros
- Portion sizes must be realistic and measurable
- No "estimated" or "approximately" values - use exact data

If you cannot find accurate nutritional data for an ingredient, choose a different ingredient with verified data.

Generate meal templates with RESEARCHED, ACCURATE nutritional data in the specified JSON format.
`;
}

function buildConstraintSection(
  constraints: any, 
  foodDislikes: string[], 
  foodPreferences: string[]
): string {
  if (constraints.include.includes('all_foods') && constraints.exclude.length === 0) {
    return `
DIETARY CONSTRAINTS: Flexible (no restrictions)
- Include: All food groups
- Exclude: None
- Notes: ${constraints.notes}

${foodDislikes.length > 0 ? `FOODS TO AVOID: ${foodDislikes.join(', ')}` : ''}
${foodPreferences.length > 0 ? `PREFERRED FOODS: ${foodPreferences.join(', ')}` : ''}
`;
  }
  
  return `
DIETARY CONSTRAINTS - MANDATORY RULES:

✅ MUST INCLUDE ONLY:
${constraints.include.map((item: string) => `   - ${formatFoodCategory(item)}`).join('\n')}

❌ MUST EXCLUDE (absolutely forbidden):
${constraints.exclude.map((item: string) => `   - ${formatFoodCategory(item)}`).join('\n')}

📋 MACRO ADJUSTMENTS FOR THIS DIET:
   - Carbs: ${constraints.macroAdjustments.carbs}
   - Protein: ${constraints.macroAdjustments.protein}
   - Fat: ${constraints.macroAdjustments.fat}

⚠️  IMPORTANT NOTES:
   ${constraints.notes}

${foodDislikes.length > 0 ? `\n🚫 SPECIFIC FOODS TO AVOID: ${foodDislikes.join(', ')}` : ''}
${foodPreferences.length > 0 ? `\n❤️  PREFERRED FOODS: ${foodPreferences.join(', ')}` : ''}
`;
}

function buildMacroSection(macros: any, constraints: any): string {
  const needsAdjustment = checkMacroConflict(macros, constraints);
  
  if (needsAdjustment) {
    return `
ORIGINAL MACRO TARGETS (from TDEE calculation):
- Calories: ${macros.calories}
- Protein: ${macros.protein}g
- Carbs: ${macros.carbs}g
- Fat: ${macros.fat}g

⚠️  WARNING: These macros may conflict with dietary constraints
ADJUSTED APPROACH:
${constraints.macroAdjustments.carbs.includes('minimize') ? 
  `- Carbs will be <5g (dietary requirement overrides calculated target)` : ''}
${constraints.macroAdjustments.protein.includes('ensure') ? 
  `- Protein maintained at ${macros.protein}g` : ''}
${constraints.macroAdjustments.fat.includes('high') ? 
  `- Fat will make up remaining calories (~${calculateAdjustedFat(macros, constraints)}g)` : ''}

**Prioritize dietary compliance over hitting exact macro targets. Adjust and explain.**
`;
  }
  
  return `
MACRO TARGETS (aligned with dietary preference):
- Calories: ${macros.calories}
- Protein: ${macros.protein}g
- Carbs: ${macros.carbs}g  
- Fat: ${macros.fat}g
`;
}

// Build training prompt with constraints
export function buildTrainingPrompt(userProfile: UserProfile, _metrics: any): string {
  const dietaryConstraints = parseMultiplePreferences(userProfile.preferences);
  
  return `
Create phase-specific session templates for this user:

User Profile:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${userProfile.equipment}
- Split: ${userProfile.workoutSplit}
- Training days: ${userProfile.trainingDaysPerWeek}/week
- Timeline: ${userProfile.timelineWeeks} weeks

DIETARY CONSIDERATIONS:
${dietaryConstraints.notes}

${dietaryConstraints.macroAdjustments.protein.includes('ensure') ? 
  `⚠️  IMPORTANT: User's diet requires adequate protein (${dietaryConstraints.macroAdjustments.protein}). 
   Design workouts that support protein synthesis and recovery.` : ''}

${dietaryConstraints.macroAdjustments.carbs.includes('minimize') ? 
  `⚠️  IMPORTANT: User follows a low-carb diet. Consider energy availability and 
   design workouts that work with limited glycogen stores.` : ''}

Create session templates that work synergistically with the user's dietary approach.
`;
}

// Build exercise library prompt with constraints
export function buildExercisePrompt(userProfile: UserProfile, framework: any, metrics: any): string {
  const dietaryConstraints = parseMultiplePreferences(userProfile.preferences);
  
  return `
Generate phase-specific exercise libraries for this user:

User Profile:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${userProfile.equipment}
- Split: ${framework?.trainingApproach?.split || userProfile.workoutSplit}
- Target muscles: ${Object.keys(framework?.trainingApproach?.volumePerMuscleWeekly || {}).join(', ')}
- Recommended weekly sets: ${metrics.trainingVolume.value}

DIETARY CONSIDERATIONS:
${dietaryConstraints.notes}

${dietaryConstraints.macroAdjustments.protein.includes('ensure') ? 
  `⚠️  IMPORTANT: User's diet prioritizes protein. Include exercises that maximize 
   muscle protein synthesis and recovery.` : ''}

${dietaryConstraints.macroAdjustments.carbs.includes('minimize') ? 
  `⚠️  IMPORTANT: User follows a low-carb diet. Focus on exercises that are 
   sustainable with limited glycogen stores.` : ''}

Create exercise libraries that complement the user's dietary approach.
`;
}
