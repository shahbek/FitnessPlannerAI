// Optimal Plan Service
// Main service that orchestrates the optimal phase sequence using MVC architecture

import { UserProfile } from '@/models/UserProfile';
import { CompletePlan } from '@/models/PlanModels';
import { ConsistentPlan } from '@/models/ConsistentPlanModels';
import { PhaseController } from '@/controllers/PhaseController';
import { AISdkRagService } from './aiSdkRagService';
import { ConsistentPlanGenerationService } from './ConsistentPlanGenerationService';

export class OptimalPlanService {
  private apiKey: string;
  private endpoint: string;
  private modelName: string;

  constructor(apiKey: string, endpoint: string, modelName: string = 'llama-3.3-70b-versatile') {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.modelName = modelName;
  }

  async generateOptimalPlan(userProfile: UserProfile, progressCallback?: (update: any) => void): Promise<CompletePlan> {
    console.log('🚀 Starting Optimal Plan Generation with MVC Architecture...');
    console.log('👤 User Profile:', JSON.stringify(userProfile, null, 2));

    try {
      // Create AI service with progress callback
      const aiService = new AISdkRagService(
        this.apiKey, 
        this.endpoint, 
        this.modelName,
        (update: any) => {
          // Pass the full update object to the callback
          if (progressCallback) {
            progressCallback(update);
          }
        }
      );
      
      // Create phase controller
      const phaseController = new PhaseController(userProfile, aiService);
      
      // Execute optimal phase sequence with progress callback
      const completePlan = await phaseController.executeOptimalSequence(progressCallback);
      
      console.log('🎉 Optimal Plan Generation Complete!');
      console.log('📊 Final Plan Summary:', {
        feasibility: completePlan.feasibility?.isFeasible ?? 'unknown',
        confidence: completePlan.confidenceScore ?? 0,
        weeklyOutlines: completePlan.weeklyOutlines?.length ?? 0,
        exercises: completePlan.phaseExerciseLibraries ? completePlan.phaseExerciseLibraries.flat().length : 0,
        sessions: completePlan.phaseSessionTemplates ? completePlan.phaseSessionTemplates.flat().length : 0,
        meals: completePlan.phaseMealTemplates ? completePlan.phaseMealTemplates.flat().length : 0
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

  /**
   * Generate a validated, consistent plan with full traceability
   * This method uses the new validation pipeline to ensure zero contradictions
   */
  async generateValidatedPlan(
    userProfile: UserProfile,
    options: {
      maxReconciliationIterations?: number;
      requireValidation?: boolean;
      autoReconcile?: boolean;
    } = {},
    progressCallback?: (update: any) => void
  ): Promise<{
    consistentPlan: ConsistentPlan;
    originalPlan: CompletePlan;
    validationPassed: boolean;
    confidence: number;
  }> {
    const consistentService = new ConsistentPlanGenerationService(
      this.apiKey,
      this.endpoint,
      this.modelName
    );

    const result = await consistentService.generateConsistentPlan(
      userProfile,
      options,
      progressCallback
    );

    return {
      consistentPlan: result.plan,
      originalPlan: result.originalPlan,
      validationPassed: result.validationPassed,
      confidence: result.plan.validationResults.overallConfidence
    };
  }
}
