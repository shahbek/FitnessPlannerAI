import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Maximum size for plan data (5MB)
const MAX_PLAN_SIZE = 5 * 1024 * 1024;

/**
 * Validate the structure of fullPlanData before saving
 */
function validatePlanStructure(fullPlanData: any): void {
  if (!fullPlanData || typeof fullPlanData !== 'object') {
    throw new Error("fullPlanData must be an object");
  }

  // Check for essential fields (at least one should be present)
  const hasRequiredFields =
    fullPlanData.weeklyOutlines ||
    fullPlanData.phaseAwareFramework ||
    fullPlanData.strategicFramework ||
    fullPlanData.phaseExerciseLibraries ||
    fullPlanData.phaseSessionTemplates;

  if (!hasRequiredFields) {
    console.warn("⚠️ fullPlanData missing required fields, but allowing save anyway");
  }

  // Check size
  const jsonString = JSON.stringify(fullPlanData);
  if (jsonString.length > MAX_PLAN_SIZE) {
    throw new Error(`Plan data too large: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB exceeds ${(MAX_PLAN_SIZE / 1024 / 1024).toFixed(2)}MB limit`);
  }
}

/**
 * Extract metadata from fullPlanData for indexing and fast queries
 */
function extractMetadata(fullPlanData: any): {
  totalWeeks?: number;
  goalCategory?: string;
  primaryGoal?: string;
  exerciseCount?: number;
  mealCount?: number;
  weeklyTargetMacros?: Array<{
    week: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
} {
  if (!fullPlanData) {
    return {};
  }

  const metadata: ReturnType<typeof extractMetadata> = {};

  // Extract total weeks from weeklyOutlines
  if (Array.isArray(fullPlanData.weeklyOutlines) && fullPlanData.weeklyOutlines.length > 0) {
    metadata.totalWeeks = fullPlanData.weeklyOutlines.length;

    // Extract weekly target macros
    metadata.weeklyTargetMacros = fullPlanData.weeklyOutlines
      .map((week: any) => {
        if (week.dailyTargets) {
          return {
            week: week.weekNumber || 0,
            calories: week.dailyTargets.calories || 0,
            protein: week.dailyTargets.protein || 0,
            carbs: week.dailyTargets.carbs || 0,
            fat: week.dailyTargets.fat || 0,
            dailyTargets: week.dailyTargetsOverride ? week.dailyTargetsOverride.map((dt: any, index: number) => ({
              day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index] || `Day ${index + 1}`,
              calories: dt.calories || 0,
              protein: dt.protein || 0,
              carbs: dt.carbs || 0,
              fat: dt.fat || 0,
            })) : undefined,
          };
        }
        return null;
      })
      .filter((m: any) => m !== null);
  }

  // ✅ Extract goalCategory from userProfile (new goal system)
  if (fullPlanData.userProfile?.goalCategory) {
    metadata.goalCategory = fullPlanData.userProfile.goalCategory;
    console.log('[extractMetadata] Found goalCategory:', metadata.goalCategory);
  }

  // ✅ Also extract primaryGoal for legacy compatibility
  // Priority: userProfile.goalCategory > userProfile.goal > inferred from recommendations
  if (fullPlanData.userProfile?.goal) {
    metadata.primaryGoal = fullPlanData.userProfile.goal;
  } else if (fullPlanData.feasibility?.recommendations) {
    // Fall back to inferring from recommendations
    const recs = fullPlanData.feasibility.recommendations.join(' ').toLowerCase();
    if (recs.includes('fat loss') || recs.includes('weight loss')) {
      metadata.primaryGoal = 'fat_loss';
    } else if (recs.includes('muscle') || recs.includes('hypertrophy')) {
      metadata.primaryGoal = 'muscle_gain';
    } else if (recs.includes('strength')) {
      metadata.primaryGoal = 'strength';
    }
  }

  // Extract exercise count
  if (Array.isArray(fullPlanData.phaseExerciseLibraries)) {
    metadata.exerciseCount = fullPlanData.phaseExerciseLibraries
      .flat()
      .filter((ex: any) => ex && ex.exerciseId)
      .length;
  } else if (Array.isArray(fullPlanData.exerciseLibrary)) {
    metadata.exerciseCount = fullPlanData.exerciseLibrary.length;
  }

  // Extract meal count
  if (Array.isArray(fullPlanData.phaseMealTemplates)) {
    metadata.mealCount = fullPlanData.phaseMealTemplates
      .flat()
      .filter((meal: any) => meal && (meal.recipe || meal.name))
      .length;
  } else if (Array.isArray(fullPlanData.mealTemplates)) {
    metadata.mealCount = fullPlanData.mealTemplates.length;
  } else if (Array.isArray(fullPlanData.dailyMealCombinations)) {
    metadata.mealCount = fullPlanData.dailyMealCombinations
      .reduce((total: number, combo: any) => {
        return total + (Array.isArray(combo.meals) ? combo.meals.length : 0);
      }, 0);
  }

  return metadata;
}

