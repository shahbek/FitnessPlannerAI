import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Get user account with token balance
export const getUserAccount = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }
    const userId = user._id as any;

    const account = await ctx.db
      .query("userAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // If account doesn't exist, return null - the UI will handle default values
    // Account will be created automatically when first token operation happens
    return account;
  },
});

// Create or initialize user account (called when needed)
export const initializeAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    // Check if account already exists
    const existing = await ctx.db
      .query("userAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new account with default tokens
    const defaultTokens = 1000;
    return await ctx.db.insert("userAccounts", {
      userId,
      tokens: defaultTokens,
      totalTokensPurchased: defaultTokens,
      planType: "free",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get token usage history
export const getTokenUsage = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return [];
    }
    const userId = user._id as any;

    const limit = args.limit || 50;

    const usage = await ctx.db
      .query("tokenUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return usage;
  },
});

// Record token usage
export const recordTokenUsage = mutation({
  args: {
    operationType: v.string(),
    tokensUsed: v.number(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    // Get user account
    let account = await ctx.db
      .query("userAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Create account if it doesn't exist
    if (!account) {
      const defaultTokens = 1000;
      const accountId = await ctx.db.insert("userAccounts", {
        userId,
        tokens: defaultTokens,
        totalTokensPurchased: defaultTokens,
        planType: "free",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      account = await ctx.db.get(accountId);
      if (!account) {
        throw new Error("Failed to create account");
      }
    }

    // Check if user has enough tokens
    if (account.tokens < args.tokensUsed) {
      throw new Error(`Insufficient tokens. You have ${account.tokens} tokens, but need ${args.tokensUsed}.`);
    }

    // Deduct tokens
    await ctx.db.patch(account._id, {
      tokens: account.tokens - args.tokensUsed,
      updatedAt: Date.now(),
    });

    // Record usage
    await ctx.db.insert("tokenUsage", {
      userId,
      operationType: args.operationType,
      tokensUsed: args.tokensUsed,
      details: args.details,
      createdAt: Date.now(),
    });

    return {
      remainingTokens: account.tokens - args.tokensUsed,
      tokensUsed: args.tokensUsed,
    };
  },
});

// Add tokens to account (for purchases)
export const addTokens = mutation({
  args: {
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const userId = user._id as any;

    let account = await ctx.db
      .query("userAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!account) {
      const accountId = await ctx.db.insert("userAccounts", {
        userId,
        tokens: args.amount,
        totalTokensPurchased: args.amount,
        planType: "free",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      account = await ctx.db.get(accountId);
      if (!account) {
        throw new Error("Failed to create account");
      }
    } else {
      await ctx.db.patch(account._id, {
        tokens: account.tokens + args.amount,
        totalTokensPurchased: account.totalTokensPurchased + args.amount,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
