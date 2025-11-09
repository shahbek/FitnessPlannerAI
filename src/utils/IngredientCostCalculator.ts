/**
 * Formula-based ingredient cost calculator
 * Replaces AI cost estimation with precise calculations
 */

interface PriceDatabaseItem {
  pricePerUnit: number; // Price in CAD
  unit: string; // e.g., "kg", "dozen", "loaf"
  weightPerUnit: number; // Weight in grams
  category: string;
  notes?: string;
}

interface IngredientMatch {
  item: PriceDatabaseItem;
  confidence: number; // 0-1, how well the name matches
}

export class IngredientCostCalculator {
  // Canadian grocery price database (2024-2025 prices)
  // Based on major chains: Loblaws, Metro, Sobeys, Real Canadian Superstore
  private priceDatabase: Map<string, PriceDatabaseItem> = new Map([
    // Proteins
    ['chicken breast', { pricePerUnit: 10.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins', notes: 'Family packs offer better value' }],
    ['chicken', { pricePerUnit: 10.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['turkey breast', { pricePerUnit: 15.98, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['turkey', { pricePerUnit: 15.98, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['lean ground beef', { pricePerUnit: 12.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['ground beef', { pricePerUnit: 12.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['salmon', { pricePerUnit: 22.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['shrimp', { pricePerUnit: 18.99, unit: 'kg', weightPerUnit: 1000, category: 'Proteins' }],
    ['eggs', { pricePerUnit: 3.49, unit: 'dozen', weightPerUnit: 600, category: 'Dairy & Eggs', notes: 'Average 50g per egg' }],
    ['whole eggs', { pricePerUnit: 3.49, unit: 'dozen', weightPerUnit: 600, category: 'Dairy & Eggs' }],
    ['egg whites', { pricePerUnit: 4.99, unit: 'carton', weightPerUnit: 500, category: 'Dairy & Eggs' }],
    ['greek yogurt', { pricePerUnit: 6.99, unit: 'kg', weightPerUnit: 1000, category: 'Dairy & Eggs' }],
    ['yogurt', { pricePerUnit: 5.49, unit: 'kg', weightPerUnit: 1000, category: 'Dairy & Eggs' }],
    
    // Grains
    ['quinoa', { pricePerUnit: 13.98, unit: 'kg', weightPerUnit: 1000, category: 'Grains' }],
    ['brown rice', { pricePerUnit: 2.99, unit: 'kg', weightPerUnit: 1000, category: 'Grains' }],
    ['rice', { pricePerUnit: 2.99, unit: 'kg', weightPerUnit: 1000, category: 'Grains' }],
    ['oats', { pricePerUnit: 5.49, unit: 'kg', weightPerUnit: 1000, category: 'Grains' }],
    ['rolled oats', { pricePerUnit: 5.49, unit: 'kg', weightPerUnit: 1000, category: 'Grains' }],
    ['whole grain bread', { pricePerUnit: 3.49, unit: 'loaf', weightPerUnit: 600, category: 'Grains' }],
    ['bread', { pricePerUnit: 3.49, unit: 'loaf', weightPerUnit: 600, category: 'Grains' }],
    ['whole grain wrap', { pricePerUnit: 3.49, unit: 'pack', weightPerUnit: 500, category: 'Grains' }],
    ['wraps', { pricePerUnit: 3.49, unit: 'pack', weightPerUnit: 500, category: 'Grains' }],
    
    // Vegetables
    ['broccoli', { pricePerUnit: 4.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['spinach', { pricePerUnit: 5.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['lettuce', { pricePerUnit: 3.99, unit: 'head', weightPerUnit: 400, category: 'Vegetables' }],
    ['carrots', { pricePerUnit: 2.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['bell peppers', { pricePerUnit: 6.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['peppers', { pricePerUnit: 6.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['tomatoes', { pricePerUnit: 4.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    ['cucumber', { pricePerUnit: 2.49, unit: 'each', weightPerUnit: 300, category: 'Vegetables' }],
    ['zucchini', { pricePerUnit: 4.99, unit: 'kg', weightPerUnit: 1000, category: 'Vegetables' }],
    
    // Fruits
    ['banana', { pricePerUnit: 1.99, unit: 'kg', weightPerUnit: 1000, category: 'Fruits' }],
    ['bananas', { pricePerUnit: 1.99, unit: 'kg', weightPerUnit: 1000, category: 'Fruits' }],
    ['apple', { pricePerUnit: 4.99, unit: 'kg', weightPerUnit: 1000, category: 'Fruits' }],
    ['apples', { pricePerUnit: 4.99, unit: 'kg', weightPerUnit: 1000, category: 'Fruits' }],
    ['berries', { pricePerUnit: 8.99, unit: 'kg', weightPerUnit: 1000, category: 'Fruits' }],
    
    // Oils & Condiments
    ['olive oil', { pricePerUnit: 14.99, unit: 'liter', weightPerUnit: 1000, category: 'Oils & Condiments' }],
    ['coconut oil', { pricePerUnit: 12.99, unit: 'liter', weightPerUnit: 1000, category: 'Oils & Condiments' }],
    ['honey', { pricePerUnit: 8.99, unit: 'kg', weightPerUnit: 1000, category: 'Oils & Condiments' }],
    ['peanut butter', { pricePerUnit: 6.99, unit: 'kg', weightPerUnit: 1000, category: 'Oils & Condiments' }],
    ['almond butter', { pricePerUnit: 12.99, unit: 'kg', weightPerUnit: 1000, category: 'Oils & Condiments' }],
    
    // Nuts & Seeds
    ['almonds', { pricePerUnit: 18.99, unit: 'kg', weightPerUnit: 1000, category: 'Nuts & Seeds' }],
    ['walnuts', { pricePerUnit: 16.99, unit: 'kg', weightPerUnit: 1000, category: 'Nuts & Seeds' }],
    ['chia seeds', { pricePerUnit: 15.99, unit: 'kg', weightPerUnit: 1000, category: 'Nuts & Seeds' }],
    ['flax seeds', { pricePerUnit: 8.99, unit: 'kg', weightPerUnit: 1000, category: 'Nuts & Seeds' }],
    
    // Supplements
    ['whey protein', { pricePerUnit: 49.99, unit: 'kg', weightPerUnit: 1000, category: 'Supplements' }],
    ['whey protein isolate', { pricePerUnit: 54.99, unit: 'kg', weightPerUnit: 1000, category: 'Supplements' }],
    ['protein powder', { pricePerUnit: 49.99, unit: 'kg', weightPerUnit: 1000, category: 'Supplements' }],
  ]);

  /**
   * Calculate cost for an ingredient based on total amount needed
   * @param ingredientName - Name of the ingredient (normalized)
   * @param totalAmount - Total amount as string (e.g., "1428g", "2.5kg", "12 eggs")
   * @returns Calculated cost in CAD, rounded to 2 decimals
   */
  calculateCost(ingredientName: string, totalAmount: string): { cost: number; item: PriceDatabaseItem | null; method: 'database' | 'estimated' } {
    const normalizedName = this.normalizeName(ingredientName);
    const item = this.findInDatabase(normalizedName);
    
    if (item) {
      // Parse amount to grams
      const amountGrams = this.parseAmountToGrams(totalAmount, item);
      
      // Calculate units needed (round up to full packages)
      const unitsNeeded = Math.ceil(amountGrams / item.weightPerUnit);
      
      // Calculate cost
      const cost = unitsNeeded * item.pricePerUnit;
      
      return {
        cost: Math.round(cost * 100) / 100, // Round to 2 decimals
        item,
        method: 'database'
      };
    }
    
    // Fallback estimation for unknown ingredients
    return {
      cost: this.estimateCost(normalizedName, totalAmount),
      item: null,
      method: 'estimated'
    };
  }

  /**
   * Normalize ingredient name for matching
   */
  private normalizeName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Find ingredient in database with fuzzy matching
   */
  private findInDatabase(normalizedName: string): PriceDatabaseItem | null {
    // Exact match first
    if (this.priceDatabase.has(normalizedName)) {
      return this.priceDatabase.get(normalizedName)!;
    }
    
    // Fuzzy match - find best match
    let bestMatch: IngredientMatch | null = null;
    
    for (const [key, item] of this.priceDatabase.entries()) {
      const confidence = this.calculateMatchConfidence(normalizedName, key);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { item, confidence };
      }
    }
    
    // Return if confidence is high enough (>0.7)
    if (bestMatch && bestMatch.confidence > 0.7) {
      return bestMatch.item;
    }
    
    return null;
  }

  /**
   * Calculate match confidence between two strings
   */
  private calculateMatchConfidence(str1: string, str2: string): number {
    // Simple word overlap calculation
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Parse amount string to grams
   * Handles formats like "1428g", "2.5kg", "12 eggs", "1.5 liters"
   */
  private parseAmountToGrams(amount: string, item: PriceDatabaseItem): number {
    const normalized = amount.toLowerCase().trim();
    
    // Remove "estimated", "approx", etc.
    const cleaned = normalized.replace(/estimated|approx|approximately|about/gi, '').trim();
    
    // Extract number and unit
    const numberMatch = cleaned.match(/(\d+\.?\d*)/);
    if (!numberMatch) {
      console.warn(`Could not parse amount: ${amount}, using 0`);
      return 0;
    }
    
    const number = parseFloat(numberMatch[1]);
    
    // Determine multiplier based on unit
    let multiplier = 1;
    
    if (cleaned.includes('kg') || cleaned.includes('kilogram')) {
      multiplier = 1000;
    } else if (cleaned.includes('g') || cleaned.includes('gram')) {
      multiplier = 1;
    } else if (cleaned.includes('l') || cleaned.includes('liter') || cleaned.includes('litre')) {
      multiplier = 1000; // 1L ≈ 1000g for liquids
    } else if (cleaned.includes('dozen') || cleaned.includes('dz')) {
      // For eggs, use weight per dozen from database
      multiplier = item.weightPerUnit / item.pricePerUnit; // Fallback calculation
      if (item.unit === 'dozen') {
        return number * item.weightPerUnit; // Direct conversion for eggs
      }
    } else if (cleaned.includes('each') || cleaned.includes('piece')) {
      // Estimate average weight per piece (varies by item)
      multiplier = 100; // Default 100g per piece
    } else {
      // Assume grams if no unit specified
      multiplier = 1;
    }
    
    return number * multiplier;
  }

  /**
   * Estimate cost for unknown ingredients
   * Uses category-based average pricing
   */
  private estimateCost(normalizedName: string, totalAmount: string): number {
    // Category-based estimates (CAD per kg)
    const categoryEstimates: Record<string, number> = {
      'proteins': 15.00, // Average for meat/fish
      'grains': 5.00,
      'vegetables': 5.00,
      'fruits': 6.00,
      'dairy': 8.00,
      'oils': 12.00,
      'nuts': 15.00,
    };
    
    // Try to guess category from name
    let category = 'vegetables'; // Default
    if (normalizedName.includes('chicken') || normalizedName.includes('beef') || normalizedName.includes('pork') || normalizedName.includes('fish') || normalizedName.includes('meat')) {
      category = 'proteins';
    } else if (normalizedName.includes('rice') || normalizedName.includes('pasta') || normalizedName.includes('bread') || normalizedName.includes('oats')) {
      category = 'grains';
    } else if (normalizedName.includes('apple') || normalizedName.includes('banana') || normalizedName.includes('berry')) {
      category = 'fruits';
    } else if (normalizedName.includes('oil') || normalizedName.includes('butter')) {
      category = 'oils';
    }
    
    const pricePerKg = categoryEstimates[category] || 5.00;
    
    // Parse amount to grams
    const amountGrams = this.parseAmountToGrams(totalAmount, { pricePerUnit: pricePerKg, unit: 'kg', weightPerUnit: 1000, category });
    
    // Calculate cost (round up to full kg)
    const kgNeeded = Math.ceil(amountGrams / 1000);
    return Math.round(kgNeeded * pricePerKg * 100) / 100;
  }

  /**
   * Validate calculated cost is reasonable
   */
  validateCost(ingredientName: string, calculatedCost: number, amount: string): boolean {
    const amountGrams = this.parseAmountToGrams(amount, { pricePerUnit: 1, unit: 'kg', weightPerUnit: 1000, category: 'Unknown' });
    
    // Check cost per kg is reasonable ($2-50/kg for most items)
    const costPerKg = (calculatedCost / amountGrams) * 1000;
    
    if (costPerKg < 2 || costPerKg > 50) {
      console.warn(`⚠️ Unusual cost per kg for ${ingredientName}: $${costPerKg.toFixed(2)}/kg (total: $${calculatedCost} for ${amount})`);
      return false;
    }
    
    return true;
  }

  /**
   * Get price database entry (for reference)
   */
  getPriceInfo(ingredientName: string): PriceDatabaseItem | null {
    const normalizedName = this.normalizeName(ingredientName);
    return this.findInDatabase(normalizedName);
  }
}

