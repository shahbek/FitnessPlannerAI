/**
 * Portion Calculator
 * 
 * Calculates exact portions for ingredients using Chain-of-Thought
 * Integrates USDA nutrition data for accurate calculations
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { buildPortionCalculationCoTPrompt } from '../prompts/cotTemplates';
import { MacroValues } from '../types/nutrition';
import { IngredientWithNutrition } from './IngredientSelector';
import { MealStructure } from './MealStructurePlanner';
import { calculateMacrosForAmount, validateMacroValues } from '../utils/usdaMapper';
import { calculateMealMacros } from '../utils/macroCalculator';

const MIN_MACRO_PER_100G = 0.5;
const MIN_PORTION_GRAMS = 10;
const DEFAULT_MAX_PORTION_GRAMS = 300;

/**
 * Portion Calculation Schema
 */
export const PortionCalculationSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.number(), // in grams
      reasoning: z.string().optional(), // Why this amount was chosen
    })
  ),
  calculatedMacros: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
  }),
  reasoning: z.string().optional(), // Overall reasoning
});

export type PortionCalculation = z.infer<typeof PortionCalculationSchema>;

/**
 * Final Meal with Portions
 */
export interface MealWithPortions {
  mealType: string;
  ingredients: Array<{
    name: string;
    amount: number; // in grams
    nutrition: MacroValues; // Nutrition for this specific amount
    fdcId: number;
  }>;
  totalMacros: MacroValues;
  reasoning?: string;
}

/**
 * Portion Calculation Options
 */
export interface PortionCalculationOptions {
  enableReasoning?: boolean;
  onReasoningUpdate?: (reasoning: string) => void;
}

/**
 * Portion Calculator
 */
export class PortionCalculator {
  private cotService: ChainOfThoughtService;

  constructor(cotService: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  /**
   * Calculate portions for a meal using CoT
   */
  async calculatePortions(
    mealStructure: MealStructure['meals'][0],
    availableIngredients: IngredientWithNutrition[],
    options?: PortionCalculationOptions
  ): Promise<MealWithPortions> {
    // Check if AI is available, fall back to deterministic if not
    if (!this.cotService.isAIAvailable || !this.cotService.isAIAvailable()) {
      console.log('📊 Using deterministic portion calculation (AI unavailable)');
      return this.calculatePortionsDeterministic(mealStructure, availableIngredients);
    }

    try {
    // Build CoT prompt with USDA nutrition data
    const prompt = buildPortionCalculationCoTPrompt(
      {
        mealType: mealStructure.mealType,
        targetCalories: mealStructure.targetCalories,
        targetProtein: mealStructure.targetProtein,
        targetCarbs: mealStructure.targetCarbs,
        targetFats: mealStructure.targetFats,
      },
      availableIngredients.map(ing => ({
        name: ing.name,
        macrosPer100g: ing.nutrition,
      }))
    );

    // Generate with CoT
    const { result, reasoning } = await this.cotService.generateWithCoT(
      prompt,
      PortionCalculationSchema,
      {
        enableVerification: true,
        onStepUpdate: (step) => {
          if (options?.onReasoningUpdate) {
            options.onReasoningUpdate(step.thought);
          }
        },
      }
    );

    // Map calculated portions to ingredients with nutrition
    const ingredientsWithPortions = result.ingredients.map((calcIng) => {
      const ingredient = availableIngredients.find(
        ing => ing.name.toLowerCase() === calcIng.name.toLowerCase()
      );

      if (!ingredient) {
        throw new Error(`Ingredient "${calcIng.name}" not found in available ingredients`);
      }

      const safeAmount = this.enforcePortionLimits(
        ingredient.name,
        calcIng.amount
      );

      if (safeAmount < MIN_PORTION_GRAMS) {
        throw new Error(
          `Calculated portion for "${ingredient.name}" is below minimum (${safeAmount}g < ${MIN_PORTION_GRAMS}g)`
        );
      }

      // Calculate nutrition for the specific amount
      const nutrition = calculateMacrosForAmount(
        ingredient.nutrition,
        safeAmount,
        'g'
      );

      return {
        name: ingredient.name,
        amount: safeAmount,
        nutrition,
        fdcId: ingredient.fdcId,
      };
    });

    // Calculate total macros
    const totalMacros = calculateMealMacros(
      ingredientsWithPortions.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        macrosPer100g: availableIngredients.find(i => i.name === ing.name)!.nutrition,
      }))
    );

    const meal: MealWithPortions = {
      mealType: mealStructure.mealType,
      ingredients: ingredientsWithPortions,
      totalMacros,
      reasoning: reasoning.steps.map(s => s.thought).join('\n'),
    };

    const validation = this.validateMealRealism(meal.totalMacros, mealStructure, meal.ingredients);
    if (!validation.isValid) {
      throw new Error(`Generated meal failed validation: ${validation.errors.join('; ')}`);
    }

