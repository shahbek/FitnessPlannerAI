// Optimal Plan Service
// Main service that orchestrates the optimal phase sequence using MVC architecture

import { UserProfile } from '@/models/UserProfile';
import { CompletePlan } from '@/models/PlanModels';
import { PhaseController } from '@/controllers/PhaseController';
import { AISdkRagService } from './aiSdkRagService';

export class OptimalPlanService {
  private aiService: AISdkRagService;

  constructor(apiKey: string, endpoint: string, modelName: string = 'llama-3.3-70b-versatile') {
    this.aiService = new AISdkRagService(apiKey, endpoint, modelName);
  }

  async generateOptimalPlan(userProfile: UserProfile): Promise<CompletePlan> {
    console.log('🚀 Starting Optimal Plan Generation with MVC Architecture...');
    console.log('👤 User Profile:', JSON.stringify(userProfile, null, 2));

    try {
      // Create phase controller
      const phaseController = new PhaseController(userProfile, this.aiService);
      
      // Execute optimal phase sequence
      const completePlan = await phaseController.executeOptimalSequence();
      
      console.log('🎉 Optimal Plan Generation Complete!');
      console.log('📊 Final Plan Summary:', {
        feasibility: completePlan.feasibility.isFeasible,
        confidence: completePlan.confidenceScore,
        weeklyOutlines: completePlan.weeklyOutlines.length,
        exercises: completePlan.phaseExerciseLibraries.flat().length,
        sessions: completePlan.phaseSessionTemplates.flat().length,
        meals: completePlan.phaseMealTemplates.flat().length
      });

      return completePlan;
    } catch (error) {
      console.error('❌ Optimal Plan Generation Failed:', error);
      throw new Error(`Failed to generate optimal plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Backward compatibility method
  async generatePhaseAwarePlan(userProfile: UserProfile): Promise<CompletePlan> {
    return this.generateOptimalPlan(userProfile);
  }

  // Backward compatibility method
  async generateCompletePlan(userProfile: UserProfile): Promise<CompletePlan> {
    return this.generateOptimalPlan(userProfile);
  }
}
