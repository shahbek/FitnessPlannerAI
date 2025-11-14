/**
 * Session Template Generator
 * 
 * Generates workout session templates using Chain-of-Thought
 * Relies entirely on AI for exercise selection
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { SessionTemplate } from '../models/PlanModels';
import { buildSessionTemplateCoTPrompt } from '../prompts/sessionTemplateCoT';
import { UserProfile } from '../models/UserProfile';

/**
 * Session Template Generation Schema
 */
export const SessionTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      sets: z.number(),
      reps: z.string(),
      restSeconds: z.number().optional(),
      order: z.number(),
      notes: z.string().optional(),
      primaryMuscles: z.array(z.string()).optional(),
    })
  ),
  estimatedDuration: z.number().optional(),
  totalVolume: z.object({
    totalSets: z.number(),
    setsPerMuscleGroup: z.record(z.string(), z.number()),
  }),
  reasoning: z.string().optional(),
});

export type SessionTemplateGeneration = z.infer<typeof SessionTemplateSchema>;

/**
 * Session Generation Options
 */
export interface SessionGenerationOptions {
  trainingPhase?: string;
  targetVolume?: {
    setsPerMuscle?: Record<string, number>;
    totalSets?: number;
  };
  enableReasoning?: boolean;
  onReasoningUpdate?: (reasoning: string) => void;
}

export interface SessionTemplateContext {
  splitName?: string;
  dayName?: string;
  dayNumber?: number;
  weekNumber?: number;
  phase?: string;
  objectives?: string[];
  planGuidance?: string;
  focusHistorySummary?: string;
  userMetrics?: {
    weightKg?: number;
    bmi?: number;
    bmr?: number;
    tdee?: number;
    goal?: string;
  };
}

/**
 * Session Template Generator
 */
export class SessionTemplateGenerator {
  private cotService?: ChainOfThoughtService;

  constructor(cotService: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  /**
   * Check if AI is available for CoT generation
   */
  private isAIAvailable(): boolean {
    return this.cotService && 
      typeof this.cotService.isAIAvailable === 'function' &&
      this.cotService.isAIAvailable();
  }

  /**
   * Generate session template for a training day
   */
  async generateSessionTemplate(
    dayFocus: string[],
    userProfile: UserProfile,
    trainingPhase: string,
    options?: SessionGenerationOptions,
    context?: SessionTemplateContext,
    previousSessions?: SessionTemplate[]
  ): Promise<SessionTemplate> {
    const normalizedFocus =
      dayFocus.includes('full_body') || dayFocus.length === 0
        ? ['chest', 'back', 'legs', 'shoulders', 'arms']
        : dayFocus;

    const expandedFocus = this.expandFocusGroups(normalizedFocus);
    const focusForPrompt = expandedFocus.length > 0 ? expandedFocus : ['chest', 'back', 'legs', 'shoulders', 'arms'];

    if (!this.isAIAvailable()) {
      throw new Error('AI service is required to generate workout sessions. Configure an AI API key.');
    }

    const recentExercises = this.extractRecentExercises(previousSessions, 7);
    const focusHistorySummary = this.buildFocusHistorySummary(focusForPrompt, previousSessions);
    const promptContext: SessionTemplateContext = {
      ...context,
      focusHistorySummary,
    };
    
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const variationHint = attempt > 0 ? this.getAlternateVariation(attempt) : undefined;
        const promptOptions = {
          excludeExercises: recentExercises,
          variationSeed: variationHint,
        } as const;
        
        const prompt = buildSessionTemplateCoTPrompt(
          focusForPrompt,
          trainingPhase,
          userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert',
          options?.targetVolume,
          promptContext,
          promptOptions
        );

        const { result } = await this.cotService!.generateWithCoT(
          prompt,
          SessionTemplateSchema,
          {
            enableVerification: true,
            onStepUpdate: (step) => {
              if (options?.onReasoningUpdate) {
                options.onReasoningUpdate(step.thought);
              }
            },
          }
        );

        const distinctExercises = this.validateAndNormalizeExercises(result.exercises || [], recentExercises);

        const sessionTemplate: SessionTemplate = {
          templateId: result.templateId,
          name: this.resolveSessionName(result.name, focusForPrompt, context),
          targetMuscles: focusForPrompt,
          totalDurationMinutes: result.estimatedDuration || this.estimateDuration(distinctExercises),
          structure: distinctExercises.map((ex, index) => ({
            exerciseId: ex.exerciseId || `exercise-${index + 1}`,
            name: ex.name || `Exercise ${index + 1}`,
            targetMuscles: ex.primaryMuscles || focusForPrompt,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds || this.getDefaultRest(ex.reps),
            notes: ex.notes || `Exercise ${index + 1}`,
          })),
        };

        return sessionTemplate;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Failed to generate session after retries');
  }

  private validateAndNormalizeExercises(
    exercises: SessionTemplateGeneration['exercises'],
    recentExercises?: string[]
  ): SessionTemplateGeneration['exercises'] {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      throw new Error('AI did not return any exercises for this session.');
    }

    const unique: SessionTemplateGeneration['exercises'] = [];
    const seen = new Set<string>();

    for (const exercise of exercises) {
      const normalized = this.normalizeExerciseName(exercise.name || '');
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      if (this.isSimilarToRecent(normalized, recentExercises)) continue;
      
      seen.add(normalized);
      unique.push(exercise);
      if (unique.length === 6) break;
    }

    if (unique.length < 4) {
      throw new Error(`AI returned only ${unique.length} unique exercises. Minimum 4 required.`);
    }

    return unique.slice(0, 6);
  }

