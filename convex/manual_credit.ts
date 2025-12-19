
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Run this manually via: 
// npx convex run manual_credit:creditUser --args '{"email": "daws@gmail.com", "tokens": 700, "note": "Manual fix for transaction sh05@gmail.com"}'

export const creditUser = mutation({
    args: {
        email: v.string(),
        tokens: v.number(),
        note: v.string(),
    },
    handler: async (ctx, args) => {
        // 1. Find user by email
        const account = await ctx.db
            .query("userAccounts")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();

        if (!account) {
            console.error(`User with email ${args.email} not found!`);
            return;
        }

        console.log(`Found user ${account.userId} (${account.email}). Current tokens: ${account.tokens}`);

        // 2. Add tokens
        await ctx.db.patch(account._id, {
            tokens: account.tokens + args.tokens,
            totalTokensPurchased: account.totalTokensPurchased + args.tokens,
            updatedAt: Date.now(),
        });

        // 3. Record in history
        await ctx.db.insert("tokenUsage", {
            userId: account.userId,
            operationType: "manual_credit",
            tokensUsed: args.tokens,
            status: "success",
            details: {
                note: args.note,
                adminAction: true
            },
            createdAt: Date.now(),
        });

        console.log(`Successfully added ${args.tokens} tokens to ${args.email}. New balance: ${account.tokens + args.tokens}`);
    },
});
