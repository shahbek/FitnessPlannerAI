// RAG (Retrieval-Augmented Generation) Index
// Centralized access to all specialized knowledge bases

export * from './cardio/cardioKnowledgeBase';
export * from './goals/goalStrategyKnowledgeBase';
export * from './nutrition/nutritionKnowledgeBase';

// Future RAG modules will be exported here:
// export * from './training/trainingKnowledgeBase';
// export * from './recovery/recoveryKnowledgeBase';
// export * from './supplementation/supplementationKnowledgeBase';

/**
 * Search across all RAG knowledge bases
 */
export async function searchAllRAG(
  query: string,
  categories?: string[]
): Promise<any[]> {
  const results: any[] = [];

  // Search cardio knowledge base
  if (!categories || categories.includes('cardio')) {
    const { searchCardioKnowledge } = await import('./cardio/cardioKnowledgeBase');
    results.push(...searchCardioKnowledge(query));
  }

  // Search goal strategy knowledge base
  if (!categories || categories.includes('goals')) {
    const { searchGoalKnowledge } = await import('./goals/goalStrategyKnowledgeBase');
    results.push(...searchGoalKnowledge(query));
  }

  // Search nutrition knowledge base
  if (!categories || categories.includes('nutrition')) {
    const { searchNutritionKnowledge } = await import('./nutrition/nutritionKnowledgeBase');
    results.push(...searchNutritionKnowledge(query));
  }

  // Future: Add other knowledge bases
  // if (!categories || categories.includes('training')) { ... }

  return results;
}

