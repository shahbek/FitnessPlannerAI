import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
// 
// Note: Better Auth tables (user, session, account, verification) are
// automatically managed by the Better Auth component and don't need
// to be defined here.
export default defineSchema({
  // User profiles
  userProfiles: defineTable({
    // Using v.string() temporarily for migration from old auth to Better Auth
    // This allows both old "users" IDs and new "user" IDs to coexist
    userId: v.string(),
    // Basic Info
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    bodyFat: v.optional(v.number()),
    targetBodyFat: v.optional(v.number()),

    // Fitness Goals - New Goal Category System
    goalCategory: v.optional(v.string()), // 'lean_bulk', 'dirty_bulk', 'mini_cut', 'aggressive_cut', 'recomp', 'maintenance', 'body_fat_goal'
    bodyFatGoal: v.optional(v.object({
      currentBf: v.number(),
      targetBf: v.number(),
    })),
    // Legacy field (deprecated, kept for backward compatibility)
    primaryGoal: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),

    // Preferences
    workoutDaysPerWeek: v.optional(v.number()),
    sessionDuration: v.optional(v.number()),
    equipmentAccess: v.optional(v.array(v.string())),

    // Dietary
    dietaryRestrictions: v.optional(v.array(v.string())),
    foodPreferences: v.optional(v.array(v.string())),
    dislikedFoods: v.optional(v.array(v.string())),

    // Created/Updated
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Workout Plans
  workoutPlans: defineTable({
    userId: v.string(), // Flexible for migration
    name: v.string(),
    description: v.optional(v.string()),

    // Store complete AI-generated plan data for UI parser
    fullPlanData: v.optional(v.any()),

    // Plan Structure (simplified for backward compatibility)
    phases: v.any(),

    // ✅ Metadata fields for better querying (extracted from fullPlanData)
    totalWeeks: v.optional(v.number()),
    startDate: v.optional(v.number()), // Manual start date override
    // New goal category system
    goalCategory: v.optional(v.string()), // 'lean_bulk', 'dirty_bulk', etc.
    // Legacy field (deprecated)
    primaryGoal: v.optional(v.string()),
    exerciseCount: v.optional(v.number()),
    mealCount: v.optional(v.number()),

    // Weekly target macros for fast access
    weeklyTargetMacros: v.optional(v.array(v.object({
      week: v.number(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    }))),

    // Metadata
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_goal_category", ["goalCategory"])
    .index("by_goal", ["primaryGoal"]) // Legacy index
    .index("by_total_weeks", ["totalWeeks"]),

  // Meal Plans
  mealPlans: defineTable({
    userId: v.string(), // Flexible for migration
    workoutPlanId: v.optional(v.id("workoutPlans")),
    name: v.string(),

    // Nutritional Goals
    dailyCalories: v.number(),
    proteinGrams: v.number(),
    carbsGrams: v.number(),
    fatsGrams: v.number(),

    // Meal Templates
    meals: v.array(v.object({
      mealNumber: v.number(),
      name: v.string(),
      timeOfDay: v.string(),
      recipes: v.array(v.object({
        name: v.string(),
        ingredients: v.array(v.object({
          name: v.string(),
          amount: v.string(),
          unit: v.string(),
        })),
        instructions: v.string(),
        macros: v.object({
          calories: v.number(),
          protein: v.number(),
          carbs: v.number(),
          fats: v.number(),
        }),
      })),
    })),

    // Metadata
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_workout_plan", ["workoutPlanId"]),

  // Shopping Lists
  shoppingLists: defineTable({
    userId: v.string(), // Flexible for migration
    mealPlanId: v.id("mealPlans"),
    weekNumber: v.number(),

    items: v.array(v.object({
      ingredient: v.string(),
      amount: v.string(),
      unit: v.string(),
      category: v.string(),
      checked: v.boolean(),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_meal_plan", ["mealPlanId"]),

  // Progress Tracking
  workoutSessions: defineTable({
    userId: v.string(), // Flexible for migration
    workoutPlanId: v.id("workoutPlans"),
    sessionDate: v.number(),

    exercises: v.array(v.object({
      exerciseName: v.string(),
      sets: v.array(v.object({
        reps: v.number(),
        weight: v.number(),
        completed: v.boolean(),
      })),
    })),

    notes: v.optional(v.string()),
    duration: v.optional(v.number()),

    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_workout_plan", ["workoutPlanId"])
    .index("by_date", ["userId", "sessionDate"]),

  // ✅ Token System - User Accounts
  userAccounts: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    tokens: v.number(), // Available tokens
    totalTokensPurchased: v.number(), // Lifetime tokens purchased
    planType: v.optional(v.string()), // e.g., "free", "basic", "premium"
    lastPurchaseDate: v.optional(v.number()), // Date of last token purchase
    lastPurchaseAmount: v.optional(v.number()), // Amount of last token purchase

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // ✅ Token Usage Tracking
  tokenUsage: defineTable({
    userId: v.string(),
    operationType: v.string(), // e.g., "plan_generation", "meal_generation", "token_purchase"
    tokensUsed: v.number(), // Positive for purchases, negative for usage
    status: v.string(), // "success", "failed", "pending"
    planId: v.optional(v.id("workoutPlans")), // Link to generated plan (if applicable)
    operationSteps: v.optional(v.array(v.string())), // Breakdown of steps for plan generation
    paymentId: v.optional(v.string()), // Stripe payment intent ID for token purchases
    details: v.optional(v.any()), // Additional info like plan ID, generation steps, etc.

    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_date", ["userId", "createdAt"])
    .index("by_status", ["status"]),
  // Custom Meals Database
  customMeals: defineTable({
    userId: v.string(),
    name: v.string(),
    mealType: v.string(), // Default type (e.g., "Lunch")
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
    }),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),


  // Daily Tracking - Comprehensive daily logging for workouts, meals, hydration, weight
  dailyTracking: defineTable({
    userId: v.string(),
    // Optional for backward compatibility with older data
    workoutPlanId: v.optional(v.id("workoutPlans")),
    // Date can be number (Unix timestamp) or string (ISO date) for backward compatibility
    // New entries should always use number (Unix timestamp at midnight UTC)
    date: v.union(v.number(), v.string()),
    // Optional for backward compatibility - new entries always include these
    weekNumber: v.optional(v.number()),
    dayNumber: v.optional(v.number()),

    // Legacy field from old schema (kept for backward compatibility)
    mealsCompleted: v.optional(v.number()),

    // Workout tracking (simple complete/skip)
    workoutStatus: v.optional(v.string()), // "completed" | "skipped" | "partial" | null
    workoutCompletedAt: v.optional(v.number()),
    workoutNotes: v.optional(v.string()),

    // Cardio tracking
    cardioStatus: v.optional(v.string()), // "completed" | "skipped" | null
    cardioCompletedAt: v.optional(v.number()),
    cardioDurationActual: v.optional(v.number()), // Actual duration in minutes
    cardioNotes: v.optional(v.string()),

    // Meals - array of logged meals (plan meals + custom)
    meals: v.optional(v.array(v.object({
      mealId: v.string(),
      mealName: v.string(),
      mealType: v.string(), // "Breakfast", "Lunch", "Dinner", "Snack", "Custom"
      isFromPlan: v.boolean(),
      isConsumed: v.boolean(),
      consumedAt: v.optional(v.number()),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
      // For custom foods from USDA search
      usdaFdcId: v.optional(v.string()),
      servingSize: v.optional(v.string()),
    }))),

    // Hydration
    waterIntakeMl: v.optional(v.number()), // Total water intake in ml
    waterTarget: v.optional(v.number()), // Daily water target in ml
    waterLogs: v.optional(v.array(v.object({
      amount: v.number(), // ml
      timestamp: v.number(),
    }))),

    // Weight
    bodyWeight: v.optional(v.number()), // kg
    previousWeight: v.optional(v.number()), // For trend display

    // Target macros for the day (from plan)
    targetMacros: v.optional(v.object({
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    })),

    // Temporarily optional for backward compatibility - will be required after cleanup
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_plan", ["workoutPlanId"])
    .index("by_date", ["userId", "date"])
    .index("by_plan_date", ["workoutPlanId", "date"])
    .index("by_user_plan_date", ["userId", "workoutPlanId", "date"]),

  // Central Ingredients Database (Cached USDA Data)
  ingredients: defineTable({
    fdcId: v.number(),
    name: v.string(), // Normalized name for searching
    description: v.string(), // Original description
    dataType: v.optional(v.string()),

    // Structured nutrition data
    nutrients: v.array(v.object({
      nutrientId: v.number(),
      nutrientName: v.string(),
      unitName: v.string(),
      value: v.number(),
    })),

    // Additional metadata
    brandOwner: v.optional(v.string()),
    ingredients: v.optional(v.string()), // Ingredient list text
    foodCategory: v.optional(v.string()),

    source: v.string(), // 'usda' | 'user' | 'system'
    cnt: v.optional(v.number()), // Usage count for popularity

    cachedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_fdc_id", ["fdcId"])
    .index("by_name", ["name"]) // Generic index
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["source", "foodCategory"]
    }),
});
