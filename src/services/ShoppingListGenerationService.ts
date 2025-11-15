import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { IngredientCostCalculator } from '../utils/IngredientCostCalculator';

export interface GenerateShoppingListParams {
  phaseMealTemplates: any[][];  // Array of phase meal templates
  weeklyOutlines: any[];
  userProfile: any;
  onReasoningUpdate?: (reasoning: string, mode: 'thinking' | 'formatting' | 'complete') => void;
}

interface UniqueIngredient {
  name: string;
  totalAmount: number;
  unit: string;
  occurrences: number;
  usedInWeeks: number[];
}

export class ShoppingListGenerationService {
  private groq: any;
  private costCalculator: IngredientCostCalculator;

  constructor(apiKey: string) {
    this.groq = createGroq({ apiKey });
    this.costCalculator = new IngredientCostCalculator();
  }

  /**
   * Generate shopping lists using two-step reasoning:
   * 1. GPT-OSS 120B (moderate reasoning) estimates costs for all unique ingredients
   * 2. Llama 4 Scout formats the cost data into weekly shopping lists
   */
  async generateShoppingListsWithGroq(params: GenerateShoppingListParams): Promise<any> {
    const { phaseMealTemplates, weeklyOutlines, userProfile, onReasoningUpdate } = params;

    try {
      console.log('🛒 Starting shopping list generation with cost estimation...');
      
      // ✅ VALIDATION: Ensure phaseMealTemplates weeks match weeklyOutlines weeks
      const mealTemplateWeeks = new Set<number>();
      phaseMealTemplates.flat().forEach((weekTemplate: any) => {
        if (weekTemplate.weekNumber) {
          mealTemplateWeeks.add(weekTemplate.weekNumber);
        }
      });
      const outlineWeeks = new Set(weeklyOutlines.map(week => week.weekNumber));
      
      // Check for missing weeks in meal templates
      const missingMealWeeks = Array.from(outlineWeeks).filter(week => !mealTemplateWeeks.has(week));
      if (missingMealWeeks.length > 0) {
        throw new Error(`❌ FAILED: Meal templates missing for weeks: ${missingMealWeeks.join(', ')}. Cannot generate shopping list without meals.`);
      }
      
      // Check for extra weeks in meal templates (shouldn't happen, but validate)
      const extraMealWeeks = Array.from(mealTemplateWeeks).filter(week => !outlineWeeks.has(week));
      if (extraMealWeeks.length > 0) {
        console.warn(`⚠️ Meal templates contain extra weeks: ${extraMealWeeks.join(', ')}. Using weeklyOutlines as source of truth.`);
      }
      
      // Use weeklyOutlines as the source of truth for plan duration
      const planWeeks = weeklyOutlines.length;
      console.log(`✅ Validated: ${planWeeks} weeks in plan, ${mealTemplateWeeks.size} weeks with meal templates`);
      
      // Step 1: Extract all unique ingredients across all weeks
      const uniqueIngredients = this.extractUniqueIngredients(phaseMealTemplates, weeklyOutlines, userProfile);
      
      console.log(`📊 Found ${uniqueIngredients.length} unique ingredients across all meal plans`);
      
      if (uniqueIngredients.length === 0) {
        throw new Error('❌ FAILED: No ingredients found in meal templates. Cannot generate shopping list.');
      }
      
      // Step 2: Calculate costs using hybrid approach (database + AI for unknown)
      console.log('💰 Step 2: Calculating ingredient costs (database + AI for unknown)...');
      
      if (onReasoningUpdate) {
        onReasoningUpdate('## 💰 Calculating Ingredient Costs\n\nUsing price database for common ingredients, AI for others...', 'thinking');
      }
      
      // Extract ingredients by week for proper cost calculation
      const weeklyIngredients = this.extractIngredientsByWeek(phaseMealTemplates, weeklyOutlines, userProfile);
      
      // Get unique ingredient names across all weeks
      const allIngredientNames = new Set<string>();
      weeklyIngredients.forEach(weekMap => {
        weekMap.forEach((_, ingredientName) => {
          allIngredientNames.add(ingredientName);
        });
      });
      
      // Separate ingredients into known (database) and unknown (need AI)
      const knownIngredientNames = new Set<string>();
      const unknownIngredientNames = new Set<string>();
      
      allIngredientNames.forEach(ingredientName => {
        const priceInfo = this.costCalculator.getPriceInfo(ingredientName);
        if (priceInfo) {
          knownIngredientNames.add(ingredientName);
        } else {
          unknownIngredientNames.add(ingredientName);
        }
      });
      
      console.log(`📊 Ingredients: ${knownIngredientNames.size} in database, ${unknownIngredientNames.size} need AI pricing`);
      
      // Collect all unknown ingredients with their usage across weeks
      const unknownIngredientsForAI: Array<{ name: string; weeks: number[]; totalAmount: number; unit: string }> = [];
      unknownIngredientNames.forEach(ingredientName => {
        const weeksUsed: number[] = [];
        let totalAmount = 0;
        let unit = 'g';
        
        weeklyIngredients.forEach((weekMap, weekNumber) => {
          const ingredientData = weekMap.get(ingredientName);
          if (ingredientData) {
            weeksUsed.push(weekNumber);
            totalAmount += ingredientData.amount;
            unit = ingredientData.unit; // Use unit from first occurrence
          }
        });
        
        if (weeksUsed.length > 0) {
          unknownIngredientsForAI.push({
            name: ingredientName,
            weeks: weeksUsed,
            totalAmount,
            unit
          });
        }
      });
      
      // Calculate costs for known ingredients (fast, accurate)
      const knownIngredientCosts = new Map<string, { costPerUnit: number; unit: string; item: any }>();
      knownIngredientNames.forEach(ingredientName => {
        const priceInfo = this.costCalculator.getPriceInfo(ingredientName);
        if (priceInfo) {
          knownIngredientCosts.set(ingredientName, {
            costPerUnit: priceInfo.pricePerUnit,
            unit: priceInfo.unit,
            item: priceInfo
          });
        }
      });
      
      // Use AI to estimate costs for unknown ingredients
      let unknownIngredientCosts = new Map<string, { costPerUnit: number; unit: string }>();
      if (unknownIngredientsForAI.length > 0) {
        console.log(`🤖 Using AI to estimate costs for ${unknownIngredientsForAI.length} unknown ingredients...`);
        if (onReasoningUpdate) {
          onReasoningUpdate(`## 🤖 AI Cost Estimation\n\nEstimating prices for ${unknownIngredientsForAI.length} ingredients not in database...`, 'thinking');
        }
        try {
          unknownIngredientCosts = await this.estimateUnknownIngredientCosts(
            unknownIngredientsForAI,
            userProfile
          );
        } catch (e) {
          console.warn('⚠️ AI price estimation failed, proceeding with defaults for unknown items.');
          unknownIngredientCosts = new Map();
        }
      }
      
      // Calculate weekly costs for each ingredient
      const ingredientCostsForFormatting = this.calculateWeeklyCosts(
        weeklyIngredients,
        knownIngredientCosts,
        unknownIngredientCosts
      );
      
      // Build comprehensive cost summary
      const costSummary = this.buildHybridCostSummary(
        uniqueIngredients,
        knownIngredientCosts,
        unknownIngredientCosts,
        ingredientCostsForFormatting
      );
      
      console.log(`✅ Cost calculation complete. ${knownIngredientNames.size} from database, ${unknownIngredientNames.size} from AI`);
      
      if (onReasoningUpdate) {
        onReasoningUpdate(
          `## ✅ Cost Calculation Complete\n\nCalculated costs for all ingredients (${knownIngredientNames.size} from database, ${unknownIngredientNames.size} from AI).`,
          'thinking'
        );
      }
      
      // Step 3: Format the cost data into weekly shopping lists
      console.log('📋 Step 3: Formatting shopping lists...');
      let parsed: any = null;
      try {
        if (onReasoningUpdate) {
          onReasoningUpdate('## 📋 Formatting Shopping Lists\n\nCreating structured weekly shopping lists...', 'formatting');
        }
        const formattingModel = this.groq('llama-3.3-70b-versatile');
        const formattingPrompt = this.buildFormattingPromptWithCosts(costSummary, weeklyOutlines, uniqueIngredients, ingredientCostsForFormatting);
        // Try structured output first (more reliable than text parsing)
        try {
          const shoppingListSchema = this.getShoppingListSchema();
          console.log('🔄 Attempting structured output generation for shopping lists...');
          const result = await generateObject({
            model: formattingModel,
            schema: shoppingListSchema,
            prompt: formattingPrompt,
            temperature: 0.1,
            system: this.getFormattingSystemPrompt()
          });
          parsed = result.object;
          console.log('✅ Structured output successful for shopping lists');
        } catch (structuredError) {
          console.warn('⚠️ Structured output failed, falling back to text generation:', structuredError);
          // Fallback to text generation with enhanced JSON parsing
          const result = await generateText({
            model: formattingModel,
            prompt: formattingPrompt,
            temperature: 0.1,
            system: this.getFormattingSystemPrompt()
          });
          const responseText = result.text || '';
          if (!responseText) {
            throw new Error('Llama 3.3 70B returned empty response');
          }
          // Extract and parse JSON with enhanced error recovery
          parsed = this.extractAndParseJSON(responseText);
          if (!parsed) {
            throw new Error('Failed to parse shopping list JSON');
          }
        }
      } catch (formattingError) {
        console.warn('⚠️ AI formatting failed. Falling back to deterministic shopping list formatting.', formattingError);
        parsed = this.buildDeterministicShoppingLists(weeklyIngredients, weeklyOutlines, ingredientCostsForFormatting);
      }

      // Validate generated structure or fallback to deterministic if missing/empty
      const isParsedEmpty = !parsed || !parsed.weeklyShoppingLists || parsed.weeklyShoppingLists.length === 0;
      const allWeeksEmpty = !isParsedEmpty && parsed.weeklyShoppingLists.every((w: any) => !w.categories || w.categories.length === 0);
      if (isParsedEmpty || allWeeksEmpty) {
        console.warn('⚠️ Generated shopping lists are empty; rebuilding deterministically.');
        parsed = this.buildDeterministicShoppingLists(weeklyIngredients, weeklyOutlines, ingredientCostsForFormatting);
      }

      console.log('✅ Shopping lists generated successfully');
      
      if (onReasoningUpdate) {
        onReasoningUpdate('## ✅ Shopping Lists Complete\n\nAll weekly shopping lists with costs have been generated!', 'complete');
      }
      
      // ✅ VALIDATION: Ensure all weeks have shopping lists (using planWeeks as source of truth)
      if (!parsed.weeklyShoppingLists || parsed.weeklyShoppingLists.length === 0) {
        throw new Error(`❌ FAILED: No weekly shopping lists generated. Expected lists for ${planWeeks} weeks.`);
      }
      
      const weeksInShoppingLists = parsed.weeklyShoppingLists.map((list: any) => list.weekNumber).sort((a: number, b: number) => a - b);
      const expectedWeekNumbers = weeklyOutlines.map((week: any) => week.weekNumber).sort((a: number, b: number) => a - b);
      const missingWeeks = expectedWeekNumbers.filter((week: number) => !weeksInShoppingLists.includes(week));
      const extraWeeks = weeksInShoppingLists.filter((week: number) => !expectedWeekNumbers.includes(week));
      
      if (missingWeeks.length > 0) {
        throw new Error(`❌ FAILED: Shopping lists missing for weeks: ${missingWeeks.join(', ')}. Expected ${planWeeks} weeks (from weeklyOutlines), got ${weeksInShoppingLists.length}.`);
      }
      
      if (extraWeeks.length > 0) {
        console.warn(`⚠️ Shopping lists contain extra weeks: ${extraWeeks.join(', ')}. This should not happen - plan has ${planWeeks} weeks.`);
        // Filter out extra weeks to match plan duration
        parsed.weeklyShoppingLists = parsed.weeklyShoppingLists.filter((list: any) => 
          expectedWeekNumbers.includes(list.weekNumber)
        );
      }
      
      if (parsed.weeklyShoppingLists.length !== planWeeks) {
        throw new Error(`❌ FAILED: Shopping list count mismatch. Expected ${planWeeks} weeks (from weeklyOutlines), got ${parsed.weeklyShoppingLists.length} shopping lists.`);
      }
      
      console.log(`✅ All ${planWeeks} weeks have shopping lists (validated against weeklyOutlines)`);
      
      return parsed;
    } catch (error) {
      console.error('❌ Shopping list generation failed:', error);
      // Final fallback: return empty structured list to avoid breaking UI
      return this.getEmptyShoppingList();
    }
  }

