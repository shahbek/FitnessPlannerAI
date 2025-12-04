import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Save or update macro tracking entry
export const upsertMacroTracking = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    weekNumber: v.number(),
    dayNumber: v.number(),
    actualMacros: v.object({
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      bodyWeight: v.number(),
    }),
    targetMacros: v.object({
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    const now = Date.now();

    // Check if entry exists for this date and plan
    const existing = await ctx.db
      .query("macroTracking")
      .withIndex("by_plan", (q) => q.eq("workoutPlanId", args.workoutPlanId))
      .filter((q) => q.eq(q.field("date"), args.date))
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        weekNumber: args.weekNumber,
        dayNumber: args.dayNumber,
        actualMacros: args.actualMacros,
        targetMacros: args.targetMacros,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert("macroTracking", {
        userId,
        workoutPlanId: args.workoutPlanId,
        date: args.date,
        weekNumber: args.weekNumber,
        dayNumber: args.dayNumber,
        actualMacros: args.actualMacros,
        targetMacros: args.targetMacros,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Get macro tracking for a specific plan
export const getMacroTrackingByPlan = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    const entries = await ctx.db
      .query("macroTracking")
      .withIndex("by_plan", (q) => q.eq("workoutPlanId", args.workoutPlanId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    return entries;
  },
});

// Get macro tracking for a specific week
export const getMacroTrackingByWeek = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    const entries = await ctx.db
      .query("macroTracking")
      .withIndex("by_week", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("weekNumber", args.weekNumber)
      )
      .collect();

    return entries;
  },
});

