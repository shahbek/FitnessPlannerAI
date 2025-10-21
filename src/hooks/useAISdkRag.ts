import { useState, useCallback } from 'react';
import { OptimalPlanService } from '@/services/OptimalPlanService';

interface ProgressUpdate {
  phase: string;
  progress: number;
  currentStep: string;
  reasoning: string[];
}

export function useAISdkRag() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [planSnapshots, setPlanSnapshots] = useState<any[]>([]);

  const generatePlan = useCallback(async (formData: any) => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);
      setPlan(null);
      setPlanSnapshots([]);

      // Initialize Optimal Plan Service
      const optimalService = new OptimalPlanService(formData.apiKey, formData.endpoint, formData.model);

      // Progress tracking
      const updateProgress = (phase: string, progress: number, currentStep: string, reasoning: string[]) => {
        setProgress({
          phase,
          progress,
          currentStep,
          reasoning
        });
      };

      // Use the new phase-aware plan generation
      updateProgress('generating', 10, 'Generating comprehensive fitness plan...', [
        'Analyzing user profile and goals',
        'Creating evidence-based weekly outlines',
        'Generating personalized meal and workout plans'
      ]);

      const completePlan = await optimalService.generateOptimalPlan(formData);
      
      setPlan(completePlan);
      setPlanSnapshots(prev => [...prev, { type: 'complete', data: completePlan }]);

      updateProgress('complete', 100, 'Plan generated successfully!', [
        `Generated with ${Math.round(completePlan.confidenceScore * 100)}% confidence`,
        `Created ${completePlan.weeklyOutlines?.length || 0} detailed weekly plans`,
        'All components validated and optimized',
        'Ready to help you achieve your fitness goals!'
      ]);

    } catch (err: any) {
      console.error('AI SDK RAG plan generation failed:', err);
      setError(err.message || 'Failed to generate plan');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearPlan = useCallback(() => {
    setPlan(null);
    setPlanSnapshots([]);
    setProgress(null);
  }, []);

  return {
    plan,
    loading,
    error,
    progress,
    planSnapshots,
    generatePlan,
    clearError,
    clearPlan
  };
}
