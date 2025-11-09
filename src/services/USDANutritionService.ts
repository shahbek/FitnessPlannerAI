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
  USDASearchResponse,
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

/**
 * Configuration
 */
const CONFIG = {
  BASE_URL: 'https://api.nal.usda.gov/fdc/v1',
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MAX_CACHE_SIZE: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second initial delay
  SEARCH_PAGE_SIZE: 50,
  SEARCH_MAX_RESULTS: 10, // Return top 10 matches
  DATA_TYPE_PRIORITY: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
  ALLOWED_DATA_TYPES: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Experimental'],
} as const;

export class USDANutritionService {
  private apiKey: string;
  private cache: Map<string, NutritionCacheEntry>;
  private cacheStats: CacheStats;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('USDA API key is required');
    }
    this.apiKey = apiKey;
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
   * Returns top matches from USDA database
   */
  async searchFood(query: string): Promise<USDAFoodItem[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    try {
      const normalizedQuery = normalizeFoodName(query);
      
      // Use POST request with dataType filter to get foods with complete nutrient data
      // Foundation Foods and Branded Foods typically have complete nutrient data
      // See: https://fdc.nal.usda.gov/api-guide
      const url = `${CONFIG.BASE_URL}/foods/search?api_key=${this.apiKey}`;
      
      const requestBody = {
        query: normalizedQuery,
        dataType: CONFIG.ALLOWED_DATA_TYPES,
        pageSize: CONFIG.SEARCH_PAGE_SIZE,
      };

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleAPIError(response, query);
      }

      const data: USDASearchResponse = await response.json();

      if (!data.foods || data.foods.length === 0) {
        throw this.createError(
          NutritionErrorType.FOOD_NOT_FOUND,
          `No foods found matching "${query}"`,
          query,
          'Please try a different search term or provide more specific food name'
        );
      }

      // Prioritize non-branded USDA data (Foundation/SR Legacy/Survey/Experimental)
      const preferredFoods = data.foods.filter((food) =>
        CONFIG.DATA_TYPE_PRIORITY.includes(food.dataType)
      );
      const otherNonBrandedFoods = data.foods.filter(
        (food) =>
          !CONFIG.DATA_TYPE_PRIORITY.includes(food.dataType)
      );

      let orderedFoods = [...preferredFoods, ...otherNonBrandedFoods];

      if (orderedFoods.length === 0) {
        throw this.createError(
          NutritionErrorType.FOOD_NOT_FOUND,
          `No foods found matching "${query}"`,
          query,
          'Please try a different search term or provide more specific food name'
        );
      }

      return orderedFoods.slice(0, CONFIG.SEARCH_MAX_RESULTS);
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error; // Re-throw NutritionError
      }
      
      // Capture more error details
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error) {
        errorMessage = String(error);
      }
      
      throw this.createError(
        NutritionErrorType.NETWORK_ERROR,
        `Failed to search for food: ${errorMessage}`,
        query,
        'Check your internet connection and API key'
      );
    }
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
      const url = `${CONFIG.BASE_URL}/food/${fdcId}?api_key=${this.apiKey}`;
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        await this.handleAPIError(response, `FDC ID: ${fdcId}`);
      }

      const food: any = await response.json();

      // Validate response has required fields
      if (!food.fdcId) {
        throw this.createError(
          NutritionErrorType.INVALID_RESPONSE,
          `Invalid food data returned for FDC ID ${fdcId}: missing fdcId`,
          undefined,
          'Food data may be incomplete in USDA database'
        );
      }

      // Check for nutrients - handle different response formats
      // Some foods use "foodNutrients" instead of "nutrients"
      let rawNutrients = food.nutrients || food.foodNutrients || [];
      
      // If nutrients array exists but is empty, or if it's in a different structure
      if (!rawNutrients || rawNutrients.length === 0) {
        const errorMessage = `Food data for FDC ID ${fdcId} (${food.description || food.lowercaseDescription || 'unknown'}) has no nutrients`;
        throw this.createError(
          NutritionErrorType.INVALID_RESPONSE,
          errorMessage,
          food.description || food.lowercaseDescription,
          'This food item may not have complete nutrient data. Try a different food item.'
        );
      }

      // Normalize nutrients to our expected format
      // USDA API returns nutrients in different formats:
      // 1. Flat format: { nutrientId: 1008, nutrientName: "Energy", value: 165, unitName: "kcal" }
      // 2. Nested format: { nutrient: { id: 1008, name: "Energy", unitName: "kcal" }, amount: 165 }
      const normalizedNutrients = rawNutrients.map((nut: any) => {
        // Check if it's already in normalized format
        if (nut.nutrientId !== undefined) {
          return nut;
        }
        
        // Handle nested format
        if (nut.nutrient && nut.nutrient.id) {
          return {
            nutrientId: nut.nutrient.id,
            nutrientName: nut.nutrient.name || '',
            unitName: nut.nutrient.unitName || '',
            value: nut.amount ?? nut.value ?? 0,
          };
        }
        
        // Fallback: try to extract from any structure
        return {
          nutrientId: nut.nutrientId ?? nut.id ?? nut.nutrient?.id ?? 0,
          nutrientName: nut.nutrientName ?? nut.name ?? nut.nutrient?.name ?? '',
          unitName: nut.unitName ?? nut.unitName ?? nut.nutrient?.unitName ?? '',
          value: nut.value ?? nut.amount ?? 0,
        };
      }).filter((nut: any) => nut.nutrientId > 0); // Filter out invalid nutrients

      // Normalize to our expected format
      const normalizedFood: USDAFoodItem = {
        fdcId: food.fdcId,
        description: food.description || food.lowercaseDescription || '',
        dataType: food.dataType || '',
        nutrients: normalizedNutrients,
        brandOwner: food.brandOwner,
        ingredients: food.ingredients,
        foodCategory: food.foodCategory,
      };

      // Store in cache
      this.setCache(cacheKey, normalizedFood);

      return normalizedFood;
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }
      
      // Capture more error details
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error) {
        errorMessage = String(error);
      }
      
      throw this.createError(
        NutritionErrorType.NETWORK_ERROR,
        `Failed to get food details: ${errorMessage}`,
        undefined,
        'Check your internet connection and API key'
      );
    }
  }

  /**
   * Get macros for a specific food and amount
   * This is the main method used by meal generation
   */
  async getMacros(
    foodName: string,
    amount: number,
    unit: 'g' | 'kg' | 'oz' | 'lb' = 'g'
  ): Promise<MacroValues> {
    // First, search for the food
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
        // Continue to next result
        continue;
      }
    }

    if (!food) {
      // If we couldn't find any food with nutrients, throw the last error or a generic one
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

    // Extract macros per 100g
    let macrosPer100g: MacroValues;
    try {
      macrosPer100g = extractMacrosFromUSDA(food.nutrients, {
        foodName: food.description,
        fdcId: food.fdcId,
        debug: true, // Enable detailed extraction logging
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error extracting macros';
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Failed to extract nutrition data for "${foodName}": ${errorMessage}`,
        foodName,
        'This food item may have incomplete nutrient data in USDA. Try a different item.'
      );
    }

    // Calculate macros for the requested amount
    const calculatedMacros = calculateMacrosForAmount(macrosPer100g, amount, unit);
    const validation = validateMacroValues(calculatedMacros);
    if (!validation.isValid) {
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Calculated macros for "${foodName}" are invalid: ${validation.errors.join(
          '; '
        )}`,
        foodName,
        'Please verify the requested amount or select a different food item.'
      );
    }

    return calculatedMacros;
  }

  /**
   * Get nutrition data for a food (for storage/caching)
   */
  async getFoodNutritionData(foodName: string): Promise<FoodNutritionData> {
    const searchResults = await this.searchFood(foodName);

    if (searchResults.length === 0) {
      throw this.createError(
        NutritionErrorType.FOOD_NOT_FOUND,
        `Food not found: "${foodName}"`,
        foodName
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
        debug: true, // Enable detailed extraction logging
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error extracting macros';
      throw this.createError(
        NutritionErrorType.INVALID_RESPONSE,
        `Failed to extract nutrition data for "${foodName}": ${errorMessage}`,
        foodName,
        'This food item may have incomplete nutrient data in USDA. Try a different item.'
      );
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

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options?: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      // Use global fetch (available in Node.js 18+, browsers, and tsx)
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429 && attempt < CONFIG.RETRY_ATTEMPTS) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : CONFIG.RETRY_DELAY * attempt;

        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      // Log error details for debugging
      if (error instanceof Error) {
        console.error(`Fetch error (attempt ${attempt}): ${error.message}`);
        console.error(`URL: ${url}`);
      }
      
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        await this.sleep(CONFIG.RETRY_DELAY * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  private async handleAPIError(
    response: Response,
    context?: string
  ): Promise<never> {
    const status = response.status;
    let errorType: NutritionErrorType;
    let message: string;

    switch (status) {
      case 400:
        errorType = NutritionErrorType.INVALID_RESPONSE;
        message = 'Invalid request to USDA API';
        break;
      case 401:
        errorType = NutritionErrorType.API_UNAVAILABLE;
        message = 'USDA API authentication failed. Check API key.';
        break;
      case 403:
        errorType = NutritionErrorType.API_UNAVAILABLE;
        message = 'USDA API access forbidden. Check API key permissions.';
        break;
      case 404:
        errorType = NutritionErrorType.FOOD_NOT_FOUND;
        message = `Food not found${context ? `: ${context}` : ''}`;
        break;
      case 429:
        errorType = NutritionErrorType.RATE_LIMIT;
        message = 'USDA API rate limit exceeded. Please wait before retrying.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorType = NutritionErrorType.API_UNAVAILABLE;
        message = 'USDA API is currently unavailable. Please try again later.';
        break;
      default:
        errorType = NutritionErrorType.API_UNAVAILABLE;
        message = `USDA API error: ${status}`;
    }

    throw this.createError(errorType, message, context);
  }

  /**
   * Create a NutritionError
   */
  private createError(
    type: NutritionErrorType,
    message: string,
    foodName?: string,
    suggestedAction?: string
  ): NutritionError {
    return {
      type,
      message,
      foodName,
      suggestedAction,
    };
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): NutritionCacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.cacheStats.size--;
      return null;
    }

    return entry;
  }

  private setCache(key: string, food: USDAFoodItem): void {
    // Evict if cache is full (FIFO)
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

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheStats.size = 0;
    this.cacheStats.hits = 0;
    this.cacheStats.misses = 0;
  }

  /**
   * Utility: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateNutritionData(data: FoodNutritionData): void {
    const validation = validateMacroValues(data.macrosPer100g);
    if (validation.isValid) {
      return;
    }

    throw this.createError(
      NutritionErrorType.INVALID_RESPONSE,
      `Invalid nutrition data for "${data.name}": ${validation.errors.join('; ')}`,
      data.name,
      'This food item returned incomplete or corrupt data from USDA. Please select an alternative.'
    );
  }
}
