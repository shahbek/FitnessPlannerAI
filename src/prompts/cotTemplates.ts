/**
 * Chain-of-Thought Prompt Templates
 * 
 * Base templates for CoT reasoning in meal planning workflows
 */

export interface CoTPromptContext {
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFats?: number;
  userPreferences?: string;
  dietaryRestrictions?: string[];
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  availableIngredients?: Array<{
    name: string;
    macrosPer100g: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  }>;
}

/**
 * Base CoT prompt template
 */
export function buildCoTPrompt(
  task: string,
  context?: CoTPromptContext
): string {
  const contextSection = context ? formatContext(context) : '';
  
  return `You are a systematic nutritionist solving a meal planning problem. Think through this step by step.

${task}

${contextSection}

Please show your reasoning:
1. Break down the problem into clear steps
2. Show your calculations or thought process for each step
3. Verify your answer before finalizing

Format your response with clear reasoning steps.`;
}

/**
 * Format context for prompt
 */
function formatContext(context: CoTPromptContext): string {
  const parts: string[] = [];

  if (context.targetCalories || context.targetProtein || context.targetCarbs || context.targetFats) {
    parts.push('Target macros:');
    if (context.targetCalories) parts.push(`- Calories: ${context.targetCalories} kcal`);
    if (context.targetProtein) parts.push(`- Protein: ${context.targetProtein}g`);
    if (context.targetCarbs) parts.push(`- Carbs: ${context.targetCarbs}g`);
    if (context.targetFats) parts.push(`- Fats: ${context.targetFats}g`);
  }

  if (context.userPreferences) {
    parts.push(`User preferences: ${context.userPreferences}`);
  }

  if (context.dietaryRestrictions && context.dietaryRestrictions.length > 0) {
    parts.push(`Dietary restrictions: ${context.dietaryRestrictions.join(', ')}`);
  }

  if (context.mealType) {
    parts.push(`Meal type: ${context.mealType}`);
  }

  if (context.availableIngredients && context.availableIngredients.length > 0) {
    parts.push('Available ingredients with nutrition data:');
    context.availableIngredients.forEach(ing => {
      parts.push(
        `- ${ing.name}: ${ing.macrosPer100g.calories} kcal, ${ing.macrosPer100g.protein}g protein, ${ing.macrosPer100g.carbs}g carbs, ${ing.macrosPer100g.fats}g fats (per 100g)`
      );
    });
  }

  return parts.join('\n');
}

/**
 * Meal Structure Planning CoT Template
 */
export function buildMealStructureCoTPrompt(
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFats: number,
  mealFrequency: number = 4,
  isTrainingDay: boolean = false
): string {
  return buildCoTPrompt(
    `Plan a meal structure for a day with ${mealFrequency} meals that meets the target macros.`,
    {
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFats,
    }
  ) + `

Think step by step:
1. First, consider how to distribute ${targetCalories} calories across ${mealFrequency} meals
   - Breakfast typically: 20-25% of daily calories
   - Lunch: 30-35% of daily calories
   - Dinner: 30-35% of daily calories
   - Snacks: Remaining calories

2. Then, allocate protein to each meal (aim for 20-40g per meal for optimal absorption)
   - Distribute ${targetProtein}g protein across meals
   - Ensure each meal has adequate protein

3. Distribute carbs (consider timing: ${isTrainingDay ? 'more carbs around workouts' : 'balanced distribution'})
   - Total carbs: ${targetCarbs}g
   - ${isTrainingDay ? 'Higher carbs pre/post workout' : 'Even distribution throughout the day'}

4. Allocate fats (essential for satiety and hormone production)
   - Total fats: ${targetFats}g
   - Include healthy fats in each meal

5. Verify: Do the totals match targets?
   - Sum calories: Should equal ${targetCalories} kcal
   - Sum protein: Should equal ${targetProtein}g
   - Sum carbs: Should equal ${targetCarbs}g
   - Sum fats: Should equal ${targetFats}g

Generate a meal structure plan with specific calorie and macro targets for each meal.`;
}

/**
 * Portion Calculation CoT Template
 */
export function buildPortionCalculationCoTPrompt(
  mealStructure: {
    mealType: string;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFats: number;
  },
  availableIngredients: Array<{
    name: string;
    macrosPer100g: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  }>
): string {
  const ingredientsList = availableIngredients
    .map(
      ing =>
        `- ${ing.name}: ${ing.macrosPer100g.calories} kcal, ${ing.macrosPer100g.protein}g protein, ${ing.macrosPer100g.carbs}g carbs, ${ing.macrosPer100g.fats}g fats (per 100g)`
    )
    .join('\n');

  return buildCoTPrompt(
    `Calculate the exact portions for each ingredient to create a ${mealStructure.mealType} that meets the target macros.`,
    {
      targetCalories: mealStructure.targetCalories,
      targetProtein: mealStructure.targetProtein,
      targetCarbs: mealStructure.targetCarbs,
      targetFats: mealStructure.targetFats,
      availableIngredients,
    }
  ) + `

Meal target:
- Calories: ${mealStructure.targetCalories} kcal
- Protein: ${mealStructure.targetProtein}g
- Carbs: ${mealStructure.targetCarbs}g
- Fats: ${mealStructure.targetFats}g

Available ingredients with USDA nutrition data:
${ingredientsList}

Think step by step:
1. For each ingredient, calculate how much is needed to meet the meal's macro targets
   - Start with protein source (e.g., chicken) - calculate portion to meet protein goal
   - Formula: (target protein / protein per 100g) × 100 = grams needed

2. Add carbohydrate source (e.g., rice) - calculate portion to meet carb goal
   - Formula: (target carbs / carbs per 100g) × 100 = grams needed

3. Add fat source if needed (e.g., olive oil) - calculate portion to meet fat goal
   - Formula: (target fats / fats per 100g) × 100 = grams needed

4. Add vegetables (minimal macros, for volume and nutrients)
   - Use small amounts, account for their macros

5. Calculate total macros: [show work]
   - For each ingredient: portion (g) × (macro per 100g / 100) = macro contribution
   - Sum all contributions

6. Compare to targets: [show comparison]
   - Calories: calculated vs ${mealStructure.targetCalories} kcal
   - Protein: calculated vs ${mealStructure.targetProtein}g
   - Carbs: calculated vs ${mealStructure.targetCarbs}g
   - Fats: calculated vs ${mealStructure.targetFats}g

7. If mismatch, adjust portions
   - If over target: reduce portions
   - If under target: increase portions or add another ingredient

Generate the final meal with exact portions in grams for each ingredient.`;
}

