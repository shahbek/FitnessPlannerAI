// Traceability Validator
// Ensures every grocery list item traces to at least one meal ingredient
// And every meal ingredient appears in grocery list (or flagged as pantry staple)

import {
  ConsistentPlan,
  ConsistentIngredient,
  ShoppingListItemWithTraceability,
  UntraceableItem
} from '@/models/ConsistentPlanModels';
import { normalizeIngredientName } from '@/models/ConsistentPlanModels';

export interface TraceabilityResult {
  isValid: boolean;
  score: number;  // 0-100%
  traceableItems: number;
  totalItems: number;
  untraceableItems: UntraceableItem[];
}

export class TraceabilityValidator {
  /**
   * Validate ingredient traceability across the plan
   */
  validate(plan: ConsistentPlan): TraceabilityResult {
    const untraceableItems: UntraceableItem[] = [];
    
    // Build maps for efficient lookup
    const ingredientMap = new Map<string, ConsistentIngredient[]>();
    const groceryItemMap = new Map<string, ShoppingListItemWithTraceability[]>();

    // Collect all ingredients across the plan
    for (const week of plan.weeks) {
      if (!week.shoppingList) continue;

      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const ingredient of meal.ingredients) {
            const normalized = normalizeIngredientName(ingredient.name);
            if (!ingredientMap.has(normalized)) {
              ingredientMap.set(normalized, []);
            }
            ingredientMap.get(normalized)!.push(ingredient);
          }
        }
      }

      // Collect grocery list items
      for (const category of week.shoppingList.categories) {
        for (const item of category.items) {
          const normalized = normalizeIngredientName(item.name);
          if (!groceryItemMap.has(normalized)) {
            groceryItemMap.set(normalized, []);
          }
          groceryItemMap.get(normalized)!.push(item);
        }
      }
    }

    // Validate grocery list items trace to ingredients
    let traceableGroceryItems = 0;
    let totalGroceryItems = 0;

    for (const week of plan.weeks) {
      if (!week.shoppingList) continue;

      for (const category of week.shoppingList.categories) {
        for (const item of category.items) {
          totalGroceryItems++;
          const normalized = normalizeIngredientName(item.name);
          
          // Check if item traces to ingredients
          const hasTraceability = item.traceability?.sourceIngredientIds?.length > 0;
          const hasMatchingIngredient = ingredientMap.has(normalized);
          
          if (hasTraceability || hasMatchingIngredient) {
            traceableGroceryItems++;
            
            // Verify traceability links are valid
            if (hasTraceability && item.traceability.sourceIngredientIds.length > 0) {
              // Validate that referenced ingredient IDs exist
              const allIngredientIds = new Set<string>();
              for (const ingredients of ingredientMap.values()) {
                for (const ing of ingredients) {
                  allIngredientIds.add(ing.ingredientId);
                }
              }
              
              const invalidIds = item.traceability.sourceIngredientIds.filter(
                id => !allIngredientIds.has(id)
              );
              
              if (invalidIds.length > 0) {
                untraceableItems.push({
                  type: 'grocery_item',
                  name: item.name,
                  location: `Week ${week.weekNumber} - ${category.category}`,
                  reason: `Contains invalid ingredient IDs: ${invalidIds.join(', ')}`
                });
                traceableGroceryItems--;  // Not actually traceable if IDs are invalid
              }
            }
          } else {
            untraceableItems.push({
              type: 'grocery_item',
              name: item.name,
              location: `Week ${week.weekNumber} - ${category.category}`,
              reason: 'No matching ingredient found in meals and no traceability links'
            });
          }
        }
      }
    }

    // Validate ingredients appear in grocery lists (or are flagged as pantry staples)
    // This is a softer check - ingredients might be pantry staples not on shopping list
    // We'll note them but not fail validation
    for (const [normalizedName, ingredients] of ingredientMap.entries()) {
      const foundInGroceryList = groceryItemMap.has(normalizedName);
      
      if (!foundInGroceryList) {
        // Check if ingredient is used in multiple weeks (likely pantry staple)
        const usedInWeeks = new Set<number>();
        for (const ing of ingredients) {
          // Extract week number from meal structure (would need to traverse back)
          // For now, we'll just note that ingredient isn't in grocery list
        }
        
        // Only flag as issue if ingredient appears only once (unlikely to be pantry staple)
        if (ingredients.length === 1) {
          untraceableItems.push({
            type: 'ingredient',
            name: ingredients[0].name,
            location: `Ingredient ${ingredients[0].ingredientId}`,
            reason: 'Ingredient not found in any grocery list (may be pantry staple)'
          });
        }
      }
    }

    // Calculate score
    const score = totalGroceryItems > 0
      ? (traceableGroceryItems / totalGroceryItems) * 100
      : 100;  // No items = perfect score (nothing to validate)

    return {
      isValid: untraceableItems.length === 0,
      score: Math.round(score * 100) / 100,
      traceableItems: traceableGroceryItems,
      totalItems: totalGroceryItems,
      untraceableItems
    };
  }

  /**
   * Build traceability matrix: ingredientId → [groceryListItemId]
   */
  buildTraceabilityMatrix(plan: ConsistentPlan): Map<string, string[]> {
    const matrix = new Map<string, string[]>();

    for (const week of plan.weeks) {
      if (!week.shoppingList) continue;

      for (const category of week.shoppingList.categories) {
        for (const item of category.items) {
          if (item.traceability?.sourceIngredientIds) {
            for (const ingredientId of item.traceability.sourceIngredientIds) {
              if (!matrix.has(ingredientId)) {
                matrix.set(ingredientId, []);
              }
              // We'd need grocery item ID - for now, use name + week as identifier
              const itemId = `week_${week.weekNumber}_${normalizeIngredientName(item.name)}`;
              matrix.get(ingredientId)!.push(itemId);
            }
          }
        }
      }
    }

    return matrix;
  }

  /**
   * Get summary of traceability issues
   */
  getTraceabilitySummary(result: TraceabilityResult): string {
    if (result.untraceableItems.length === 0) {
      return '✅ All grocery list items are traceable to meal ingredients.';
    }

    const groceryIssues = result.untraceableItems.filter(i => i.type === 'grocery_item');
    const ingredientIssues = result.untraceableItems.filter(i => i.type === 'ingredient');

    const summary: string[] = [];
    
    if (groceryIssues.length > 0) {
      summary.push(`❌ ${groceryIssues.length} grocery items cannot be traced to ingredients:`);
      groceryIssues.slice(0, 5).forEach(item => {
        summary.push(`   - ${item.name} (${item.location}): ${item.reason}`);
      });
      if (groceryIssues.length > 5) {
        summary.push(`   ... and ${groceryIssues.length - 5} more`);
      }
    }

    if (ingredientIssues.length > 0) {
      summary.push(`⚠️ ${ingredientIssues.length} ingredients not found in grocery lists (may be pantry staples):`);
      ingredientIssues.slice(0, 5).forEach(item => {
        summary.push(`   - ${item.name}`);
      });
      if (ingredientIssues.length > 5) {
        summary.push(`   ... and ${ingredientIssues.length - 5} more`);
      }
    }

    return summary.join('\n');
  }
}

