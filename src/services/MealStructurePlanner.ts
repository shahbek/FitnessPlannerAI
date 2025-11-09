/**
 * Meal Structure Planner
 * 
 * Plans meal structure (breakfast, lunch, dinner, snacks) using Chain-of-Thought
 */

import { z } from 'zod';
import { ChainOfThoughtService, CoTReasoningResult } from './ChainOfThoughtService';
import { buildMealStructureCoTPrompt } from '../prompts/cotTemplates';
import { DayMacroTargets } from './DayMacroDistributor';
import { ReasoningTracker } from '../utils/cotHelpers';

/**
 * Meal Structure Schema
 */
export const MealStructureSchema = z.object({
  meals: z.array(
    z.object({
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
      targetCalories: z.number(),
      targetProtein: z.number(),
      targetCarbs: z.number(),
      targetFats: z.number(),
      mealTiming: z.string().optional(), // e.g., "8:00 AM", "12:00 PM"
      description: z.string().optional(), // Brief description
    })
  ),
  reasoning: z.string().optional(), // CoT reasoning summary
});

export type MealStructure = z.infer<typeof MealStructureSchema>;

/**
 * Meal Structure Planning Options
 */
export interface MealStructureOptions {
  userPreferences?: string;
  dietaryRestrictions?: string[];
  mealFrequency?: number; // Default: 4
  enableReasoning?: boolean;
  onReasoningUpdate?: (reasoning: CoTReasoningResult) => void;
}

/**
 * Meal Structure Planner
 */
export class MealStructurePlanner {
  private cotService: ChainOfThoughtService;
  private reasoningTracker: ReasoningTracker;

  constructor(cotService: ChainOfThoughtService) {
    this.cotService = cotService;
    this.reasoningTracker = new ReasoningTracker();
  }

  /**
   * Check if AI is available for CoT generation
   */
  private isAIAvailable(): boolean {
    return this.cotService && typeof this.cotService.isAIAvailable === 'function' 
      ? this.cotService.isAIAvailable() 
      : false;
  }

  /**
   * Plan meal structure for a day
   */
  async planMealStructure(
    dayTargets: DayMacroTargets,
    options?: MealStructureOptions
  ): Promise<{
    structure: MealStructure;
    reasoning: CoTReasoningResult;
  }> {
    const mealFrequency = options?.mealFrequency || 4;
    const isTrainingDay = dayTargets.dayType === 'training';

    // Build CoT prompt
    const prompt = buildMealStructureCoTPrompt(
      dayTargets.targets.calories,
      dayTargets.targets.protein,
      dayTargets.targets.carbs,
      dayTargets.targets.fats,
      mealFrequency,
      isTrainingDay
    );

    // Check if AI is available, otherwise use deterministic method
    if (!this.isAIAvailable()) {
      console.log('📊 Using deterministic meal structure planning (AI unavailable)');
      return this.planMealStructureDeterministic(dayTargets, options);
    }

    // Add user context if available
    let enhancedPrompt = prompt;
    if (options?.userPreferences) {
      enhancedPrompt += `\n\nUser preferences: ${options.userPreferences}`;
    }
    if (options?.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
      enhancedPrompt += `\n\nDietary restrictions: ${options.dietaryRestrictions.join(', ')}`;
    }

    // Generate with CoT
    try {
      const { result, reasoning } = await this.cotService.generateWithCoT(
        enhancedPrompt,
        MealStructureSchema,
        {
          enableVerification: true,
          onStepUpdate: (step) => {
            this.reasoningTracker.addStep(step);
          },
        }
      );

    // Verify totals match day targets
    const verification = this.verifyMealStructureTotals(result, dayTargets);

    // Add reasoning summary to structure
    const structureWithReasoning: MealStructure = {
      ...result,
      reasoning: reasoning.steps.map(s => s.thought).join('\n'),
    };

    // Callback for reasoning update
    if (options?.onReasoningUpdate) {
      options.onReasoningUpdate(reasoning);
    }

      return {
        structure: structureWithReasoning,
        reasoning,
      };
    } catch (error) {
      console.warn('⚠️  CoT generation failed, falling back to deterministic method:', error);
      return this.planMealStructureDeterministic(dayTargets, options);
    }
  }

