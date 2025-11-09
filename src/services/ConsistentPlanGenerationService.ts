// Consistent Plan Generation Service
// Wraps existing generation services and adds validation + reconciliation
// Ensures deterministic, reproducible plans with zero contradictions

import { UserProfile } from '@/models/UserProfile';
import { CompletePlan } from '@/models/PlanModels';
import {
  ConsistentPlan,
  ConsistentWeek,
  ConsistentDay,
  ConsistentMeal,
  ConsistentIngredient,
  ShoppingListWithTraceability,
  ShoppingListItemWithTraceability,
  generatePlanId,
  generateWeekId,
  generateDayId,
  generateMealId,
  generateIngredientId,
  normalizeIngredientName,
  calculateTraceabilityHash,
  calculatePlanChecksum,
  calculateMealMacros,
  calculateDayMacros,
  calculateWeekMacros,
  MacroTotals
} from '@/models/ConsistentPlanModels';
import { PlanConsistencyValidator } from './PlanConsistencyValidator';
import { PlanReconciliationService } from './PlanReconciliationService';
import { DuplicateMealRemover } from './DuplicateMealRemover';
import { OptimalPlanService } from './OptimalPlanService';

export interface GenerationOptions {
  maxReconciliationIterations?: number;
  requireValidation?: boolean;  // If true, plan must pass validation
  autoReconcile?: boolean;  // If true, attempt auto-fix on validation failures
}

export class ConsistentPlanGenerationService {
  private optimalPlanService: OptimalPlanService;
  private validator: PlanConsistencyValidator;
  private reconciler: PlanReconciliationService;
  private duplicateRemover: DuplicateMealRemover;

  constructor(
    apiKey: string,
    endpoint: string,
    modelName: string = 'llama-3.3-70b-versatile'
  ) {
    this.optimalPlanService = new OptimalPlanService(apiKey, endpoint, modelName);
    this.validator = new PlanConsistencyValidator();
    this.reconciler = new PlanReconciliationService();
    this.duplicateRemover = new DuplicateMealRemover();
  }