  private normalizeExerciseName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(barbell|dumbbell|cable|machine|smith|ez-bar|ez)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isSimilarToRecent(exerciseName: string, recentExercises?: string[]): boolean {
    if (!recentExercises || recentExercises.length === 0) return false;
    
    const normalized = this.normalizeExerciseName(exerciseName);
    
    return recentExercises.some(recent => {
      const normalizedRecent = this.normalizeExerciseName(recent);
      if (normalized === normalizedRecent) return true;
      if (normalized.length > 5 && normalizedRecent.length > 5 && 
          (normalized.includes(normalizedRecent) || normalizedRecent.includes(normalized))) {
        return true;
      }
      return false;
    });
  }

  private extractRecentExercises(sessions: SessionTemplate[] | undefined, daysBack: number): string[] {
    if (!sessions || sessions.length === 0) return [];
    
    return sessions
      .slice(-daysBack)
      .flatMap(s => s.structure.map(e => e.name))
      .filter((name, idx, arr) => arr.indexOf(name) === idx);
  }

  private buildFocusHistorySummary(
    focus: string[],
    previousSessions?: SessionTemplate[],
    limit = 3
  ): string | undefined {
    if (!previousSessions || previousSessions.length === 0) {
      return undefined;
    }

    const normalizedFocus = focus.map((muscle) => muscle.toLowerCase());
    const relevantSessions = previousSessions
      .filter((session) => {
        const targetMuscles = (session.targetMuscles || []).map((muscle) => muscle.toLowerCase());
        return targetMuscles.some((muscle) => normalizedFocus.includes(muscle));
      })
      .slice(-limit);

    if (relevantSessions.length === 0) {
      return undefined;
    }

    const summaries = relevantSessions.map((session) => {
      const muscleSet = new Set<string>();
      const exerciseHighlights: string[] = [];

      (session.structure || []).forEach((exercise) => {
        (exercise.targetMuscles || []).forEach((muscle) => muscleSet.add(muscle.toLowerCase()));
        if (exerciseHighlights.length < 4 && exercise.name) {
          exerciseHighlights.push(exercise.name);
        }
      });

      const musclesText =
        muscleSet.size > 0
          ? Array.from(muscleSet)
              .map((muscle) => this.toTitleCase(muscle))
              .join(', ')
          : 'General focus';

      const exercisesText =
        exerciseHighlights.length > 0 ? exerciseHighlights.join(', ') : 'varied movements';

      return `${session.name || 'Previous session'} → muscles: ${musclesText}; key lifts: ${exercisesText}`;
    });

    return summaries.join('\n');
  }

