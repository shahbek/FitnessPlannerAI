/**
 * Ingredient Selector
 * 
 * Proposes ingredients for meals (LLM or rule-based)
 * Integrates with USDA API for nutrition data
 */

import { z } from 'zod';
import { USDANutritionService, NutritionError } from './USDANutritionService';
import { NutritionErrorType } from '../types/nutrition';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { MacroValues, FoodNutritionData } from '../types/nutrition';
import { MealStructure } from './MealStructurePlanner';
import { normalizeFoodName } from '../utils/usdaMapper';

/**
 * Ingredient Proposal Schema
 */
export const IngredientProposalSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z.string(),
      category: z.enum([
        'protein',
        'carb',
        'fat',
        'vegetable',
        'fruit',
        'dairy',
        'other',
      ]),
      suggestedAmount: z.number().optional(), // in grams
      reason: z.string().optional(), // Why this ingredient was chosen
    })
  ),
  reasoning: z.string().optional(),
});

export type IngredientProposal = z.infer<typeof IngredientProposalSchema>;

/**
 * Ingredient with USDA Data
 */
export interface IngredientWithNutrition {
  name: string;
  category: string;
  amount: number; // in grams
  nutrition: MacroValues;
  usdaData: FoodNutritionData;
  fdcId: number;
}

/**
 * Ingredient Selection Options
 */
export interface IngredientSelectionOptions {
  userPreferences?: string;
  dietaryRestrictions?: string[];
  preferredFoods?: string[];
  avoidFoods?: string[];
  useLLM?: boolean; // Default: true
  maxIngredients?: number; // Default: 5-8 per meal
}

/**
 * Ingredient Selector
 */
export class IngredientSelector {
  private usdaService: USDANutritionService;
  private cotService?: ChainOfThoughtService;
  private foodNameMapping: Map<string, string>; // User food name -> USDA food name

  constructor(
    usdaService: USDANutritionService,
    cotService?: ChainOfThoughtService
  ) {
    this.usdaService = usdaService;
    this.cotService = cotService;
    this.foodNameMapping = new Map();
  }

  /**
   * Select ingredients for a meal using LLM or rule-based approach
   */
  async selectIngredients(
    mealStructure: MealStructure['meals'][0],
    options?: IngredientSelectionOptions
  ): Promise<IngredientWithNutrition[]> {
    const useLLM = options?.useLLM !== false;
    const isAIAvailable = this.cotService && 
      typeof this.cotService.isAIAvailable === 'function' &&
      this.cotService.isAIAvailable();

    let proposals: IngredientProposal;
    if (useLLM && isAIAvailable) {
      try {
        proposals = await this.proposeWithLLM(mealStructure, options);
      } catch (error) {
        console.warn('⚠️  LLM ingredient proposal failed, falling back to rule-based:', error);
        proposals = await this.proposeRuleBased(mealStructure, options);
      }
    } else {
      // Use rule-based if LLM disabled or unavailable
      proposals = await this.proposeRuleBased(mealStructure, options);
    }

    // Lookup USDA data for each ingredient
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ingredient of proposals.ingredients) {
      try {
        const nutrition = await this.lookupIngredientNutrition(
          ingredient.name,
          options
        );

        const ingredientWithNutrition: IngredientWithNutrition = {
          name: ingredient.name,
          category: ingredient.category,
          amount: ingredient.suggestedAmount || 100, // Default 100g
          nutrition: nutrition.macrosPer100g,
          usdaData: nutrition,
          fdcId: nutrition.fdcId,
        };

        const validation = this.validateIngredientNutrition(ingredientWithNutrition);
        if (!validation.isValid) {
          throw new Error(
            `Invalid ingredient data for "${ingredient.name}": ${validation.errors.join(
              '; '
            )}`
          );
        }

        ingredientsWithNutrition.push(ingredientWithNutrition);
      } catch (error) {
        // Handle food not found - will be handled by caller
        if (error instanceof Error && 'type' in error) {
          const nutritionError = error as NutritionError;
          if (nutritionError.type === NutritionErrorType.FOOD_NOT_FOUND) {
            throw nutritionError; // Re-throw to be handled by MealPlanGenerator
          }
        }
        throw error;
      }
    }

