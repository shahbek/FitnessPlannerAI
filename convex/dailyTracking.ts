import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Get or create daily tracking entry for a specific date
export const getOrCreateDailyTracking = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(), // Unix timestamp (should be midnight)
    weekNumber: v.number(),
    dayNumber: v.number(),
    // Initial data from plan
    targetMacros: v.optional(v.object({
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    })),
    waterTarget: v.optional(v.number()),
    plannedMeals: v.optional(v.array(v.object({
      mealId: v.string(),
      mealName: v.string(),
      mealType: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    // Check if entry exists
    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (existing) {
      return existing;
    }

    // Create new entry with planned meals
    const meals = args.plannedMeals?.map((meal) => ({
      ...meal,
      isFromPlan: true,
      isConsumed: false,
    })) || [];

    const newEntry = await ctx.db.insert("dailyTracking", {
      userId,
      workoutPlanId: args.workoutPlanId,
      date: args.date,
      weekNumber: args.weekNumber,
      dayNumber: args.dayNumber,
      meals,
      waterIntakeMl: 0,
      waterTarget: args.waterTarget || 3000,
      waterLogs: [],
      targetMacros: args.targetMacros,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(newEntry);
  },
});

// Get daily tracking for a specific date
export const getDailyTracking = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }
    const userId = user._id as any;

    return await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();
  },
});

// Update workout status
export const updateWorkoutStatus = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    status: v.string(), // "completed" | "skipped" | "partial"
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    await ctx.db.patch(existing._id, {
      workoutStatus: args.status,
      workoutCompletedAt: args.status === "completed" ? now : undefined,
      workoutNotes: args.notes,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Update cardio status
export const updateCardioStatus = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    status: v.string(), // "completed" | "skipped"
    durationActual: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    await ctx.db.patch(existing._id, {
      cardioStatus: args.status,
      cardioCompletedAt: args.status === "completed" ? now : undefined,
      cardioDurationActual: args.durationActual,
      cardioNotes: args.notes,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Toggle meal consumed status
export const toggleMealConsumed = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    mealId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    const meals = existing.meals || [];
    const updatedMeals = meals.map((meal) => {
      if (meal.mealId === args.mealId) {
        return {
          ...meal,
          isConsumed: !meal.isConsumed,
          consumedAt: !meal.isConsumed ? now : undefined,
        };
      }
      return meal;
    });

    await ctx.db.patch(existing._id, {
      meals: updatedMeals,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Add custom meal (from USDA search or manual entry)
export const addCustomMeal = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    meal: v.object({
      mealName: v.string(),
      mealType: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      usdaFdcId: v.optional(v.string()),
      servingSize: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    const meals = existing.meals || [];
    const newMeal = {
      mealId: `custom-${now}`,
      ...args.meal,
      isFromPlan: false,
      isConsumed: true,
      consumedAt: now,
    };

    await ctx.db.patch(existing._id, {
      meals: [...meals, newMeal],
      updatedAt: now,
    });

    return existing._id;
  },
});

// Swap planned meal with alternative
export const swapMeal = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    originalMealId: v.string(),
    newMeal: v.object({
      mealName: v.string(),
      mealType: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      usdaFdcId: v.optional(v.string()),
      servingSize: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    const meals = existing.meals || [];
    const updatedMeals = meals.map((meal) => {
      if (meal.mealId === args.originalMealId) {
        return {
          mealId: `swapped-${now}`,
          ...args.newMeal,
          isFromPlan: false,
          isConsumed: false,
        };
      }
      return meal;
    });

    await ctx.db.patch(existing._id, {
      meals: updatedMeals,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Add water log
export const addWaterLog = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    amount: v.number(), // ml
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    const waterLogs = existing.waterLogs || [];
    const newLog = { amount: args.amount, timestamp: now };
    const updatedWaterIntake = (existing.waterIntakeMl || 0) + args.amount;

    await ctx.db.patch(existing._id, {
      waterLogs: [...waterLogs, newLog],
      waterIntakeMl: updatedWaterIntake,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Update body weight
export const updateBodyWeight = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    weight: v.number(), // kg
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    // Get previous weight from the day before (for trend)
    const yesterdayTimestamp = args.date - 86400000; // 24 hours in ms
    const yesterday = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", yesterdayTimestamp)
      )
      .first();

    await ctx.db.patch(existing._id, {
      bodyWeight: args.weight,
      previousWeight: yesterday?.bodyWeight,
      updatedAt: now,
    });

    return existing._id;
  },
});

// Get tracking history for a plan (for trends/charts)
export const getTrackingHistory = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return [];
    }
    const userId = user._id as any;

    const entries = await ctx.db
      .query("dailyTracking")
      .withIndex("by_plan", (q) => q.eq("workoutPlanId", args.workoutPlanId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .take(args.limit || 30);

    return entries;
  },
});

// Get today's tracking summary (for quick stats)
export const getTodaySummary = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }
    const userId = user._id as any;

    // Get today's midnight timestamp
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const entry = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", todayTimestamp)
      )
      .first();

    if (!entry) {
      return null;
    }

    // Calculate consumed macros
    const consumedMeals = entry.meals?.filter((m) => m.isConsumed) || [];
    const consumedMacros = consumedMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      ...entry,
      consumedMacros,
      mealsConsumed: consumedMeals.length,
      totalMeals: entry.meals?.length || 0,
      waterProgress: entry.waterTarget
        ? ((entry.waterIntakeMl || 0) / entry.waterTarget) * 100
        : 0,
    };
  },
});

// Delete a meal
export const deleteMeal = mutation({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    date: v.number(),
    mealId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("dailyTracking")
      .withIndex("by_user_plan_date", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", args.workoutPlanId)
          .eq("date", args.date)
      )
      .first();

    if (!existing) {
      throw new Error("Daily tracking entry not found");
    }

    const meals = existing.meals || [];
    const updatedMeals = meals.filter(meal => meal.mealId !== args.mealId);

    await ctx.db.patch(existing._id, {
      meals: updatedMeals,
      updatedAt: now,
    });

    return existing._id;
  },
});
