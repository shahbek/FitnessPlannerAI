/**
 * Session Template Generator
 * 
 * Generates workout session templates using Chain-of-Thought
 * Integrates with exercise library for exercise selection
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { ExerciseLibraryService } from './ExerciseLibraryService';
import { TrainingSplit } from './TrainingSplitService';
import { Exercise, SessionTemplate } from '../models/PlanModels';
import {
  buildSessionTemplateCoTPrompt,
  buildExerciseSelectionPrompt,
  buildSetRepAssignmentPrompt,
} from '../prompts/sessionTemplateCoT';
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
      reps: z.string(), // e.g., "8-12" or "10"
      restSeconds: z.number().optional(),
      order: z.number(),
      notes: z.string().optional(),
    })
  ),
  estimatedDuration: z.number().optional(), // in minutes
  totalVolume: z.object({
    totalSets: z.number(),
    setsPerMuscleGroup: z.record(z.string(), z.number()), // Fix: record needs key type (string) and value type (number)
  }),
  reasoning: z.string().optional(),
});

export type SessionTemplateGeneration = z.infer<typeof SessionTemplateSchema>;

/**
 * Session Generation Options
 */
export interface SessionGenerationOptions {
  trainingPhase?: string; // 'foundation', 'progression', 'peak'
  targetVolume?: {
    setsPerMuscle?: Record<string, number>;
    totalSets?: number;
  };
  enableReasoning?: boolean;
  onReasoningUpdate?: (reasoning: string) => void;
}

/**
 * Session Template Generator
 */
export class SessionTemplateGenerator {
  private cotService?: ChainOfThoughtService;
  private exerciseLibrary: ExerciseLibraryService;

