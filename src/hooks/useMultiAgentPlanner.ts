import { useState, useCallback } from 'react';
import { 
  FormState, 
  AgentContext, 
  AgentResponse, 
  MultiAgentPlan, 
  StreamingProgress,
  ProgressivePlan,
  ProgressionPhase,
  WeeklyCheckpoint
} from '@/types';
import { 
  PHYSIOLOGICAL_ANALYST_PROMPT, 
  TRAINING_PROGRAMMER_PROMPT, 
  NUTRITION_STRATEGIST_PROMPT,
  MASTER_COORDINATOR_PROMPT 
} from '@/constants';
import { 
  calculateTimeline, 
  calculateWeeklyCheckpoints,
  validateGoalRealism 
} from '@/utils/physiologyCalculations';

interface UseMultiAgentPlannerProps {
  form: FormState;
  onProgress?: (progress: StreamingProgress) => void;
}

export function useMultiAgentPlanner({ form, onProgress }: UseMultiAgentPlannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<'analysis' | 'planning' | 'synthesis' | 'complete'>('analysis');
  const [agentResponses, setAgentResponses] = useState<Partial<MultiAgentPlan>>({});
  const [progressivePlan, setProgressivePlan] = useState<ProgressivePlan | null>(null);
  const [reasoning, setReasoning] = useState<string[]>([]);

  const updateProgress = useCallback((phase: StreamingProgress['phase'], step: string, progress: number) => {
    if (onProgress) {
      onProgress({
        phase,
        progress,
        currentStep: step,
        reasoning: [...reasoning],
        partialResults: agentResponses
      });
    }
  }, [onProgress, reasoning, agentResponses]);

  const addReasoning = useCallback((step: string) => {
    setReasoning(prev => [...prev, step]);
  }, []);

  const callAgent = useCallback(async (
    agent: 'physiological_analyst' | 'training_programmer' | 'nutrition_strategist' | 'master_coordinator',
    prompt: string,
    context?: AgentContext
  ): Promise<AgentResponse> => {
    const request = {
      model: form.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: buildUserPrompt(form, context) },
      ],
      temperature: 0.2,
    };

    const res = await fetch(form.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${form.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    
    try {
      const parsed = JSON.parse(content);
      return {
        agent,
        reasoning: parsed.reasoning || '',
        recommendations: parsed,
        confidence: parsed.confidence || 0.8,
        citations: parsed.citations || [],
        nextSteps: parsed.nextSteps || []
      };
    } catch {
      return {
        agent,
        reasoning: content,
        recommendations: {},
        confidence: 0.5,
        citations: [],
        nextSteps: []
      };
    }
  }, [form]);

  const buildUserPrompt = useCallback((form: FormState, context?: AgentContext): string => {
    const basePrompt = `USER_PROFILE
- age: ${form.age}
- sex: ${form.sex}
- height_cm: ${form.heightCm}
- weight_kg: ${form.weightKg}
- body_fat_pct: ${form.bodyFat || 'unknown'}
- activity_factor: ${form.activity}
- training_age: ${form.trainingAge}
- goal: ${form.goal}
- target_body_fat_pct: ${form.targetBf || 'n/a'}

SCHEDULE
${form.schedule || 'No constraints provided'}

DIET
- likes: ${form.preferences || ''}
- avoid: ${form.avoid || ''}
- repetition_ok: ${form.repetitionOk ? 'true' : 'false'}

EQUIPMENT
${form.equipment || 'Bodyweight'}`;

    if (context) {
      return `${basePrompt}

CURRENT_CONTEXT
- Current Phase: ${context.currentPhase.name}
- Previous Results: ${JSON.stringify(context.previousResults.slice(-2))}
- User Feedback: ${context.userFeedback.join(', ')}
- Metabolic State: ${JSON.stringify(context.metabolicState)}`;
    }

    return basePrompt;
  }, []);

  const generateProgressivePlan = useCallback(async () => {
    setLoading(true);
    setError('');
    setReasoning([]);
    setAgentResponses({});
    setProgressivePlan(null);

    try {
      // Validate goal realism first
      const validation = validateGoalRealism(
        Number(form.bodyFat),
        Number(form.targetBf),
        Number(form.weightKg),
        form.trainingAge
      );

      if (!validation.isRealistic) {
        setError(`Goal validation failed: ${validation.warnings.join(', ')}`);
        return;
      }

      // Phase 1: Physiological Analysis
      setCurrentPhase('analysis');
      updateProgress('analysis', 'Analyzing physiological state...', 10);
      addReasoning('Starting physiological analysis...');

      const physiologicalAnalysis = await callAgent('physiological_analyst', PHYSIOLOGICAL_ANALYST_PROMPT);
      setAgentResponses(prev => ({ ...prev, physiologicalAnalysis }));
      addReasoning('Physiological analysis complete - calculated BMR, TDEE, and metabolic risks');

      updateProgress('analysis', 'Calculating timeline and phases...', 30);
      
      // Calculate timeline and phases
      const timeline = calculateTimeline(
        Number(form.bodyFat),
        Number(form.targetBf),
        Number(form.weightKg),
        physiologicalAnalysis.recommendations?.approach || 'moderate'
      );

      addReasoning(`Timeline calculated: ${timeline.totalWeeks} weeks with ${timeline.phases.length} phases`);

      // Phase 2: Training Programming
      setCurrentPhase('planning');
      updateProgress('planning', 'Designing training program...', 40);
      addReasoning('Starting training program design...');

      const trainingContext: AgentContext = {
        userId: 'user',
        currentPhase: timeline.phases[0],
        previousResults: [],
        userFeedback: [],
        metabolicState: {
          week: 0,
          tdeeReduction: 0,
          leptinLevel: 1,
          cortisolLevel: 1,
          sleepQuality: 10,
          hungerLevel: 5,
          energyLevel: 10
        }
      };

      const trainingProgram = await callAgent('training_programmer', TRAINING_PROGRAMMER_PROMPT, trainingContext);
      setAgentResponses(prev => ({ ...prev, trainingProgram }));
      addReasoning('Training program designed with periodization and fatigue management');

      // Phase 3: Nutrition Strategy
      updateProgress('planning', 'Creating nutrition strategy...', 60);
      addReasoning('Starting nutrition strategy development...');

      const nutritionStrategy = await callAgent('nutrition_strategist', NUTRITION_STRATEGIST_PROMPT, trainingContext);
      setAgentResponses(prev => ({ ...prev, nutritionStrategy }));
      addReasoning('Nutrition strategy created with macro periodization and adherence optimization');

      // Phase 4: Master Coordination
      setCurrentPhase('synthesis');
      updateProgress('synthesis', 'Synthesizing comprehensive plan...', 80);
      addReasoning('Starting master coordination and synthesis...');

      const masterCoordinator = await callAgent('master_coordinator', MASTER_COORDINATOR_PROMPT, trainingContext);
      setAgentResponses(prev => ({ ...prev, masterCoordinator }));
      addReasoning('Master coordination complete - all components integrated');

      // Generate weekly checkpoints
      updateProgress('synthesis', 'Generating weekly checkpoints...', 90);
      const checkpoints = calculateWeeklyCheckpoints(
        timeline.phases,
        Number(form.weightKg),
        Number(form.bodyFat),
        Number(form.activity) * (370 + 21.6 * (Number(form.weightKg) * (1 - Number(form.bodyFat) / 100))),
        form
      );

      addReasoning(`Generated ${checkpoints.length} weekly checkpoints with detailed progression`);

      // Create final progressive plan
      const finalPlan: ProgressivePlan = {
        id: `plan_${Date.now()}`,
        userId: 'user',
        createdAt: new Date().toISOString(),
        currentState: {
          weight: Number(form.weightKg),
          bodyFat: Number(form.bodyFat),
          leanMass: Number(form.weightKg) * (1 - Number(form.bodyFat) / 100),
          tdee: Number(form.activity) * (370 + 21.6 * (Number(form.weightKg) * (1 - Number(form.bodyFat) / 100)))
        },
        goalState: {
          targetBodyFat: Number(form.targetBf),
          targetWeight: checkpoints[checkpoints.length - 1]?.predictedWeight || Number(form.weightKg),
          targetLeanMass: checkpoints[checkpoints.length - 1]?.predictedLeanMass || Number(form.weightKg) * (1 - Number(form.bodyFat) / 100)
        },
        timeline: {
          totalWeeks: timeline.totalWeeks,
          phases: timeline.phases,
          checkpoints,
          adaptations: checkpoints.map(cp => ({
            week: cp.week,
            tdeeReduction: Math.min(cp.week * 1, 15), // 1% per week, max 15%
            leptinLevel: Math.max(1 - cp.week * 0.05, 0.6), // 5% reduction per week, min 60%
            cortisolLevel: Math.min(1 + cp.week * 0.03, 1.3), // 3% increase per week, max 130%
            sleepQuality: Math.max(10 - cp.week * 0.2, 6),
            hungerLevel: Math.min(5 + cp.week * 0.3, 8),
            energyLevel: Math.max(10 - cp.week * 0.15, 6)
          }))
        },
        strategy: {
          approach: physiologicalAnalysis.recommendations?.approach || 'moderate',
          dietBreakFrequency: 10,
          refeedFrequency: 7,
          deloadFrequency: 4
        },
        rationale: masterCoordinator.recommendations?.unified_rationale || 'Comprehensive multi-agent analysis',
        references: [
          ...(physiologicalAnalysis.citations || []),
          ...(trainingProgram.citations || []),
          ...(nutritionStrategy.citations || []),
          ...(masterCoordinator.citations || [])
        ]
      };

      setProgressivePlan(finalPlan);
      setCurrentPhase('complete');
      updateProgress('complete', 'Plan generation complete!', 100);
      addReasoning('Multi-agent progressive plan generation complete!');

    } catch (e: any) {
      setError(e.message || 'Failed to generate progressive plan');
      addReasoning(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [form, callAgent, updateProgress, addReasoning]);

  const adjustPlan = useCallback(async (week: number, actualResults: any) => {
    if (!progressivePlan) return;

    setLoading(true);
    setError('');

    try {
      const currentPhase = progressivePlan.timeline.phases.find(p => 
        week >= p.startWeek && week <= p.endWeek
      );

      if (!currentPhase) return;

      const context: AgentContext = {
        userId: 'user',
        currentPhase,
        previousResults: progressivePlan.timeline.checkpoints.slice(0, week),
        userFeedback: [JSON.stringify(actualResults)],
        metabolicState: progressivePlan.timeline.adaptations[week - 1] || {
          week: 0,
          tdeeReduction: 0,
          leptinLevel: 1,
          cortisolLevel: 1,
          sleepQuality: 10,
          hungerLevel: 5,
          energyLevel: 10
        }
      };

      // Get adjustment recommendations from each agent
      const [physiologicalAdjustment, trainingAdjustment, nutritionAdjustment] = await Promise.all([
        callAgent('physiological_analyst', PHYSIOLOGICAL_ANALYST_PROMPT, context),
        callAgent('training_programmer', TRAINING_PROGRAMMER_PROMPT, context),
        callAgent('nutrition_strategist', NUTRITION_STRATEGIST_PROMPT, context)
      ]);

      // Update the plan with adjustments
      const updatedPlan = { ...progressivePlan };
      // Apply adjustments to future weeks
      // This would involve updating the checkpoints and phases based on agent recommendations

      setProgressivePlan(updatedPlan);

    } catch (e: any) {
      setError(e.message || 'Failed to adjust plan');
    } finally {
      setLoading(false);
    }
  }, [progressivePlan, callAgent]);

  return {
    loading,
    error,
    currentPhase,
    agentResponses,
    progressivePlan,
    reasoning,
    generateProgressivePlan,
    adjustPlan,
    clearError: () => setError('')
  };
}
