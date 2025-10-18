// Retrieval-Augmented Generation (RAG) System for High-Accuracy Fitness Planning
// This system retrieves relevant scientific facts to ground AI responses in evidence

import { 
  ScientificFact, 
  getRelevantFacts, 
  calculateConfidence, 
  validateMacroTargets, 
  validateFatLossRate,
  PHYSIOLOGICAL_FACTS 
} from '@/data/scientificKnowledgeBase';

export interface RAGQuery {
  userProfile: any;
  context: string[];
  question: string;
  confidenceThreshold?: number;
}

export interface RAGResponse {
  facts: ScientificFact[];
  confidence: number;
  reasoning: string;
  warnings: string[];
  recommendations: string[];
  citations: string[];
}

export interface ContextualFact extends ScientificFact {
  relevanceScore: number;
  contextualizedValue: any;
  application: string;
}

export class FitnessRAGSystem {
  private knowledgeBase: ScientificFact[];
  private confidenceThreshold: number;

  constructor(confidenceThreshold: number = 0.8) {
    this.knowledgeBase = PHYSIOLOGICAL_FACTS;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Retrieve relevant facts for a specific query
   */
  async retrieveFacts(query: RAGQuery): Promise<RAGResponse> {
    const { userProfile, context, question, confidenceThreshold = this.confidenceThreshold } = query;
    
    // Get relevant facts based on context and user profile
    const relevantFacts = getRelevantFacts(userProfile, context);
    
    // Filter by confidence threshold
    const highConfidenceFacts = relevantFacts.filter(fact => 
      calculateConfidence(fact, userProfile) >= confidenceThreshold
    );

    // Rank facts by relevance to the specific question
    const rankedFacts = this.rankFactsByRelevance(highConfidenceFacts, question, userProfile);

    // Generate contextualized facts
    const contextualFacts = this.contextualizeFacts(rankedFacts, userProfile, context);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(contextualFacts);

    // Generate reasoning and recommendations
    const { reasoning, warnings, recommendations } = this.generateReasoning(
      contextualFacts, 
      userProfile, 
      question
    );

    // Extract citations
    const citations = this.extractCitations(contextualFacts);

    return {
      facts: contextualFacts,
      confidence: overallConfidence,
      reasoning,
      warnings,
      recommendations,
      citations
    };
  }

  /**
   * Get specific facts for macro calculations
   */
  async getMacroFacts(userProfile: any): Promise<RAGResponse> {
    return this.retrieveFacts({
      userProfile,
      context: ['nutrition', 'fat_loss', 'muscle_gain'],
      question: 'What are the optimal macronutrient targets?'
    });
  }

  /**
   * Get specific facts for training recommendations
   */
  async getTrainingFacts(userProfile: any): Promise<RAGResponse> {
    return this.retrieveFacts({
      userProfile,
      context: ['training', 'hypertrophy', 'strength'],
      question: 'What are the optimal training parameters?'
    });
  }

  /**
   * Get specific facts for metabolic calculations
   */
  async getMetabolicFacts(userProfile: any): Promise<RAGResponse> {
    return this.retrieveFacts({
      userProfile,
      context: ['metabolism', 'physiology', 'fat_loss'],
      question: 'What are the metabolic considerations?'
    });
  }

  /**
   * Validate a proposed plan against scientific evidence
   */
  async validatePlan(plan: any, userProfile: any): Promise<{
    isValid: boolean;
    confidence: number;
    warnings: string[];
    recommendations: string[];
    validatedFacts: ScientificFact[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let overallConfidence = 1.0;
    const validatedFacts: ScientificFact[] = [];

    // Validate macro targets if present
    if (plan.calories && plan.protein_g && plan.fat_g && plan.carb_g) {
      const macroValidation = validateMacroTargets(
        plan.protein_g, 
        plan.fat_g, 
        plan.carb_g, 
        userProfile
      );
      
      warnings.push(...macroValidation.warnings);
      recommendations.push(...macroValidation.recommendations);
      overallConfidence *= macroValidation.confidence;
    }

    // Validate fat loss rate if applicable
    if (plan.fat_loss_rate && userProfile.currentWeight && userProfile.targetWeight) {
      const fatLossValidation = validateFatLossRate(
        userProfile.currentWeight,
        userProfile.targetWeight,
        plan.timeline_weeks || 12
      );
      
      warnings.push(...fatLossValidation.warnings);
      recommendations.push(...fatLossValidation.recommendations);
      overallConfidence *= fatLossValidation.confidence;
    }

    // Get relevant facts for validation
    const ragResponse = await this.retrieveFacts({
      userProfile,
      context: ['validation', 'safety'],
      question: 'Validate this fitness plan'
    });

    validatedFacts.push(...ragResponse.facts);
    warnings.push(...ragResponse.warnings);
    recommendations.push(...ragResponse.recommendations);
    overallConfidence *= ragResponse.confidence;

    return {
      isValid: warnings.length === 0,
      confidence: overallConfidence,
      warnings,
      recommendations,
      validatedFacts
    };
  }

  /**
   * Generate evidence-based recommendations
   */
  async generateRecommendations(userProfile: any, goal: string): Promise<{
    recommendations: string[];
    confidence: number;
    supportingFacts: ScientificFact[];
  }> {
    const context = this.determineContextFromGoal(goal);
    
    const ragResponse = await this.retrieveFacts({
      userProfile,
      context,
      question: `Generate recommendations for: ${goal}`
    });

    const recommendations = this.synthesizeRecommendations(ragResponse.facts, userProfile, goal);

    return {
      recommendations,
      confidence: ragResponse.confidence,
      supportingFacts: ragResponse.facts
    };
  }

  private rankFactsByRelevance(facts: ScientificFact[], question: string, userProfile: any): ScientificFact[] {
    return facts.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, question, userProfile);
      const scoreB = this.calculateRelevanceScore(b, question, userProfile);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(fact: ScientificFact, question: string, userProfile: any): number {
    let score = 0;
    
    // Base confidence score
    score += calculateConfidence(fact, userProfile) * 0.4;
    
    // Keyword matching
    const questionWords = question.toLowerCase().split(' ');
    const factWords = (fact.title + ' ' + fact.conditions.context.join(' ')).toLowerCase().split(' ');
    const matchingWords = questionWords.filter(word => factWords.includes(word));
    score += (matchingWords.length / questionWords.length) * 0.3;
    
    // Category relevance
    const categoryKeywords = {
      'nutrition': ['protein', 'fat', 'carb', 'calorie', 'macro', 'diet'],
      'training': ['exercise', 'workout', 'volume', 'intensity', 'frequency'],
      'metabolism': ['metabolic', 'adaptation', 'tdee', 'bmr', 'deficit'],
      'body_composition': ['weight', 'fat', 'muscle', 'lean', 'body']
    };
    
    const relevantKeywords = categoryKeywords[fact.category] || [];
    const keywordMatches = questionWords.filter(word => relevantKeywords.includes(word));
    score += (keywordMatches.length / questionWords.length) * 0.3;
    
    return score;
  }

  private contextualizeFacts(facts: ScientificFact[], userProfile: any, context: string[]): ContextualFact[] {
    return facts.map(fact => ({
      ...fact,
      relevanceScore: this.calculateRelevanceScore(fact, context.join(' '), userProfile),
      contextualizedValue: this.contextualizeValue(fact, userProfile),
      application: this.generateApplication(fact, userProfile, context)
    }));
  }

  private contextualizeValue(fact: ScientificFact, userProfile: any): any {
    if (typeof fact.value === 'string') {
      return fact.value;
    }
    
    if (Array.isArray(fact.value)) {
      const [min, max] = fact.value;
      
      // Apply user-specific adjustments
      if (fact.id === 'protein_requirement_cut') {
        const adjustedMin = min * userProfile.weightKg;
        const adjustedMax = max * userProfile.weightKg;
        return [adjustedMin, adjustedMax];
      }
      
      if (fact.id === 'fat_loss_max_rate') {
        const adjustedMin = min * userProfile.weightKg;
        const adjustedMax = max * userProfile.weightKg;
        return [adjustedMin, adjustedMax];
      }
      
      return fact.value;
    }
    
    return fact.value;
  }

  private generateApplication(fact: ScientificFact, userProfile: any, context: string[]): string {
    const applications = {
      'bmr_katch_mcardle': `For a ${userProfile.weightKg}kg person with ${userProfile.bodyFat}% body fat, BMR = 370 + (21.6 × ${(userProfile.weightKg * (1 - userProfile.bodyFat / 100)).toFixed(1)}) = ${(370 + (21.6 * userProfile.weightKg * (1 - userProfile.bodyFat / 100))).toFixed(0)} kcal/day`,
      'protein_requirement_cut': `During fat loss, aim for ${(2.2 * userProfile.weightKg).toFixed(0)}-${(2.8 * userProfile.weightKg).toFixed(0)}g protein per day`,
      'fat_loss_max_rate': `Safe fat loss rate: ${(0.5 * userProfile.weightKg).toFixed(1)}-${(1.0 * userProfile.weightKg).toFixed(1)}kg per week`,
      'minimum_fat_intake': `Minimum fat intake: ${(0.6 * userProfile.weightKg).toFixed(0)}-${(1.0 * userProfile.weightKg).toFixed(0)}g per day for hormone production`
    };
    
    return applications[fact.id] || fact.title;
  }

  private calculateOverallConfidence(facts: ContextualFact[]): number {
    if (facts.length === 0) return 0;
    
    const weightedSum = facts.reduce((sum, fact) => 
      sum + (fact.confidence * fact.relevanceScore), 0
    );
    
    const totalWeight = facts.reduce((sum, fact) => sum + fact.relevanceScore, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private generateReasoning(facts: ContextualFact[], userProfile: any, question: string): {
    reasoning: string;
    warnings: string[];
    recommendations: string[];
  } {
    const reasoning = facts.map(fact => 
      `${fact.title}: ${fact.application} (Confidence: ${(fact.confidence * 100).toFixed(0)}%)`
    ).join('\n');
    
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Generate warnings based on low confidence facts
    facts.forEach(fact => {
      if (fact.confidence < 0.7) {
        warnings.push(`Low confidence in ${fact.title} (${(fact.confidence * 100).toFixed(0)}%)`);
      }
    });
    
    // Generate recommendations based on facts
    facts.forEach(fact => {
      if (fact.id === 'protein_requirement_cut') {
        recommendations.push('Prioritize protein intake to preserve muscle mass during caloric deficit');
      }
      if (fact.id === 'metabolic_adaptation_rate') {
        recommendations.push('Plan diet breaks every 6-8 weeks to mitigate metabolic adaptation');
      }
    });
    
    return { reasoning, warnings, recommendations };
  }

  private extractCitations(facts: ContextualFact[]): string[] {
    const citations = new Set<string>();
    
    facts.forEach(fact => {
      fact.evidence.sources.forEach(source => {
        citations.add(source);
      });
    });
    
    return Array.from(citations);
  }

  private determineContextFromGoal(goal: string): string[] {
    const goalLower = goal.toLowerCase();
    const contexts: string[] = [];
    
    if (goalLower.includes('fat') || goalLower.includes('cut') || goalLower.includes('weight loss')) {
      contexts.push('fat_loss', 'contest_prep');
    }
    if (goalLower.includes('muscle') || goalLower.includes('gain') || goalLower.includes('hypertrophy')) {
      contexts.push('muscle_gain', 'hypertrophy');
    }
    if (goalLower.includes('strength') || goalLower.includes('power')) {
      contexts.push('strength', 'power');
    }
    if (goalLower.includes('maintenance') || goalLower.includes('maintain')) {
      contexts.push('maintenance');
    }
    
    return contexts.length > 0 ? contexts : ['general'];
  }

  private synthesizeRecommendations(facts: ScientificFact[], userProfile: any, goal: string): string[] {
    const recommendations: string[] = [];
    
    facts.forEach(fact => {
      switch (fact.id) {
        case 'protein_requirement_cut':
          recommendations.push(`Maintain protein intake at ${(2.2 * userProfile.weightKg).toFixed(0)}-${(2.8 * userProfile.weightKg).toFixed(0)}g daily`);
          break;
        case 'fat_loss_max_rate':
          recommendations.push(`Target fat loss rate of ${(0.5 * userProfile.weightKg).toFixed(1)}-${(1.0 * userProfile.weightKg).toFixed(1)}kg per week`);
          break;
        case 'diet_break_frequency':
          recommendations.push('Schedule diet breaks every 6-8 weeks to prevent metabolic adaptation');
          break;
        case 'minimum_fat_intake':
          recommendations.push(`Ensure minimum fat intake of ${(0.6 * userProfile.weightKg).toFixed(0)}g daily for hormone production`);
          break;
      }
    });
    
    return recommendations;
  }
}

// Export singleton instance
export const fitnessRAG = new FitnessRAGSystem(0.8);
