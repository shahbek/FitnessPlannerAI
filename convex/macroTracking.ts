import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

export const getMacroTrackingByPlan = query({
    args: {
        workoutPlanId: v.id("workoutPlans"),
    },
    handler: async (ctx, args) => {
        const user = await authComponent.getAuthUser(ctx);
        if (!user) {
            return [];
        }
        const userId = user._id;

        // Get daily tracking entries for this plan
        const tracking = await ctx.db
            .query("dailyTracking")
            .withIndex("by_user_plan_date", (q) =>
                q.eq("userId", userId as any).eq("workoutPlanId", args.workoutPlanId)
            )
            .collect();

        return tracking;
    },
});