/**
 * Correction CoT Template
 */
export function buildCorrectionCoTPrompt(
  originalPrompt: string,
  originalResult: any,
  verificationFailure: {
    message: string;
    targetCalories?: number;
    targetProtein?: number;
    targetCarbs?: number;
    targetFats?: number;
    calculatedCalories?: number;
    calculatedProtein?: number;
    calculatedCarbs?: number;
    calculatedFats?: number;
    corrections?: string[];
  }
): string {
  const differences: string[] = [];
  
  if (verificationFailure.targetCalories && verificationFailure.calculatedCalories) {
    const diff = verificationFailure.calculatedCalories - verificationFailure.targetCalories;
    differences.push(`Calories: ${diff > 0 ? '+' : ''}${diff} kcal (target: ${verificationFailure.targetCalories}, calculated: ${verificationFailure.calculatedCalories})`);
  }
  
  if (verificationFailure.targetProtein && verificationFailure.calculatedProtein) {
    const diff = verificationFailure.calculatedProtein - verificationFailure.targetProtein;
    differences.push(`Protein: ${diff > 0 ? '+' : ''}${diff}g (target: ${verificationFailure.targetProtein}, calculated: ${verificationFailure.calculatedProtein})`);
  }
  
  if (verificationFailure.targetCarbs && verificationFailure.calculatedCarbs) {
    const diff = verificationFailure.calculatedCarbs - verificationFailure.targetCarbs;
    differences.push(`Carbs: ${diff > 0 ? '+' : ''}${diff}g (target: ${verificationFailure.targetCarbs}, calculated: ${verificationFailure.calculatedCarbs})`);
  }
  
  if (verificationFailure.targetFats && verificationFailure.calculatedFats) {
    const diff = verificationFailure.calculatedFats - verificationFailure.targetFats;
    differences.push(`Fats: ${diff > 0 ? '+' : ''}${diff}g (target: ${verificationFailure.targetFats}, calculated: ${verificationFailure.calculatedFats})`);
  }

  return buildCoTPrompt(
    `Previous attempt failed verification. Correct the meal to meet the exact targets.`,
    {
      targetCalories: verificationFailure.targetCalories,
      targetProtein: verificationFailure.targetProtein,
      targetCarbs: verificationFailure.targetCarbs,
      targetFats: verificationFailure.targetFats,
    }
  ) + `

Verification failed: ${verificationFailure.message}

Original task:
${originalPrompt}

Previous result:
${JSON.stringify(originalResult, null, 2)}

Differences from target:
${differences.join('\n')}

Corrections needed:
${verificationFailure.corrections?.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Please review and correct the issues'}

HARD CONSTRAINTS (DO NOT VIOLATE):
1. Egg portions must be ≤ 200g (≈4 eggs max)
2. Meat or fish portions must be ≤ 400g
3. Oil, butter, or other pure fat portions must be ≤ 50g
4. Carb sources (rice, pasta, oats, bread, potatoes) must be ≤ 250g
5. Every portion must be ≥ 10g (no token amounts)
6. Total meal calories must stay within ±15% of target
7. Protein must be within ±3% of target and within ±5g
8. All macros must satisfy BOTH percentage and absolute tolerances
9. Ingredient names must remain specific (use precise cuts/varieties such as "chicken breast", "sirloin steak", "jasmine rice"; never generic labels like "chicken" or "beef").

Think step by step:
1. Identify which macros are off (over or under target)
2. Determine the best strategy to fix:
   - If protein is low: increase protein source or add high-protein food
   - If calories are high: reduce portions or swap to lower-calorie options
   - If carbs are off: adjust carb source portion
   - If fats are off: adjust fat source portion
3. Calculate new portions
4. Verify again: Do new totals match targets?

Generate the corrected meal with exact portions.`;
}

/**
 * Meal Structure Parser CoT Template
 */
export function buildMealStructureParserCoTPrompt(
  mealStructureText: string
): string {
  return `Parse the following meal structure into a structured format.

Meal structure text:
${mealStructureText}

Extract:
- Meal type (breakfast, lunch, dinner, snack)
- Target calories for each meal
- Target protein for each meal
- Target carbs for each meal
- Target fats for each meal

Verify:
- Do all meal calories sum to the daily target?
- Do all meal proteins sum to the daily target?
- Do all meal carbs sum to the daily target?
- Do all meal fats sum to the daily target?

Return a structured list of meals with their macro targets.`;
}

