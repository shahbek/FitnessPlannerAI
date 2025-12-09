/**
 * Supplement Meal Generator
 * 
 * Generates high-protein, low-calorie supplement meals during plan generation.
 * These are used as backup when regular meals don't hit protein targets.
 * 
 * Key features:
 * - AI generates fresh supplement meals for each plan
 * - Meals are designed to be high-protein, low-calorie
 * - LP algorithm adjusts quantities to hit exact protein targets
 * - Consistent with how regular meals are handled
 */

import { z } from 'zod';
import { MacroValues } from '../types/nutrition';
import { UserProfile } from '../models/UserProfile';

/**
 * Schema for supplement meals
 */
const SupplementMealSchema = z.object({
  name: z.string().describe('Short, descriptive name (e.g., "Chocolate Whey Shake", "Greek Yogurt Protein Bowl")'),
  description: z.string().describe('Brief description of the meal'),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.number().describe('Amount in grams'),
    macrosPerGram: z.object({
      protein: z.number().describe('Protein per gram'),
      carbs: z.number().describe('Carbs per gram'),
      fats: z.number().describe('Fats per gram'),
      calories: z.number().describe('Calories per gram'),
    }),
  })),
  totalMacros: z.object({
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
    calories: z.number(),
  }),
  instructions: z.array(z.string()),
  proteinDensity: z.number().describe('Protein per calorie ratio (higher = better)'),
});

const SupplementMealsResponseSchema = z.object({
  supplementMeals: z.array(SupplementMealSchema).min(3).max(6),
});

export type SupplementMeal = z.infer<typeof SupplementMealSchema>;

/**
 * Supplement meal with adjusted quantities
 */
export interface AdjustedSupplementMeal {
  originalMeal: SupplementMeal;
  adjustedIngredients: Array<{
    name: string;
    originalAmount: number;
    adjustedAmount: number;
    macros: MacroValues;
  }>;
  adjustedMacros: MacroValues;
  scaleFactor: number;
}

/**
 * Generate high-protein supplement meals using AI
 */
export async function generateSupplementMeals(
  userProfile: UserProfile,
  apiKey: string,
  endpoint: string,
  model: string,
  options?: {
    count?: number;
    preferences?: string;
  }
): Promise<SupplementMeal[]> {
  const { createGroq } = await import('@ai-sdk/groq');
  const { generateObject } = await import('ai');
  
  const count = options?.count || 4;
  const preferences = options?.preferences || userProfile.preferences || '';
  
  const prompt = `Generate ${count} HIGH-PROTEIN, LOW-CALORIE supplement meals.

These meals will be used to boost protein intake when daily targets aren't met.

USER CONTEXT:
- Weight: ${userProfile.weightKg}kg
- Daily protein target: ~${Math.round(userProfile.weightKg * 2.2)}g
- Dietary preferences: ${preferences || 'None specified'}

REQUIREMENTS FOR EACH SUPPLEMENT MEAL:
1. HIGH PROTEIN DENSITY: At least 0.15g protein per calorie (ideally 0.20+)
2. LOW TOTAL CALORIES: Under 300 calories per serving
3. PROTEIN FOCUSED: 20-40g protein per serving
4. PRACTICAL: Easy to prepare (5 minutes or less)
5. ADJUSTABLE: Ingredients that can be scaled up/down

MEAL TYPES TO INCLUDE (variety):
- Protein shake variants (whey, casein, plant-based)
- Greek yogurt based
- Egg-based (egg whites, hard boiled)
- Lean meat based (turkey, chicken, tuna)
- Cottage cheese based

FOR EACH INGREDIENT, PROVIDE ACCURATE MACROS PER GRAM:
- Use USDA data or standard nutrition values
- Whey protein: ~0.80g protein/g, ~0.05g carbs/g, ~0.02g fats/g, ~3.6 cal/g
- Greek yogurt (nonfat): ~0.10g protein/g, ~0.04g carbs/g, ~0.00g fats/g, ~0.59 cal/g
- Egg whites: ~0.11g protein/g, ~0.01g carbs/g, ~0.00g fats/g, ~0.52 cal/g
- Chicken breast: ~0.31g protein/g, ~0.00g carbs/g, ~0.04g fats/g, ~1.65 cal/g
- Cottage cheese (low-fat): ~0.12g protein/g, ~0.03g carbs/g, ~0.01g fats/g, ~0.72 cal/g

CRITICAL: Calculate proteinDensity as (protein / calories).
Higher values = better for protein supplementation.

Generate exactly ${count} diverse supplement meals.`;

  try {
    const groq = createGroq({ apiKey });
    
    const result = await generateObject({
      model: groq(model),
      schema: SupplementMealsResponseSchema,
      prompt,
      temperature: 0.7,
    });

    const meals = result.object.supplementMeals;
    
    // Sort by protein density (highest first)
    meals.sort((a, b) => b.proteinDensity - a.proteinDensity);
    
    console.log(`✅ Generated ${meals.length} supplement meals:`);
    meals.forEach((meal, i) => {
      console.log(`   ${i + 1}. ${meal.name}: ${meal.totalMacros.protein}g P, ${meal.totalMacros.calories} cal (density: ${meal.proteinDensity.toFixed(3)})`);
    });
    
    return meals;
  } catch (error) {
    console.error('❌ Failed to generate supplement meals:', error);
    // Return default fallback meals
    return getDefaultSupplementMeals();
  }
}

