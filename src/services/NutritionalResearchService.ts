// Nutritional Research Service
// Provides accurate nutritional data for meal ingredients

export interface NutritionalData {
  name: string;
  weight: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  micronutrients?: string[];
  source: string;
}

export class NutritionalResearchService {

  /**
   * Validates that meal macros match the sum of ingredient macros
   */
  static validateMealMacros(meal: any): { isValid: boolean; discrepancies: string[] } {
    const discrepancies: string[] = [];
    
    if (!meal.baseRecipe?.ingredients || !Array.isArray(meal.baseRecipe.ingredients)) {
      return { isValid: false, discrepancies: ['No ingredients found'] };
    }

    // Calculate total macros from ingredients
    const ingredientTotals = meal.baseRecipe.ingredients.reduce(
      (totals: any, ingredient: any) => ({
        calories: totals.calories + (ingredient.calories || 0),
        protein: totals.protein + (ingredient.protein || 0),
        carbs: totals.carbs + (ingredient.carbs || 0),
        fat: totals.fat + (ingredient.fat || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // Compare with meal totals
    const mealCalories = meal.totalCalories || 0;
    const mealProtein = meal.macros?.protein || 0;
    const mealCarbs = meal.macros?.carbs || 0;
    const mealFat = meal.macros?.fat || 0;

    const tolerance = 5; // 5% tolerance for rounding differences

    if (Math.abs(ingredientTotals.calories - mealCalories) > tolerance) {
      discrepancies.push(`Calories mismatch: ingredients=${ingredientTotals.calories}, meal=${mealCalories}`);
    }
    if (Math.abs(ingredientTotals.protein - mealProtein) > tolerance) {
      discrepancies.push(`Protein mismatch: ingredients=${ingredientTotals.protein}g, meal=${mealProtein}g`);
    }
    if (Math.abs(ingredientTotals.carbs - mealCarbs) > tolerance) {
      discrepancies.push(`Carbs mismatch: ingredients=${ingredientTotals.carbs}g, meal=${mealCarbs}g`);
    }
    if (Math.abs(ingredientTotals.fat - mealFat) > tolerance) {
      discrepancies.push(`Fat mismatch: ingredients=${ingredientTotals.fat}g, meal=${mealFat}g`);
    }

    return {
      isValid: discrepancies.length === 0,
      discrepancies
    };
  }

  /**
   * Provides research guidance for accurate nutritional data
   */
  static getResearchGuidelines(): string {
    return `
🔬 **NUTRITIONAL RESEARCH GUIDELINES**:

**REQUIRED SOURCES:**
- USDA FoodData Central (fdc.nal.usda.gov)
- USDA National Nutrient Database
- Nutrition.gov verified data
- Food manufacturer nutrition labels
- Registered dietitian resources

**REQUIRED DATA FOR EACH INGREDIENT:**
- Exact weight/volume (e.g., "100g chicken breast", "1 medium avocado 150g")
- Calories per serving
- Protein content (grams)
- Carbohydrate content (grams)
- Fat content (grams)
- Fiber content (if >2g)
- Key micronutrients (if notable)

**VALIDATION REQUIREMENTS:**
- Each ingredient must have verifiable nutritional data
- Total meal macros = sum of all ingredient macros
- Portion sizes must be realistic and measurable
- No "estimated" or "approximately" values
- Use exact weights, not "1 cup" or "1 serving"

**EXAMPLE ACCURATE FORMAT:**
"150g chicken breast: 165 cal, 31g protein, 0g carbs, 3.6g fat (USDA FoodData Central)"
    `;
  }

  /**
   * Validates that all ingredients have proper nutritional data
   */
  static validateIngredientData(ingredients: any[]): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    ingredients.forEach((ingredient, index) => {
      if (!ingredient.name) {
        issues.push(`Ingredient ${index + 1}: Missing name`);
      }
      if (!ingredient.amount || !ingredient.amount.includes('g') && !ingredient.amount.includes('ml')) {
        issues.push(`Ingredient ${index + 1} (${ingredient.name}): Amount must include weight/volume (e.g., "100g", "15ml")`);
      }
      if (typeof ingredient.calories !== 'number' || ingredient.calories <= 0) {
        issues.push(`Ingredient ${index + 1} (${ingredient.name}): Invalid calories (${ingredient.calories})`);
      }
      if (typeof ingredient.protein !== 'number' || ingredient.protein < 0) {
        issues.push(`Ingredient ${index + 1} (${ingredient.name}): Invalid protein (${ingredient.protein}g)`);
      }
      if (typeof ingredient.carbs !== 'number' || ingredient.carbs < 0) {
        issues.push(`Ingredient ${index + 1} (${ingredient.name}): Invalid carbs (${ingredient.carbs}g)`);
      }
      if (typeof ingredient.fat !== 'number' || ingredient.fat < 0) {
        issues.push(`Ingredient ${index + 1} (${ingredient.name}): Invalid fat (${ingredient.fat}g)`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Provides common ingredient nutritional data for reference
   */
  static getCommonIngredientsData(): NutritionalData[] {
    return [
      {
        name: 'Chicken Breast (raw)',
        weight: '100g',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0,
        micronutrients: ['B vitamins', 'Selenium'],
        source: 'USDA FoodData Central'
      },
      {
        name: 'Avocado (medium)',
        weight: '150g',
        calories: 240,
        protein: 3,
        carbs: 13,
        fat: 22,
        fiber: 10,
        micronutrients: ['Vitamin K', 'Folate', 'Potassium'],
        source: 'USDA FoodData Central'
      },
      {
        name: 'Whole Grain Bread',
        weight: '60g (2 slices)',
        calories: 160,
        protein: 6,
        carbs: 30,
        fat: 2,
        fiber: 4,
        micronutrients: ['B vitamins', 'Iron'],
        source: 'USDA FoodData Central'
      },
      {
        name: 'Olive Oil',
        weight: '15ml (1 tbsp)',
        calories: 135,
        protein: 0,
        carbs: 0,
        fat: 15,
        fiber: 0,
        micronutrients: ['Vitamin E'],
        source: 'USDA FoodData Central'
      },
      {
        name: 'Brown Rice (cooked)',
        weight: '100g',
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fat: 0.9,
        fiber: 1.8,
        micronutrients: ['Manganese', 'Selenium'],
        source: 'USDA FoodData Central'
      }
    ];
  }
}
