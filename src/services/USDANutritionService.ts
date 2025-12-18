/**
 * USDA Nutrition Service
 * 
 * Single source of truth for all nutritional data.
 * Integrates with USDA FoodData Central API.
 * 
 * Policy: NO FALLBACK DATA - If USDA API fails, generation must pause.
 */

import {
  USDAFoodItem,
  MacroValues,
  FoodNutritionData,
  NutritionError,
  NutritionErrorType,
  NutritionCacheEntry,
  CacheStats,
} from '../types/nutrition';
import {
  extractMacrosFromUSDA,
  normalizeFoodName,
  calculateMacrosForAmount,
  validateMacroValues,
} from '../utils/usdaMapper';
import { stripDescriptorWords } from '../constants/ingredients';
import { api } from '../../convex/_generated/api';

/**
 * Interface compatible with ConvexReactClient and ConvexHttpClient
 */
export interface IConvexClient {
  action(action: any, args?: any): Promise<any>;
}

/**
 * Configuration
 */
const CONFIG = {
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MAX_CACHE_SIZE: 10000,
  SEARCH_MAX_RESULTS: 10,
} as const;

type SearchAttempt = {
  query: string;
  reason: string;
};

const CATEGORY_FALLBACKS = [
  { keywords: ['salmon', 'fillet'], replacements: ['salmon', 'atlantic salmon', 'sockeye salmon'] },
  { keywords: ['salmon'], replacements: ['atlantic salmon', 'sockeye salmon'] },
  { keywords: ['shredded', 'cheese'], replacements: ['cheddar cheese', 'mozzarella cheese', 'colby cheese'] },
  { keywords: ['cheese'], replacements: ['cheddar cheese', 'mozzarella cheese'] },
  { keywords: ['bell', 'pepper'], replacements: ['sweet pepper', 'green bell pepper', 'red bell pepper'] },
  { keywords: ['rice', 'cracker'], replacements: ['rice crackers plain', 'rice cakes'] },
  { keywords: ['scrambled', 'egg'], replacements: ['egg, whole, cooked, scrambled', 'egg, whole, scrambled', 'egg, whole, raw'] },
  { keywords: ['rolled', 'oats'], replacements: ['oats, rolled', 'old fashioned oats', 'oatmeal'] },
  { keywords: ['quinoa'], replacements: ['quinoa, cooked', 'quinoa, uncooked'] },
];

export class USDANutritionService {
  private client: IConvexClient;
  private cache: Map<string, NutritionCacheEntry>;
  private cacheStats: CacheStats;

