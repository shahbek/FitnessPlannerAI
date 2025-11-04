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

    // Create new account with 0 tokens (no free plan)
    return await ctx.db.insert("userAccounts", {
      userId,
      tokens: 0,
      totalTokensPurchased: 0,
      planType: "none",
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
    status: v.optional(v.string()), // "success", "failed", "pending"
    planId: v.optional(v.id("workoutPlans")),
    operationSteps: v.optional(v.array(v.string())),
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

    // Create account if it doesn't exist (no free tokens)
    if (!account) {
      const accountId = await ctx.db.insert("userAccounts", {
        userId,
        tokens: 0,
        totalTokensPurchased: 0,
        planType: "none",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      account = await ctx.db.get(accountId);
      if (!account) {
        throw new Error("Failed to create account");
      }
    }

    const finalStatus = args.status || "success";
    const tokensToDeduct = finalStatus === "success" ? args.tokensUsed : 0;

    // Check if user has enough tokens (only if status is success)
    if (finalStatus === "success" && account.tokens < tokensToDeduct) {
      throw new Error(`Insufficient tokens. You have ${account.tokens} tokens, but need ${tokensToDeduct}.`);
    }

    // Deduct tokens only if successful
    if (finalStatus === "success" && tokensToDeduct > 0) {
      await ctx.db.patch(account._id, {
        tokens: account.tokens - tokensToDeduct,
        updatedAt: Date.now(),
      });
    }

    // Record usage with new fields
    await ctx.db.insert("tokenUsage", {
      userId,
      operationType: args.operationType,
      tokensUsed: -Math.abs(args.tokensUsed), // Negative for usage
      status: finalStatus,
      planId: args.planId,
      operationSteps: args.operationSteps,
      details: args.details,
      createdAt: Date.now(),
    });

    return {
      remainingTokens: finalStatus === "success" ? account.tokens - tokensToDeduct : account.tokens,
      tokensUsed: tokensToDeduct,
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
        planType: "none",
        lastPurchaseDate: Date.now(),
        lastPurchaseAmount: args.amount,
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
        lastPurchaseDate: Date.now(),
        lastPurchaseAmount: args.amount,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Add tokens from payment (called by webhook)
export const addTokensFromPayment = mutation({
  args: {
    userId: v.string(),
    tokens: v.number(),
    paymentId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    let account = await ctx.db
      .query("userAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) {
      const accountId = await ctx.db.insert("userAccounts", {
        userId: args.userId,
        tokens: args.tokens,
        totalTokensPurchased: args.tokens,
        planType: "none",
        lastPurchaseDate: Date.now(),
        lastPurchaseAmount: args.amount,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      account = await ctx.db.get(accountId);
      if (!account) {
        throw new Error("Failed to create account");
      }
    } else {
      await ctx.db.patch(account._id, {
        tokens: account.tokens + args.tokens,
        totalTokensPurchased: account.totalTokensPurchased + args.tokens,
        lastPurchaseDate: Date.now(),
        lastPurchaseAmount: args.amount,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Record token purchase in usage history
export const recordTokenPurchase = mutation({
  args: {
    userId: v.string(),
    tokens: v.number(),
    paymentId: v.string(),
    packageId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tokenUsage", {
      userId: args.userId,
      operationType: "token_purchase",
      tokensUsed: args.tokens, // Positive for purchases
      status: "success",
      paymentId: args.paymentId,
      details: {
        packageId: args.packageId,
        amount: args.amount,
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
