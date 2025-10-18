// Enhanced RAG System with Vector Database Integration
// Provides high-accuracy, evidence-based recommendations with confidence scoring

import { vectorDatabase, SearchQuery, SearchResult } from './vectorDatabase';
import { researchPDFParser, ParsedResearch } from './pdfParser';

export interface RAGQuery {
  userProfile: any;
  question: string;
  context: string[];
  confidenceThreshold?: number;
  maxResults?: number;
}

export interface RAGResponse {
  answer: string;
  confidence: number;
  supportingEvidence: {
    documents: SearchResult[];
    formulas: any[];
    recommendations: any[];
    dataPoints: any[];
  };
  reasoning: string;
  citations: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ContextualizedFact {
  id: string;
  content: string;
  confidence: number;
  source: string;
  authors: string[];
  year: number;
  relevanceScore: number;
  application: string;
}

export class EnhancedRAGSystem {
  private isInitialized = false;
  private researchData: ParsedResearch[] = [];

  /**
   * Initialize the RAG system with research data
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Enhanced RAG System...');
      
      // Parse all research papers
      this.researchData = await researchPDFParser.parseAllPapers();
      console.log(`Parsed ${this.researchData.length} research papers`);
      
      if (this.researchData.length === 0) {
        throw new Error('No research papers could be parsed');
      }
      
      // Initialize vector database
      await vectorDatabase.initialize(this.researchData);
      console.log('Vector database initialized');
      
      this.isInitialized = true;
      console.log('Enhanced RAG System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RAG system:', error);
      throw new Error(`RAG initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query the RAG system for evidence-based recommendations
   */
  async query(query: RAGQuery): Promise<RAGResponse> {
    if (!this.isInitialized) {
      throw new Error('RAG system not initialized. Call initialize() first.');
    }

    // Search for relevant documents
    const searchResults = await this.searchRelevantDocuments(query);
    
    // Extract and contextualize facts
    const contextualizedFacts = await this.contextualizeFacts(searchResults, query);
    
    // Generate evidence-based answer
    const answer = await this.generateAnswer(query, contextualizedFacts);
    
    // Calculate confidence score
    const confidence = this.calculateOverallConfidence(contextualizedFacts, query);
    
    // Generate reasoning and recommendations
    const { reasoning, warnings, recommendations } = this.generateReasoning(contextualizedFacts, query);
    
    // Extract citations
    const citations = this.extractCitations(contextualizedFacts);
    
    // Categorize supporting evidence
    const supportingEvidence = this.categorizeEvidence(searchResults);

    return {
      answer,
      confidence,
      supportingEvidence,
      reasoning,
      citations,
      warnings,
      recommendations
    };
  }

  /**
   * Get specific recommendations for a user profile and goal
   */
  async getRecommendations(userProfile: any, goal: string): Promise<RAGResponse> {
    const context = this.determineContextFromGoal(goal);
    
    return this.query({
      userProfile,
      question: `Generate evidence-based recommendations for: ${goal}`,
      context,
      confidenceThreshold: 0.8,
      maxResults: 15
    });
  }

  /**
   * Get macro recommendations with confidence scoring
   */
  async getMacroRecommendations(userProfile: any): Promise<RAGResponse> {
    return this.query({
      userProfile,
      question: 'What are the optimal macronutrient targets for this user?',
      context: ['nutrition', 'macros', 'protein', 'fat', 'carbs'],
      confidenceThreshold: 0.85,
      maxResults: 10
    });
  }

  /**
   * Get training recommendations
   */
  async getTrainingRecommendations(userProfile: any): Promise<RAGResponse> {
    return this.query({
      userProfile,
      question: 'What are the optimal training parameters for this user?',
      context: ['training', 'exercise', 'volume', 'intensity', 'frequency'],
      confidenceThreshold: 0.8,
      maxResults: 10
    });
  }

  /**
   * Get metabolic calculations
   */
  async getMetabolicCalculations(userProfile: any): Promise<RAGResponse> {
    return this.query({
      userProfile,
      question: 'Calculate BMR, TDEE, and metabolic requirements for this user',
      context: ['metabolism', 'bmr', 'tdee', 'energy', 'calories'],
      confidenceThreshold: 0.9,
      maxResults: 8
    });
  }

