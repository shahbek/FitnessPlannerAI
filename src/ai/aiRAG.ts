// AI-Powered RAG System
// Uses real AI with research knowledge base for dynamic responses

import { researchKnowledgeBase, ResearchFact } from './knowledgeBase';
import { realAIClient } from './realAIClient';

export interface AIQuery {
  question: string;
  userProfile: any;
  context?: string[];
  maxFacts?: number;
  minConfidence?: number;
}

export interface AIResponse {
  answer: string;
  confidence: number;
  sources: string[];
  facts: ResearchFact[];
  reasoning: string;
  warnings: string[];
  recommendations: string[];
}

export class AIRAGSystem {
  private isInitialized = false;

  async initialize(apiKey?: string, endpoint?: string, model?: string): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing AI RAG System...');
    
    // Initialize knowledge base
    await researchKnowledgeBase.initialize();
    
    // Initialize real AI client with provided parameters or defaults
    if (apiKey && endpoint && model) {
      await realAIClient.initialize(apiKey, endpoint, model);
    }
    
    this.isInitialized = true;
    console.log('AI RAG System initialized successfully with real AI client');
  }

  async query(query: AIQuery): Promise<AIResponse> {
    if (!this.isInitialized) {
      throw new Error('AI RAG System not initialized. Call initialize() first.');
    }

    // Search knowledge base for relevant facts
    const searchQuery = `${query.question} ${query.context?.join(' ') || ''}`;
    const relevantFacts = researchKnowledgeBase.searchFacts(
      searchQuery,
      undefined,
      query.minConfidence || 0.8
    ).slice(0, query.maxFacts || 5);

    if (relevantFacts.length === 0) {
      return {
        answer: "I don't have sufficient research data to answer this question with high confidence.",
        confidence: 0.3,
        sources: [],
        facts: [],
        reasoning: "No relevant research facts found in knowledge base.",
        warnings: ['Limited research data available'],
        recommendations: ['Consider consulting additional research sources']
      };
    }

    // Generate AI response using the facts
    const response = await this.generateAIResponse(query, relevantFacts);
    
    return response;
  }

  private async generateAIResponse(query: AIQuery, facts: ResearchFact[]): Promise<AIResponse> {
    // Create a comprehensive prompt with the research facts
    const prompt = this.buildPrompt(query, facts);
    
    try {
      // Use real AI client instead of mock
      const systemPrompt = `You are a scientific fitness expert with access to peer-reviewed research. Answer the user's question using ONLY the provided research facts. Be precise, evidence-based, and include specific calculations when applicable.`;
      
      const aiResponse = await realAIClient.complete(prompt, systemPrompt);
      
      // Parse the AI response
      return this.parseAIResponse(aiResponse, facts);
    } catch (error) {
      console.error('Real AI API call failed:', error);
      
      // Fallback to rule-based response
      return this.generateFallbackResponse(query, facts);
    }
  }

  private buildPrompt(query: AIQuery, facts: ResearchFact[]): string {
    const userContext = `
User Profile:
- Age: ${query.userProfile.age}
- Sex: ${query.userProfile.sex}
- Weight: ${query.userProfile.weightKg} kg
- Height: ${query.userProfile.heightCm} cm
- Body Fat: ${query.userProfile.bodyFat || 'Not provided'}%
- Training Days / Week: ${query.userProfile.trainingDaysPerWeek || query.userProfile.training_history?.currentTrainingDaysPerWeek || 'Not specified'}
- Activity Level: ${query.userProfile.activityLevel || query.userProfile.activity || 'Not specified'}
- Training Experience: ${query.userProfile.workoutLevel || query.userProfile.experienceLevel || query.userProfile.trainingAge || 'Not specified'}
- Preferred Split: ${query.userProfile.workoutSplit || query.userProfile.preferredSplit || 'Not specified'}
- Goal: ${query.userProfile.goal || 'Not specified'}
- Dietary Restrictions: ${query.userProfile.dietaryRestrictions?.join(', ') || 'None'}
- Preferred Cuisines: ${query.userProfile.preferredCuisines?.join(', ') || 'Flexible'}
- Program Duration: ${query.userProfile.desiredTimelineWeeks || 'Not specified'} weeks
`;

    const researchContext = facts.map(fact => `
Source: ${fact.source} (${fact.year})
Authors: ${fact.authors.join(', ')}
Confidence: ${(fact.confidence * 100).toFixed(0)}%
Content: ${fact.content}
${fact.formulas.length > 0 ? `Formulas: ${fact.formulas.join(', ')}` : ''}
${fact.dataPoints.length > 0 ? `Data Points: ${fact.dataPoints.map(dp => `${dp.description}: ${dp.value} ${dp.units}`).join(', ')}` : ''}
${fact.studyType ? `Study Type: ${fact.studyType}` : ''}
`).join('\n');

    return `
You are a scientific fitness expert with access to peer-reviewed research. Answer the user's question using ONLY the provided research facts. Be precise, evidence-based, and include specific calculations when applicable.

${userContext}

RESEARCH FACTS:
${researchContext}

USER QUESTION: ${query.question}

INSTRUCTIONS:
1. Use ONLY the research facts provided above
2. If calculations are needed, show the specific formulas and calculations
3. Provide confidence levels based on the research quality
4. Include specific recommendations with numbers/percentages
5. If the research doesn't fully answer the question, say so and explain what additional information would be needed
6. Always cite the specific research sources
7. For variety and personalization, provide multiple options when appropriate
8. Consider dietary restrictions and preferences in recommendations
9. Include progression strategies for long-term programs
10. Address both immediate and long-term considerations

RESPONSE FORMAT:
Answer: [Your evidence-based answer with specific calculations and variety options]
Confidence: [0-100% based on research quality]
Reasoning: [Step-by-step explanation of your reasoning]
Warnings: [Any safety concerns or limitations]
Recommendations: [Specific actionable recommendations with variety]
Variety Options: [Multiple approaches or alternatives when applicable]
`;
  }

  // Mock callAI method removed - now using realAIClient.complete() instead

  private parseAIResponse(aiResponse: string, facts: ResearchFact[]): AIResponse {
    // Parse the structured AI response
    const answerMatch = aiResponse.match(/Answer:\s*(.+?)(?=Confidence:|$)/s);
    const confidenceMatch = aiResponse.match(/Confidence:\s*(\d+)%/);
    const reasoningMatch = aiResponse.match(/Reasoning:\s*(.+?)(?=Warnings:|$)/s);
    const warningsMatch = aiResponse.match(/Warnings:\s*(.+?)(?=Recommendations:|$)/s);
    const recommendationsMatch = aiResponse.match(/Recommendations:\s*(.+?)$/s);

    const answer = answerMatch ? answerMatch[1].trim() : aiResponse;
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.8;
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Based on research evidence';
    const warnings = warningsMatch ? [warningsMatch[1].trim()] : [];
    const recommendations = recommendationsMatch ? [recommendationsMatch[1].trim()] : [];

    return {
      answer,
      confidence,
      sources: facts.map(f => `${f.source} (${f.year})`),
      facts,
      reasoning,
      warnings,
      recommendations
    };
  }

  private generateFallbackResponse(_query: AIQuery, facts: ResearchFact[]): AIResponse {
    // Generate a fallback response when AI API fails
    const fact = facts[0]; // Use the most relevant fact
    
    return {
      answer: `Based on research evidence: ${fact.content}`,
      confidence: fact.confidence,
      sources: [`${fact.source} (${fact.year})`],
      facts: [fact],
      reasoning: `This recommendation is based on research with ${(fact.confidence * 100).toFixed(0)}% confidence.`,
      warnings: fact.confidence < 0.9 ? ['Confidence below optimal threshold'] : [],
      recommendations: ['Monitor individual response and adjust as needed']
    };
  }

  // Helper methods removed - now using real AI calculations
}

// Export singleton instance
export const aiRAG = new AIRAGSystem();
