import { useState, useCallback } from 'react';
import { OptimalPlanService } from '@/services/OptimalPlanService';

interface ProgressUpdate {
  phase: string;
  progress: number | null; // null means indeterminate
  currentStep: string;
  reasoning: string[];
  aiReasoning?: string; // Streaming AI reasoning from GPT-OSS
  reasoningMode?: 'thinking' | 'formatting' | 'complete'; // Current AI reasoning mode
  estimatedTimeRemaining?: number; // seconds
  phaseNumber?: number; // Current phase number
  totalPhases?: number; // Total number of phases
  milestones?: Array<{ label: string; completed: boolean }>; // Progress milestones
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

      // Use the new phase-aware plan generation
      setProgress({
        phase: 'initializing',
        progress: null, // Indeterminate initially
        currentStep: 'Initializing plan generation...',
        reasoning: [
          'Analyzing user profile and goals',
          'Calculating baseline metrics',
          'Preparing generation pipeline'
        ],
        milestones: [
          { label: 'Profile analyzed', completed: false },
          { label: 'Framework generated', completed: false },
          { label: 'Exercises created', completed: false },
          { label: 'Sessions designed', completed: false },
          { label: 'Meals planned', completed: false },
          { label: 'Shopping list generated', completed: false }
        ]
      });

      const completePlan = await optimalService.generateOptimalPlan(
        formData,
        (update: any) => {
          // Update receives {phase, progress, currentStep, reasoning, aiReasoning, reasoningMode}
          console.log('🎯 useAISdkRag received update:', {
            phase: update.phase,
            hasAiReasoning: !!update.aiReasoning,
            reasoningLength: update.aiReasoning?.length,
            reasoningMode: update.reasoningMode,
            progress: update.progress
          });
          
          // Only use progress if it's a valid number, otherwise use null for indeterminate
          const progressValue = typeof update.progress === 'number' && update.progress >= 0 && update.progress <= 100
            ? update.progress
            : null;
          
          setProgress({
            phase: update.phase || 'generating',
            progress: progressValue,
            currentStep: update.currentStep || 'Processing...',
            reasoning: update.reasoning || [],
            aiReasoning: update.aiReasoning,
            reasoningMode: update.reasoningMode,
            estimatedTimeRemaining: update.estimatedTimeRemaining,
            phaseNumber: update.phaseNumber,
            totalPhases: update.totalPhases,
            milestones: update.milestones
          });
        }
      );
      
      setPlan(completePlan);
      setPlanSnapshots(prev => [...prev, { type: 'complete', data: completePlan }]);

      setProgress({
        phase: 'complete',
        progress: 100,
        currentStep: 'Plan generated successfully!',
        reasoning: [
          `Generated with ${Math.round(completePlan.confidenceScore * 100)}% confidence`,
          `Created ${completePlan.weeklyOutlines?.length || 0} detailed weekly plans`,
          'All components validated and optimized',
          'Ready to help you achieve your fitness goals!'
        ]
      });

    } catch (err: any) {
      console.error('AI SDK RAG plan generation failed:', err);
      
      // Create user-friendly error message
      let errorMessage = 'Failed to generate plan';
      let errorDetails = '';
      
      if (err.message) {
        if (err.message.includes('API key') || err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'Invalid API Key';
          errorDetails = 'Please check your API key in Settings. Make sure it\'s valid and has the correct permissions.';
        } else if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('timeout')) {
          errorMessage = 'Network Error';
          errorDetails = 'Unable to connect to the AI service. Please check your internet connection and try again.';
        } else if (err.message.includes('rate limit') || err.message.includes('429')) {
          errorMessage = 'Rate Limit Exceeded';
          errorDetails = 'Too many requests. Please wait a moment and try again.';
        } else {
          errorMessage = 'Generation Failed';
          errorDetails = err.message.length > 100 ? err.message.substring(0, 100) + '...' : err.message;
        }
      }
      
      setError(`${errorMessage}: ${errorDetails}`);
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
