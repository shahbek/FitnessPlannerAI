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
    
    // Fitness Goals
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
    .index("by_goal", ["primaryGoal"])
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
});