  /**
   * Validate a plan against scientific evidence
   */
  async validatePlan(plan: any, userProfile: any): Promise<{
    isValid: boolean;
    confidence: number;
    warnings: string[];
    recommendations: string[];
    validatedFacts: any[];
  }> {
    const validationQuery = {
      userProfile,
      question: 'Validate this fitness plan against scientific evidence',
      context: ['validation', 'safety', 'effectiveness'],
      confidenceThreshold: 0.7,
      maxResults: 20
    };

    const response = await this.query(validationQuery);
    
    // Additional validation logic
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Check macro targets
    if (plan.calories && plan.protein && plan.fat && plan.carbs) {
      const macroValidation = await this.validateMacroTargets(plan, userProfile);
      warnings.push(...macroValidation.warnings);
      recommendations.push(...macroValidation.recommendations);
    }
    
    // Check fat loss rate
    if (plan.fatLossRate) {
      const fatLossValidation = await this.validateFatLossRate(plan.fatLossRate, userProfile);
      warnings.push(...fatLossValidation.warnings);
      recommendations.push(...fatLossValidation.recommendations);
    }

    return {
      isValid: warnings.length === 0 && response.confidence >= 0.8,
      confidence: response.confidence,
      warnings: [...warnings, ...response.warnings],
      recommendations: [...recommendations, ...response.recommendations],
      validatedFacts: response.supportingEvidence.documents
    };
  }

  private async searchRelevantDocuments(query: RAGQuery): Promise<SearchResult[]> {
    const searchQuery: SearchQuery = {
      text: query.question,
      category: query.context[0], // Use first context as category filter
      minConfidence: query.confidenceThreshold || 0.7,
      limit: query.maxResults || 10,
      threshold: 0.5
    };

    return await vectorDatabase.search(searchQuery);
  }

  private async contextualizeFacts(searchResults: SearchResult[], query: RAGQuery): Promise<ContextualizedFact[]> {
    return searchResults.map(result => ({
      id: result.document.id,
      content: result.document.content,
      confidence: result.document.metadata.confidence,
      source: result.document.metadata.source,
      authors: result.document.metadata.authors,
      year: result.document.metadata.year,
      relevanceScore: result.relevanceScore,
      application: this.generateApplication(result.document, query.userProfile)
    }));
  }

  private async generateAnswer(query: RAGQuery, facts: ContextualizedFact[]): Promise<string> {
    if (facts.length === 0) {
      return "I don't have sufficient evidence to provide a confident recommendation for this query.";
    }

    // Group facts by category
    const categorizedFacts = this.categorizeFacts(facts);
    
    // Generate answer based on facts
    let answer = "Based on the scientific evidence, here are my recommendations:\n\n";
    
    // Add formulas if available
    if (categorizedFacts.formulas.length > 0) {
      answer += "**Key Formulas:**\n";
      categorizedFacts.formulas.forEach(fact => {
        answer += `- ${fact.content}\n`;
      });
      answer += "\n";
    }
    
    // Add recommendations
    if (categorizedFacts.recommendations.length > 0) {
      answer += "**Evidence-Based Recommendations:**\n";
      categorizedFacts.recommendations.forEach(fact => {
        answer += `- ${fact.content} (Confidence: ${Math.round(fact.confidence * 100)}%)\n`;
      });
      answer += "\n";
    }
    
    // Add data points
    if (categorizedFacts.dataPoints.length > 0) {
      answer += "**Supporting Data:**\n";
      categorizedFacts.dataPoints.forEach(fact => {
        answer += `- ${fact.content} (Confidence: ${Math.round(fact.confidence * 100)}%)\n`;
      });
    }

    return answer;
  }

  private calculateOverallConfidence(facts: ContextualizedFact[], query: RAGQuery): number {
    if (facts.length === 0) return 0;

    // Calculate weighted average confidence
    const totalWeight = facts.reduce((sum, fact) => sum + fact.relevanceScore, 0);
    const weightedConfidence = facts.reduce((sum, fact) => 
      sum + (fact.confidence * fact.relevanceScore), 0
    );

    return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  }

  private generateReasoning(facts: ContextualizedFact[], _query: RAGQuery): {
    reasoning: string;
    warnings: string[];
    recommendations: string[];
  } {
    const reasoning = facts.map(fact => 
      `${fact.content} (Source: ${fact.source}, Confidence: ${Math.round(fact.confidence * 100)}%)`
    ).join('\n\n');

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Generate warnings for low confidence facts
    facts.forEach(fact => {
      if (fact.confidence < 0.7) {
        warnings.push(`Low confidence in: ${fact.content.substring(0, 50)}...`);
      }
    });

    // Generate recommendations based on facts
    facts.forEach(fact => {
      if (fact.content.toLowerCase().includes('protein')) {
        recommendations.push('Prioritize adequate protein intake for muscle preservation');
      }
      if (fact.content.toLowerCase().includes('metabolic adaptation')) {
        recommendations.push('Plan diet breaks to prevent metabolic adaptation');
      }
      if (fact.content.toLowerCase().includes('fat loss')) {
        recommendations.push('Monitor fat loss rate to ensure it stays within safe limits');
      }
    });

    return { reasoning, warnings, recommendations };
  }