/**
 * Default supplement meals (fallback if AI generation fails)
 */
export function getDefaultSupplementMeals(): SupplementMeal[] {
  return [
    {
      name: 'Simple Whey Protein Shake',
      description: 'Quick protein shake with water - maximum protein density',
      ingredients: [
        { name: 'Whey Protein Powder', amount: 30, macrosPerGram: { protein: 0.80, carbs: 0.05, fats: 0.02, calories: 3.6 } },
        { name: 'Water', amount: 250, macrosPerGram: { protein: 0, carbs: 0, fats: 0, calories: 0 } },
      ],
      totalMacros: { protein: 24, carbs: 1.5, fats: 0.6, calories: 108 },
      instructions: ['Add protein powder to shaker', 'Add cold water', 'Shake well', 'Drink immediately'],
      proteinDensity: 0.222,
    },
    {
      name: 'Greek Yogurt Protein Bowl',
      description: 'Creamy Greek yogurt - high protein, low fat',
      ingredients: [
        { name: 'Non-Fat Greek Yogurt', amount: 200, macrosPerGram: { protein: 0.10, carbs: 0.04, fats: 0.00, calories: 0.59 } },
      ],
      totalMacros: { protein: 20, carbs: 8, fats: 0, calories: 118 },
      instructions: ['Scoop yogurt into bowl', 'Add a pinch of salt if desired', 'Enjoy'],
      proteinDensity: 0.169,
    },
    {
      name: 'Egg White Scramble',
      description: 'Pure protein from egg whites',
      ingredients: [
        { name: 'Egg Whites', amount: 200, macrosPerGram: { protein: 0.11, carbs: 0.01, fats: 0.00, calories: 0.52 } },
        { name: 'Salt', amount: 1, macrosPerGram: { protein: 0, carbs: 0, fats: 0, calories: 0 } },
      ],
      totalMacros: { protein: 22, carbs: 2, fats: 0, calories: 104 },
      instructions: ['Whisk egg whites', 'Cook in non-stick pan over medium heat', 'Season with salt'],
      proteinDensity: 0.212,
    },
    {
      name: 'Tuna Protein Pack',
      description: 'Canned tuna - lean protein powerhouse',
      ingredients: [
        { name: 'Canned Tuna in Water', amount: 120, macrosPerGram: { protein: 0.25, carbs: 0.00, fats: 0.01, calories: 1.08 } },
        { name: 'Lemon Juice', amount: 10, macrosPerGram: { protein: 0, carbs: 0.03, fats: 0, calories: 0.22 } },
      ],
      totalMacros: { protein: 30, carbs: 0.3, fats: 1.2, calories: 132 },
      instructions: ['Drain tuna', 'Add lemon juice', 'Season with pepper', 'Mix and enjoy'],
      proteinDensity: 0.227,
    },
  ];
}