  /**
   * Deterministic formatter to build weekly shopping lists from computed costs
   */
  private buildDeterministicShoppingLists(
    weeklyIngredients: Map<number, Map<string, { amount: number; unit: string; meals: string[] }>>,
    weeklyOutlines: any[],
    ingredientCosts: Map<string, Map<number, { cost: number; amount: number; unit: string }>>
  ): any {
    const weeklyShoppingLists: any[] = [];

    // Build per-week lists
    weeklyOutlines.forEach((week: any) => {
      const weekNumber = week.weekNumber;
      const ingredientMap = weeklyIngredients.get(weekNumber) || new Map();
      const categories: Array<{ category: string; items: any[]; categoryTotal: number }> = [];
      const categoryMap = new Map<string, any[]>();

      ingredientMap.forEach((data, ingredientName) => {
        const category = this.categorizeIngredient(ingredientName);
        if (!categoryMap.has(category)) categoryMap.set(category, []);
        const weekCostInfo = ingredientCosts.get(ingredientName)?.get(weekNumber);
        const estimatedCost = weekCostInfo?.cost ?? this.estimateCostFallback(ingredientName, data.amount, data.unit);
        categoryMap.get(category)!.push({
          name: ingredientName,
          quantity: `${Math.round(data.amount)}${data.unit || 'g'}`,
          estimatedCost: Math.round((estimatedCost || 0) * 100) / 100,
          priority: 'medium'
        });
      });

      let weekTotal = 0;
      categoryMap.forEach((items, category) => {
        const categoryTotal = items.reduce((sum: number, it: any) => sum + (it.estimatedCost || 0), 0);
        if (items.length > 0) {
          categories.push({ category, items, categoryTotal: Math.round(categoryTotal * 100) / 100 });
          weekTotal += categoryTotal;
        }
      });

      weeklyShoppingLists.push({
        weekNumber,
        phase: week.phase,
        categories,
        weekTotal: Math.round(weekTotal * 100) / 100
      });
    });

    // Build master list by aggregating across weeks
    const masterCategoryMap = new Map<string, any[]>();
    weeklyShoppingLists.forEach((weekList) => {
      weekList.categories.forEach((cat: any) => {
        if (!masterCategoryMap.has(cat.category)) masterCategoryMap.set(cat.category, []);
        masterCategoryMap.get(cat.category)!.push(...cat.items);
      });
    });

    const masterCategories: Array<{ category: string; items: any[] }> = [];
    let totalEstimatedCost = 0;
    masterCategoryMap.forEach((items, category) => {
      const categoryTotal = items.reduce((sum: number, it: any) => sum + (it.estimatedCost || 0), 0);
      masterCategories.push({ category, items });
      totalEstimatedCost += categoryTotal;
    });

    return {
      masterShoppingList: {
        categories: masterCategories,
        totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
        notes: []
      },
      weeklyShoppingLists
    };
  }

