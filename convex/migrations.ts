
import { mutation } from "./_generated/server";

export const countTracking = mutation({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("dailyTracking").collect();
        console.log(`Total tracking records: ${all.length}`);
        const dates = all.map(t => new Date(t.date).toDateString());
        console.log('Tracking dates:', dates.slice(0, 10), '...');
    },
});
