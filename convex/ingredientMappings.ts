"use node";

import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function normalizeKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const getMappingsLocal = internalQuery({
  args: {
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      name: string;
      fdcId: number;
      description: string;
      dataType?: string;
      confidence?: number;
      source: string;
    }> = [];

    for (const rawName of args.names) {
      const name = normalizeKey(rawName);
      if (!name) continue;
      const doc = await ctx.db
        .query("ingredientMappings")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (doc) {
        results.push({
          name: doc.name,
          fdcId: doc.fdcId,
          description: doc.description,
          dataType: doc.dataType,
          confidence: doc.confidence,
          source: doc.source,
        });
      }
    }

    return results;
  },
});

export const upsertMappingsLocal = internalMutation({
  args: {
    mappings: v.array(
      v.object({
        name: v.string(),
        fdcId: v.number(),
        description: v.string(),
        dataType: v.optional(v.string()),
        confidence: v.optional(v.number()),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const mapping of args.mappings) {
      const name = normalizeKey(mapping.name);
      if (!name) continue;

      const existing = await ctx.db
        .query("ingredientMappings")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();

      if (!existing) {
        await ctx.db.insert("ingredientMappings", {
          name,
          fdcId: mapping.fdcId,
          description: mapping.description,
          dataType: mapping.dataType,
          confidence: mapping.confidence,
          source: mapping.source,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
          useCount: 1,
        });
        continue;
      }

      await ctx.db.patch(existing._id, {
        fdcId: mapping.fdcId,
        description: mapping.description,
        dataType: mapping.dataType,
        confidence: mapping.confidence,
        source: mapping.source,
        updatedAt: now,
        lastUsedAt: now,
        useCount: (existing.useCount || 0) + 1,
      });
    }
  },
});

export const getMappings = action({
  args: {
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Cast internal to any so this compiles even if _generated/api.d.ts isn't regenerated yet.
    return await ctx.runQuery((internal as any).ingredientMappings.getMappingsLocal, {
      names: args.names,
    });
  },
});

export const upsertMappings = action({
  args: {
    mappings: v.array(
      v.object({
        name: v.string(),
        fdcId: v.number(),
        description: v.string(),
        dataType: v.optional(v.string()),
        confidence: v.optional(v.number()),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation((internal as any).ingredientMappings.upsertMappingsLocal, {
      mappings: args.mappings,
    });
    return { ok: true, updated: args.mappings.length };
  },
});

