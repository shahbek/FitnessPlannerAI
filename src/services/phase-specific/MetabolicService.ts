// Phase 2: Metabolic Calculations Service
// Handles BMR/TDEE/macro calculations with evidence-based formulas

import { UserProfile } from '@/models/UserProfile';
import { MetabolicMetrics } from '@/models/PlanModels';
import { MetabolicPromptBuilder } from '@/prompt-builders/MetabolicPromptBuilder';
import { AISdkRagService } from '@/services/aiSdkRagService';
import { dynamicCalculator } from '@/ai/dynamicCalculator';

export class MetabolicService {
  constructor(private aiService: AISdkRagService) {}

  async calculateMetrics(
    userProfile: UserProfile,
    dietaryConstraints: any,
    feasibility: any
  ): Promise<MetabolicMetrics> {
    console.log('🧮 Calculating metabolic metrics...');
    
    // Use deterministic calculator for base metrics
    const bmr = await dynamicCalculator.calculateBMR(userProfile);
    const tdee = await dynamicCalculator.calculateTDEE(userProfile, bmr.value);
    const macros = await dynamicCalculator.calculateMacroTargets(
      userProfile,
      tdee.value,
      userProfile.goal || 'fitness'
    );
    const fatLoss = await dynamicCalculator.calculateFatLossRate(userProfile);
    const trainingVolume = await dynamicCalculator.calculateTrainingVolume(
      userProfile,
      userProfile.goal || 'fitness'
    );
    const water = await dynamicCalculator.calculateWaterRequirement(userProfile);

    // Build prompt for AI validation and adjustment
    const prompt = MetabolicPromptBuilder.buildPrompt(
      userProfile,
      dietaryConstraints,
      feasibility,
      { bmr, tdee, macros, fatLoss, trainingVolume, water }
    );

    // Generate validated metrics
    const validatedMetrics = await this.aiService.generateWithFallback(
      this.getMetabolicSchema(),
      prompt,
      { bmr, tdee, macros, fatLoss, trainingVolume, water }
    );

    console.log('✅ Metabolic calculations complete');
    return validatedMetrics;
  }

  private getMetabolicSchema(): any {
    return {
      bmr: {
        value: 'number',
        formula: 'string',
        source: 'string'
      },
      tdee: {
        value: 'number',
        formula: 'string',
        source: 'string'
      },
      macros: {
        calories: 'number',
        protein: 'number',
        carbs: 'number',
        fat: 'number'
      },
      fatLoss: {
        value: 'number',
        formula: 'string',
        source: 'string'
      },
      trainingVolume: {
        value: 'number',
        formula: 'string',
        source: 'string'
      },
      water: {
        value: 'number',
        formula: 'string',
        source: 'string'
      }
    };
  }
}