  constructor(
    cotService: ChainOfThoughtService,
    exerciseLibrary: ExerciseLibraryService
  ) {
    this.cotService = cotService;
    this.exerciseLibrary = exerciseLibrary;
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
    dayFocus: string[], // Muscle groups to train
    userProfile: UserProfile,
    trainingPhase: string,
    options?: SessionGenerationOptions
  ): Promise<SessionTemplate> {
    // Get available exercises for this day
    // Normalize muscle group names (e.g., 'full_body' -> ['chest', 'back', 'legs', etc.])
    let normalizedFocus = dayFocus;
    if (dayFocus.includes('full_body') || dayFocus.length === 0) {
      normalizedFocus = ['chest', 'back', 'legs', 'shoulders', 'arms'];
    }

    let availableExercises = this.exerciseLibrary.getRecommendedExercises(
      {
        workoutLevel: userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert',
        equipment: userProfile.equipment,
        injuries: userProfile.injuries || [],
      },
      normalizedFocus
    );

    // If no exercises found, try with a broader search (any muscle group)
    if (availableExercises.length === 0) {
      console.warn(`⚠️  No exercises found for ${normalizedFocus.join(', ')}, trying broader search`);
      availableExercises = this.exerciseLibrary.getRecommendedExercises(
        {
          workoutLevel: userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert',
          equipment: userProfile.equipment,
          injuries: userProfile.injuries || [],
        },
        [] // Empty array to get any exercises
      );
    }

    if (availableExercises.length === 0) {
      throw new Error(
        `No exercises available for muscle groups: ${dayFocus.join(', ')} (tried: ${normalizedFocus.join(', ')})`
      );
    }

    // Check if AI is available, otherwise use deterministic method
    if (!this.isAIAvailable()) {
      console.log('📊 Using deterministic session template generation (AI unavailable)');
      return this.generateSessionTemplateDeterministic(
        dayFocus,
        availableExercises,
        userProfile,
        trainingPhase,
        options
      );
    }

    // Build CoT prompt
    const prompt = buildSessionTemplateCoTPrompt(
      dayFocus,
      availableExercises,
      trainingPhase,
      userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert',
      options?.targetVolume
    );

    // Generate with CoT
    try {
      const { result, reasoning } = await this.cotService!.generateWithCoT(
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

      // Convert to SessionTemplate format (matching the interface)
      const sessionTemplate: SessionTemplate = {
        templateId: result.templateId,
        name: result.name,
        targetMuscles: dayFocus,
        totalDurationMinutes: result.estimatedDuration || 60,
        structure: result.exercises.map((ex, index) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds || 60,
          notes: ex.notes || `Exercise ${index + 1}`,
        })),
      };

      return sessionTemplate;
    } catch (error) {
      console.warn('⚠️  CoT session generation failed, falling back to deterministic method:', error);
      return this.generateSessionTemplateDeterministic(
        dayFocus,
        availableExercises,
        userProfile,
        trainingPhase,
        options
      );
    }
  }

  /**
   * Generate session template deterministically (fallback when AI unavailable)
   */
  private generateSessionTemplateDeterministic(
    dayFocus: string[],
    availableExercises: Exercise[],
    userProfile: UserProfile,
    trainingPhase: string,
    options?: SessionGenerationOptions
  ): SessionTemplate {
    // Select 4-6 exercises for the session
    const exerciseCount = Math.min(6, Math.max(4, availableExercises.length));
    const selectedExercises = availableExercises.slice(0, exerciseCount);

    // Use existing assignSetsReps method
    const assignments = this.assignSetsReps(
      selectedExercises,
      trainingPhase,
      userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert'
    );

    // Generate template ID
    const templateId = `session-${dayFocus.join('-')}-${Date.now()}`;

    // Calculate total duration (rough estimate: 3 min per exercise + rest)
    const totalDurationMinutes = assignments.reduce((total, assignment) => {
      return total + (assignment.sets * 3) + (assignment.restSeconds * assignment.sets / 60);
    }, 0);

    // Convert to SessionTemplate format (matching the interface)
    return {
      templateId,
      name: `${dayFocus.join(' & ')} Workout`,
      targetMuscles: dayFocus,
      totalDurationMinutes: Math.round(totalDurationMinutes),
      structure: assignments.map((assignment, index) => ({
        exerciseId: assignment.exerciseId,
        sets: assignment.sets,
        reps: assignment.reps,
        restSeconds: assignment.restSeconds,
        notes: `Deterministic assignment for ${trainingPhase} phase`,
      })),
    };
  }

  /**
   * Select exercises from library (can be used independently)
   */
  selectExercises(
    targetMuscleGroups: string[],
    userProfile: UserProfile,
    maxExercises: number = 8
  ): Exercise[] {
    return this.exerciseLibrary.getRecommendedExercises(
      {
        workoutLevel: userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert',
        equipment: userProfile.equipment,
        injuries: userProfile.injuries || [],
      },
      targetMuscleGroups
    ).slice(0, maxExercises);
  }

  /**
   * Assign sets and reps (deterministic method)
   */
  assignSetsReps(
    exercises: Exercise[],
    trainingPhase: string,
    userLevel: 'beginner' | 'intermediate' | 'expert'
  ): Array<{
    exerciseId: string;
    sets: number;
    reps: string;
    restSeconds: number;
  }> {
    const assignments: Array<{
      exerciseId: string;
      sets: number;
      reps: string;
      restSeconds: number;
    }> = [];

    exercises.forEach((exercise) => {
      const isCompound = exercise.muscleGroups.length >= 3;

      // Determine sets and reps based on phase and exercise type
      let sets: number;
      let reps: string;
      let restSeconds: number;

      switch (trainingPhase.toLowerCase()) {
        case 'foundation':
          sets = isCompound ? 3 : 2;
          reps = userLevel === 'beginner' ? '8-10' : '10-12';
          restSeconds = isCompound ? 120 : 60;
          break;
        case 'progression':
          sets = isCompound ? 4 : 3;
          reps = userLevel === 'beginner' ? '8-10' : '6-8';
          restSeconds = isCompound ? 150 : 90;
          break;
        case 'peak':
          sets = isCompound ? 5 : 3;
          reps = userLevel === 'beginner' ? '6-8' : '4-6';
          restSeconds = isCompound ? 180 : 90;
          break;
        default:
          sets = isCompound ? 3 : 2;
          reps = '8-12';
          restSeconds = isCompound ? 120 : 60;
      }

      assignments.push({
        exerciseId: exercise.exerciseId,
        sets,
        reps,
        restSeconds,
      });
    });

    return assignments;
  }

  /**
   * Calculate volume for a session
   */
  calculateVolume(
    exercises: Array<{
      exerciseId: string;
      sets: number;
      muscleGroups: string[];
    }>
  ): {
    totalSets: number;
    setsPerMuscleGroup: Record<string, number>;
  } {
    const setsPerMuscleGroup: Record<string, number> = {};
    let totalSets = 0;

    exercises.forEach((exercise) => {
      totalSets += exercise.sets;

      // Distribute sets across muscle groups
      // If exercise hits multiple muscle groups, divide sets equally
      const setsPerGroup = exercise.sets / exercise.muscleGroups.length;

      exercise.muscleGroups.forEach((mg) => {
        setsPerMuscleGroup[mg] = (setsPerMuscleGroup[mg] || 0) + setsPerGroup;
      });
    });

    // Round to whole numbers
    Object.keys(setsPerMuscleGroup).forEach((mg) => {
      setsPerMuscleGroup[mg] = Math.round(setsPerMuscleGroup[mg]);
    });

    return {
      totalSets,
      setsPerMuscleGroup,
    };
  }

  /**
   * Get form cues for exercise
   */
  private getFormCues(exerciseId: string): string[] {
    const exercise = this.exerciseLibrary.getExerciseById(exerciseId);
    return exercise?.formCues || [];
  }

  /**
   * Get progression options for exercise
   */
  private getProgressionOptions(exerciseId: string): string[] {
    const exercise = this.exerciseLibrary.getExerciseById(exerciseId);
    return exercise?.progressionOptions || [];
  }

  /**
   * Get regression options for exercise
   */
  private getRegressionOptions(exerciseId: string): string[] {
    const exercise = this.exerciseLibrary.getExerciseById(exerciseId);
    return exercise?.regressionOptions || [];
  }
}

