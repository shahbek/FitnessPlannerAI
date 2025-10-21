// Phase 1: Feasibility Assessment Service
// Handles feasibility assessment with evidence-based validation

import { UserProfile } from '@/models/UserProfile';
import { FeasibilityAssessment } from '@/models/PlanModels';
import { FeasibilityPromptBuilder } from '@/prompt-builders/FeasibilityPromptBuilder';
import { AISdkRagService } from '@/services/aiSdkRagService';

export class FeasibilityService {
  constructor(private aiService: AISdkRagService) {}

  async assessFeasibility(userProfile: UserProfile): Promise<FeasibilityAssessment> {
    console.log('📊 Assessing goal feasibility...');
    
    // Get dietary constraints
    const dietaryConstraints = this.parseDietaryConstraints(userProfile.preferences);
    
    // Get scientific limits
    const scientificLimits = this.getScientificLimits();
    
    // Build prompt
    const prompt = FeasibilityPromptBuilder.buildPrompt(
      userProfile,
      dietaryConstraints,
      scientificLimits
    );
    
    // Generate assessment
    const assessment = await this.aiService.generateWithFallback(
      this.getFeasibilitySchema(),
      prompt,
      this.getFallbackAssessment(userProfile)
    );
    
    console.log('✅ Feasibility assessment complete');
    return assessment;
  }

  private parseDietaryConstraints(preferences: string): any {
    // Use existing preference parser
    // This is a simplified version - actual implementation will use the full parser
    return {
      include: ['all_foods'],
      exclude: [],
      macroAdjustments: {
        carbs: 'based_on_goals',
        protein: 'based_on_goals',
        fat: 'based_on_goals'
      },
      notes: `User specified: "${preferences}"`
    };
  }

  private getScientificLimits(): any {
    return {
      maxFatLossPerWeek: 0.01, // 1% bodyweight per week
      minProteinPerKg: 1.6,
      minTrainingFrequency: 3,
      maxDeficitPercentage: 0.25
    };
  }

  private getFeasibilitySchema(): any {
    return {
      isFeasible: 'boolean',
      confidenceScore: 'number',
      reasoning: 'string',
      risks: 'array',
      recommendations: 'array',
      alternativeTimeline: 'number',
      optimisticOutlook: 'string',
      evidenceLimits: 'object'
    };
  }

  private getFallbackAssessment(userProfile: UserProfile): FeasibilityAssessment {
    const currentBF = userProfile.bodyFat || 22;
    const targetBF = userProfile.targetBf || 15;
    const bfToLose = currentBF - targetBF;
    const minWeeks = Math.ceil(bfToLose / 0.5); // 0.5% per week max
    const isFeasible = userProfile.timelineWeeks >= minWeeks;
    
    return {
      isFeasible,
      confidenceScore: isFeasible ? 0.9 : 0.7,
      reasoning: `Timeline assessment: ${isFeasible ? 'Realistic' : 'Too aggressive'}. ${isFeasible ? 'Timeline is safe and achievable.' : `Minimum safe timeline is ${minWeeks} weeks.`}`,
      risks: isFeasible ? ['Overtraining', 'Inadequate recovery'] : ['Aggressive timeline', 'Potential muscle loss', 'Metabolic adaptation'],
      recommendations: isFeasible ? ['Focus on progressive overload', 'Prioritize sleep and nutrition'] : ['Extend timeline to minimum safe duration', 'Consider conservative approach', 'Monitor body composition closely'],
      alternativeTimeline: minWeeks,
      optimisticOutlook: `With ${isFeasible ? userProfile.timelineWeeks : minWeeks} weeks of consistent effort, you can safely achieve significant progress toward your goals!`,
      evidenceLimits: {
        maxFatLossPerWeek: 0.5,
        minWeeksRequired: minWeeks,
        calculatedMetrics: {
          bmr: 0, // Will be calculated in phase 2
          tdee: 0,
          fatLossRate: 0.5
        }
      }
    };
  }
}
