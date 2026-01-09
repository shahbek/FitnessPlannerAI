// Force rebuild
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Types matching USDANutritionService expectations
export const NutrientValdator = v.object({
    nutrientId: v.number(),
    nutrientName: v.string(),
    unitName: v.string(),
    value: v.number(),
});

export const FoodItemValidator = v.object({
    fdcId: v.number(),
    name: v.string(),
    description: v.string(),
    dataType: v.optional(v.string()),
    nutrients: v.array(NutrientValdator),
    brandOwner: v.optional(v.string()),
    ingredients: v.optional(v.string()),
    foodCategory: v.optional(v.string()),
    source: v.string(),
    cachedAt: v.number(),
});

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

/**
 * Internal Mutation: Save ingredients to the database
 */
export const saveIngredients = internalMutation({
    args: {
        ingredients: v.array(v.object({
            fdcId: v.number(),
            name: v.string(),
            description: v.string(),
            dataType: v.optional(v.string()),
            nutrients: v.array(NutrientValdator),
            brandOwner: v.optional(v.string()),
            ingredients: v.optional(v.string()),
            foodCategory: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        for (const item of args.ingredients) {
            const existing = await ctx.db
                .query("ingredients")
                .withIndex("by_fdc_id", (q) => q.eq("fdcId", item.fdcId))
                .first();

            if (existing) {
                // Upsert: nutrition data quality evolves (e.g., per-serving -> per-100g normalization), so refresh.
                await ctx.db.patch(existing._id, {
                    ...item,
                    source: 'usda',
                    updatedAt: now,
                });
                continue;
            }

            await ctx.db.insert("ingredients", {
                ...item,
                source: 'usda',
                cachedAt: now,
                updatedAt: now,
            });
        }
    },
});

/**
 * Internal Query: Search ingredients in the database
 */
export const searchIngredientsLocal = internalQuery({
    args: {
        query: v.string(),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        // Simple search implementation
        // Ideally use Convex search capabilities
        return await ctx.db
            .query("ingredients")
            .withSearchIndex("search_name", (q) => q.search("name", args.query))
            .take(args.limit);
    },
});

/**
 * Internal Query: Get ingredient by FDC ID
 */
export const getIngredientLocal = internalQuery({
    args: {
        fdcId: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("ingredients")
            .withIndex("by_fdc_id", (q) => q.eq("fdcId", args.fdcId))
            .first();
    },
});

/**
 * Action: Search for foods (Hybrid: Local -> USDA)
 */
export const searchFoods = action({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
        dataType: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const limit = args.limit || 20;
        const query = args.query.toLowerCase().trim();

        // 1. Search Local
        const localResults = await ctx.runQuery(internal.food.searchIngredientsLocal, {
            query,
            limit,
        });

        // If we have "enough" good matches, return them
        // "Enough" is subjective. For now, if we have < 5 results, we fetch more.
        if (localResults.length >= 5) {
            return localResults.map(mapToFoodItem);
        }

        // 2. Fetch from USDA
        // Use env variable
        const apiKey = process.env.USDA_API_KEY;
        if (!apiKey) {
            console.warn("USDA_API_KEY not set in Convex environment");
            return localResults.map(mapToFoodItem);
        }

        try {
            const searchUrl = `${USDA_API_BASE}/foods/search?api_key=${apiKey}`;
            const searchBody = {
                query: args.query,
                dataType: args.dataType || ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
                pageSize: 25,
            };

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchBody),
            });

            if (!response.ok) {
                console.error(`USDA Search failed: ${response.status}`);
                return localResults.map(mapToFoodItem);
            }

            const data = await response.json();
            const usdaFoods = data.foods || [];

            // Process and save new foods
            const foodsToSave: any[] = [];
            const processedFoods: any[] = [];

            for (const food of usdaFoods) {
                const normalized = normalizeUSDAFood(food);
                // Add to result list
                processedFoods.push(normalized);

                // Add to save list (deduplication happens in mutation)
                // Only save if it has nutrients
                if (normalized.nutrients.length > 0) {
                    foodsToSave.push(normalized);
                }
            }

            // 3. Async Save to DB (Fire and forget from client perspective, but await here to ensure data consistency if needed)
            if (foodsToSave.length > 0) {
                await ctx.runMutation(internal.food.saveIngredients, {
                    ingredients: foodsToSave
                });
            }

            // Merge and return
            // We prioritize local results? Or USDA?
            // USDA results are fresher for the exact query.
            // Let's return USDA results as they match the query well.
            // However, we should deduplicate if we mix.

            return processedFoods;

        } catch (e) {
            console.error("Error fetching from USDA:", e);
            return localResults.map(mapToFoodItem);
        }
    },
});

/**
 * Action: Get Food Details (Hybrid: Local -> USDA)
 */