  /**
   * Plan meal structure deterministically (fallback when AI unavailable)
   */
  private planMealStructureDeterministic(
    dayTargets: DayMacroTargets,
    options?: MealStructureOptions
  ): {
    structure: MealStructure;
    reasoning: CoTReasoningResult;
  } {
    const mealFrequency = options?.mealFrequency || 4;
    const targets = dayTargets.targets;

    // Distribute macros across meals
    const meals: MealStructure['meals'] = [];
    const caloriesPerMeal = Math.round(targets.calories / mealFrequency);
    const proteinPerMeal = Math.round(targets.protein * 10 / mealFrequency) / 10;
    const carbsPerMeal = Math.round(targets.carbs * 10 / mealFrequency) / 10;
    const fatsPerMeal = Math.round(targets.fats * 10 / mealFrequency) / 10;

    // Standard meal times
    const mealTimes = [
      { type: 'breakfast', time: '8:00 AM' },
      { type: 'lunch', time: '12:00 PM' },
      { type: 'dinner', time: '6:00 PM' },
      { type: 'snack', time: '3:00 PM' },
    ];

    for (let i = 0; i < mealFrequency; i++) {
      const mealType = i < mealTimes.length 
        ? mealTimes[i].type as 'breakfast' | 'lunch' | 'dinner' | 'snack'
        : 'snack';
      
      meals.push({
        mealType,
        targetCalories: caloriesPerMeal,
        targetProtein: proteinPerMeal,
        targetCarbs: carbsPerMeal,
        targetFats: fatsPerMeal,
        mealTiming: i < mealTimes.length ? mealTimes[i].time : undefined,
        description: `Deterministic ${mealType} plan`,
      });
    }

    // Create reasoning result
    const reasoning: CoTReasoningResult = {
      steps: [
        {
          step: 1,
          thought: `Distributed ${targets.calories} calories across ${mealFrequency} meals`,
          calculation: `${targets.calories} / ${mealFrequency} = ${caloriesPerMeal} kcal per meal`,
          timestamp: Date.now(),
        },
        {
          step: 2,
          thought: `Distributed macros proportionally: ${proteinPerMeal}g protein, ${carbsPerMeal}g carbs, ${fatsPerMeal}g fats per meal`,
          timestamp: Date.now(),
        },
      ],
      finalResult: { meals },
      verification: {
        passed: true,
        message: 'Deterministic meal structure created',
      },
    };

    return {
      structure: {
        meals,
        reasoning: 'Deterministic distribution: Equal macro allocation across meals',
      },
      reasoning,
    };
  }

  /**
   * Verify meal structure totals match day targets
   */
  verifyMealStructureTotals(
    structure: MealStructure,
    dayTargets: DayMacroTargets
  ): {
    passed: boolean;
    differences: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  } {
    const totals = structure.meals.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.targetCalories,
        protein: sum.protein + meal.targetProtein,
        carbs: sum.carbs + meal.targetCarbs,
        fats: sum.fats + meal.targetFats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    const differences = {
      calories: totals.calories - dayTargets.targets.calories,
      protein: totals.protein - dayTargets.targets.protein,
      carbs: totals.carbs - dayTargets.targets.carbs,
      fats: totals.fats - dayTargets.targets.fats,
    };

    // Allow ±2% tolerance for meal structure totals
    const tolerance = 0.02;
    const passed =
      Math.abs(differences.calories / dayTargets.targets.calories) <= tolerance &&
      Math.abs(differences.protein / dayTargets.targets.protein) <= tolerance &&
      Math.abs(differences.carbs / dayTargets.targets.carbs) <= tolerance &&
      Math.abs(differences.fats / dayTargets.targets.fats) <= tolerance;

    return {
      passed,
      differences,
    };
  }

  /**
   * Parse meal structure from text (fallback method)
   */
  parseMealStructure(text: string): MealStructure | null {
    try {
      // Try to extract JSON from text
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return MealStructureSchema.parse(parsed);
      }
      return null;
    } catch (error) {
      console.error('Failed to parse meal structure:', error);
      return null;
    }
  }

  /**
   * Get reasoning tracker
   */
  getReasoningTracker(): ReasoningTracker {
    return this.reasoningTracker;
  }
}