    return meal;
    } catch (error) {
      console.warn('⚠️  CoT portion calculation failed, falling back to deterministic method:', error);
      return this.calculatePortionsDeterministic(mealStructure, availableIngredients);
    }
  }

  /**
   * Calculate portions using deterministic algorithm (fallback)
   */
  calculatePortionsDeterministic(
    mealStructure: MealStructure['meals'][0],
    availableIngredients: IngredientWithNutrition[]
  ): MealWithPortions {
    const portions: Array<{ name: string; amount: number }> = [];
    let remainingProtein = mealStructure.targetProtein;
    let remainingCarbs = mealStructure.targetCarbs;
    let remainingFats = mealStructure.targetFats;

    // Sort ingredients by category
    const proteins = availableIngredients.filter(ing =>
      ing.category === 'protein'
    );
    const carbs = availableIngredients.filter(ing => ing.category === 'carb');
    const fats = availableIngredients.filter(ing => ing.category === 'fat');
    const vegetables = availableIngredients.filter(
      ing => ing.category === 'vegetable'
    );

    // Calculate protein source portion
    if (proteins.length > 0 && remainingProtein > 0) {
      const proteinSource = proteins[0];
      const proteinPer100g = proteinSource.nutrition.protein;
      if (proteinPer100g <= MIN_MACRO_PER_100G) {
        throw new Error(
          `Protein source "${proteinSource.name}" has insufficient protein (${proteinPer100g}g per 100g)`
        );
      }

      const rawAmount = Math.round((remainingProtein / proteinPer100g) * 100);
      const safeAmount = this.enforcePortionLimits(proteinSource.name, rawAmount);

      if (safeAmount < MIN_PORTION_GRAMS) {
        throw new Error(
          `Calculated protein portion for "${proteinSource.name}" below minimum (${safeAmount}g)`
        );
      }

      portions.push({ name: proteinSource.name, amount: safeAmount });
      remainingProtein = Math.max(0, remainingProtein - (safeAmount / 100) * proteinPer100g);
    }

    // Calculate carb source portion
    if (carbs.length > 0 && remainingCarbs > 0) {
      const carbSource = carbs[0];
      const carbsPer100g = carbSource.nutrition.carbs;
      if (carbsPer100g <= MIN_MACRO_PER_100G) {
        throw new Error(
          `Carb source "${carbSource.name}" has insufficient carbs (${carbsPer100g}g per 100g)`
        );
      }

      const rawAmount = Math.round((remainingCarbs / carbsPer100g) * 100);
      const safeAmount = this.enforcePortionLimits(carbSource.name, rawAmount);

      if (safeAmount < MIN_PORTION_GRAMS) {
        throw new Error(
          `Calculated carb portion for "${carbSource.name}" below minimum (${safeAmount}g)`
        );
      }

      portions.push({ name: carbSource.name, amount: safeAmount });
      remainingCarbs = Math.max(0, remainingCarbs - (safeAmount / 100) * carbsPer100g);
    }

    // Calculate fat source portion
    if (fats.length > 0 && remainingFats > 0) {
      const fatSource = fats[0];
      const fatsPer100g = fatSource.nutrition.fats;
      if (fatsPer100g <= MIN_MACRO_PER_100G) {
        throw new Error(
          `Fat source "${fatSource.name}" has insufficient fats (${fatsPer100g}g per 100g)`
        );
      }

      const rawAmount = Math.round((remainingFats / fatsPer100g) * 100);
      const safeAmount = this.enforcePortionLimits(fatSource.name, rawAmount);

      if (safeAmount < MIN_PORTION_GRAMS) {
        throw new Error(
          `Calculated fat portion for "${fatSource.name}" below minimum (${safeAmount}g)`
        );
      }

      portions.push({ name: fatSource.name, amount: safeAmount });
      remainingFats = Math.max(0, remainingFats - (safeAmount / 100) * fatsPer100g);
    }

    // Add vegetables (minimal macros, for volume)
    if (vegetables.length > 0) {
      const veggieAmount = this.enforcePortionLimits(vegetables[0].name, 100);
      portions.push({ name: vegetables[0].name, amount: Math.max(MIN_PORTION_GRAMS, veggieAmount) });
    }

    // Calculate final macros
    const ingredientsWithPortions = portions.map((portion) => {
      const ingredient = availableIngredients.find(
        ing => ing.name === portion.name
      )!;

      return {
        name: ingredient.name,
        amount: portion.amount,
        nutrition: calculateMacrosForAmount(
          ingredient.nutrition,
          portion.amount,
          'g'
        ),
        fdcId: ingredient.fdcId,
      };
    });

    const totalMacros = calculateMealMacros(
      ingredientsWithPortions.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        macrosPer100g: availableIngredients.find(i => i.name === ing.name)!.nutrition,
      }))
    );

    const meal: MealWithPortions = {
      mealType: mealStructure.mealType,
      ingredients: ingredientsWithPortions,
      totalMacros,
    };

    const validation = this.validateMealRealism(meal.totalMacros, mealStructure, meal.ingredients);
    if (!validation.isValid) {
      throw new Error(`Deterministic meal failed validation: ${validation.errors.join('; ')}`);
    }

    return meal;
  }

  /**
   * Adjust portions to meet exact targets
   */
  adjustPortions(
    currentMeal: MealWithPortions,
    targetMacros: MacroValues,
    availableIngredients: IngredientWithNutrition[]
  ): MealWithPortions {
    const differences = {
      calories: targetMacros.calories - currentMeal.totalMacros.calories,
      protein: targetMacros.protein - currentMeal.totalMacros.protein,
      carbs: targetMacros.carbs - currentMeal.totalMacros.carbs,
      fats: targetMacros.fats - currentMeal.totalMacros.fats,
    };

    const adjusted = currentMeal.ingredients.map((ing) => {
      const ingredient = availableIngredients.find(i => i.name === ing.name);
      if (!ingredient) return ing;

      let adjustment = 0;

      // Adjust based on category
      if (ingredient.category === 'protein' && Math.abs(differences.protein) > 1) {
        const proteinPer100g = ingredient.nutrition.protein;
        if (proteinPer100g > 0) {
          adjustment = (differences.protein / proteinPer100g) * 100;
        }
      } else if (ingredient.category === 'carb' && Math.abs(differences.carbs) > 1) {
        const carbsPer100g = ingredient.nutrition.carbs;
        if (carbsPer100g > 0) {
          adjustment = (differences.carbs / carbsPer100g) * 100;
        }
      } else if (ingredient.category === 'fat' && Math.abs(differences.fats) > 1) {
        const fatsPer100g = ingredient.nutrition.fats;
        if (fatsPer100g > 0) {
          adjustment = (differences.fats / fatsPer100g) * 100;
        }
      }

      const adjustedAmount = Math.round(ing.amount + adjustment);
      const safeAmount = this.enforcePortionLimits(ingredient.name, adjustedAmount);
      const finalAmount = Math.max(MIN_PORTION_GRAMS, safeAmount);

      return {
        ...ing,
        amount: finalAmount,
        nutrition: calculateMacrosForAmount(ingredient.nutrition, finalAmount, 'g'),
      };
    });

    const totalMacros = calculateMealMacros(
      adjusted.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        macrosPer100g: availableIngredients.find(i => i.name === ing.name)!.nutrition,
      }))
    );

    return {
      mealType: currentMeal.mealType,
      ingredients: adjusted,
      totalMacros,
    };
  }

  private enforcePortionLimits(ingredientName: string, amount: number): number {
    if (!Number.isFinite(amount)) {
      throw new Error(`Calculated portion for "${ingredientName}" is not a finite number`);
    }

    const maxPortion = this.getMaxRealisticPortion(ingredientName);
    if (amount > maxPortion) {
      console.warn(
        `⚠️ Portion ${amount}g exceeds realistic maximum ${maxPortion}g for ${ingredientName}. Clamping.`
      );
      return maxPortion;
    }

    return Math.max(amount, 0);
  }

  private getMaxRealisticPortion(ingredientName: string): number {
    const limits: Record<string, number> = {
      eggs: 200,
      'chicken breast': 400,
      salmon: 350,
      beef: 300,
      rice: 250,
      oats: 150,
      pasta: 200,
      bread: 150,
      'olive oil': 50,
      butter: 50,
      cheese: 100,
    };

    const lowerName = ingredientName.toLowerCase();
    for (const [key, limit] of Object.entries(limits)) {
      if (lowerName.includes(key)) {
        return limit;
      }
    }

    return DEFAULT_MAX_PORTION_GRAMS;
  }

  private validateMealRealism(
    macros: MacroValues,
    target: MealStructure['meals'][0],
    ingredients: MealWithPortions['ingredients']
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const macroValidation = validateMacroValues(macros);
    if (!macroValidation.isValid) {
      errors.push(...macroValidation.errors);
    }

    if (
      macros.calories === 0 &&
      macros.protein === 0 &&
      macros.carbs === 0 &&
      macros.fats === 0
    ) {
      errors.push('Meal has zero macros across the board');
    }

    if (macros.calories > target.targetCalories * 1.5) {
      errors.push(
        `Calories ${macros.calories} exceed 150% of target ${target.targetCalories}`
      );
    }

    const calculatedCalories =
      macros.protein * 4 + macros.carbs * 4 + macros.fats * 9;
    if (Math.abs(macros.calories - calculatedCalories) > calculatedCalories * 0.2) {
      errors.push(
        `Calorie mismatch >20% (reported ${macros.calories} vs calculated ${calculatedCalories})`
      );
    }

    for (const ingredient of ingredients) {
      const maxPortion = this.getMaxRealisticPortion(ingredient.name);
      if (ingredient.amount > maxPortion) {
        errors.push(
          `${ingredient.name} portion ${ingredient.amount}g exceeds limit ${maxPortion}g`
        );
      }

      if (ingredient.amount < MIN_PORTION_GRAMS) {
        errors.push(
          `${ingredient.name} portion ${ingredient.amount}g is below minimum ${MIN_PORTION_GRAMS}g`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

