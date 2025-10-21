// Dietary Constraints Knowledge Base
// Comprehensive mapping of dietary preferences to food restrictions and macro adjustments

export interface DietaryConstraints {
  include: string[];
  exclude: string[];
  macroAdjustments: {
    carbs: string;
    protein: string;
    fat: string;
  };
  notes: string;
}

export const DIETARY_CONSTRAINTS: Record<string, DietaryConstraints> = {
  'carnivore': {
    include: ['meat', 'fish', 'eggs', 'animal_fats', 'organ_meats', 'bone_broth'],
    exclude: ['grains', 'vegetables', 'fruits', 'legumes', 'nuts', 'seeds'],
    macroAdjustments: {
      carbs: 'minimize (<5g)',
      protein: 'moderate-high (1.6-2.2g/kg)',
      fat: 'high (remaining calories)'
    },
    notes: 'Zero plant foods, animal products only'
  },
  'ketogenic': {
    include: ['meat', 'fish', 'eggs', 'low_carb_vegetables', 'healthy_fats', 'cheese'],
    exclude: ['grains', 'sugar', 'high_carb_vegetables', 'most_fruits'],
    macroAdjustments: {
      carbs: 'very_low (<50g, ideally <20g)',
      protein: 'moderate (1.6-2.0g/kg)',
      fat: 'high (70-80% of calories)'
    },
    notes: 'Maintain ketosis through carb restriction'
  },
  'vegan': {
    include: ['legumes', 'tofu', 'tempeh', 'seitan', 'vegetables', 'fruits', 'grains', 'nuts', 'seeds'],
    exclude: ['meat', 'fish', 'eggs', 'dairy', 'honey'],
    macroAdjustments: {
      carbs: 'flexible',
      protein: 'ensure adequate (2.0-2.4g/kg from plant sources)',
      fat: 'moderate (nuts, seeds, avocado, oils)'
    },
    notes: 'Combine protein sources for complete amino acid profile'
  },
  'vegetarian': {
    include: ['eggs', 'dairy', 'legumes', 'tofu', 'vegetables', 'fruits', 'grains', 'nuts', 'seeds'],
    exclude: ['meat', 'fish', 'poultry'],
    macroAdjustments: {
      carbs: 'flexible',
      protein: 'ensure adequate (1.8-2.2g/kg)',
      fat: 'moderate'
    },
    notes: 'Include eggs and dairy for complete proteins'
  },
  'paleo': {
    include: ['meat', 'fish', 'eggs', 'vegetables', 'fruits', 'nuts', 'seeds'],
    exclude: ['grains', 'legumes', 'dairy', 'processed_foods', 'refined_sugar'],
    macroAdjustments: {
      carbs: 'moderate (from fruits and vegetables)',
      protein: 'moderate-high (1.6-2.0g/kg)',
      fat: 'moderate-high'
    },
    notes: 'Focus on whole, unprocessed foods'
  },
  'mediterranean': {
    include: ['fish', 'olive_oil', 'vegetables', 'fruits', 'whole_grains', 'legumes', 'nuts'],
    exclude: ['red_meat (limited)', 'processed_foods', 'refined_sugar'],
    macroAdjustments: {
      carbs: 'moderate (whole grains, fruits)',
      protein: 'moderate (1.6-1.8g/kg, fish focus)',
      fat: 'moderate-high (olive oil focus)'
    },
    notes: 'Emphasize fish, olive oil, and plant-based foods'
  },
  'pescatarian': {
    include: ['fish', 'seafood', 'eggs', 'dairy', 'vegetables', 'fruits', 'grains', 'legumes'],
    exclude: ['meat', 'poultry'],
    macroAdjustments: {
      carbs: 'flexible',
      protein: 'ensure adequate (1.6-2.0g/kg from fish/eggs)',
      fat: 'moderate (omega-3 focus)'
    },
    notes: 'Prioritize fatty fish for omega-3s'
  },
  'gluten_free': {
    include: ['meat', 'fish', 'eggs', 'dairy', 'vegetables', 'fruits', 'gluten_free_grains', 'legumes'],
    exclude: ['wheat', 'barley', 'rye', 'conventional_oats'],
    macroAdjustments: {
      carbs: 'flexible (from gluten-free sources)',
      protein: 'flexible',
      fat: 'flexible'
    },
    notes: 'Avoid all gluten-containing grains'
  },
  'dairy_free': {
    include: ['meat', 'fish', 'eggs', 'vegetables', 'fruits', 'grains', 'legumes', 'plant_milks'],
    exclude: ['milk', 'cheese', 'yogurt', 'butter', 'whey', 'casein'],
    macroAdjustments: {
      carbs: 'flexible',
      protein: 'ensure adequate (consider plant proteins)',
      fat: 'flexible (use plant-based fats)'
    },
    notes: 'Ensure calcium intake from alternative sources'
  },
  'low_fodmap': {
    include: ['meat', 'fish', 'eggs', 'low_fodmap_vegetables', 'low_fodmap_fruits', 'rice', 'quinoa'],
    exclude: ['high_fodmap_foods', 'wheat', 'onions', 'garlic', 'legumes', 'certain_fruits'],
    macroAdjustments: {
      carbs: 'moderate (low FODMAP sources)',
      protein: 'flexible',
      fat: 'flexible'
    },
    notes: 'Avoid fermentable carbohydrates for digestive health'
  },
  'flexible': {
    include: ['all_foods'],
    exclude: [],
    macroAdjustments: {
      carbs: 'based_on_goals',
      protein: 'based_on_goals',
      fat: 'based_on_goals'
    },
    notes: 'No dietary restrictions, focus on macro targets'
  }
};