    return ingredientsWithNutrition;
  }

  /**
   * Propose ingredients using LLM with CoT
   */
  private async proposeWithLLM(
    mealStructure: MealStructure['meals'][0],
    options?: IngredientSelectionOptions
  ): Promise<IngredientProposal> {
    if (!this.cotService || 
        (typeof this.cotService.isAIAvailable === 'function' && !this.cotService.isAIAvailable())) {
      throw new Error('CoT service not available for LLM proposal');
    }

    const prompt = this.buildIngredientProposalPrompt(mealStructure, options);

    const { result } = await this.cotService.generateWithCoT(
      prompt,
      IngredientProposalSchema,
      {
        enableVerification: true,
      }
    );

    return result;
  }

  /**
   * Build ingredient proposal prompt
   */
  private buildIngredientProposalPrompt(
    mealStructure: MealStructure['meals'][0],
    options?: IngredientSelectionOptions
  ): string {
    let prompt = `Propose healthy ingredients for a ${mealStructure.mealType} meal.

Target macros:
- Calories: ${mealStructure.targetCalories} kcal
- Protein: ${mealStructure.targetProtein}g
- Carbs: ${mealStructure.targetCarbs}g
- Fats: ${mealStructure.targetFats}g

Think step by step:
1. Identify which macro categories are needed (protein source, carb source, fat source, vegetables)
2. Select appropriate foods for each category
3. Consider variety and nutrition
4. Ensure ingredients are commonly available and healthy

`;

    if (options?.userPreferences) {
      prompt += `User preferences: ${options.userPreferences}\n`;
    }

    if (options?.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
      prompt += `Dietary restrictions: ${options.dietaryRestrictions.join(', ')}\n`;
    }

    if (options?.preferredFoods && options.preferredFoods.length > 0) {
      prompt += `Preferred foods: ${options.preferredFoods.join(', ')}\n`;
    }

    if (options?.avoidFoods && options.avoidFoods.length > 0) {
      prompt += `Avoid foods: ${options.avoidFoods.join(', ')}\n`;
    }

    prompt += `\nPropose 5-8 ingredients that together can meet these macro targets.`;
    prompt += `\nEvery ingredient must be a specific variety or cut (e.g., "chicken breast" instead of "chicken", "sirloin steak" instead of "beef"). Avoid generic ingredient names.`;
    prompt += `\nDo NOT use composite or prepared item names as ingredients (e.g., "mixed berries", "stir-fry mix", "turkey burger"). Always list individual base ingredients (e.g., "strawberries", "blueberries", "raspberries"; or "ground turkey", "whole wheat bun", "lettuce").`;

    return prompt;
  }

  /**
   * Propose ingredients using rule-based approach
   */
  private async proposeRuleBased(
    mealStructure: MealStructure['meals'][0],
    options?: IngredientSelectionOptions
  ): Promise<IngredientProposal> {
    const ingredients: IngredientProposal['ingredients'] = [];

    // Protein source (aim for 20-30g per meal)
    const proteinNeeded = mealStructure.targetProtein;
    if (proteinNeeded > 0) {
      ingredients.push({
        name: this.selectProteinSource(options),
        category: 'protein',
        suggestedAmount: Math.round((proteinNeeded / 0.25) * 100) / 100, // Assume ~25g protein per 100g
      });
    }

    // Carb source
    const carbsNeeded = mealStructure.targetCarbs;
    if (carbsNeeded > 0) {
      ingredients.push({
        name: this.selectCarbSource(options),
        category: 'carb',
        suggestedAmount: Math.round((carbsNeeded / 0.25) * 100) / 100, // Assume ~25g carbs per 100g
      });
    }

    // Fat source
    const fatsNeeded = mealStructure.targetFats;
    if (fatsNeeded > 0) {
      ingredients.push({
        name: this.selectFatSource(options),
        category: 'fat',
        suggestedAmount: Math.round((fatsNeeded / 0.8) * 100) / 100, // Assume ~80g fat per 100g
      });
    }

    // Vegetables (for volume and micronutrients)
    ingredients.push({
      name: 'broccoli',
      category: 'vegetable',
      suggestedAmount: 100, // Standard serving
    });

    return {
      ingredients,
      reasoning: 'Rule-based selection using common macro sources',
    };
  }

  /**
   * Select protein source based on preferences
   */
  private selectProteinSource(options?: IngredientSelectionOptions): string {
    const preferred = options?.preferredFoods || [];
    const avoid = options?.avoidFoods || [];

    // Common protein sources
    const proteins = [
      'chicken breast',
      'salmon',
      'eggs',
      'lean ground turkey',
      'tofu',
      'greek yogurt',
      'cottage cheese',
      'tuna',
    ];

    // Check preferred foods first
    for (const food of preferred) {
      if (proteins.some(p => food.toLowerCase().includes(p))) {
        return food;
      }
    }

    // Filter out avoided foods
    const available = proteins.filter(p =>
      !avoid.some(a => a.toLowerCase().includes(p))
    );

    // Return first available, or default
    return available[0] || 'chicken breast';
  }

  /**
   * Select carb source
   */
  private selectCarbSource(options?: IngredientSelectionOptions): string {
    const preferred = options?.preferredFoods || [];
    const avoid = options?.avoidFoods || [];

    const carbs = [
      'brown rice',
      'quinoa',
      'sweet potato',
      'oats',
      'whole wheat bread',
      'pasta',
      'potato',
    ];

    for (const food of preferred) {
      if (carbs.some(c => food.toLowerCase().includes(c))) {
        return food;
      }
    }

    const available = carbs.filter(c =>
      !avoid.some(a => a.toLowerCase().includes(c))
    );

    return available[0] || 'brown rice';
  }

  /**
   * Select fat source
   */
  private selectFatSource(options?: IngredientSelectionOptions): string {
    const preferred = options?.preferredFoods || [];
    const avoid = options?.avoidFoods || [];

    const fats = [
      'olive oil',
      'avocado',
      'almonds',
      'peanut butter',
      'coconut oil',
      'butter',
    ];

    for (const food of preferred) {
      if (fats.some(f => food.toLowerCase().includes(f))) {
        return food;
      }
    }

    const available = fats.filter(f =>
      !avoid.some(a => a.toLowerCase().includes(f))
    );

    return available[0] || 'olive oil';
  }

  /**
   * Lookup ingredient nutrition from USDA
   */
  async lookupIngredientNutrition(
    foodName: string,
    options?: IngredientSelectionOptions
  ): Promise<FoodNutritionData> {
    // Check if we have a mapping
    const mappedName = this.foodNameMapping.get(
      normalizeFoodName(foodName)
    ) || foodName;

    try {
      return await this.usdaService.getFoodNutritionData(mappedName);
    } catch (error) {
      // Try with normalized name if different
      const normalized = normalizeFoodName(foodName);
      if (normalized !== mappedName) {
        try {
          return await this.usdaService.getFoodNutritionData(normalized);
        } catch {
          // Fall through to original error
        }
      }

      // If food not found, throw error to be handled by caller
      if (
        error instanceof Error &&
        'type' in error &&
        (error as NutritionError).type === NutritionErrorType.FOOD_NOT_FOUND
      ) {
        throw error;
      }

      throw new Error(
        `Failed to lookup nutrition for "${foodName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add food name mapping (user name -> USDA name)
   */
  addFoodMapping(userName: string, usdaName: string): void {
    this.foodNameMapping.set(normalizeFoodName(userName), usdaName);
  }

  /**
   * Get food name mapping
   */
  getFoodMapping(userName: string): string | undefined {
    return this.foodNameMapping.get(normalizeFoodName(userName));
  }

  /**
   * Handle food not found scenario
   * Returns alternative suggestions or throws error
   */
  async handleFoodNotFound(
    foodName: string,
    category: string
  ): Promise<{
    alternatives: string[];
    needsUserInput: boolean;
  }> {
    // Try to find alternatives in the same category
    const alternatives: string[] = [];

    switch (category) {
      case 'protein':
        alternatives.push('chicken breast', 'salmon', 'eggs', 'tofu');
        break;
      case 'carb':
        alternatives.push('brown rice', 'quinoa', 'sweet potato', 'oats');
        break;
      case 'fat':
        alternatives.push('olive oil', 'avocado', 'almonds');
        break;
      case 'vegetable':
        alternatives.push('broccoli', 'spinach', 'carrots', 'bell peppers');
        break;
      default:
        alternatives.push('chicken breast', 'brown rice', 'broccoli');
    }

    // Filter out the original food name
    const filtered = alternatives.filter(
      alt => alt.toLowerCase() !== foodName.toLowerCase()
    );

    return {
      alternatives: filtered.slice(0, 3), // Return top 3 alternatives
      needsUserInput: true, // Always needs user input for food not found
    };
  }

  private validateIngredientNutrition(
    ingredient: IngredientWithNutrition
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const macros = ingredient.nutrition;

    if (
      macros.calories === 0 &&
      macros.protein === 0 &&
      macros.carbs === 0 &&
      macros.fats === 0
    ) {
      errors.push(`All macros are zero for ${ingredient.name}`);
    }

    if (macros.protein > 0 && macros.calories === 0) {
      errors.push(`${ingredient.name} has protein but zero calories`);
    }

    if (
      ingredient.category === 'protein' &&
      macros.protein < 10
    ) {
      errors.push(
        `${ingredient.name} is categorized as protein but has <10g protein per 100g`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
