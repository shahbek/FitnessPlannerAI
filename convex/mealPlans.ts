import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Create a meal plan
export const createMealPlan = mutation({
  args: {
    name: v.string(),
    workoutPlanId: v.optional(v.id("workoutPlans")),
    dailyCalories: v.number(),
    proteinGrams: v.number(),
    carbsGrams: v.number(),
    fatsGrams: v.number(),
    meals: v.any(), // Complex nested structure
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    const now = Date.now();

    // Deactivate other plans
    const existingPlans = await ctx.db
      .query("mealPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false, updatedAt: now });
    }

    // Create new plan
    return await ctx.db.insert("mealPlans", {
      userId,
      name: args.name,
      workoutPlanId: args.workoutPlanId,
      dailyCalories: args.dailyCalories,
      proteinGrams: args.proteinGrams,
      carbsGrams: args.carbsGrams,
      fatsGrams: args.fatsGrams,
      meals: args.meals,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get active meal plan
export const getActiveMealPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("mealPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", user._id as any).eq("isActive", true))
      .first();
  },
});

// Get all meal plans for user
export const getUserMealPlans = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("mealPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id as any))
      .order("desc")
      .collect();
  },
});

// Update meal plan
export const updateMealPlan = mutation({
  args: {
    planId: v.id("mealPlans"),
    name: v.optional(v.string()),
    dailyCalories: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    carbsGrams: v.optional(v.number()),
    fatsGrams: v.optional(v.number()),
    meals: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id as any) {
      throw new Error("Meal plan not found or unauthorized");
    }

    const { planId, ...updates } = args;
    await ctx.db.patch(planId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return planId;
  },
});

// Delete meal plan
export const deleteMealPlan = mutation({
  args: {
    planId: v.id("mealPlans"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id as any) {
      throw new Error("Meal plan not found or unauthorized");
    }

    await ctx.db.delete(args.planId);
    return args.planId;
  },
});

