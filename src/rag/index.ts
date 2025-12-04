// RAG (Retrieval-Augmented Generation) Index
// Centralized access to all specialized knowledge bases

export * from './cardio/cardioKnowledgeBase';

// Future RAG modules will be exported here:
// export * from './nutrition/nutritionKnowledgeBase';
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

  // Future: Add other knowledge bases
  // if (!categories || categories.includes('nutrition')) { ... }
  // if (!categories || categories.includes('training')) { ... }

  return results;
}