/**
 * Adjust a supplement meal to hit a specific protein target using linear scaling
 * 
 * @param meal - The supplement meal to adjust
 * @param targetProtein - The protein amount needed (grams)
 * @param options - Adjustment options
 * @returns Adjusted meal with scaled ingredients
 */
export function adjustSupplementMealToTarget(
  meal: SupplementMeal,
  targetProtein: number,
  options?: {
    maxCalories?: number;
    minScaleFactor?: number;
    maxScaleFactor?: number;
  }
): AdjustedSupplementMeal {
  const { maxCalories = 500, minScaleFactor = 0.5, maxScaleFactor = 4.0 } = options || {};
  
  // Calculate ideal scale factor to hit protein target
  const idealScale = targetProtein / meal.totalMacros.protein;
  
  // Check calorie constraint
  const scaledCalories = meal.totalMacros.calories * idealScale;
  let finalScale = idealScale;
  
  if (maxCalories && scaledCalories > maxCalories) {
    // Cap by calorie limit
    finalScale = maxCalories / meal.totalMacros.calories;
    console.log(`   ⚠️ Scale capped by calorie limit: ${idealScale.toFixed(2)}x → ${finalScale.toFixed(2)}x`);
  }
  
  // Clamp to min/max scale factors
  finalScale = Math.max(minScaleFactor, Math.min(maxScaleFactor, finalScale));
  
  // Scale all ingredients
  const adjustedIngredients = meal.ingredients.map(ing => {
    const adjustedAmount = Math.round(ing.amount * finalScale);
    return {
      name: ing.name,
      originalAmount: ing.amount,
      adjustedAmount,
      macros: {
        protein: Math.round(adjustedAmount * ing.macrosPerGram.protein * 10) / 10,
        carbs: Math.round(adjustedAmount * ing.macrosPerGram.carbs * 10) / 10,
        fats: Math.round(adjustedAmount * ing.macrosPerGram.fats * 10) / 10,
        calories: Math.round(adjustedAmount * ing.macrosPerGram.calories),
      },
    };
  });
  
  // Calculate adjusted totals
  const adjustedMacros: MacroValues = adjustedIngredients.reduce(
    (sum, ing) => ({
      protein: sum.protein + ing.macros.protein,
      carbs: sum.carbs + ing.macros.carbs,
      fats: sum.fats + ing.macros.fats,
      calories: sum.calories + ing.macros.calories,
    }),
    { protein: 0, carbs: 0, fats: 0, calories: 0 }
  );
  
  return {
    originalMeal: meal,
    adjustedIngredients,
    adjustedMacros,
    scaleFactor: finalScale,
  };
}

/**
 * Find the best supplement meal for a protein deficit and adjust it
 */
export function selectAndAdjustSupplementMeal(
  supplementMeals: SupplementMeal[],
  proteinNeeded: number,
  options?: {
    maxCalories?: number;
    usedMealNames?: string[]; // For variety
  }
): AdjustedSupplementMeal | null {
  const { maxCalories = 400, usedMealNames = [] } = options || {};
  
  // Filter out already used meals for variety
  let candidates = supplementMeals.filter(m => !usedMealNames.includes(m.name));
  
  // If all used, allow repeats
  if (candidates.length === 0) {
    candidates = supplementMeals;
  }
  
  // Sort by protein density (best first)
  candidates.sort((a, b) => b.proteinDensity - a.proteinDensity);
  
  // Try each candidate
  for (const meal of candidates) {
    const adjusted = adjustSupplementMealToTarget(meal, proteinNeeded, { maxCalories });
    
    // Accept if it provides at least 50% of needed protein
    if (adjusted.adjustedMacros.protein >= proteinNeeded * 0.5) {
      return adjusted;
    }
  }
  
  // Fallback: return the highest density meal at max scale
  if (candidates.length > 0) {
    return adjustSupplementMealToTarget(candidates[0], proteinNeeded, { 
      maxCalories: maxCalories * 1.5, // Allow more calories as fallback
      maxScaleFactor: 5.0,
    });
  }
  
  return null;
}

