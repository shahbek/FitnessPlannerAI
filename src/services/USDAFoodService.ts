/**
 * USDA FoodData Central API Service
 * Provides food search and nutrition data lookup
 */

export interface USDAFoodItem {
  fdcId: string;
  description: string;
  dataType: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export interface USDASearchResult {
  foods: USDAFoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

// USDA API key - you can get a free one from https://fdc.nal.usda.gov/api-key-signup.html
// Using demo key for development
const USDA_API_KEY = 'DEMO_KEY';
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

/**
 * Search for foods in the USDA database
 */
export async function searchUSDAFoods(
  query: string,
  pageSize: number = 25,
  pageNumber: number = 1
): Promise<USDASearchResult> {
  if (!query.trim()) {
    return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
  }

  try {
    const response = await fetch(`${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.trim(),
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
        pageSize,
        pageNumber,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
      }),
    });

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse and normalize the results
    const foods: USDAFoodItem[] = (data.foods || []).map((food: any) => {
      const nutrients = food.foodNutrients || [];
      
      // Extract nutrients by ID
      // 1008 = Energy (kcal), 1003 = Protein, 1005 = Carbs, 1004 = Fat
      // 1079 = Fiber, 2000 = Sugar
      const getNutrient = (id: number): number => {
        const nutrient = nutrients.find((n: any) => n.nutrientId === id);
        return nutrient?.value || 0;
      };

      return {
        fdcId: String(food.fdcId),
        description: food.description || food.lowercaseDescription || 'Unknown Food',
        dataType: food.dataType || 'Unknown',
        brandOwner: food.brandOwner,
        servingSize: food.servingSize || 100,
        servingSizeUnit: food.servingSizeUnit || 'g',
        calories: Math.round(getNutrient(1008)),
        protein: Math.round(getNutrient(1003) * 10) / 10,
        carbs: Math.round(getNutrient(1005) * 10) / 10,
        fat: Math.round(getNutrient(1004) * 10) / 10,
        fiber: Math.round(getNutrient(1079) * 10) / 10,
        sugar: Math.round(getNutrient(2000) * 10) / 10,
      };
    });

    return {
      foods,
      totalHits: data.totalHits || 0,
      currentPage: pageNumber,
      totalPages: Math.ceil((data.totalHits || 0) / pageSize),
    };
  } catch (error) {
    console.error('USDA search failed:', error);
    // Return empty results on error
    return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
  }
}

/**
 * Get detailed nutrition info for a specific food by FDC ID
 */
export async function getUSDAFoodDetails(fdcId: string): Promise<USDAFoodItem | null> {
  try {
    const response = await fetch(
      `${USDA_API_BASE}/food/${fdcId}?api_key=${USDA_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const food = await response.json();
    const nutrients = food.foodNutrients || [];

    const getNutrient = (id: number): number => {
      const nutrient = nutrients.find(
        (n: any) => n.nutrient?.id === id || n.nutrientId === id
      );
      return nutrient?.amount || nutrient?.value || 0;
    };

    return {
      fdcId: String(food.fdcId),
      description: food.description || 'Unknown Food',
      dataType: food.dataType || 'Unknown',
      brandOwner: food.brandOwner,
      servingSize: food.servingSize || 100,
      servingSizeUnit: food.servingSizeUnit || 'g',
      calories: Math.round(getNutrient(1008)),
      protein: Math.round(getNutrient(1003) * 10) / 10,
      carbs: Math.round(getNutrient(1005) * 10) / 10,
      fat: Math.round(getNutrient(1004) * 10) / 10,
      fiber: Math.round(getNutrient(1079) * 10) / 10,
      sugar: Math.round(getNutrient(2000) * 10) / 10,
    };
  } catch (error) {
    console.error('Failed to get USDA food details:', error);
    return null;
  }
}

/**
 * Common foods database for quick access (offline fallback)
 * These are approximate values for common foods
 */
export const COMMON_FOODS: USDAFoodItem[] = [
  {
    fdcId: 'common-chicken-breast',
    description: 'Chicken Breast, grilled',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  {
    fdcId: 'common-rice-white',
    description: 'White Rice, cooked',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
  },
  {
    fdcId: 'common-egg',
    description: 'Egg, whole, cooked',
    dataType: 'Common',
    servingSize: 50,
    servingSizeUnit: 'g',
    calories: 78,
    protein: 6,
    carbs: 0.6,
    fat: 5,
  },
  {
    fdcId: 'common-banana',
    description: 'Banana, medium',
    dataType: 'Common',
    servingSize: 118,
    servingSizeUnit: 'g',
    calories: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
  },
  {
    fdcId: 'common-oats',
    description: 'Oatmeal, cooked',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 68,
    protein: 2.5,
    carbs: 12,
    fat: 1.4,
  },
  {
    fdcId: 'common-salmon',
    description: 'Salmon, grilled',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
  },
  {
    fdcId: 'common-broccoli',
    description: 'Broccoli, steamed',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 35,
    protein: 2.4,
    carbs: 7,
    fat: 0.4,
  },
  {
    fdcId: 'common-sweet-potato',
    description: 'Sweet Potato, baked',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 90,
    protein: 2,
    carbs: 21,
    fat: 0.1,
  },
  {
    fdcId: 'common-greek-yogurt',
    description: 'Greek Yogurt, plain',
    dataType: 'Common',
    servingSize: 170,
    servingSizeUnit: 'g',
    calories: 100,
    protein: 17,
    carbs: 6,
    fat: 0.7,
  },
  {
    fdcId: 'common-almonds',
    description: 'Almonds, raw',
    dataType: 'Common',
    servingSize: 28,
    servingSizeUnit: 'g',
    calories: 164,
    protein: 6,
    carbs: 6,
    fat: 14,
  },
  {
    fdcId: 'common-avocado',
    description: 'Avocado, raw',
    dataType: 'Common',
    servingSize: 100,
    servingSizeUnit: 'g',
    calories: 160,
    protein: 2,
    carbs: 9,
    fat: 15,
  },
  {
    fdcId: 'common-whey-protein',
    description: 'Whey Protein Powder',
    dataType: 'Common',
    servingSize: 30,
    servingSizeUnit: 'g',
    calories: 120,
    protein: 24,
    carbs: 3,
    fat: 1,
  },
];

/**
 * Search common foods (for quick access / offline)
 */
export function searchCommonFoods(query: string): USDAFoodItem[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return COMMON_FOODS;
  
  return COMMON_FOODS.filter(
    (food) =>
      food.description.toLowerCase().includes(queryLower) ||
      food.fdcId.includes(queryLower)
  );
}