  /** Estimate cost using category defaults when pricing is unknown */
  private estimateCostFallback(ingredientName: string, amount: number, unit: string): number {
    const info = this.costCalculator.getPriceInfo(ingredientName);
    if (info) {
      // Approximate based on database entry
      const grams = unit?.toLowerCase() === 'g' ? amount : amount;
      const unitsNeeded = grams / info.weightPerUnit;
      return unitsNeeded * info.pricePerUnit;
    }
    const category = this.categorizeIngredient(ingredientName);
    const defaults: Record<string, number> = {
      'Proteins': 12.0,
      'Grains': 3.0,
      'Vegetables': 5.0,
      'Fruits': 6.0,
      'Dairy & Eggs': 6.0,
      'Oils & Condiments': 9.0,
      'Nuts & Seeds': 15.0
    };
    const perKg = defaults[category] ?? 8.0;
    const grams = unit?.toLowerCase() === 'g' ? amount : amount;
    return (grams / 1000) * perKg;
  }

  /**
   * Extract ingredients per week with proper grouping
   * CORRECTLY handles meal structure: meals are organized by day within weeks
   * Each meal is eaten once per day, so we sum across all 7 days in the week
   */
  private extractIngredientsByWeek(
    phaseMealTemplates: any[][],
    _weeklyOutlines: any[],
    _userProfile: any
  ): Map<number, Map<string, { amount: number; unit: string; meals: string[] }>> {
    const weeklyIngredients = new Map<number, Map<string, { amount: number; unit: string; meals: string[] }>>();
    
    // phaseMealTemplates is array of arrays where inner arrays contain day templates
    // Each day template has: { weekNumber, dayNumber, meals: [...] }
    const allDayTemplates = phaseMealTemplates.flat();
    
    // Group day templates by week
    const daysByWeek = new Map<number, any[]>();
    allDayTemplates.forEach((dayTemplate: any) => {
      const weekNumber = dayTemplate.weekNumber;
      if (!weekNumber) return;
      
      if (!daysByWeek.has(weekNumber)) {
        daysByWeek.set(weekNumber, []);
      }
      daysByWeek.get(weekNumber)!.push(dayTemplate);
    });
    
    // Process each week
    daysByWeek.forEach((dayTemplates, weekNumber) => {
      // Initialize week map
      if (!weeklyIngredients.has(weekNumber)) {
        weeklyIngredients.set(weekNumber, new Map());
      }
      const weekIngredientMap = weeklyIngredients.get(weekNumber)!;
      
      // Extract ingredients from ALL days in this week
      dayTemplates.forEach((dayTemplate: any) => {
        const meals = dayTemplate.meals || [];
        
        // Each meal is eaten once per day, so we extract ingredients from all meals
        meals.forEach((meal: any) => {
          const mealName = meal.recipe?.name || meal.baseRecipe?.name || meal.name || meal.mealType || 'Unknown Meal';
          
          // Handle multiple possible ingredient locations
          let ingredients: any[] = [];
          if (meal.recipe?.ingredients && Array.isArray(meal.recipe.ingredients)) {
            ingredients = meal.recipe.ingredients;
          } else if (meal.baseRecipe?.ingredients && Array.isArray(meal.baseRecipe.ingredients)) {
            ingredients = meal.baseRecipe.ingredients;
          } else if (Array.isArray(meal.ingredients)) {
            ingredients = meal.ingredients;
          }
          
          // Debug logging for missing ingredients
          if (ingredients.length === 0 && meal.recipe) {
            console.warn(`⚠️ Meal "${mealName}" has no ingredients in recipe.baseRecipe structure:`, {
              hasRecipe: !!meal.recipe,
              hasBaseRecipe: !!meal.baseRecipe,
              hasIngredients: !!meal.ingredients,
              mealKeys: Object.keys(meal)
            });
          }
          
          ingredients.forEach((ingredient: any) => {
            const ingredientName = (ingredient.name || '').trim();
            if (!ingredientName) return;
            
            // Parse amount (e.g., "100g" -> 100, "g")
            const amountStr = ingredient.amount || '0';
            const amountMatch = amountStr.match(/(\d+\.?\d*)\s*([a-zA-Z]+)?/);
            const amountPerMeal = amountMatch ? parseFloat(amountMatch[1]) : 0;
            const unit = amountMatch?.[2] || 'g';
            
            // IMPORTANT: This meal is eaten ONCE PER DAY
            // If we're processing day 1, this is day 1's amount
            // We need to sum across all 7 days
            // But since we're iterating through all days, we just add the amount once per day
            // The total will be the sum of all days
            const normalizedName = ingredientName.toLowerCase();
            
            // Group ingredients within the week (sum amounts across all days)
            if (weekIngredientMap.has(normalizedName)) {
              const existing = weekIngredientMap.get(normalizedName)!;
              existing.amount += amountPerMeal; // Add this day's amount
              if (!existing.meals.includes(mealName)) {
                existing.meals.push(mealName);
              }
            } else {
              weekIngredientMap.set(normalizedName, {
                amount: amountPerMeal, // This will accumulate across days
                unit,
                meals: [mealName]
              });
            }
          });
        });
      });
    });
    
    return weeklyIngredients;
  }

