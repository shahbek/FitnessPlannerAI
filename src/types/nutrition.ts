/**
 * Nutrition Types
 * Types for USDA FoodData Central API integration and nutrition data
 */

/**
 * USDA FoodData Central API Types
 */
export interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  nutrients: USDANutrient[];
  brandOwner?: string;
  ingredients?: string;
  foodCategory?: {
    description: string;
  };
}

export interface USDASearchResponse {
  foods: USDAFoodItem[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

/**
 * Internal Nutrition Types
 */
export interface MacroValues {
  calories: number; // kcal
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  fiber?: number; // grams
  sugar?: number; // grams
  sodium?: number; // mg
}

export interface FoodNutritionData {
  fdcId: number;
  name: string;
  macrosPer100g: MacroValues;
  source: 'usda' | 'user-provided'; // Always 'usda' in our system
  lastUpdated: string;
}

export interface IngredientNutrition {
  foodName: string;
  amount: number; // in grams
  unit: 'g' | 'kg' | 'oz' | 'lb';
  nutrition: MacroValues;
  usdaData: USDAFoodItem;
}

/**
 * Error Types
 */
export enum NutritionErrorType {
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  FOOD_NOT_FOUND = 'FOOD_NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface NutritionError {
  type: NutritionErrorType;
  message: string;
  foodName?: string;
  context?: any;
  suggestedAction?: string;
}

/**
 * Cache Types
 */
export interface NutritionCacheEntry {
  food: USDAFoodItem;
  timestamp: number;
  ttl: number; // 24 hours in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

