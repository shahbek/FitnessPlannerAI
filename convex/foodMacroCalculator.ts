"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Food Macro Calculator
 * 
 * Takes a list of ingredients with portions and calculates macros
 * by looking up each ingredient in the USDA database.
 */
export const calculateMealMacros = action({
    args: {
        ingredients: v.array(v.object({
            name: v.string(),
            estimatedGrams: v.number(),
            description: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        const results = [];

        for (const ingredient of args.ingredients) {
            try {
                // Search USDA for this ingredient
                const usdaResults = await ctx.runAction(api.usda.searchFoods, {
                    query: ingredient.name,
                    pageSize: 5,
                });

                if (!usdaResults.foods || usdaResults.foods.length === 0) {
                    console.warn(`No USDA match found for: ${ingredient.name}`);
                    // Add with zero macros if no match found
                    results.push({
                        name: ingredient.name,
                        grams: ingredient.estimatedGrams,
                        description: ingredient.description,
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                        usdaMatch: "No match found",
                        matchConfidence: "none",
                    });
                    continue;
                }

                // Take the best match (first result)
                const match = usdaResults.foods[0];

                // Calculate macros for this portion
                // Formula: (macros per 100g) × (grams) / 100
                const portionMultiplier = ingredient.estimatedGrams / 100;

                const ingredientMacros = {
                    name: ingredient.name,
                    grams: ingredient.estimatedGrams,
                    description: ingredient.description,
                    calories: Math.round(match.calories * portionMultiplier),
                    protein: Math.round(match.protein * portionMultiplier * 10) / 10,
                    carbs: Math.round(match.carbs * portionMultiplier * 10) / 10,
                    fat: Math.round(match.fat * portionMultiplier * 10) / 10,
                    usdaMatch: match.description,
                    matchConfidence: "high", // Could be improved with fuzzy matching score
                    fdcId: match.fdcId,
                };

                results.push(ingredientMacros);
            } catch (error) {
                console.error(`Error processing ingredient ${ingredient.name}:`, error);
                // Add with zero macros on error
                results.push({
                    name: ingredient.name,
                    grams: ingredient.estimatedGrams,
                    description: ingredient.description,
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    usdaMatch: "Error during lookup",
                    matchConfidence: "none",
                });
            }
        }

        // Calculate totals
        const totals = results.reduce((acc, ing) => ({
            calories: acc.calories + ing.calories,
            protein: acc.protein + ing.protein,
            carbs: acc.carbs + ing.carbs,
            fat: acc.fat + ing.fat,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        // Round totals
        const roundedTotals = {
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein * 10) / 10,
            carbs: Math.round(totals.carbs * 10) / 10,
            fat: Math.round(totals.fat * 10) / 10,
        };

        return {
            ingredients: results,
            totals: roundedTotals,
        };
    },
});