  /**
   * Extract all unique ingredients across all weeks (for master list)
   */
  private extractUniqueIngredients(
    phaseMealTemplates: any[][],
    weeklyOutlines: any[],
    userProfile: any
  ): UniqueIngredient[] {
    const ingredientMap = new Map<string, UniqueIngredient>();
    
    // Use the new week-by-week extraction
    const weeklyIngredients = this.extractIngredientsByWeek(phaseMealTemplates, weeklyOutlines, userProfile);
    
    // Aggregate across all weeks
    weeklyIngredients.forEach((weekMap, weekNumber) => {
      weekMap.forEach((ingredientData, ingredientName) => {
        if (ingredientMap.has(ingredientName)) {
          const existing = ingredientMap.get(ingredientName)!;
          existing.totalAmount += ingredientData.amount;
          existing.occurrences++;
          if (!existing.usedInWeeks.includes(weekNumber)) {
            existing.usedInWeeks.push(weekNumber);
          }
        } else {
          ingredientMap.set(ingredientName, {
            name: ingredientName,
            totalAmount: ingredientData.amount,
            unit: ingredientData.unit,
            occurrences: 1,
            usedInWeeks: [weekNumber]
          });
        }
      });
    });
    
    return Array.from(ingredientMap.values()).sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Build cost summary from calculated costs (replaces AI cost reasoning)
   */
  private buildCostSummary(
    ingredientCosts: Map<string, { cost: number; item: any; method: string; totalAmount: string }>,
    uniqueIngredients: UniqueIngredient[]
  ): string {
    const lines: string[] = [];
    lines.push('=== INGREDIENT COST TABLE ===\n');
    lines.push(`Calculated costs using Canadian market price database (2024-2025 prices)\n`);
    
    uniqueIngredients.forEach((ing, idx) => {
      const costData = ingredientCosts.get(ing.name);
      if (!costData) return;
      
      const amountString = `${Math.round(ing.totalAmount)}${ing.unit || 'g'}`;
      const priceInfo = costData.item;
      
      lines.push(`${idx + 1}. ${ing.name}`);
      if (priceInfo) {
        lines.push(`   - Price: $${priceInfo.pricePerUnit.toFixed(2)}/${priceInfo.unit}`);
        lines.push(`   - Typical Package: ${priceInfo.unit === 'kg' ? '500g-1kg packages' : priceInfo.unit === 'dozen' ? 'dozen' : 'standard package'}`);
        lines.push(`   - Total Needed: ${amountString} across ${ing.usedInWeeks.length} weeks`);
        lines.push(`   - Estimated Cost: $${costData.cost.toFixed(2)} CAD`);
        if (priceInfo.notes) {
          lines.push(`   - Notes: ${priceInfo.notes}`);
        }
        lines.push(`   - Method: ${costData.method === 'database' ? 'Price database (accurate)' : 'Estimated (not in database)'}`);
      } else {
        lines.push(`   - Total Needed: ${amountString} across ${ing.usedInWeeks.length} weeks`);
        lines.push(`   - Estimated Cost: $${costData.cost.toFixed(2)} CAD (estimated)`);
        lines.push(`   - Method: Estimated - ingredient not in price database`);
      }
      lines.push('');
    });
    
    return lines.join('\n');
  }

  /**
   * Build prompt for GPT-OSS to estimate costs for all unique ingredients (DEPRECATED - use formula-based calculator)
   */
  private buildCostReasoningPrompt(uniqueIngredients: UniqueIngredient[], userProfile: any): string {
    return `You are a Canadian grocery pricing expert. Estimate costs for these ingredients based on current Canadian market prices (CAD).

USER LOCATION: ${userProfile.location || 'Canada'}

UNIQUE INGREDIENTS (${uniqueIngredients.length} total):
${uniqueIngredients.slice(0, 50).map((ing, idx) => 
  `${idx + 1}. ${ing.name} - Used ${ing.occurrences}x across ${ing.usedInWeeks.length} weeks (Total: ${Math.round(ing.totalAmount)}${ing.unit})`
).join('\n')}
${uniqueIngredients.length > 50 ? `\n... and ${uniqueIngredients.length - 50} more ingredients` : ''}

YOUR TASK:
For EACH ingredient, estimate:
1. Price per standard unit (e.g., $/100g, $/lb, $/dozen)
2. Typical package size available in Canadian stores
3. Estimated cost for the total amount needed

Consider:
- Current 2024-2025 Canadian grocery prices
- Major chains: Loblaws, Metro, Sobeys, Real Canadian Superstore
- Seasonal availability and price variations
- Organic vs conventional options

Format your response like this:

=== INGREDIENT COST TABLE ===

1. Chicken Breast
   - Price: $10.99/kg ($5.00/lb)
   - Typical Package: 500g-1kg packages
   - Total Needed: 2400g across 8 weeks
   - Estimated Cost: $26.40 CAD
   - Notes: Buy family packs for savings

2. Oats (Rolled Oats)
   - Price: $5.49/kg
   - Typical Package: 1kg box
   - Total Needed: 1400g across 8 weeks
   - Estimated Cost: $7.69 CAD
   - Notes: Store brand cheaper

... continue for ALL ${uniqueIngredients.length} ingredients

CRITICAL:
- Estimate costs for ALL ingredients provided
- Use realistic 2024-2025 Canadian prices
- Consider package sizes (can't buy exactly 127g of chicken)
- Factor in waste/rounding up to full packages
- Keep format simple and consistent for easy extraction`;
  }

  /**
   * Use AI to estimate costs for unknown ingredients (NO HARDCODED FALLBACKS)
   */
  private async estimateUnknownIngredientCosts(
    unknownIngredients: Array<{ name: string; weeks: number[]; totalAmount: number; unit: string }>,
    userProfile: any
  ): Promise<Map<string, { costPerUnit: number; unit: string }>> {
    if (unknownIngredients.length === 0) {
      return new Map();
    }

    const prompt = `You are a Canadian grocery pricing expert. Estimate current market prices (2024-2025) for these ingredients in Canadian dollars (CAD).

USER LOCATION: ${userProfile.location || 'Canada'}

UNKNOWN INGREDIENTS (${unknownIngredients.length} total):
${unknownIngredients.map((ing, idx) => 
  `${idx + 1}. ${ing.name} - Used in weeks ${ing.weeks.join(', ')} (Total needed: ${Math.round(ing.totalAmount)}${ing.unit})`
).join('\n')}

YOUR TASK:
For EACH ingredient, provide:
1. Price per 100 grams (100g) in CAD (e.g., $X.XX per 100g)
2. The unit must be exactly "100g" so downstream code can scale the price based on actual grams used.

CRITICAL:
- Use realistic 2024-2025 Canadian grocery prices
- Major chains: Loblaws, Metro, Sobeys, Real Canadian Superstore
- Consider typical package sizes available in stores
- Prices should be in CAD

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "ingredients": [
    {
      "name": "ingredient name (exact match)",
      "pricePerUnit": 1.99,
      "unit": "100g",
      "notes": "Equivalent to $19.90/kg based on typical Canadian grocery pricing"
    }
  ]
}

IMPORTANT: You MUST provide pricing for ALL ${unknownIngredients.length} ingredients listed above.`;

    try {
      const model = this.groq('llama-3.3-70b-versatile');
      const result = await generateText({
        model,
        prompt,
        temperature: 0.3
      });

      const responseText = result.text || '';
      
      // Extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI did not return valid JSON for ingredient pricing');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
        throw new Error('AI response missing ingredients array');
      }

      // Map results
      const costMap = new Map<string, { costPerUnit: number; unit: string }>();
      
      parsed.ingredients.forEach((item: any) => {
        const name = (item.name || '').toLowerCase().trim();
        if (name && item.pricePerUnit && item.unit) {
          costMap.set(name, {
            costPerUnit: parseFloat(item.pricePerUnit) || 0,
            unit: item.unit
          });
        }
      });

      // Validate all ingredients got prices
      const missingPrices = unknownIngredients.filter(ing => 
        !costMap.has(ing.name.toLowerCase())
      );

      if (missingPrices.length > 0) {
        throw new Error(`AI failed to provide prices for ${missingPrices.length} ingredients: ${missingPrices.map(i => i.name).join(', ')}`);
      }

      console.log(`✅ AI estimated prices for ${costMap.size} unknown ingredients`);
      return costMap;

    } catch (error) {
      console.error('❌ AI ingredient cost estimation failed:', error);
      throw new Error(`Failed to estimate costs for unknown ingredients: ${error instanceof Error ? error.message : 'Unknown error'}. This is required - no fallback pricing available.`);
    }
  }

