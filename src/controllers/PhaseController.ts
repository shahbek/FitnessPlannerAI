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

  async executeOptimalSequence(progressCallback?: (phase: string, progress: number, currentStep: string, reasoning: string[], streamingContent?: any[]) => void): Promise<CompletePlan> {
    console.log('🚀 Starting Optimal Phase Sequence...');
    
    // Calculate basic metrics for progress updates
    const lbm = this.userProfile.lbm;
    const bmr = 370 + (21.6 * lbm);
    const tdee = bmr * this.getActivityMultiplier();
    const proteinTarget = Math.round(lbm * 2.2); // 1g per lb of LBM
    const fatTarget = Math.round(tdee * 0.25 / 9); // 25% of calories from fat
    
    // Update progress with calculated metrics
    if (progressCallback) {
      progressCallback('calculating', 20, 'Calculating baseline metrics...', [
        `BMR: ${Math.round(bmr)} calories/day`,
        `TDEE: ${Math.round(tdee)} calories/day`,
        `Protein target: ${proteinTarget}g/day`,
        `Fat target: ${fatTarget}g/day`
      ]);
    }
    
    // For now, use the existing generatePhaseAwarePlan method
    // This provides all the phases in the correct sequence
    console.log('📊 Using existing phase-aware plan generation...');
    const completePlan = await this.aiService.generatePhaseAwarePlan(this.userProfile, progressCallback);
    
    console.log('🎉 Optimal Phase Sequence Complete!');
    return completePlan;
  }

  private getActivityMultiplier(): number {
    switch (this.userProfile.activityLevel) {
      case 'sedentary': return 1.2;
      case 'light': return 1.375;
      case 'moderate': return 1.55;
      case 'active': return 1.725;
      case 'very_active': return 1.9;
      default: return 1.375;
    }
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