export const getFoodDetails = action({
    args: {
        fdcId: v.number(),
    },
    handler: async (ctx, args) => {
        // 1. Check Local
        const local = await ctx.runQuery(internal.food.getIngredientLocal, {
            fdcId: args.fdcId,
        });

        const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
        const getValue = (nutrients: any[], id: number): number => {
            const n = (nutrients || []).find((x: any) => Number(x?.nutrientId) === id);
            const v = n?.value ?? n?.amount ?? 0;
            return typeof v === 'number' ? v : Number(v || 0);
        };
        const isLocalPlausible = (doc: any): boolean => {
            const desc = String(doc?.description || doc?.name || '').toLowerCase();
            const nutrients = doc?.nutrients || [];
            const calories = getValue(nutrients, 1008);
            const fat = getValue(nutrients, 1004);

            // Pure oils should never be ~<500 kcal/100g (per-100g normalization).
            if (desc.includes('oil') && !desc.includes('spray') && calories > 0 && calories < 500) return false;
            // "Milk" should not be extremely calorie-dense like nuts/seeds.
            if (desc.includes('milk') && !desc.includes('powder') && calories > 250) return false;
            // If fat is tiny but calories are high, data is likely per-serving or corrupted.
            if (calories > 400 && fat < 10) return false;
            return true;
        };

        if (local) {
            const updatedAt = Number(local.updatedAt ?? local.cachedAt ?? 0);
            const ageOk = updatedAt > 0 ? (Date.now() - updatedAt) < CACHE_TTL_MS : false;
            if (ageOk && isLocalPlausible(local)) {
                return mapToFoodItem(local);
            }
        }

        // 2. Fetch USDA
        const apiKey = process.env.USDA_API_KEY;
        if (!apiKey) {
            throw new Error("USDA_API_KEY not set");
        }

        try {
            const url = `${USDA_API_BASE}/food/${args.fdcId}?api_key=${apiKey}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`USDA API error: ${response.status}`);
            }

            const food = await response.json();
            const normalized = normalizeUSDAFood(food);

            // 3. Save to DB
            if (normalized.nutrients.length > 0) {
                await ctx.runMutation(internal.food.saveIngredients, {
                    ingredients: [normalized]
                });
            }

            return normalized;
        } catch (e) {
            console.error(`Error fetching details for ${args.fdcId}:`, e);
            throw e;
        }
    },
});


// --- Helpers ---

function mapToFoodItem(doc: any) {
    // Convert DB doc to clean object if needed, or return as is
    return {
        fdcId: doc.fdcId,
        description: doc.description || doc.name, // Handle naming
        dataType: doc.dataType || 'Unknown',
        nutrients: doc.nutrients,
        brandOwner: doc.brandOwner,
        ingredients: doc.ingredients,
        foodCategory: doc.foodCategory,
    };
}

function normalizeUSDAFood(food: any) {
    // Normalize nutrients
    // USDA API returns nutrients in different formats:
    // 1. Flat format: { nutrientId: 1008, nutrientName: "Energy", value: 165, unitName: "kcal" }
    // 2. Nested format: { nutrient: { id: 1008, name: "Energy", unitName: "kcal" }, amount: 165 }

    let rawNutrients = food.nutrients || food.foodNutrients || [];

    let normalizedNutrients = rawNutrients.map((nut: any) => {
        // Check if it's already in normalized format
        if (nut.nutrientId !== undefined) {
            return {
                nutrientId: nut.nutrientId,
                nutrientName: nut.nutrientName,
                unitName: nut.unitName,
                value: nut.value
            };
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
    }).filter((nut: any) => nut.nutrientId > 0);

    // Branded foods often report nutrients per serving. Convert to per-100g when serving size is in grams/ml.
    const dataType = String(food.dataType || '').toLowerCase();
    const isBranded = dataType.includes('branded');
    const servingSizeRaw = food.servingSize ?? food?.foodPortions?.[0]?.gramWeight ?? 0;
    const servingSize = typeof servingSizeRaw === 'number' ? servingSizeRaw : Number(servingSizeRaw || 0);
    const servingUnit = String(food.servingSizeUnit || 'g').toLowerCase();

    const gramsPerServing =
        servingSize > 0 && (servingUnit === 'g' || servingUnit === 'gram' || servingUnit === 'grams')
            ? servingSize
            : servingSize > 0 && (servingUnit === 'ml' || servingUnit === 'milliliter' || servingUnit === 'milliliters')
                ? servingSize // Approximate 1g/ml; good enough for nutrition scaling in practice.
                : 0;

    if (isBranded && gramsPerServing > 0) {
        const factor = 100 / gramsPerServing;
        normalizedNutrients = normalizedNutrients.map((n: any) => ({
            ...n,
            value: (typeof n.value === 'number' ? n.value : Number(n.value || 0)) * factor,
        }));
    }

    // Fix for foodCategory validation error
    // Sometimes USDA API returns an object { id, code, description } instead of a string
    let category = food.foodCategory;
    if (typeof category === 'object' && category !== null && category.description) {
        category = category.description;
    } else if (typeof category === 'object') {
        category = JSON.stringify(category);
    }

    return {
        fdcId: food.fdcId,
        name: (food.description || food.lowercaseDescription || '').toLowerCase(),
        description: food.description || food.lowercaseDescription || '',
        dataType: food.dataType || 'Unknown',
        nutrients: normalizedNutrients,
        brandOwner: food.brandOwner,
        ingredients: food.ingredients,
        foodCategory: category,
    };
}