  /**
   * Calculate weekly costs for each ingredient based on actual usage
   */
  private calculateWeeklyCosts(
    weeklyIngredients: Map<number, Map<string, { amount: number; unit: string; meals: string[] }>>,
    knownIngredientCosts: Map<string, { costPerUnit: number; unit: string; item: any }>,
    unknownIngredientCosts: Map<string, { costPerUnit: number; unit: string }>
  ): Map<string, Map<number, { cost: number; amount: number; unit: string }>> {
    const weeklyCosts = new Map<string, Map<number, { cost: number; amount: number; unit: string }>>();

    weeklyIngredients.forEach((weekMap, weekNumber) => {
      weekMap.forEach((ingredientData, ingredientName) => {
        // Get price info
        let priceInfo: { costPerUnit: number; unit: string; weightPerUnit?: number } | null = null;
        
        const knownCost = knownIngredientCosts.get(ingredientName);
        if (knownCost) {
          priceInfo = {
            costPerUnit: knownCost.costPerUnit,
            unit: knownCost.unit,
            weightPerUnit: knownCost.item?.weightPerUnit
          };
        } else {
          const unknownCost = unknownIngredientCosts.get(ingredientName);
          if (unknownCost) {
            // For unknown ingredients, estimate weight per unit based on unit type
            let weightPerUnit = 1000; // Default 1kg
            if (unknownCost.unit === 'kg') {
              weightPerUnit = 1000;
            } else if (unknownCost.unit === '100g') {
              weightPerUnit = 100;
            } else if (unknownCost.unit === 'dozen') {
              weightPerUnit = 600; // Approx for eggs
            } else if (unknownCost.unit === 'piece' || unknownCost.unit === 'each') {
              weightPerUnit = 100; // Estimate
            }
            
            priceInfo = {
              costPerUnit: unknownCost.costPerUnit,
              unit: unknownCost.unit,
              weightPerUnit
            };
          }
        }

        if (!priceInfo) {
          console.warn(`⚠️ No price info for ingredient: ${ingredientName}, skipping cost calculation`);
          return;
        }

        // Convert ingredient amount to match price unit
        let amountInPriceUnit = ingredientData.amount;
        if (ingredientData.unit !== priceInfo.unit) {
          // Convert to grams first, then to price unit
          let grams = ingredientData.amount;
          if (ingredientData.unit === 'kg') grams = ingredientData.amount * 1000;
          else if (ingredientData.unit === 'g') grams = ingredientData.amount;
          
          // Convert to price unit
          if (priceInfo.unit === 'kg') {
            amountInPriceUnit = grams / 1000;
          } else if (priceInfo.unit === '100g') {
            amountInPriceUnit = grams / 100;
          } else if (priceInfo.unit === 'dozen' && priceInfo.weightPerUnit) {
            amountInPriceUnit = grams / priceInfo.weightPerUnit;
          } else {
            amountInPriceUnit = grams / (priceInfo.weightPerUnit || 1000);
          }
        }

        // Calculate cost proportionally based on actual amount used
        const cost = amountInPriceUnit * priceInfo.costPerUnit;

        // Store weekly cost
        if (!weeklyCosts.has(ingredientName)) {
          weeklyCosts.set(ingredientName, new Map());
        }
        weeklyCosts.get(ingredientName)!.set(weekNumber, {
          cost: Math.round(cost * 100) / 100,
          amount: ingredientData.amount,
          unit: ingredientData.unit
        });
      });
    });

    return weeklyCosts;
  }