// Food category mapping for ingredient validation
export const FOOD_CATEGORIES: Record<string, string[]> = {
  'grains': ['rice', 'bread', 'pasta', 'oats', 'wheat', 'tortilla', 'quinoa', 'barley', 'rye'],
  'meat': ['chicken', 'beef', 'pork', 'steak', 'turkey', 'bacon', 'lamb', 'veal', 'duck'],
  'fish': ['salmon', 'tuna', 'fish', 'shrimp', 'cod', 'halibut', 'mackerel', 'sardines', 'anchovies'],
  'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'whey', 'casein', 'greek_yogurt'],
  'eggs': ['eggs', 'egg_whites', 'egg_yolks'],
  'legumes': ['beans', 'lentils', 'chickpeas', 'peas', 'soy', 'tofu', 'tempeh', 'edamame'],
  'vegetables': ['broccoli', 'spinach', 'carrots', 'onions', 'garlic', 'peppers', 'tomatoes', 'cucumber'],
  'fruits': ['apple', 'banana', 'orange', 'berries', 'grapes', 'mango', 'pineapple', 'avocado'],
  'nuts': ['almonds', 'walnuts', 'cashews', 'peanuts', 'pecans', 'pistachios', 'macadamia'],
  'seeds': ['chia', 'flax', 'hemp', 'pumpkin', 'sunflower', 'sesame'],
  'oils': ['olive_oil', 'coconut_oil', 'avocado_oil', 'butter', 'ghee', 'lard', 'tallow']
};

// Helper functions
export function categorizeIngredient(ingredientName: string): string[] {
  const name = ingredientName.toLowerCase().replace(/[^a-z\s]/g, '');
  const categories: string[] = [];
  
  for (const [category, keywords] of Object.entries(FOOD_CATEGORIES)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return categories.length > 0 ? categories : ['unknown'];
}

export function formatFoodCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function checkMacroConflict(macros: any, constraints: DietaryConstraints): boolean {
  // Check if calculated macros are incompatible with diet
  if (constraints.macroAdjustments.carbs.includes('minimize') && macros.carbs > 50) {
    return true;
  }
  if (constraints.macroAdjustments.fat.includes('high') && (macros.fat / macros.calories * 9) < 0.6) {
    return true;
  }
  return false;
}

export function calculateAdjustedFat(macros: any, constraints: DietaryConstraints): number {
  // For carnivore/keto: (calories - protein*4 - minimal_carbs*4) / 9
  const proteinCals = macros.protein * 4;
  const minimalCarbCals = 5 * 4; // Assume <5g carbs
  const fatCals = macros.calories - proteinCals - minimalCarbCals;
  return Math.round(fatCals / 9);
}
