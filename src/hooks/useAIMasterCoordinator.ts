import { useState, useCallback } from 'react';
import { FormState } from '@/types';
import { useAIPhysiologyModeling } from './useAIPhysiologyModeling';
import { useAIMealPlanning } from './useAIMealPlanning';
import { useAITrainingProgramming } from './useAITrainingProgramming';

interface AICoordinatedPlan {
  physiologicalAnalysis: any;
  weeklyPlans: Array<{
    week: number;
    phase: string;
    mealPlan: any;
    trainingProgram: any;
    confidence: number;
    scientificReferences: string[];
  }>;
  overallConfidence: number;
  totalReferences: string[];
  generatedAt: string;
}

export function useAIMasterCoordinator(form: FormState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [coordinatedPlan, setCoordinatedPlan] = useState<AICoordinatedPlan | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  const physiologyModeling = useAIPhysiologyModeling(form);
  const mealPlanning = useAIMealPlanning(form);
  const trainingProgramming = useAITrainingProgramming(form);

  const generateCompleteAIPlan = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Generate physiological analysis
      setCurrentStep('Analyzing physiological parameters and calculating metabolic requirements...');
      await physiologyModeling.generatePhysiologicalAnalysis();
      
      if (physiologyModeling.error) {
        throw new Error(`Physiological analysis failed: ${physiologyModeling.error}`);
      }

      if (!physiologyModeling.analysis) {
        throw new Error('No physiological analysis generated');
      }

      // Step 2: Generate weekly plans for each week
      setCurrentStep('Generating comprehensive meal and training plans for each week...');
      const weeklyPlans = [];
      const allReferences = new Set<string>();

      for (const projection of physiologyModeling.analysis.weeklyProjections) {
        // Find the corresponding phase
        const phase = physiologyModeling.analysis.timeline.phases.find(p => 
          projection.week >= p.startWeek + 1 && projection.week <= p.endWeek + 1
        );

        if (!phase) {
          console.warn(`No phase found for week ${projection.week}`);
          continue;
        }

        // Create a mock checkpoint for the meal planning
        const mockCheckpoint = {
          week: projection.week,
          phase: phase.name,
          predictedWeight: projection.predictedWeight,
          predictedBodyFat: projection.predictedBodyFat,
          predictedLeanMass: projection.predictedLeanMass,
          dailyCalories: projection.dailyCalories,
          proteinGrams: projection.proteinGrams,
          fatGrams: projection.fatGrams,
          carbGrams: projection.carbGrams,
          trainingVolume: projection.trainingVolume,
          cardioMinutes: projection.cardioMinutes,
          notes: '',
          adaptations: []
        };

        // Generate meal plan for this week
        setCurrentStep(`Generating meal plan for week ${projection.week}...`);
        await mealPlanning.generateAIMealPlan(mockCheckpoint, phase, form.preferences ? form.preferences.split(',').map(p => p.trim()) : []);
        
        if (mealPlanning.error) {
          console.warn(`Meal planning failed for week ${projection.week}: ${mealPlanning.error}`);
          continue;
        }

        // Generate training program for this week
        setCurrentStep(`Generating training program for week ${projection.week}...`);
        await trainingProgramming.generateAITrainingProgram(mockCheckpoint, phase);
        
        if (trainingProgramming.error) {
          console.warn(`Training programming failed for week ${projection.week}: ${trainingProgramming.error}`);
          continue;
        }

        // Collect references
        if (mealPlanning.weeklyPlan?.scientificBasis) {
          mealPlanning.weeklyPlan.scientificBasis.forEach(ref => allReferences.add(ref));
        }
        if (trainingProgramming.trainingProgram?.scientificBasis) {
          trainingProgramming.trainingProgram.scientificBasis.forEach(ref => allReferences.add(ref));
        }

        weeklyPlans.push({
          week: projection.week,
          phase: phase.name,
          mealPlan: mealPlanning.weeklyPlan,
          trainingProgram: trainingProgramming.trainingProgram,
          confidence: Math.min(
            projection.confidence || 0.9,
            mealPlanning.weeklyPlan?.confidence || 0.9,
            trainingProgramming.trainingProgram?.confidence || 0.9
          ),
          scientificReferences: [
            ...(mealPlanning.weeklyPlan?.scientificBasis || []),
            ...(trainingProgramming.trainingProgram?.scientificBasis || [])
          ]
        });
      }

      // Step 3: Create coordinated plan
      setCurrentStep('Synthesizing complete AI-driven plan...');
      const coordinatedPlan: AICoordinatedPlan = {
        physiologicalAnalysis: physiologyModeling.analysis,
        weeklyPlans,
        overallConfidence: Math.min(
          physiologyModeling.analysis?.confidence || 0.9,
          weeklyPlans.reduce((acc, wp) => acc + wp.confidence, 0) / weeklyPlans.length
        ),
        totalReferences: Array.from(allReferences),
        generatedAt: new Date().toISOString()
      };

      setCoordinatedPlan(coordinatedPlan);
      setCurrentStep('Complete! AI-driven plan generated successfully.');
      
      console.log('Complete AI-driven plan generated:', {
        totalWeeks: weeklyPlans.length,
        overallConfidence: coordinatedPlan.overallConfidence,
        totalReferences: coordinatedPlan.totalReferences.length
      });

    } catch (e: any) {
      setError(e.message || 'Failed to generate complete AI plan');
      console.error('AI master coordination failed:', e);
    } finally {
      setLoading(false);
    }
  }, [form, physiologyModeling, mealPlanning, trainingProgramming]);

  return {
    coordinatedPlan,
    loading,
    error,
    currentStep,
    generateCompleteAIPlan,
    clearError: () => setError(''),
    // Individual system access
    physiologyModeling,
    mealPlanning,
    trainingProgramming
  };
}