  constructor(client: IConvexClient) {
    if (!client) {
      throw new Error('Convex client is required');
    }
    this.client = client;
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: CONFIG.MAX_CACHE_SIZE,
    };
  }

  /**
   * Search for foods by name
   */
  async searchFood(query: string): Promise<USDAFoodItem[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    try {
      const normalizedQuery = normalizeFoodName(query);
      const attempts = this.buildSearchAttempts(normalizedQuery);

      let lastError: NutritionError | null = null;

      for (const [index, attempt] of attempts.entries()) {
        try {
          // Use Convex Action
          // Note: The action signature handles caching and fetching from USDA
          const foods = await this.client.action(api.food.searchFoods, {
            query: attempt.query,
            limit: CONFIG.SEARCH_MAX_RESULTS
          });

          if (foods && foods.length > 0) {
            if (index > 0) {
              console.log(`🔎 [USDA] Found "${query}" via ${attempt.reason} -> "${attempt.query}"`);
            }
            return foods;
          }
        } catch (error: any) {
          lastError = error;
          console.warn(`Search attempt failed for "${attempt.query}":`, error);
        }
      }

      if (lastError) {
        throw lastError;
      }

      throw this.createError(
        NutritionErrorType.FOOD_NOT_FOUND,
        `No foods found matching "${query}"`,
        query,
        'Please try a different search term or provide more specific food name'
      );
    } catch (error) {
      // Re-throw if already typed
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw this.createError(
        NutritionErrorType.NETWORK_ERROR,
        `Failed to search for food: ${errorMessage}`,
        query,
        'Check your internet connection'
      );
    }
  }

  private buildSearchAttempts(normalizedQuery: string): SearchAttempt[] {
    const attempts: SearchAttempt[] = [];
    const seen = new Set<string>();

    const pushAttempt = (attempt: SearchAttempt) => {
      if (!attempt.query) return;
      if (seen.has(attempt.query)) return;
      attempts.push(attempt);
      seen.add(attempt.query);
    };

    pushAttempt({ query: normalizedQuery, reason: 'original phrase' });

    const stripped = stripDescriptorWords(normalizedQuery);
    if (stripped && stripped !== normalizedQuery) {
      pushAttempt({ query: stripped, reason: 'descriptor-stripped phrase' });
    }

    for (const variant of this.generateFallbackVariants(normalizedQuery)) {
      pushAttempt({ query: variant, reason: `category fallback (${variant})` });
    }

    return attempts;
  }

  private generateFallbackVariants(query: string): string[] {
    const normalized = normalizeFoodName(query);
    const variants = new Set<string>();

    CATEGORY_FALLBACKS.forEach((rule) => {
      const matches = rule.keywords.every((keyword) => normalized.includes(keyword));
      if (matches) {
        rule.replacements.forEach((replacement) =>
          variants.add(normalizeFoodName(replacement))
        );
      }
    });

    return Array.from(variants);
  }

  /**
   * Get detailed nutrition data for a specific FDC ID
   */
  async getFoodDetails(fdcId: number): Promise<USDAFoodItem> {
    const cacheKey = `fdc:${fdcId}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      this.cacheStats.hits++;
      return cached.food;
    }

    this.cacheStats.misses++;

    try {
      // Call Convex Action
      const food = await this.client.action(api.food.getFoodDetails, { fdcId });

      if (!food) {
        throw this.createError(
          NutritionErrorType.FOOD_NOT_FOUND,
          `Food details not found for FDC ID ${fdcId}`
        );
      }

      // Store in memory cache
      this.setCache(cacheKey, food);

      return food;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw this.createError(
        NutritionErrorType.NETWORK_ERROR,
        `Failed to get food details: ${errorMessage}`,
        undefined,
        'Check your internet connection'
      );
    }
  }

  /**
   * Get macros for a specific food and amount
   */
  async getMacros(
    foodName: string,
    amount: number,
    unit: 'g' | 'kg' | 'oz' | 'lb' = 'g'
  ): Promise<MacroValues> {
    const searchResults = await this.searchFood(foodName);

    if (searchResults.length === 0) {
      throw this.createError(
        NutritionErrorType.FOOD_NOT_FOUND,
        `Food not found: "${foodName}"`,
        foodName,
        'Please provide the exact food name or try a different search term'
      );
    }

    // Try each result until we find one with nutrients
    let food: USDAFoodItem | null = null;
    let lastError: any = null;

    for (const result of searchResults) {
      try {
        const testFood = await this.getFoodDetails(result.fdcId);
        if (testFood.nutrients && testFood.nutrients.length > 0) {
          food = testFood;
          break;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!food) {
      if (lastError && typeof lastError === 'object' && 'type' in lastError) {
        throw lastError;
      }
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `No foods found with complete nutrient data for "${foodName}"`,
        foodName,
        'Try a different food name or search term'
      );
    }

    let macrosPer100g: MacroValues;
    try {
      macrosPer100g = extractMacrosFromUSDA(food.nutrients, {
        foodName: food.description,
        fdcId: food.fdcId,
        debug: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error extracting macros';
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Failed to extract nutrition data for "${foodName}": ${errorMessage}`,
        foodName
      );
    }

    const calculatedMacros = calculateMacrosForAmount(macrosPer100g, amount, unit);
    const validation = validateMacroValues(calculatedMacros);
    if (!validation.isValid) {
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Calculated macros for "${foodName}" are invalid: ${validation.errors.join('; ')}`,
        foodName
      );
    }

    return calculatedMacros;
  }

  /**
   * Get nutrition data for a food (for storage/caching)
   */
  async getFoodNutritionData(foodName: string): Promise<FoodNutritionData> {
    // Reusing getMacros logic but returning detailed object
    // This could also be optimized by not calculating amount logic if we just want per 100g
    // But keeping it consistent with getMacros flow is fine.

    // Copy-paste of getMacros search logic to get the food object
    const searchResults = await this.searchFood(foodName);
    if (searchResults.length === 0) {
      throw this.createError(NutritionErrorType.FOOD_NOT_FOUND, `Food not found: "${foodName}"`, foodName);
    }

    let food: USDAFoodItem | null = null;
    for (const result of searchResults) {
      try {
        const testFood = await this.getFoodDetails(result.fdcId);
        if (testFood.nutrients && testFood.nutrients.length > 0) {
          food = testFood;
          break;
        }
      } catch (error) { continue; }
    }

    if (!food) {
      throw this.createError(NutritionErrorType.INVALID_RESPONSE, `No foods found for "${foodName}"`, foodName);
    }

    let macrosPer100g: MacroValues;
    try {
      macrosPer100g = extractMacrosFromUSDA(food.nutrients, {
        foodName: food.description,
        fdcId: food.fdcId,
        debug: true,
      });
    } catch (error) {
      throw this.createError(NutritionErrorType.INVALID_RESPONSE, `Failed to extract macros`, foodName);
    }

    const nutritionData: FoodNutritionData = {
      fdcId: food.fdcId,
      name: food.description,
      macrosPer100g,
      source: 'usda',
      lastUpdated: new Date().toISOString(),
    };

    this.validateNutritionData(nutritionData);

    return nutritionData;
  }

  private createError(
    type: NutritionErrorType,
    message: string,
    foodName?: string,
    suggestedAction?: string
  ): NutritionError {
    return { type, message, foodName, suggestedAction };
  }

  private getFromCache(key: string): NutritionCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.cacheStats.size--;
      return null;
    }
    return entry;
  }

  private setCache(key: string, food: USDAFoodItem): void {
    if (this.cache.size >= CONFIG.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.cacheStats.size--;
      }
    }
    const entry: NutritionCacheEntry = {
      food,
      timestamp: Date.now(),
      ttl: CONFIG.CACHE_TTL,
    };
    this.cache.set(key, entry);
    this.cacheStats.size++;
  }

  getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheStats.size = 0;
    this.cacheStats.hits = 0;
    this.cacheStats.misses = 0;
  }

  private validateNutritionData(data: FoodNutritionData): void {
    const validation = validateMacroValues(data.macrosPer100g);
    if (!validation.isValid) {
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Invalid nutrition data for "${data.name}": ${validation.errors.join('; ')}`,
        data.name
      );
    }
  }
}
