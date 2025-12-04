// Meal Compliance Validator
// Validates that generated meals comply with dietary constraints

import { parseMultiplePreferences } from './preferenceParser';
import { DIETARY_CONSTRAINTS, categorizeIngredient } from './dietaryConstraints';

export interface MealTemplate {
  templateId: string;
  name: string;
  mealType: string;
  totalCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  baseRecipe: {
    name: string;
    ingredients: Array<{
      name: string;
      amount: string;
      calories: number;
    }>;
    instructions: string[];
  };
}

export interface ValidationResult {
  isCompliant: boolean;
  violations: string[];
  requiresRegeneration: boolean;
  complianceScore: number;
  suggestions: string[];
}

export function validateMealCompliance(
  meals: MealTemplate[],
  userPreference: string,
  metrics: any
): ValidationResult {
  const constraints = parseMultiplePreferences(userPreference);
  const violations: string[] = [];
  const suggestions: string[] = [];

  // If flexible diet, just check for basic compliance
  if (constraints.include.includes('all_foods') && constraints.exclude.length === 0) {
    return {
      isCompliant: true,
      violations: [],
      requiresRegeneration: false,
      complianceScore: 1.0,
      suggestions: []
    };
  }

  for (const meal of meals) {
    if (!meal.baseRecipe?.ingredients) continue;

    for (const ingredient of meal.baseRecipe.ingredients) {
      const ingredientCategories = categorizeIngredient(ingredient.name);

      // Check if ingredient is forbidden
      const isForbidden = constraints.exclude.some(excluded =>
        ingredientCategories.some(category =>
          category.includes(excluded.replace(/_/g, ' ')) ||
          excluded.replace(/_/g, ' ').includes(category)
        )
      );

      if (isForbidden) {
        const forbiddenCategory = constraints.exclude.find(excluded =>
          ingredientCategories.some(category =>
            category.includes(excluded.replace(/_/g, ' ')) ||
            excluded.replace(/_/g, ' ').includes(category)
          )
        );

        violations.push(
          `Meal "${meal.name}" contains forbidden ingredient: "${ingredient.name}" ` +
          `(violates ${userPreference} preference - ${forbiddenCategory} not allowed)`
        );
      }

      // Check if ingredient is not in allowed foods
      if (!constraints.include.includes('all_foods')) {
        const isAllowed = constraints.include.some(allowed =>
          ingredientCategories.some(category =>
            category.includes(allowed.replace(/_/g, ' ')) ||
            allowed.replace(/_/g, ' ').includes(category)
          )
        );

        if (!isAllowed && ingredientCategories.length > 0) {
          violations.push(
            `Meal "${meal.name}" contains non-compliant ingredient: "${ingredient.name}" ` +
            `(not in allowed foods for ${userPreference})`
          );
        }
      }
    }

    // Check macro compliance
    const macroViolations = validateMacroCompliance(meal, constraints, metrics);
    violations.push(...macroViolations);
  }

  // Calculate compliance score
  const totalIngredients = meals.reduce((sum, meal) =>
    sum + (meal.baseRecipe?.ingredients?.length || 0), 0
  );
  const violationRate = violations.length / Math.max(totalIngredients, 1);
  const complianceScore = Math.max(0, 1 - violationRate);

  // Determine if regeneration is required
  const requiresRegeneration = violationRate > 0.3 || violations.length > meals.length * 0.5;

  // Generate suggestions
  if (violations.length > 0) {
    suggestions.push(
      `Review the ${constraints.include.length > 0 ? 'allowed' : 'forbidden'} food categories:`,
      `- Allowed: ${constraints.include.map(f => f.replace(/_/g, ' ')).join(', ')}`,
      `- Forbidden: ${constraints.exclude.map(f => f.replace(/_/g, ' ')).join(', ')}`
    );
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    requiresRegeneration,
    complianceScore,
    suggestions
  };
}