  private extractCitations(facts: ContextualizedFact[]): string[] {
    const citations = new Set<string>();
    
    facts.forEach(fact => {
      citations.add(`${fact.authors.join(', ')} (${fact.year}). ${fact.source}`);
    });
    
    return Array.from(citations);
  }

  private categorizeEvidence(searchResults: SearchResult[]): {
    documents: SearchResult[];
    formulas: any[];
    recommendations: any[];
    dataPoints: any[];
  } {
    const formulas: any[] = [];
    const recommendations: any[] = [];
    const dataPoints: any[] = [];

    searchResults.forEach(result => {
      const doc = result.document;
      
      if (doc.metadata.section === 'formulas') {
        formulas.push(doc);
      } else if (doc.metadata.section === 'recommendations') {
        recommendations.push(doc);
      } else if (doc.metadata.section === 'data_points') {
        dataPoints.push(doc);
      }
    });

    return {
      documents: searchResults,
      formulas,
      recommendations,
      dataPoints
    };
  }

  private categorizeFacts(facts: ContextualizedFact[]): {
    formulas: ContextualizedFact[];
    recommendations: ContextualizedFact[];
    dataPoints: ContextualizedFact[];
    other: ContextualizedFact[];
  } {
    const categorized = {
      formulas: [] as ContextualizedFact[],
      recommendations: [] as ContextualizedFact[],
      dataPoints: [] as ContextualizedFact[],
      other: [] as ContextualizedFact[]
    };

    facts.forEach(fact => {
      if (fact.content.toLowerCase().includes('formula') || fact.content.toLowerCase().includes('equation')) {
        categorized.formulas.push(fact);
      } else if (fact.content.toLowerCase().includes('recommendation') || fact.content.toLowerCase().includes('should')) {
        categorized.recommendations.push(fact);
      } else if (fact.content.toLowerCase().includes('data') || fact.content.toLowerCase().includes('g/kg') || fact.content.toLowerCase().includes('%')) {
        categorized.dataPoints.push(fact);
      } else {
        categorized.other.push(fact);
      }
    });

    return categorized;
  }

  private generateApplication(document: any, userProfile: any): string {
    // Generate user-specific application of the fact
    if (document.content.toLowerCase().includes('protein')) {
      const proteinGrams = (2.2 * userProfile.weightKg).toFixed(0);
      return `For a ${userProfile.weightKg}kg person, this translates to approximately ${proteinGrams}g protein per day`;
    }
    
    if (document.content.toLowerCase().includes('fat loss')) {
      const fatLossKg = (0.5 * userProfile.weightKg).toFixed(1);
      return `For a ${userProfile.weightKg}kg person, this means ${fatLossKg}kg fat loss per week maximum`;
    }
    
    return document.content;
  }

  private determineContextFromGoal(goal: string): string[] {
    const goalLower = goal.toLowerCase();
    const contexts: string[] = [];
    
    if (goalLower.includes('fat') || goalLower.includes('cut') || goalLower.includes('weight loss')) {
      contexts.push('fat_loss', 'contest_prep', 'metabolism');
    }
    if (goalLower.includes('muscle') || goalLower.includes('gain') || goalLower.includes('hypertrophy')) {
      contexts.push('muscle_gain', 'hypertrophy', 'training');
    }
    if (goalLower.includes('strength') || goalLower.includes('power')) {
      contexts.push('strength', 'power', 'training');
    }
    if (goalLower.includes('maintenance') || goalLower.includes('maintain')) {
      contexts.push('maintenance', 'nutrition');
    }
    
    return contexts.length > 0 ? contexts : ['general'];
  }

  private async validateMacroTargets(plan: any, userProfile: any): Promise<{
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Validate protein intake
    const proteinPerKg = plan.protein / userProfile.weightKg;
    if (proteinPerKg < 1.6) {
      warnings.push(`Protein intake (${proteinPerKg.toFixed(1)} g/kg) is below recommended minimum`);
      recommendations.push('Increase protein intake to at least 1.6 g/kg bodyweight');
    }
    
    return { warnings, recommendations };
  }

  private async validateFatLossRate(rate: number, _userProfile: any): Promise<{
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    if (rate > 1.0) {
      warnings.push(`Fat loss rate (${rate}%/week) exceeds safe maximum`);
      recommendations.push('Reduce fat loss rate to 0.5-1.0% bodyweight per week');
    }
    
    return { warnings, recommendations };
  }
}

// Export singleton instance
export const enhancedRAG = new EnhancedRAGSystem();