  private expandFocusGroups(focusList: string[]): string[] {
    const focusMap: Record<string, string[]> = {
      'upper body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      'lower body': ['quads', 'hamstrings', 'glutes', 'calves', 'lower-back'],
      push: ['chest', 'shoulders', 'triceps'],
      pull: ['back', 'lats', 'biceps', 'rear-delts'],
      legs: ['quads', 'hamstrings', 'glutes', 'calves'],
      full_body: ['chest', 'back', 'legs', 'shoulders', 'arms'],
      conditioning: ['cardio', 'core', 'glutes'],
      core: ['abs', 'obliques', 'lower-back'],
      glutes: ['glutes', 'hamstrings'],
      hips: ['glutes', 'hamstrings', 'quads'],
      arms: ['biceps', 'triceps', 'forearms'],
      shoulders: ['shoulders', 'rear-delts'],
    };

    const muscles = new Set<string>();

    focusList.forEach((labelRaw) => {
      if (!labelRaw) return;
      const splits = labelRaw
        .split(/[,&/]/)
        .map((segment) => segment.trim().toLowerCase())
        .filter(Boolean);

      splits.forEach((label) => {
        if (focusMap[label]) {
          focusMap[label].forEach((muscle) => muscles.add(muscle));
          return;
        }

        if (label.endsWith('s') && focusMap[label.slice(0, -1)]) {
          focusMap[label.slice(0, -1)].forEach((muscle) => muscles.add(muscle));
          return;
        }

        if (label.includes('glute')) ['glutes', 'hamstrings'].forEach((m) => muscles.add(m));
        else if (label.includes('quad')) muscles.add('quads');
        else if (label.includes('hamstring')) muscles.add('hamstrings');
        else if (label.includes('calf')) muscles.add('calves');
        else if (label.includes('chest')) muscles.add('chest');
        else if (label.includes('back')) muscles.add('back');
        else if (label.includes('shoulder')) muscles.add('shoulders');
        else if (label.includes('bicep')) muscles.add('biceps');
        else if (label.includes('tricep')) muscles.add('triceps');
        else if (label.includes('arm')) ['biceps', 'triceps'].forEach((m) => muscles.add(m));
        else if (label.includes('abs') || label.includes('core')) ['abs', 'obliques'].forEach((m) => muscles.add(m));
      });
    });

    return Array.from(muscles);
  }

  private resolveSessionName(
    originalName: string | undefined,
    focus: string[],
    context?: SessionTemplateContext
  ): string {
    const fallback = this.generateFocusBasedName(focus);

    if (!originalName) {
      return fallback;
    }

    const lower = originalName.toLowerCase();
    const hasPhaseToken = ['foundation', 'progression', 'peak'].some((token) =>
      lower.includes(token)
    );

    if (hasPhaseToken) {
      return fallback;
    }

    return originalName;
  }

  private toTitleCase(text: string): string {
    return text
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private generateFocusBasedName(focus: string[]): string {
    if (!focus || focus.length === 0) {
      return 'Full Body Strength';
    }

    const primary = this.toTitleCase(focus[0]);
    if (primary.toLowerCase().includes('body') || primary.toLowerCase().includes('day')) {
      return `${primary} Session`;
    }

    return `${primary} Strength`;
  }

  private estimateDuration(exercises: SessionTemplateGeneration['exercises']): number {
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
    return Math.round((totalSets * 135) / 60 + 10);
  }

  private getDefaultRest(reps: string): number {
    const repCount = this.parseRepRange(reps);
    if (repCount <= 5) return 180;
    if (repCount <= 12) return 90;
    return 60;
  }

  private parseRepRange(reps: string): number {
    const match = reps.match(/(\d+)(?:-(\d+))?/);
    if (!match) return 10;
    const low = parseInt(match[1]);
    const high = match[2] ? parseInt(match[2]) : low;
    return (low + high) / 2;
  }

  private getAlternateVariation(attempt: number): string {
    const variations = ['strength', 'hypertrophy', 'endurance'];
    return variations[attempt % variations.length];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
