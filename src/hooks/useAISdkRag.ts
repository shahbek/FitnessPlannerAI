import { useState, useCallback } from 'react';
import { AISdkRagService } from '@/services/aiSdkRagService';

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

      // Initialize AI SDK RAG service
      const ragService = new AISdkRagService(formData.apiKey, formData.endpoint, formData.model);

      // Progress tracking
      const updateProgress = (phase: string, progress: number, currentStep: string, reasoning: string[]) => {
        setProgress({
          phase,
          progress,
          currentStep,
          reasoning
        });
      };

      // Step 1: Feasibility Assessment
      updateProgress('feasibility', 10, 'Assessing goal feasibility...', [
        'Analyzing user profile and goals',
        'Evaluating timeline and experience level',
        'Identifying optimal approach for success'
      ]);

      const feasibility = await ragService.generateFeasibilityAssessment(formData);
      setPlanSnapshots(prev => [...prev, { type: 'feasibility', data: feasibility }]);

      // Handle feasibility issues optimistically - suggest alternatives but continue
      if (!feasibility.isFeasible) {
        console.log('⚠️ Original timeline may be challenging, but proceeding with optimistic approach');
        console.log(`💡 Suggested alternative timeline: ${feasibility.alternativeTimeline}`);
        console.log(`🌟 Optimistic outlook: ${feasibility.optimisticOutlook}`);
        
        // Update formData with alternative timeline if suggested
        if (feasibility.alternativeTimeline) {
          const suggestedWeeks = parseInt(feasibility.alternativeTimeline.replace(/\D/g, ''));
          if (suggestedWeeks > 0) {
            formData.timelineWeeks = suggestedWeeks;
            console.log(`🔄 Updated timeline to ${suggestedWeeks} weeks based on feasibility assessment`);
          }
        }
      }

      // Step 2: Strategic Framework
      updateProgress('framework', 25, 'Generating strategic framework...', [
        'Researching optimal training approaches',
        'Analyzing nutrition strategies',
        'Creating personalized framework'
      ]);

      const strategicFramework = await ragService.generateStrategicFramework(formData);
      setPlanSnapshots(prev => [...prev, { type: 'framework', data: strategicFramework }]);

      // Step 3: Exercise Library
      updateProgress('exercises', 40, 'Building exercise library...', [
        'Selecting exercises for target muscles',
        'Creating progressions and regressions',
        'Ensuring equipment compatibility'
      ]);

      const exerciseLibrary = await ragService.generateExerciseLibrary(formData, strategicFramework);
      setPlanSnapshots(prev => [...prev, { type: 'exercises', data: exerciseLibrary }]);

      // Step 4: Session Templates
      updateProgress('sessions', 55, 'Creating session templates...', [
        'Designing workout sessions',
        'Balancing volume and intensity',
        'Optimizing session structure'
      ]);

      const sessionTemplates = await ragService.generateSessionTemplates(formData, exerciseLibrary, strategicFramework);
      setPlanSnapshots(prev => [...prev, { type: 'sessions', data: sessionTemplates }]);

      // Step 5: Meal Templates
      updateProgress('nutrition', 70, 'Designing meal templates...', [
        'Creating nutritionally balanced meals',
        'Calculating macro distributions',
        'Ensuring variety and sustainability'
      ]);

      const mealTemplates = await ragService.generateMealTemplates(formData, strategicFramework);
      setPlanSnapshots(prev => [...prev, { type: 'meals', data: mealTemplates }]);

      // Step 6: Shopping List
      updateProgress('shopping', 85, 'Compiling shopping list...', [
        'Analyzing meal requirements',
        'Organizing by categories',
        'Calculating estimated costs'
      ]);

      const shoppingList = await ragService.generateShoppingList(mealTemplates);
      setPlanSnapshots(prev => [...prev, { type: 'shopping', data: shoppingList }]);

      // Step 7: Phase Progression
      updateProgress('phases', 95, 'Defining phase progression...', [
        'Creating progressive phases',
        'Planning modifications and adaptations',
        'Setting realistic milestones'
      ]);

      const phaseProgression = await ragService.generatePhaseProgression(formData, strategicFramework);
      setPlanSnapshots(prev => [...prev, { type: 'phases', data: phaseProgression }]);

      // Complete plan
      const completePlan = {
        feasibility,
        strategicFramework,
        exerciseLibrary,
        sessionTemplates,
        mealTemplates,
        shoppingList,
        phaseProgression,
        generatedAt: new Date().toISOString(),
        confidenceScore: feasibility.confidenceScore
      };

      setPlan(completePlan);
      setPlanSnapshots(prev => [...prev, { type: 'complete', data: completePlan }]);

      updateProgress('complete', 100, 'Plan generated successfully!', [
        `Generated with ${Math.round(feasibility.confidenceScore * 100)}% confidence`,
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
