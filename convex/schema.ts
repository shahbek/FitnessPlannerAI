import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  
  // User profiles
  userProfiles: defineTable({
    userId: v.id("users"),
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
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    
    // Plan Structure
    phases: v.array(v.object({
      phaseNumber: v.number(),
      name: v.string(),
      duration: v.number(),
      focus: v.string(),
      weeks: v.array(v.object({
        weekNumber: v.number(),
        sessions: v.array(v.object({
          sessionNumber: v.number(),
          type: v.string(),
          exercises: v.array(v.object({
            name: v.string(),
            muscleGroup: v.string(),
            sets: v.number(),
            reps: v.string(),
            rest: v.string(),
            notes: v.optional(v.string()),
          })),
        })),
      })),
    })),
    
    // Metadata
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),
  
  // Meal Plans
  mealPlans: defineTable({
    userId: v.id("users"),
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
    userId: v.id("users"),
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
    userId: v.id("users"),
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
});

