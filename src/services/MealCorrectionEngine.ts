/**
 * Meal Correction Engine
 * 
 * Verifies meals against targets and implements correction loops
 * Uses Chain-of-Thought for intelligent corrections
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { VerificationService, VerificationResult } from './VerificationService';
import { buildCorrectionCoTPrompt } from '../prompts/cotTemplates';
import { FeedbackLoopManager } from '../utils/cotHelpers';
import { MacroValues } from '../types/nutrition';
import { MealWithPortions } from './PortionCalculator';
import { IngredientWithNutrition } from './IngredientSelector';
import { calculateMacrosForAmount, validateMacroValues } from '../utils/usdaMapper';

const MIN_PORTION_GRAMS = 10;
const DEFAULT_MAX_PORTION_GRAMS = 300;

/**
 * Correction Options
 */
export interface CorrectionOptions {
  maxIterations?: number; // Default: 7
  onIterationUpdate?: (iteration: number, result: VerificationResult) => void;
  onCorrectionNeeded?: (error: string, suggestedAction: string) => void;
}

/**
 * Correction Result
 */
export interface CorrectionResult {
  meal: MealWithPortions;
  verification: VerificationResult;
  iterations: number;
  success: boolean;
  finalReasoning?: string;
}

/**
 * Meal Correction Engine
 */
export class MealCorrectionEngine {
  private cotService: ChainOfThoughtService;
  private verificationService: VerificationService;
  private feedbackLoopManager: FeedbackLoopManager;

  constructor(
    cotService: ChainOfThoughtService,
    verificationService: VerificationService
  ) {
    this.cotService = cotService;
    this.verificationService = verificationService;
    this.feedbackLoopManager = new FeedbackLoopManager(7); // Increased to 7 iterations
  }

  /**
   * Verify and correct meal until targets are met
   */
  async verifyAndCorrect(
    meal: MealWithPortions,
    targetMacros: MacroValues,
    availableIngredients: IngredientWithNutrition[],
    options?: CorrectionOptions
  ): Promise<CorrectionResult> {
    const maxIterations = options?.maxIterations || 7;
    this.feedbackLoopManager.reset();

    let currentMeal = meal;
    let verification: VerificationResult;
    let iterations = 0;
    let previousError = Number.POSITIVE_INFINITY;

    do {
      // Start iteration
      const { canContinue } = this.feedbackLoopManager.startIteration();
      if (!canContinue) {
        // Max iterations reached
        return {
          meal: currentMeal,
          verification: verification!,
          iterations,
          success: false,
        };
      }

      iterations++;

      // Verify current meal
      verification = this.verificationService.verifyMacros(
        currentMeal.totalMacros,
        targetMacros
      );

      // Callback for iteration update
      if (options?.onIterationUpdate) {
        options.onIterationUpdate(iterations, verification);
      }

      // If verification passed, we're done
      if (verification.passed) {
        this.feedbackLoopManager.recordIteration(
          currentMeal,
          { steps: [], finalResult: currentMeal },
          { passed: true, message: 'Macros within tolerance' }
        );

        return {
          meal: currentMeal,
          verification,
          iterations,
          success: true,
        };
      }

      const currentError = this.calculateMacroError(
        currentMeal.totalMacros,
        targetMacros
      );

      if (currentError >= previousError && iterations > 1) {
        console.warn(
          `⚠️ Macro error worsened (iteration ${iterations}): ${currentError.toFixed(
            3
          )} >= ${previousError.toFixed(3)}`
        );
        return {
          meal: currentMeal,
          verification,
          iterations,
          success: false,
        };
      }

      previousError = currentError;

      // Correction needed
      const error = this.verificationService.generateVerificationError(
        verification
      );

      if (error && options?.onCorrectionNeeded) {
        options.onCorrectionNeeded(error.message, error.suggestedAction || '');
      }

      // Generate correction
      try {
        currentMeal = await this.correctMeal(
          currentMeal,
          targetMacros,
          verification,
          availableIngredients
        );

        // Record iteration
        this.feedbackLoopManager.recordIteration(
          currentMeal,
          { steps: [], finalResult: currentMeal },
          { passed: false, message: error?.message || 'Verification failed' }
        );
      } catch (correctionError) {
        // Correction failed, return current best attempt
        return {
          meal: currentMeal,
          verification,
          iterations,
          success: false,
        };
      }
    } while (iterations < maxIterations);

    // Max iterations reached
    return {
      meal: currentMeal,
      verification: verification!,
      iterations,
      success: false,
    };
  }

