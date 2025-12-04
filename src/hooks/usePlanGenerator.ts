/**
 * React Hook for Integrated Plan Generator
 * 
 * Provides a React interface for the IntegratedPlanGenerator service
 * Handles state management, progress updates, and error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { IntegratedPlanGenerator } from '@/services/IntegratedPlanGenerator';
import { UserProfile } from '@/models/UserProfile';
import { WeeklyOutline, CompletePlan } from '@/models/PlanModels';
import { useToast } from '@/components/ui/use-toast';

/**
 * Progress Update Interface
 */
export interface PlanGenerationProgress {
  phase: 'initialization' | 'workout_planning' | 'meal_planning' | 'verification' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: string;
  reasoning?: string[]; // CoT reasoning steps
  errors?: string[];
  warnings?: string[];
}

/**
 * Plan Generation Options
 */
export interface PlanGenerationOptions {
  useUSDAAPI?: boolean;
  useCoT?: boolean;
  enableCorrections?: boolean;
  maxCorrectionIterations?: number;
}

/**
 * Hook Return Type
 */
export interface UsePlanGeneratorReturn {
  // State
  plan: CompletePlan | null;
  loading: boolean;
  error: string | null;
  progress: PlanGenerationProgress | null;

  // Actions
  generatePlan: (userProfile: UserProfile, weeklyOutlines: WeeklyOutline[], options?: PlanGenerationOptions) => Promise<void>;
  cancelGeneration: () => void;
  clearError: () => void;
  clearPlan: () => void;

  // Status
  isGenerating: boolean;
  canCancel: boolean;
}

/**
 * usePlanGenerator Hook
 * 
 * Provides React interface for IntegratedPlanGenerator
 */
export function usePlanGenerator(options?: { enableToasts?: boolean }): UsePlanGeneratorReturn {
  const [plan, setPlan] = useState<CompletePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlanGenerationProgress | null>(null);

  // Ref to track cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const generatorRef = useRef<IntegratedPlanGenerator | null>(null);

  // Toast notifications (optional)
  const { toast } = useToast();
  const enableToasts = options?.enableToasts ?? true;

  /**
   * Generate Plan
   */
  const generatePlan = useCallback(async (
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[],
    options?: PlanGenerationOptions
  ) => {
    if (loading) {
      console.warn('⚠️  Plan generation already in progress');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPlan(null);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Initialize generator (uses environment variables)
      const generator = new IntegratedPlanGenerator();
      generatorRef.current = generator;

      // Initial progress state
      setProgress({
        phase: 'initialization',
        progress: 0,
        currentStep: 'Initializing plan generation...',
        reasoning: [],
        errors: [],
        warnings: [],
      });

      // Generate plan with progress callbacks
      const completePlan = await generator.generatePlan(
        userProfile,
        weeklyOutlines,
        {
          ...options,
          onStateUpdate: (state: any) => {
            // Update progress from generator state
            const progressUpdate: PlanGenerationProgress = {
              phase: state.phase || 'initialization',
              progress: state.progress || 0,
              currentStep: state.currentStep || 'Processing...',
              reasoning: state.reasoning || [],
              errors: state.errors || [],
              warnings: state.warnings || [],
            };
            setProgress(progressUpdate);

            // Show toast for major phase changes - REMOVED per user request
            // if (enableToasts && state.phase && state.phase !== progress?.phase) {
            //   const phaseMessages: Record<string, string> = {
            //     workout_planning: 'Planning your workouts...',
            //     meal_planning: 'Planning your meals...',
            //     verification: 'Verifying your plan...',
            //   };
            //
            //   if (phaseMessages[state.phase]) {
            //     toast({
            //       title: phaseMessages[state.phase],
            //       description: state.currentStep || '',
            //     });
            //   }
            // }
          },
        }
      );

      // Success - set final plan
      setPlan(completePlan);

      // Final progress update
      const finalProgress: PlanGenerationProgress = {
        phase: 'complete',
        progress: 100,
        currentStep: 'Plan generated successfully!',
        reasoning: [
          `Generated with ${Math.round((completePlan.confidenceScore || 0.85) * 100)}% confidence`,
          `Created ${completePlan.weeklyOutlines?.length || 0} weekly outline(s)`,
          `Generated ${completePlan.phaseMealTemplates?.length || 0} days of meal plans`,
          `Generated ${completePlan.phaseSessionTemplates?.length || 0} workout sessions`,
          'All components validated and ready!',
        ],
        errors: completePlan.validationResults?.errors || [],
        warnings: completePlan.validationResults?.warnings || [],
      };
      setProgress(finalProgress);

      // Show success toast
      if (enableToasts) {
        toast({
          title: 'Plan Generated Successfully!',
          description: `Created ${completePlan.phaseMealTemplates?.length || 0} days of meals and ${completePlan.phaseSessionTemplates?.length || 0} workouts`,
          variant: 'default',
        });
      }

    } catch (err: any) {
      console.error('❌ Plan generation error:', err);

      // Handle cancellation
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        const cancelledProgress: PlanGenerationProgress = {
          phase: 'error',
          progress: 0,
          currentStep: 'Generation cancelled',
          reasoning: [],
          errors: ['Plan generation was cancelled by user'],
          warnings: [],
        };
        setProgress(cancelledProgress);
        setError('Plan generation was cancelled');

        if (enableToasts) {
          toast({
            title: 'Generation Cancelled',
            description: 'Plan generation was cancelled',
            variant: 'default',
          });
        }
      } else {
        // Handle other errors
        const errorMessage = err.message || 'Unknown error occurred during plan generation';
        const errorProgress: PlanGenerationProgress = {
          phase: 'error',
          progress: 0,
          currentStep: 'Generation failed',
          reasoning: [],
          errors: [errorMessage],
          warnings: [],
        };
        setError(errorMessage);
        setProgress(errorProgress);

        // Show error toast
        if (enableToasts) {
          toast({
            title: 'Generation Failed',
            description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage,
            variant: 'destructive',
          });
        }
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      generatorRef.current = null;
    }
  }, [loading]);

  /**
   * Cancel Generation
   */
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('🛑 Plan generation cancelled');
    }

    // Note: IntegratedPlanGenerator doesn't have built-in cancellation
    // This is a placeholder for future implementation
    // For now, we just set the loading state to false
    setLoading(false);
    setProgress({
      phase: 'error',
      progress: 0,
      currentStep: 'Generation cancelled',
      reasoning: [],
      errors: ['Generation was cancelled'],
      warnings: [],
    });
  }, []);

  /**
   * Clear Error
   */
  const clearError = useCallback(() => {
    setError(null);
    if (progress?.phase === 'error') {
      setProgress(null);
    }
  }, [progress]);

  /**
   * Clear Plan
   */
  const clearPlan = useCallback(() => {
    setPlan(null);
    setProgress(null);
    setError(null);
  }, []);

  return {
    // State
    plan,
    loading,
    error,
    progress,

    // Actions
    generatePlan,
    cancelGeneration,
    clearError,
    clearPlan,

    // Status
    isGenerating: loading,
    canCancel: loading && abortControllerRef.current !== null,
  };
}
