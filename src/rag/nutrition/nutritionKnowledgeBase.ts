/**
 * Nutrition Knowledge Base
 * 
 * Provides evidence-based nutrition facts and recommendations.
 */

export interface NutritionFact {
    id: string;
    content: string;
    category: 'sugar' | 'protein' | 'carbs' | 'fats' | 'hydration' | 'general' | 'specific_foods' | 'cuisine';
    source?: string;
    priority: number; // 1-10, 10 being highest
}

export const NUTRITION_KNOWLEDGE_BASE: NutritionFact[] = [
    {
        id: 'sugar-limit-daily',
        category: 'sugar',
        content: 'Daily added sugar intake should be kept to a minimum. The recommended limit for added sugars is no more than 30g daily for adults.',
        source: 'NHS / WHO Guidelines',
        priority: 10
    },
    {
        id: 'processed-sugary-foods',
        category: 'general',
        content: 'Ultra-processed foods high in added sugars and unhealthy fats should be minimized. These items provide high caloric density with low nutrient density, making them unsuitable as staples in a performance-focused nutrition plan.',
        priority: 8
    },
    {
        id: 'cooking-fat-limit',
        category: 'fats',
        content: 'Cooking fats (oils, butter, ghee) should be used in minimal but sufficient quantities (typically 5-15g per meal). They should not be used as primary calorie fillers. Use non-stick sprays or moisture-based cooking where possible.',
        priority: 9
    },
    {
        id: 'snack-calorie-limit',
        category: 'specific_foods',
        content: 'Snacks should be kept to a maximum of 350 calories to avoid excessive energy intake between main meals.',
        priority: 10
    },
    {
        id: 'water-zero-calories',
        category: 'hydration',
        content: 'Water has zero calories and is the primary source of hydration. It should never be assigned a caloric value in meal planning.',
        priority: 10
    },
    {
        id: 'protein-muscle-retention',
        category: 'protein',
        content: 'Adequate protein intake (1.6g-2.2g per kg of body weight) is critical for muscle retention during fat loss phases and muscle growth during bulking phases.',
        source: 'Schoenfeld et al. (2018)',
        priority: 8
    },
    {
        id: 'fiber-satiety',
        category: 'carbs',
        content: 'High-fiber diets (25-35g daily) improve satiety, aid digestion, and help regulate blood sugar levels.',
        priority: 7
    },
    {
        id: 'whole-foods-priority',
        category: 'general',
        content: 'Priority should be given to whole, minimally processed foods to maximize nutrient density and minimize hidden added sugars and unhealthy fats.',
        priority: 8
    },
    {
        id: 'cuisine-authenticity',
        category: 'cuisine',
        content: 'When a specific cuisine (e.g., Kenyan, Indian, Mediterranean) is requested, use authentic local dish names (e.g., "Ugali and Sukumawiki" instead of "Kenyan Cornmeal and Greens"). Avoid generic "Platter" or "Bowl" names unless they are actually traditional or popular in the cuisine.',
        priority: 10
    },
    {
        id: 'ingredient-decomposition',
        category: 'cuisine',
        content: 'DECOMPOSE all dishes into their raw, USDA-lookup-friendly ingredients. For example, "Ugali" should be listed as "Maize Flour" and "Water"; "Sukumawiki" should be "Kale" or "Collard Greens" plus seasonings. NEVER use the dish name as an ingredient.',
        priority: 10
    }
];

export interface SearchFilters {
    category?: NutritionFact['category'];
    minPriority?: number;
}

/**
 * Search the nutrition knowledge base
 */
export function searchNutritionKnowledge(query: string, filters?: SearchFilters): NutritionFact[] {
    let results = [...NUTRITION_KNOWLEDGE_BASE];

    if (filters?.category) {
        results = results.filter(f => f.category === filters.category);
    }

    if (filters?.minPriority) {
        results = results.filter(f => f.priority >= filters.minPriority);
    }

    if (query) {
        const searchTerms = query.toLowerCase().split(' ');
        results = results.filter(f =>
            searchTerms.some(term => f.content.toLowerCase().includes(term)) ||
            searchTerms.some(term => f.category.toLowerCase().includes(term))
        );
    }

    return results.sort((a, b) => b.priority - a.priority);
}

/**
 * Get top nutritional recommendations
 */
export function getNutritionRecommendations(limit: number = 5): NutritionFact[] {
    return [...NUTRITION_KNOWLEDGE_BASE]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, limit);
}