  /**
   * Correct meal using CoT
   */
  private async correctMeal(
    currentMeal: MealWithPortions,
    targetMacros: MacroValues,
    verification: VerificationResult,
    availableIngredients: IngredientWithNutrition[]
  ): Promise<MealWithPortions> {
    // Build correction prompt
    const error = this.verificationService.generateVerificationError(
      verification
    );

    const prompt = buildCorrectionCoTPrompt(
      `Create a ${currentMeal.mealType} meal meeting these macro targets`,
      currentMeal,
      {
        message: error?.message || 'Macros do not match targets',
        targetCalories: targetMacros.calories,
        targetProtein: targetMacros.protein,
        targetCarbs: targetMacros.carbs,
        targetFats: targetMacros.fats,
        calculatedCalories: currentMeal.totalMacros.calories,
        calculatedProtein: currentMeal.totalMacros.protein,
        calculatedCarbs: currentMeal.totalMacros.carbs,
        calculatedFats: currentMeal.totalMacros.fats,
        corrections: error?.suggestedAction
          ? [error.suggestedAction]
          : undefined,
      }
    );

    // Add available ingredients to prompt
    const ingredientsList = availableIngredients
      .map(
        ing =>
          `- ${ing.name}: ${ing.nutrition.calories} kcal, ${ing.nutrition.protein}g protein, ${ing.nutrition.carbs}g carbs, ${ing.nutrition.fats}g fats (per 100g)`
      )
      .join('\n');

    const enhancedPrompt = `${prompt}\n\nAvailable ingredients:\n${ingredientsList}`;

    // Generate correction with CoT
    const { result } = await this.cotService.generateWithCoT(
      enhancedPrompt,
      z.object({
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.number(),
          })
        ),
        reasoning: z.string().optional(),
      }),
      {
        enableVerification: true,
      }
    );

    // Map to MealWithPortions
    const correctedIngredients = result.ingredients.map((calcIng) => {
      const ingredient = availableIngredients.find(
        ing => ing.name.toLowerCase() === calcIng.name.toLowerCase()
      );

      if (!ingredient) {
        throw new Error(`Ingredient "${calcIng.name}" not found`);
      }

      if (!Number.isFinite(calcIng.amount)) {
        throw new Error(`Correction returned non-finite portion for "${calcIng.name}"`);
      }

      const safeAmount = this.enforcePortionLimits(ingredient.name, calcIng.amount);
      if (safeAmount < MIN_PORTION_GRAMS) {
        throw new Error(
          `Correction proposed portion below minimum (${safeAmount}g) for "${ingredient.name}"`
        );
      }

      const nutrition = this.calculateNutritionForAmount(
        ingredient.nutrition,
        safeAmount
      );

      return {
        name: ingredient.name,
        amount: safeAmount,
        nutrition,
        fdcId: ingredient.fdcId,
      };
    });

    // Calculate total macros
    const totalMacros = this.calculateTotalMacros(correctedIngredients);

    const validation = validateMacroValues(totalMacros);
    if (!validation.isValid) {
      throw new Error(
        `Corrected meal macros invalid: ${validation.errors.join('; ')}`
      );
    }

    return {
      mealType: currentMeal.mealType,
      ingredients: correctedIngredients,
      totalMacros,
      reasoning: result.reasoning,
    };
  }

  /**
   * Calculate nutrition for specific amount
   */
  private calculateNutritionForAmount(
    macrosPer100g: MacroValues,
    amount: number
  ): MacroValues {
    return calculateMacrosForAmount(macrosPer100g, amount, 'g');
  }

  /**
   * Calculate total macros from ingredients
   */
  private calculateTotalMacros(
    ingredients: Array<{ nutrition: MacroValues }>
  ): MacroValues {
    return ingredients.reduce(
      (total, ing) => ({
        calories: total.calories + ing.nutrition.calories,
        protein: total.protein + ing.nutrition.protein,
        carbs: total.carbs + ing.nutrition.carbs,
        fats: total.fats + ing.nutrition.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }

  /**
   * Quick verification (no correction)
   */
  verifyMeal(
    meal: MealWithPortions,
    targetMacros: MacroValues
  ): VerificationResult {
    return this.verificationService.verifyMacros(
      meal.totalMacros,
      targetMacros
    );
  }

  private enforcePortionLimits(ingredientName: string, amount: number): number {
    if (!Number.isFinite(amount)) {
      throw new Error(`Portion for "${ingredientName}" is not a finite number`);
    }

    const maxPortion = this.getMaxRealisticPortion(ingredientName);
    if (amount > maxPortion) {
      console.warn(
        `⚠️ Correction portion ${amount}g exceeds limit ${maxPortion}g for ${ingredientName}. Clamping.`
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
  private calculateMacroError(actual: MacroValues, target: MacroValues): number {
    const computeError = (actualValue: number, targetValue: number): number => {
      const diff = Math.abs(actualValue - targetValue);
      if (targetValue === 0) {
        return diff;
      }
      return diff / Math.abs(targetValue);
    };

    const proteinError = computeError(actual.protein, target.protein);
    const carbsError = computeError(actual.carbs, target.carbs);
    const fatsError = computeError(actual.fats, target.fats);
    const caloriesError = computeError(actual.calories, target.calories);

    return proteinError + carbsError + fatsError + caloriesError;
  }
}

