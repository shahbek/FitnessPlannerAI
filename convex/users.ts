import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Get current user (using Better Auth)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await authComponent.getAuthUser(ctx);
      console.log('[getCurrentUser] Better Auth user:', user);
      return user;
    } catch (error) {
      // User is not authenticated, return null instead of throwing
      console.log('[getCurrentUser] User not authenticated');
      return null;
    }
  },
});

// Create or update user profile
export const upsertUserProfile = mutation({
  args: {
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    primaryGoal: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    workoutDaysPerWeek: v.optional(v.number()),
    sessionDuration: v.optional(v.number()),
    equipmentAccess: v.optional(v.array(v.string())),
    dietaryRestrictions: v.optional(v.array(v.string())),
    foodPreferences: v.optional(v.array(v.string())),
    dislikedFoods: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any; // Better Auth uses "user" table, cast to match schema

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: now,
      });
      return existingProfile._id;
    } else {
      // Create new profile
      return await ctx.db.insert("userProfiles", {
        userId,
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Get user profile
export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id as any))
      .first();
  },
});

