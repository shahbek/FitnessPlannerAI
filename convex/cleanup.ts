import { mutation } from "./_generated/server";

/**
 * One-time cleanup function to delete old dailyTracking documents
 * that don't match the new schema structure.
 * Run this once via: npx convex run cleanup:deleteOldDailyTracking
 */
export const deleteOldDailyTracking = mutation({
  handler: async (ctx) => {
    const allDocs = await ctx.db.query("dailyTracking").collect();
    
    let deleted = 0;
    const deletedIds: string[] = [];
    
    for (const doc of allDocs) {
      // Delete documents that are missing required fields or have old structure
      if (
        !doc.dayNumber && 
        !doc.weekNumber && 
        !doc.workoutPlanId &&
        (doc.date === "2025-11-18" || typeof doc.date === "string")
      ) {
        await ctx.db.delete(doc._id);
        deleted++;
        deletedIds.push(doc._id);
        console.log(`Deleted old document: ${doc._id}`);
      }
    }
    
    return { 
      deleted, 
      total: allDocs.length,
      deletedIds 
    };
  },
});

