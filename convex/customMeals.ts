import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createCustomMeal = mutation({
    args: {
        name: v.string(),
        mealType: v.string(),
        ingredients: v.array(v.object({
            name: v.string(),
            calories: v.number(),
            protein: v.number(),
            carbs: v.number(),
            fat: v.number(),
            servingSize: v.string(),
            fdcId: v.optional(v.string())
        })),
        totalMacros: v.object({
            calories: v.number(),
            protein: v.number(),
            carbs: v.number(),
            fat: v.number()
        })
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Unauthorized");
        }

        const mealId = await ctx.db.insert("customMeals", {
            userId,
            name: args.name,
            mealType: args.mealType,
            ingredients: args.ingredients,
            totalMacros: args.totalMacros,
            createdAt: Date.now(),
        });

        return mealId;
    },
});

export const getUserCustomMeals = query({
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        const meals = await ctx.db
            .query("customMeals")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        return meals;
    },
});