function validateMacroCompliance(
  meal: MealTemplate,
  constraints: any,
  metrics: any
): string[] {
  const violations: string[] = [];

  // Check carb compliance for low-carb diets
  if (constraints.macroAdjustments.carbs.includes('minimize') && meal.macros.carbs > 10) {
    violations.push(
      `Meal "${meal.name}" has ${meal.macros.carbs}g carbs, but diet requires <5g carbs`
    );
  }

  if (constraints.macroAdjustments.carbs.includes('very_low') && meal.macros.carbs > 20) {
    violations.push(
      `Meal "${meal.name}" has ${meal.macros.carbs}g carbs, but diet requires <20g carbs`
    );
  }

  // Check protein adequacy
  if (constraints.macroAdjustments.protein.includes('ensure') && meal.macros.protein < 15) {
    violations.push(
      `Meal "${meal.name}" has only ${meal.macros.protein}g protein, but diet requires adequate protein`
    );
  }

  // Check fat requirements for high-fat diets
  if (constraints.macroAdjustments.fat.includes('high')) {
    const fatPercentage = (meal.macros.fat * 9) / meal.totalCalories;
    if (fatPercentage < 0.6) {
      violations.push(
        `Meal "${meal.name}" has only ${Math.round(fatPercentage * 100)}% fat, but diet requires high fat (70-80%)`
      );
    }
  }

  return violations;
}

// Generate correction suggestions for violations
export function generateCorrectionSuggestions(
  violations: string[],
  constraints: any
): string[] {
  const suggestions: string[] = [];

  const forbiddenIngredients = violations
    .filter(v => v.includes('forbidden ingredient'))
    .map(v => v.match(/forbidden ingredient: "([^"]+)"/)?.[1])
    .filter((v): v is string => !!v);

  const nonCompliantIngredients = violations
    .filter(v => v.includes('non-compliant ingredient'))
    .map(v => v.match(/non-compliant ingredient: "([^"]+)"/)?.[1])
    .filter(Boolean);

  if (forbiddenIngredients.length > 0) {
    suggestions.push(
      `Replace these forbidden ingredients: ${forbiddenIngredients.join(', ')}`,
      `Use these alternatives instead: ${getAlternativeIngredients(forbiddenIngredients, constraints)}`
    );
  }

  if (nonCompliantIngredients.length > 0) {
    suggestions.push(
      `Replace these non-compliant ingredients: ${nonCompliantIngredients.join(', ')}`,
      `Use ingredients from allowed categories: ${constraints.include.join(', ')}`
    );
  }

  return suggestions;
}

function getAlternativeIngredients(forbidden: string[], constraints: any): string {
  const alternatives: string[] = [];

  for (const ingredient of forbidden) {
    const categories = categorizeIngredient(ingredient);

    // Find allowed alternatives from the same category
    for (const category of categories) {
      const allowedCategory = constraints.include.find((allowed: string) =>
        allowed.replace(/_/g, ' ').includes(category)
      );

      if (allowedCategory) {
        // Add some common alternatives for this category
        const categoryAlternatives = getCategoryAlternatives(allowedCategory);
        alternatives.push(...categoryAlternatives);
      }
    }
  }

  return [...new Set(alternatives)].slice(0, 5).join(', ');
}

function getCategoryAlternatives(category: string): string[] {
  const alternatives: Record<string, string[]> = {
    'meat': ['chicken breast', 'ground beef', 'salmon', 'eggs'],
    'fish': ['salmon', 'tuna', 'cod', 'shrimp'],
    'vegetables': ['broccoli', 'spinach', 'bell peppers', 'zucchini'],
    'legumes': ['black beans', 'chickpeas', 'lentils', 'tofu'],
    'grains': ['quinoa', 'brown rice', 'oats', 'whole wheat bread'],
    'dairy': ['greek yogurt', 'cheese', 'milk', 'cottage cheese'],
    'nuts': ['almonds', 'walnuts', 'cashews', 'peanuts'],
    'oils': ['olive oil', 'coconut oil', 'avocado oil', 'butter']
  };

  return alternatives[category] || [];
}