  /**
   * Build hybrid cost summary (database + AI prices)
   */
  private buildHybridCostSummary(
    uniqueIngredients: UniqueIngredient[],
    knownIngredientCosts: Map<string, { costPerUnit: number; unit: string; item: any }>,
    unknownIngredientCosts: Map<string, { costPerUnit: number; unit: string }>,
    weeklyCosts: Map<string, Map<number, { cost: number; amount: number; unit: string }>>
  ): string {
    const lines: string[] = [];
    lines.push('=== INGREDIENT COST TABLE ===\n');
    lines.push(`Calculated costs using hybrid approach: Price database for common items, AI for others.\n\n`);

    uniqueIngredients.forEach((ing, idx) => {
      const knownCost = knownIngredientCosts.get(ing.name);
      const unknownCost = unknownIngredientCosts.get(ing.name);
      
      if (!knownCost && !unknownCost) {
        console.warn(`⚠️ No cost info for ingredient: ${ing.name}`);
        return;
      }

      const priceInfo = knownCost || { costPerUnit: unknownCost!.costPerUnit, unit: unknownCost!.unit, item: null };
      const method = knownCost ? 'database' : 'AI estimated';
      
      // Calculate total cost across all weeks
      const weeklyCostMap = weeklyCosts.get(ing.name);
      let totalCost = 0;
      if (weeklyCostMap) {
        weeklyCostMap.forEach(weekCost => {
          totalCost += weekCost.cost;
        });
      }

      lines.push(`${idx + 1}. ${ing.name}`);
      lines.push(`   - Price: $${priceInfo.costPerUnit.toFixed(2)}/${priceInfo.unit}`);
      lines.push(`   - Total Needed: ${Math.round(ing.totalAmount)}${ing.unit} across ${ing.usedInWeeks.length} weeks`);
      lines.push(`   - Total Estimated Cost: $${totalCost.toFixed(2)} CAD`);
      lines.push(`   - Method: ${method === 'database' ? 'Price database (accurate)' : 'AI estimated (not in database)'}`);
      if (knownCost?.item?.notes) {
        lines.push(`   - Notes: ${knownCost.item.notes}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Build prompt for Llama 4 Scout using pre-calculated costs
   */
  private buildFormattingPromptWithCosts(
    costSummary: string,
    weeklyOutlines: any[],
    uniqueIngredients: UniqueIngredient[],
    ingredientCosts: Map<string, Map<number, { cost: number; amount: number; unit: string }>>
  ): string {
    return this.buildFormattingPrompt(costSummary, weeklyOutlines, uniqueIngredients, ingredientCosts);
  }

  /**
   * Build prompt for Llama 4 Scout to format cost data into weekly shopping lists
   */
  private buildFormattingPrompt(
    costReasoning: string,
    weeklyOutlines: any[],
    uniqueIngredients: UniqueIngredient[],
    weeklyCosts?: Map<string, Map<number, { cost: number; amount: number; unit: string }>>
  ): string {
    // Create a mapping of ingredients to their weeks and categories
    const ingredientsByWeek = new Map<number, Map<string, UniqueIngredient[]>>();
    
    uniqueIngredients.forEach(ing => {
      ing.usedInWeeks.forEach(weekNum => {
        if (!ingredientsByWeek.has(weekNum)) {
          ingredientsByWeek.set(weekNum, new Map());
        }
        const weekMap = ingredientsByWeek.get(weekNum)!;
        const category = this.categorizeIngredient(ing.name);
        if (!weekMap.has(category)) {
          weekMap.set(category, []);
        }
        weekMap.get(category)!.push(ing);
      });
    });
    
    // Build enhanced prompt with weekly cost information if available
    let costDetails = '';
    if (weeklyCosts && weeklyCosts.size > 0) {
      costDetails = '\n\nWEEKLY COST DETAILS (pre-calculated from actual ingredient usage):\n';
      weeklyCosts.forEach((weekCostMap, ingredientName) => {
        weekCostMap.forEach((weekCost, weekNumber) => {
          costDetails += `Week ${weekNumber} - ${ingredientName}: ${weekCost.amount}${weekCost.unit} = $${weekCost.cost.toFixed(2)}\n`;
        });
      });
    }
    
    return `Extract ingredient costs and create weekly shopping lists in JSON format.

COST ANALYSIS:
${costReasoning}${costDetails}

WEEKLY STRUCTURE:
${weeklyOutlines.map(week => `Week ${week.weekNumber} (${week.phase})`).join('\n')}

INGREDIENT USAGE BY WEEK (with categories):
${Array.from(ingredientsByWeek.entries()).map(([weekNum, categoryMap]) => {
  return `Week ${weekNum}:\n${Array.from(categoryMap.entries()).map(([cat, ings]) => 
    `  ${cat}: ${ings.map(i => i.name).join(', ')}`
  ).join('\n')}`;
}).join('\n\n')}

YOUR TASK:
1. Create a master shopping list with ALL ingredients and their costs (extract from cost analysis)
2. **CRITICAL: Create weekly shopping lists for ALL ${weeklyOutlines.length} weeks** - You MUST include lists for weeks: ${weeklyOutlines.map(w => w.weekNumber).join(', ')}
3. For each weekly list, include ALL relevant categories (not just Proteins)
4. Calculate weekly costs by dividing total ingredient cost proportionally across the weeks it's used

CRITICAL REQUIREMENTS:
- Master list has ALL ${uniqueIngredients.length} ingredients with TOTAL costs
- **You MUST create exactly ${weeklyOutlines.length} weekly shopping lists** - one for EACH week
- Weekly lists show only ingredients needed THAT week with FRACTIONAL costs
- Each week must have categories: Proteins, Grains, Vegetables, Fruits, Dairy & Eggs, Oils & Condiments, Nuts & Seeds (only include if that week uses items from that category)
- **FAILURE TO CREATE ALL ${weeklyOutlines.length} WEEKLY LISTS WILL RESULT IN GENERATION FAILURE**
- If a week has NO items, still include empty categories array with weekTotal: 0
- Validate that weeklyShoppingLists array has exactly ${weeklyOutlines.length} items before returning

JSON FORMATTING REQUIREMENTS (CRITICAL - INVALID JSON WILL CAUSE FAILURE):
- Use ONLY double quotes for strings (never single quotes)
- ALL array elements MUST be separated by commas: ["item1", "item2", "item3"]
- NO trailing commas: [item1, item2] NOT [item1, item2,]
- ALL property names must be quoted: {"weekNumber": 1} NOT {weekNumber: 1}
- Ensure proper bracket matching: every [ must have a matching ]
- Arrays must be properly closed: ["item"] NOT ["item"
- Check that EVERY item in arrays has a comma after it (except the last one)
- Return ONLY valid JSON - no markdown, no explanatory text, just the JSON object

Extract costs from the analysis in this format:
- Look for "Estimated Cost: $XX.XX CAD"
- Look for "Price: $XX.XX/unit"
- Extract package sizes and notes

Return ONLY valid JSON (no markdown):

{
  "masterShoppingList": {
    "categories": [
      {
        "category": "Proteins",
        "items": [
          {
            "name": "Chicken Breast",
            "totalAmount": "2400g",
            "pricePerUnit": "$10.99/kg",
            "estimatedCost": 26.40,
            "packageSize": "500g-1kg packages",
            "notes": "Buy family packs for savings"
          }
        ]
      },
      {
        "category": "Grains",
        "items": []
      },
      {
        "category": "Vegetables",
        "items": []
      },
      {
        "category": "Fruits",
        "items": []
      },
      {
        "category": "Dairy & Eggs",
        "items": []
      },
      {
        "category": "Oils & Condiments",
        "items": []
      },
      {
        "category": "Nuts & Seeds",
        "items": []
      }
    ],
    "totalEstimatedCost": 0,
    "notes": ["Buy in bulk when possible", "Check for sales"]
  },
  "weeklyShoppingLists": [
    {
      "weekNumber": 1,
      "phase": "Foundation",
      "categories": [
        {
          "category": "Proteins",
          "items": [
            {
              "name": "Chicken Breast",
              "quantity": "630g",
              "estimatedCost": 6.93,
              "priority": "high"
            }
          ]
        },
        {
          "category": "Grains",
          "items": [
            {
              "name": "Quinoa",
              "quantity": "1200g",
              "estimatedCost": 23.88,
              "priority": "high"
            },
            {
              "name": "Oats",
              "quantity": "372g",
              "estimatedCost": 1.87,
              "priority": "high"
            }
          ]
        },
        {
          "category": "Vegetables",
          "items": [
            {
              "name": "Broccoli",
              "quantity": "481g",
              "estimatedCost": 2.99,
              "priority": "high"
            }
          ]
        },
        {
          "category": "Fruits",
          "items": [
            {
              "name": "Banana",
              "quantity": "638g",
              "estimatedCost": 0.88,
              "priority": "medium"
            }
          ]
        },
        {
          "category": "Dairy & Eggs",
          "items": [
            {
              "name": "Greek Yogurt",
              "quantity": "393g",
              "estimatedCost": 2.99,
              "priority": "high"
            }
          ]
        },
        {
          "category": "Oils & Condiments",
          "items": [
            {
              "name": "Olive Oil",
              "quantity": "194g",
              "estimatedCost": 2.75,
              "priority": "medium"
            }
          ]
        },
        {
          "category": "Nuts & Seeds",
          "items": [
            {
              "name": "Almonds",
              "quantity": "48g",
              "estimatedCost": 1.62,
              "priority": "medium"
            }
          ]
        }
      ],
      "weekTotal": 43.91,
      "notes": ["Buy chicken in family pack", "Look for quinoa on sale"]
    }
  ]
}

CALCULATION EXAMPLE:
If "Chicken Breast" total cost is $65.94 for 5040g used across 8 weeks (630g per week):
- Week 1 uses 630g, so cost = $65.94 × (630/5040) = $8.24

If ingredient used in 3 specific weeks (not all weeks), divide cost only by those 3 weeks.

CRITICAL:
1. Categorize ingredients logically (Proteins, Grains, Vegetables, Fruits, Dairy & Eggs, Oils & Condiments, Nuts & Seeds)
2. Extract ALL costs from the cost analysis
3. Calculate totals accurately
4. For weekly lists, only include ingredients used in that week
5. Calculate weekly costs as a fraction of total based on usage
6. Ensure all numbers are valid (no NaN or undefined)
7. NO markdown code blocks - ONLY JSON`;
  }

  /**
   * Get Zod schema for shopping list structure (for structured output)
   */
  private getShoppingListSchema(): z.ZodType<any> {
    return z.object({
      weeklyShoppingLists: z.array(z.object({
        weekNumber: z.number(),
        phase: z.string().optional(),
        categories: z.array(z.object({
          category: z.string(),
          items: z.array(z.object({
            name: z.string(),
            quantity: z.string(),
            estimatedCost: z.number(),
            priority: z.string().optional()
          }))
        })),
        weekTotal: z.number(),
        notes: z.array(z.string()).optional()
      })),
      masterShoppingList: z.object({
        categories: z.array(z.object({
          category: z.string(),
          items: z.array(z.object({
            name: z.string(),
            totalQuantity: z.string(),
            totalEstimatedCost: z.number(),
            usedInWeeks: z.array(z.number()),
            priority: z.string().optional()
          }))
        })),
        totalCost: z.number()
      }).optional()
    });
  }

  /**
   * Extract JSON from text response with enhanced error diagnostics
   */
  private extractAndParseJSON(text: string): any {
    console.log('📋 Response length:', text.length);
    
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        const parseError = error as SyntaxError;
        console.warn('⚠️ JSON parse failed, attempting fixes...');
        
        // Extract error position for better diagnostics
        const positionMatch = parseError.message.match(/position (\d+)/);
        if (positionMatch) {
          const errorPos = parseInt(positionMatch[1]);
          const start = Math.max(0, errorPos - 200);
          const end = Math.min(jsonMatch[0].length, errorPos + 200);
          console.warn(`   Error at position ${errorPos}:`);
          console.warn(`   Context: ...${jsonMatch[0].substring(start, end)}...`);
          
          // If error mentions array, try specific array fixes first
          if (parseError.message.includes('array') || parseError.message.includes(']')) {
            console.warn('   Detected array-related error, applying array-specific fixes...');
            const arrayFixed = this.fixArrayIssues(jsonMatch[0]);
            try {
              return JSON.parse(arrayFixed);
            } catch (e) {
              console.warn('   Array fixes failed, trying common fixes...');
            }
          }
        }
        
        const fixed = this.fixCommonJSONIssues(jsonMatch[0]);
        try {
          return JSON.parse(fixed);
        } catch (e) {
          console.error('Failed to parse fixed JSON:', e);
          // Try aggressive fixes as last resort
          const aggressiveFixed = this.aggressiveJSONFix(jsonMatch[0]);
          try {
            return JSON.parse(aggressiveFixed);
          } catch (e2) {
            console.error('Failed to parse after aggressive fixes:', e2);
          }
        }
      }
    }
    
    // Try code block extraction
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.error('Failed to parse code block JSON:', e);
      }
    }
    
    // Try flexible extraction with enhanced error recovery
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = text.substring(firstBrace, lastBrace + 1);
      
      // Try multiple fix strategies
      const strategies = [
        () => this.fixCommonJSONIssues(extracted),
        () => this.aggressiveJSONFix(extracted),
        () => this.fixArrayIssues(extracted)
      ];
      
      for (const fixFn of strategies) {
        try {
          const fixed = fixFn();
          return JSON.parse(fixed);
        } catch (e) {
          // Try next strategy
          continue;
        }
      }
      
      console.error('Failed to parse extracted JSON after all fix attempts');
      
      // Last resort: try to extract just the weeklyShoppingLists array
      const listsMatch = extracted.match(/"weeklyShoppingLists"\s*:\s*\[([\s\S]*)\]/);
      if (listsMatch) {
        try {
          const fixedLists = this.fixCommonJSONIssues(`{"weeklyShoppingLists":[${listsMatch[1]}]}`);
          return JSON.parse(fixedLists);
        } catch (e) {
          console.error('Failed to extract weeklyShoppingLists array:', e);
        }
      }
    }
    
    throw new Error('Could not extract JSON from response');
  }

  /**
   * Fix common JSON formatting issues with enhanced error recovery
   */
  private fixCommonJSONIssues(jsonString: string): string {
    let fixed = jsonString;
    
    // Step 1: Fix trailing commas (must be first)
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Step 2: Fix missing commas in arrays (find patterns like: ]\s*" or ]\s*{ or ]\s*\[ or ]\s*\d)
    // This handles: ["item1" "item2"] or [1 2 3] -> ["item1", "item2"] or [1, 2, 3]
    fixed = fixed.replace(/(["\d\]}])\s+(["\d\[\{])/g, '$1, $2');
    
    // Step 3: Fix missing commas after array elements before closing bracket
    // Pattern: ..."item" ] or ...123 ] -> ..."item", ] or ...123, ]
    fixed = fixed.replace(/(["\d\]\}])\s*\]/g, (match, p1) => {
      // Only add comma if p1 is not already a closing bracket/brace
      if (p1 !== ']' && p1 !== '}') {
        return p1 + ']';
      }
      return match;
    });
    // More aggressive: fix patterns where comma is missing before ]
    fixed = fixed.replace(/([^,\s])\s*\]/g, (match, p1) => {
      // If p1 is a quote, number, or closing brace, add comma
      if (p1 === '"' || p1.match(/[\d\]\}]/)) {
        return p1 + ',]';
      }
      return match;
    });
    
    // Step 4: Fix single quotes to double quotes (be careful with contractions)
    fixed = fixed.replace(/'([^']*)'(?=\s*[,:}\]])/g, '"$1"');
    
    // Step 5: Fix unquoted property names
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
    
    // Step 6: Remove duplicate commas
    fixed = fixed.replace(/,{2,}/g, ',');
    
    // Step 7: Fix commas before closing brackets/braces (shouldn't exist after step 1, but double-check)
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Step 8: Fix unclosed strings (add closing quote if missing)
    // This is a simple heuristic - count quotes and fix obvious issues
    let quoteCount = 0;
    let inString = false;
    let escapeNext = false;
    const chars = fixed.split('');
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        quoteCount++;
      }
    }
    
    // If we have an odd number of quotes and end without closing, try to fix
    if (inString && quoteCount % 2 !== 0) {
      // Try to add closing quote before next structural character
      const lastQuoteIndex = fixed.lastIndexOf('"');
      if (lastQuoteIndex !== -1) {
        const afterLastQuote = fixed.substring(lastQuoteIndex + 1);
        const nextStructural = afterLastQuote.search(/[,:\[\]{}]/);
        if (nextStructural !== -1 && nextStructural > 0) {
          // Insert quote before structural character
          const insertPos = lastQuoteIndex + 1 + nextStructural;
          fixed = fixed.substring(0, insertPos) + '"' + fixed.substring(insertPos);
        }
      }
    }
    
    return fixed;
  }

  /**
   * Aggressive JSON fixing for stubborn parsing errors
   */
  private aggressiveJSONFix(jsonString: string): string {
    let fixed = this.fixCommonJSONIssues(jsonString);
    
    // Remove any leading/trailing whitespace or non-JSON characters
    fixed = fixed.trim();
    
    // Handle common text before JSON (remove "Here is the JSON:" type stuff)
    fixed = fixed.replace(/^[^{]*/, '');
    
    // Handle common text after JSON
    fixed = fixed.replace(/[^}]*$/, '');
    
    // Fix newlines that might be breaking strings
    fixed = fixed.replace(/\n(?=\s*")/g, ' ');
    
    // Fix single line breaks inside strings
    fixed = fixed.replace(/: "([^"]*)\n([^"]*)"/g, ': "$1 $2"');
    
    // Remove any BOM characters
    fixed = fixed.replace(/^\uFEFF/, '');
    
    // Handle escaped quotes properly
    fixed = fixed.replace(/\\"/g, '\\"');
    
    // Handle infinity and NaN (replace with null or 0)
    fixed = fixed.replace(/:\s*Infinity/g, ': null');
    fixed = fixed.replace(/:\s*NaN/g, ': 0');
    
    return fixed;
  }

  /**
   * Fix array-specific issues (missing commas, malformed arrays)
   */
  private fixArrayIssues(jsonString: string): string {
    let fixed = jsonString;
    
    // Fix pattern: item1 item2 ] -> item1, item2 ]
    // Match content between [ and ] that's missing commas
    fixed = fixed.replace(/\[\s*([^\]]+)\s*\]/g, (match, content) => {
      // If content has spaces but no commas (and isn't a single item), add commas
      if (content.includes(' ') && !content.includes(',')) {
        // Split by spaces but preserve quoted strings
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (char === '"' && (i === 0 || content[i-1] !== '\\')) {
            inQuotes = !inQuotes;
            current += char;
          } else if (char === ' ' && !inQuotes && current.trim()) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current.trim()) {
          parts.push(current.trim());
        }
        
        if (parts.length > 1) {
          return '[' + parts.join(', ') + ']';
        }
      }
      return match;
    });
    
    // Fix missing commas in arrays - handle common patterns
    // Enhanced state machine to properly track array context and fix missing commas
    
    // First, fix obvious missing commas between array elements
    // Pattern: "value1" "value2" -> "value1", "value2"
    // This must be done carefully to only match inside arrays
    let fixedCopy = fixed;
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    
    // Build a character-by-character fix that tracks context
    let output = '';
    for (let i = 0; i < fixedCopy.length; i++) {
      const char = fixedCopy[i];
      
      if (escapeNext) {
        escapeNext = false;
        output += char;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        output += char;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        output += char;
        continue;
      }
      
      if (inString) {
        output += char;
        continue;
      }
      
      if (char === '[') {
        depth++;
        output += char;
        continue;
      }
      
      if (char === ']') {
        depth--;
        output += char;
        continue;
      }
      
      // If we're inside an array and see whitespace, check if we need to add a comma
      if (depth > 0 && /\s/.test(char)) {
        // Look ahead and behind to see if we're between two values
        const beforeMatch = fixedCopy.substring(Math.max(0, i - 50), i).match(/(["\d}\]\]])\s*$/);
        const afterMatch = fixedCopy.substring(i + 1, Math.min(fixedCopy.length, i + 51)).match(/^\s*(["\d\[\{])/);
        
        if (beforeMatch && afterMatch) {
          const beforeChar = beforeMatch[1];
          const afterChar = afterMatch[1];
          // Check if we have two values that need a comma
          if ((beforeChar === '"' || /\d/.test(beforeChar) || beforeChar === '}' || beforeChar === ']') &&
              (afterChar === '"' || /\d/.test(afterChar) || afterChar === '[' || afterChar === '{')) {
            // Check if there's already a comma nearby
            const recentText = fixedCopy.substring(Math.max(0, i - 10), i);
            if (!recentText.endsWith(',')) {
              output += ',';
              continue;
            }
          }
        }
      }
      
      output += char;
    }
    
    fixed = output;
    
    // Additional fix: Handle missing commas before closing brackets more directly
    // Pattern: value followed by whitespace then ] -> value, ]
    fixed = fixed.replace(/([^,\s\]}])\s*(\])/g, (match, p1, p2) => {
      // Only fix if p1 looks like end of a value (quote, digit, closing brace)
      if (p1 === '"' || /\d/.test(p1) || p1 === '}') {
        return p1 + ', ' + p2;
      }
      return match;
    });
    
    // Fix trailing commas in arrays (shouldn't exist but handle if model generates them)
    fixed = fixed.replace(/,(\s*])/g, '$1');
    
    return fixed;
  }

  /**
   * Categorize an ingredient by name
   */
  private categorizeIngredient(name: string): string {
    const lowerName = name.toLowerCase();
    
    // Proteins
    if (lowerName.includes('chicken') || lowerName.includes('turkey') || 
        lowerName.includes('salmon') || lowerName.includes('cod') || 
        lowerName.includes('tuna') || lowerName.includes('beef') || 
        lowerName.includes('pork') || lowerName.includes('fish') ||
        lowerName.includes('shrimp') || lowerName.includes('ground')) {
      return 'Proteins';
    }
    
    // Grains
    if (lowerName.includes('rice') || lowerName.includes('quinoa') || 
        lowerName.includes('oats') || lowerName.includes('pasta') || 
        lowerName.includes('bread') || lowerName.includes('noodle') ||
        lowerName.includes('flour') || lowerName.includes('cereal')) {
      return 'Grains';
    }
    
    // Vegetables
    if (lowerName.includes('broccoli') || lowerName.includes('spinach') || 
        lowerName.includes('kale') || lowerName.includes('lettuce') || 
        lowerName.includes('tomato') || lowerName.includes('pepper') || 
        lowerName.includes('onion') || lowerName.includes('garlic') || 
        lowerName.includes('carrot') || lowerName.includes('potato') ||
        lowerName.includes('asparagus') || lowerName.includes('cucumber') ||
        lowerName.includes('zucchini') || lowerName.includes('mushroom')) {
      return 'Vegetables';
    }
    
    // Fruits
    if (lowerName.includes('apple') || lowerName.includes('banana') || 
        lowerName.includes('orange') || lowerName.includes('berry') || 
        lowerName.includes('berries') || lowerName.includes('strawberry') ||
        lowerName.includes('blueberry') || lowerName.includes('avocado') ||
        lowerName.includes('lemon') || lowerName.includes('lime') ||
        lowerName.includes('grape') || lowerName.includes('melon')) {
      return 'Fruits';
    }
    
    // Dairy & Eggs
    if (lowerName.includes('milk') || lowerName.includes('cheese') || 
        lowerName.includes('yogurt') || lowerName.includes('egg') || 
        lowerName.includes('butter') || lowerName.includes('cream') ||
        lowerName.includes('whey') || lowerName.includes('feta') ||
        lowerName.includes('cheddar') || lowerName.includes('mozzarella')) {
      return 'Dairy & Eggs';
    }
    
    // Nuts & Seeds
    if (lowerName.includes('almond') || lowerName.includes('walnut') || 
        lowerName.includes('cashew') || lowerName.includes('peanut') || 
        lowerName.includes('seed') || lowerName.includes('nut') ||
        lowerName.includes('chia') || lowerName.includes('flax') ||
        lowerName.includes('sunflower') || lowerName.includes('pumpkin')) {
      return 'Nuts & Seeds';
    }
    
    // Oils & Condiments (default for remaining items)
    return 'Oils & Condiments';
  }

  /**
   * Get empty shopping list structure
   */
  private getEmptyShoppingList(): any {
    return {
      masterShoppingList: {
        categories: [],
        totalEstimatedCost: 0,
        notes: ['No meal templates available for shopping list generation']
      },
      weeklyShoppingLists: []
    };
  }

  /**
   * System prompt for GPT-OSS cost reasoning
   */
  private getCostReasoningSystemPrompt(): string {
    return `You are a Canadian grocery pricing expert. Estimate realistic costs for ingredients based on current 2024-2025 Canadian market prices. Use data from major chains like Loblaws, Metro, Sobeys, and Real Canadian Superstore. Provide detailed cost breakdowns with package sizes and shopping tips.`;
  }

  /**
   * System prompt for Llama 4 Scout formatting
   */
  private getFormattingSystemPrompt(): string {
    return `You are a data extraction assistant. Extract ingredient costs from structured text and format as JSON.

CRITICAL RULES:
1. Output ONLY valid JSON - no text before or after
2. NO markdown code blocks (no \`\`\`json)
3. Extract ALL costs exactly as stated
4. Categorize ingredients logically
5. Calculate totals accurately
6. Ensure all numbers are valid floats
7. No trailing commas
8. Proper bracket/brace matching`;
  }
}
