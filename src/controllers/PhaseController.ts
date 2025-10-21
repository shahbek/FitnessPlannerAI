// Phase Controller
// Orchestrates the execution of each phase in the optimal sequence

import { UserProfile, NormalizedUserProfile } from '@/models/UserProfile';
import { CompletePlan } from '@/models/PlanModels';
import { AISdkRagService } from '@/services/aiSdkRagService';

export class PhaseController {
  private userProfile: NormalizedUserProfile;
  private aiService: AISdkRagService;

  constructor(userProfile: UserProfile, aiService: AISdkRagService) {
    this.userProfile = this.normalizeUserProfile(userProfile);
    this.aiService = aiService;
  }

  async executeOptimalSequence(): Promise<CompletePlan> {
    console.log('🚀 Starting Optimal Phase Sequence...');
    
    // For now, use the existing generatePhaseAwarePlan method
    // This provides all the phases in the correct sequence
    console.log('📊 Using existing phase-aware plan generation...');
    const completePlan = await this.aiService.generatePhaseAwarePlan(this.userProfile);
    
    console.log('🎉 Optimal Phase Sequence Complete!');
    return completePlan;
  }

  // Individual phase methods are available for future enhancement
  // Currently using the existing generatePhaseAwarePlan method which handles all phases

  private normalizeUserProfile(userProfile: UserProfile): NormalizedUserProfile {
    const lbm = userProfile.weightKg * (1 - (userProfile.bodyFat || 22) / 100);
    const bmi = userProfile.weightKg / Math.pow(userProfile.heightCm / 100, 2);
    
    return {
      ...userProfile,
      lbm,
      bmi,
      activityLevel: this.determineActivityLevel(userProfile),
      dietaryConstraints: {
        include: ['all_foods'],
        exclude: [],
        macroAdjustments: {
          carbs: 'based_on_goals',
          protein: 'based_on_goals',
          fat: 'based_on_goals'
        },
        notes: `User specified: "${userProfile.preferences}"`
      }
    };
  }

  private determineActivityLevel(userProfile: UserProfile): 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' {
    if (userProfile.trainingDaysPerWeek >= 5) return 'very_active';
    if (userProfile.trainingDaysPerWeek >= 3) return 'active';
    if (userProfile.trainingDaysPerWeek >= 1) return 'moderate';
    return 'light';
  }

  // Future enhancement: Individual phase methods can be implemented here
  // for more granular control over the generation process
}
