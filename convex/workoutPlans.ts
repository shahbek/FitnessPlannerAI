import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Create a workout plan
export const createWorkoutPlan = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    phases: v.any(), // Complex nested structure
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
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false, updatedAt: now });
    }

    // Create new plan
    return await ctx.db.insert("workoutPlans", {
      userId,
      name: args.name,
      description: args.description,
      phases: args.phases,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get active workout plan
export const getActiveWorkoutPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", user._id as any).eq("isActive", true))
      .first();
  },
});

// Get all workout plans for user
export const getUserWorkoutPlans = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id as any))
      .order("desc")
      .collect();
  },
});

// Update workout plan
export const updateWorkoutPlan = mutation({
  args: {
    planId: v.id("workoutPlans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    phases: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id as any) {
      throw new Error("Workout plan not found or unauthorized");
    }

    const { planId, ...updates } = args;
    await ctx.db.patch(planId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return planId;
  },
});

// Delete workout plan
export const deleteWorkoutPlan = mutation({
  args: {
    planId: v.id("workoutPlans"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id as any) {
      throw new Error("Workout plan not found or unauthorized");
    }

    await ctx.db.delete(args.planId);
    return args.planId;
  },
});