// Create a workout plan
export const createWorkoutPlan = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    phases: v.any(), // Complex nested structure
    fullPlanData: v.optional(v.any()), // Complete AI-generated plan
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    const now = Date.now();

    console.log('[createWorkoutPlan] Saving plan for user:', userId, 'with fullPlanData:', !!args.fullPlanData);

    // ✅ Validate plan structure before saving
    if (args.fullPlanData) {
      try {
        validatePlanStructure(args.fullPlanData);
        console.log('[createWorkoutPlan] Plan structure validated successfully');
      } catch (error) {
        console.error('[createWorkoutPlan] Validation failed:', error);
        throw error;
      }
    }

    // ✅ Extract metadata from fullPlanData for indexing
    const metadata = args.fullPlanData ? extractMetadata(args.fullPlanData) : {};
    console.log('[createWorkoutPlan] Extracted metadata:', {
      totalWeeks: metadata.totalWeeks,
      goalCategory: metadata.goalCategory,
      primaryGoal: metadata.primaryGoal,
      exerciseCount: metadata.exerciseCount,
      mealCount: metadata.mealCount,
      weeklyMacrosCount: metadata.weeklyTargetMacros?.length || 0,
    });

    // Deactivate other plans
    const existingPlans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false, updatedAt: now });
    }

    // Create new plan with extracted metadata
    const planId = await ctx.db.insert("workoutPlans", {
      userId,
      name: args.name,
      description: args.description,
      phases: args.phases,
      fullPlanData: args.fullPlanData, // Store complete plan
      // ✅ Add extracted metadata for fast querying
      totalWeeks: metadata.totalWeeks,
      goalCategory: metadata.goalCategory, // New goal category system
      primaryGoal: metadata.primaryGoal,   // Legacy, for backward compatibility
      exerciseCount: metadata.exerciseCount,
      mealCount: metadata.mealCount,
      weeklyTargetMacros: metadata.weeklyTargetMacros,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log('[createWorkoutPlan] Plan saved successfully with ID:', planId);
    return planId;
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
      console.log('[getUserWorkoutPlans] No authenticated user');
      return [];
    }

    console.log('[getUserWorkoutPlans] Fetching plans for user:', user._id);

    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id as any))
      .order("desc")
      .collect();

    console.log('[getUserWorkoutPlans] Found', plans.length, 'plans');

    // Optimize payload: Only return full data for the active plan
    // For others, return summary only to prevent timeouts
    return plans.map(plan => {
      const isFullDataIncluded = plan.isActive;
      return {
        ...plan,
        fullPlanData: isFullDataIncluded ? plan.fullPlanData : undefined
      };
    });
  },
});

// Get single workout plan by ID
export const getWorkoutPlan = query({
  args: {
    planId: v.id("workoutPlans"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id as any) {
      return null;
    }

    return plan;
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

// Activate workout plan (Set start date)
export const activateWorkoutPlan = mutation({
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

    // Calculate Monday of the current week (UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysSinceMonday);
    monday.setUTCHours(0, 0, 0, 0);

    const startDate = monday.getTime();

    await ctx.db.patch(args.planId, {
      startDate,
      updatedAt: Date.now(),
    });

    console.log(`[activateWorkoutPlan] Activated plan ${plan._id} starting ${monday.toDateString()}`);
    return startDate;
  },
});