  /**
   * Generate a consistent plan with full validation
   */
  async generateConsistentPlan(
    userProfile: UserProfile,
    options: GenerationOptions = {},
    progressCallback?: (update: any) => void
  ): Promise<{
    plan: ConsistentPlan;
    originalPlan: CompletePlan;
    validationPassed: boolean;
  }> {
    const {
      maxReconciliationIterations = 5,
      requireValidation = false,
      autoReconcile = true
    } = options;

    console.log('🚀 Starting Consistent Plan Generation...');

    // Step 1: Generate plan using existing service
    if (progressCallback) {
      progressCallback({
        phase: 'generation',
        progress: 10,
        message: 'Generating plan with AI...'
      });
    }

    const completePlan = await this.optimalPlanService.generateOptimalPlan(
      userProfile,
      progressCallback
    );

    // Step 2: Convert to ConsistentPlan structure
    if (progressCallback) {
      progressCallback({
        phase: 'conversion',
        progress: 60,
        message: 'Converting to consistent structure...'
      });
    }

    let consistentPlan = this.convertToConsistentPlan(completePlan, userProfile);

    // Step 3: Bottom-up aggregation
    this.aggregateMacros(consistentPlan);

    // Step 3.5: Remove duplicate meals (MUST happen before validation)
    if (progressCallback) {
      progressCallback({
        phase: 'duplicate_removal',
        progress: 70,
        message: 'Removing duplicate meals...'
      });
    }

    const duplicateRemovalResult = this.duplicateRemover.removeDuplicates(consistentPlan);
    if (duplicateRemovalResult.removedDuplicates > 0) {
      console.log(`🔧 Removed ${duplicateRemovalResult.removedDuplicates} duplicate meals`);
      // Re-aggregate after removing duplicates
      this.aggregateMacros(consistentPlan);
    }

    // Step 4: Validate consistency
    if (progressCallback) {
      progressCallback({
        phase: 'validation',
        progress: 75,
        message: 'Validating plan consistency...'
      });
    }

    let validationResult = this.validator.validate(consistentPlan);
    const adjustments: any[] = [...duplicateRemovalResult.adjustments];

    // Step 5: Reconciliation loop (if validation fails and autoReconcile is enabled)
    let iteration = 0;
    while (
      !validationResult.isValid &&
      autoReconcile &&
      iteration < maxReconciliationIterations
    ) {
      if (progressCallback) {
        progressCallback({
          phase: 'reconciliation',
          progress: 75 + (iteration * 5),
          message: `Reconciling inconsistencies (iteration ${iteration + 1}/${maxReconciliationIterations})...`
        });
      }

      console.log(`🔄 Reconciliation iteration ${iteration + 1}/${maxReconciliationIterations}`);

      const reconciliationResult = this.reconciler.reconcile(consistentPlan);
      adjustments.push(...reconciliationResult.adjustments);

      // Re-aggregate after reconciliation
      this.aggregateMacros(consistentPlan);

      // Re-validate
      validationResult = this.validator.validate(consistentPlan, adjustments);

      iteration++;

      if (validationResult.isValid) {
        console.log('✅ Reconciliation successful!');
        break;
      }
    }

    // Update validation results in plan
    validationResult = this.validator.validate(consistentPlan, adjustments);
    consistentPlan.validationResults = validationResult.report;

    // Step 6: Generate grocery lists with traceability
    if (progressCallback) {
      progressCallback({
        phase: 'grocery',
        progress: 90,
        message: 'Building grocery lists with traceability...'
      });
    }

    this.buildGroceryListsWithTraceability(consistentPlan);

    // Step 7: Final audit
    if (progressCallback) {
      progressCallback({
        phase: 'final',
        progress: 95,
        message: 'Running final validation audit...'
      });
    }

    const finalValidation = this.validator.validate(consistentPlan, adjustments);
    consistentPlan.validationResults = finalValidation.report;
    consistentPlan.metadata.checksum = calculatePlanChecksum(consistentPlan);

    // Check if validation passed
    const validationPassed = finalValidation.isValid;

    if (requireValidation && !validationPassed) {
      const summary = this.validator.getValidationSummary(finalValidation);
      throw new Error(
        `Plan validation failed (required). Confidence: ${finalValidation.confidence.toFixed(1)}%\n\n${summary}`
      );
    }

    console.log(`✅ Plan generation complete. Confidence: ${finalValidation.confidence.toFixed(1)}%`);
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        progress: 100,
        message: `Plan generated with ${finalValidation.confidence.toFixed(1)}% confidence`
      });
    }

    return {
      plan: consistentPlan,
      originalPlan: completePlan,
      validationPassed
    };
  }

  /**
   * Convert CompletePlan to ConsistentPlan structure
   */
  private convertToConsistentPlan(
    completePlan: CompletePlan,
    userProfile: UserProfile
  ): ConsistentPlan {
    const planId = generatePlanId();
    const plan: ConsistentPlan = {
      planId,
      userId: userProfile.userId || 'unknown',
      weeks: [],
      validationResults: {
        overallConfidence: 0,
        macroConsistency: {
          score: 0,
          weeklyAlignment: 0,
          dailyAlignment: 0,
          mealAlignment: 0,
          discrepancies: []
        },
        ingredientTraceability: {
          score: 0,
          traceableItems: 0,
          totalItems: 0,
          untraceableItems: []
        },
        variety: {
          score: 0,
          duplicateMeals: [],
          weeklyRotation: 0
        },
        adjustments: {
          appliedFixes: [],
          failedFixes: []
        },
        checksum: ''
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        checksum: '',
        version: '1.0.0'
      }
    };

    // Convert weekly outlines to consistent weeks
    for (const outline of completePlan.weeklyOutlines) {
      const weekId = generateWeekId(planId);
      const week: ConsistentWeek = {
        weekId,
        planId,
        weekNumber: outline.weekNumber,
        dailyTargets: {
          calories: outline.dailyTargets.calories,
          protein: outline.dailyTargets.protein,
          carbs: outline.dailyTargets.carbs,
          fat: outline.dailyTargets.fat,
          proteinPerKg: outline.dailyTargets.proteinPerKg
        },
        calculatedTotals: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        },
        days: [],
        shoppingList: undefined
      };

      // Convert meal templates to days
      // phaseMealTemplates is an array of arrays: [phase1Days[], phase2Days[], ...]
      // Each day template has: { weekNumber, dayNumber, meals: [...] }
      const allDayTemplates = completePlan.phaseMealTemplates?.flat() || [];
      const weekDayTemplates = allDayTemplates.filter(
        (day: any) => day.weekNumber === outline.weekNumber
      );

      // Create 7 days for the week
      for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
        const dayId = generateDayId(weekId);
        const dayTemplate = weekDayTemplates.find(
          (d: any) => d.dayNumber === dayNumber
        );

        const day: ConsistentDay = {
          dayId,
          weekId,
          dayNumber,
          calculatedTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          meals: []
        };

        // Convert meals from day template
        if (dayTemplate?.meals) {
          for (const mealTemplate of dayTemplate.meals) {
            const mealId = generateMealId(dayId);
            const meal: ConsistentMeal = {
              mealId,
              dayId,
              mealType: mealTemplate.mealType || mealTemplate.recipe?.name?.split(' ')[0] || 'Unknown',
              recipeReference: mealTemplate.templateId || mealTemplate.recipe?.name,
              declaredMacros: {
                calories: mealTemplate.totalCalories || mealTemplate.calories || 0,
                protein: mealTemplate.macros?.protein || mealTemplate.protein || 0,
                carbs: mealTemplate.macros?.carbs || mealTemplate.carbs || 0,
                fat: mealTemplate.macros?.fat || mealTemplate.fat || 0
              },
              calculatedMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              ingredients: [],
              traceabilityHash: '',
              recipe: {
                name: mealTemplate.recipe?.name || mealTemplate.baseRecipe?.name || mealTemplate.name || 'Unknown Meal',
                instructions: mealTemplate.recipe?.instructions || 
                             mealTemplate.baseRecipe?.instructions || 
                             mealTemplate.cookingInstructions || 
                             []
              }
            };

            // Convert ingredients
            const ingredients = mealTemplate.recipe?.ingredients || 
                               mealTemplate.baseRecipe?.ingredients || 
                               mealTemplate.ingredients || 
                               [];

            for (const ingredientTemplate of ingredients) {
              const ingredientId = generateIngredientId(mealId);
              const normalizedName = normalizeIngredientName(ingredientTemplate.name || '');
              
              // Parse amount (e.g., "100g" -> 100)
              const amountStr = ingredientTemplate.amount || '0';
              const amountMatch = amountStr.match(/(\d+\.?\d*)/);
              const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

              const ingredient: ConsistentIngredient = {
                ingredientId,
                mealId,
                name: ingredientTemplate.name || '',
                normalizedName,
                amount,
                unit: ingredientTemplate.unit || 'g',
                macros: {
                  calories: ingredientTemplate.calories || 0,
                  protein: ingredientTemplate.protein || 0,
                  carbs: ingredientTemplate.carbs || 0,
                  fat: ingredientTemplate.fat || 0
                }
              };

              meal.ingredients.push(ingredient);
            }

            // Calculate traceability hash
            meal.traceabilityHash = calculateTraceabilityHash(
              meal.ingredients.map(i => i.ingredientId)
            );

            day.meals.push(meal);
          }
        }

        week.days.push(day);
      }

      plan.weeks.push(week);
    }

    return plan;
  }

  /**
   * Perform bottom-up macro aggregation
   */
  private aggregateMacros(plan: ConsistentPlan): void {
    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          meal.calculatedMacros = calculateMealMacros(meal);
        }
        day.calculatedTotals = calculateDayMacros(day);
      }
      week.calculatedTotals = calculateWeekMacros(week);
    }
  }

  /**
   * Build grocery lists with traceability links
   */
  private buildGroceryListsWithTraceability(plan: ConsistentPlan): void {
    for (const week of plan.weeks) {
      // Extract ingredients from all days in the week
      const ingredientMap = new Map<string, {
        ingredient: ConsistentIngredient;
        totalAmount: number;
        meals: string[];
        days: number[];
      }>();

      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const ingredient of meal.ingredients) {
            const normalized = ingredient.normalizedName;
            
            if (!ingredientMap.has(normalized)) {
              ingredientMap.set(normalized, {
                ingredient,
                totalAmount: 0,
                meals: [],
                days: []
              });
            }

            const entry = ingredientMap.get(normalized)!;
            entry.totalAmount += ingredient.amount;
            entry.meals.push(meal.mealId);
            if (!entry.days.includes(day.dayNumber)) {
              entry.days.push(day.dayNumber);
            }
          }
        }
      }

      // Build shopping list with traceability
      const categories = new Map<string, ShoppingListItemWithTraceability[]>();

      for (const [normalizedName, entry] of ingredientMap.entries()) {
        const category = this.categorizeIngredient(entry.ingredient.name);
        
        if (!categories.has(category)) {
          categories.set(category, []);
        }

        const item: ShoppingListItemWithTraceability = {
          name: entry.ingredient.name,
          normalizedName,
          quantity: `${Math.round(entry.totalAmount)}${entry.ingredient.unit}`,
          estimatedCost: 0,  // Would be calculated by ShoppingListGenerationService
          priority: 'high',
          traceability: {
            sourceIngredientIds: [entry.ingredient.ingredientId],
            sourceMealIds: entry.meals,
            sourceDayIds: week.days.filter(d => entry.days.includes(d.dayNumber)).map(d => d.dayId),
            verificationHash: calculateTraceabilityHash([entry.ingredient.ingredientId])
          }
        };

        categories.get(category)!.push(item);
      }

      week.shoppingList = {
        weekNumber: week.weekNumber,
        categories: Array.from(categories.entries()).map(([category, items]) => ({
          category,
          items
        })),
        weekTotal: 0,
        notes: []
      };
    }
  }

  /**
   * Categorize ingredient for shopping list
   */
  private categorizeIngredient(name: string): string {
    const lower = name.toLowerCase();
    
    if (lower.includes('chicken') || lower.includes('turkey') || lower.includes('salmon') ||
        lower.includes('beef') || lower.includes('pork') || lower.includes('fish')) {
      return 'Proteins';
    }
    if (lower.includes('rice') || lower.includes('quinoa') || lower.includes('oats') ||
        lower.includes('pasta') || lower.includes('bread')) {
      return 'Grains';
    }
    if (lower.includes('broccoli') || lower.includes('spinach') || lower.includes('kale') ||
        lower.includes('carrot') || lower.includes('pepper') || lower.includes('tomato')) {
      return 'Vegetables';
    }
    if (lower.includes('apple') || lower.includes('banana') || lower.includes('berry') ||
        lower.includes('avocado')) {
      return 'Fruits';
    }
    if (lower.includes('milk') || lower.includes('cheese') || lower.includes('yogurt') ||
        lower.includes('egg')) {
      return 'Dairy & Eggs';
    }
    if (lower.includes('almond') || lower.includes('walnut') || lower.includes('seed')) {
      return 'Nuts & Seeds';
    }
    return 'Oils & Condiments';
  }
}

