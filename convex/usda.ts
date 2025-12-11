"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

export const searchFoods = action({
    args: {
        query: v.string(),
        pageSize: v.optional(v.number()),
        pageNumber: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { query, pageSize = 25, pageNumber = 1 } = args;

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
                    // sortBy: 'dataType.keyword', // Removed to default to relevance
                    // sortOrder: 'asc',
                }),
            });

            if (!response.ok) {
                throw new Error(`USDA API error: ${response.status}`);
            }

            const data = await response.json();

            // Normalize results
            const foods = (data.foods || []).map((food: any) => {
                const nutrients = food.foodNutrients || [];

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
            // Return empty results on error for graceful degradation
            return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
        }
    },
});
