/**
 * Session Template CoT Prompts
 * 
 * Chain-of-Thought prompts for workout session template generation
 */

import { Exercise } from '../models/PlanModels';
import { TrainingSplit } from '../services/TrainingSplitService';

/**
 * Build CoT prompt for session template planning
 */
export function buildSessionTemplateCoTPrompt(
  dayFocus: string[], // Muscle groups to train this day
  availableExercises: Exercise[],
  trainingPhase: string, // e.g., 'foundation', 'progression', 'peak'
  userLevel: 'beginner' | 'intermediate' | 'expert',
  targetVolume?: {
    setsPerMuscle?: number;
    totalSets?: number;
  }
): string {
  const exercisesList = availableExercises
    .map(
      ex =>
        `- ${ex.name} (${ex.muscleGroups.join(', ')}, ${ex.difficulty}, equipment: ${ex.equipment.join(', ')})`
    )
    .join('\n');

  const targetVolumeInfo = targetVolume
    ? `\nTarget volume:\n- Sets per muscle: ${targetVolume.setsPerMuscle || 'varies'}\n- Total sets: ${targetVolume.totalSets || 'varies'}`
    : '';

  return `You are a strength and conditioning coach planning a workout session.

Training focus for this session:
${dayFocus.join(', ')}

Training phase: ${trainingPhase}
User experience level: ${userLevel}

Available exercises (filtered by equipment and safety):
${exercisesList}
${targetVolumeInfo}

Think step by step:
1. Select 4-8 exercises that effectively target the focus muscle groups
   - Prioritize compound movements first
   - Include 1-2 isolation exercises if needed
   - Ensure exercises match user's experience level (${userLevel})

2. Determine exercise order:
   - Start with most demanding compound movements
   - Progress to accessory/isolation work
   - Consider fatigue management

3. Assign sets and reps based on training phase:
   - Foundation phase: 3-4 sets, 8-12 reps (hypertrophy focus)
   - Progression phase: 3-5 sets, 6-10 reps (strength/hypertrophy)
   - Peak phase: 4-6 sets, 4-8 reps (strength focus)
   - Adjust for user level (${userLevel})

4. Calculate total volume:
   - Count total sets per muscle group
   - Ensure it meets volume targets if provided
   - Verify recovery is feasible

5. Verify the session:
   - Does it target all focus muscle groups?
   - Is the volume appropriate for the phase?
   - Will the user recover adequately?

Generate a detailed workout session template with exercises, sets, reps, and rest periods.`;
}

/**
 * Build prompt for exercise selection from library
 */
export function buildExerciseSelectionPrompt(
  targetMuscleGroups: string[],
  availableExercises: Exercise[],
  constraints: {
    maxExercises?: number;
    requireCompound?: boolean;
    excludeEquipment?: string[];
    excludeInjuries?: string[];
  }
): string {
  const exercisesList = availableExercises
    .map(ex => {
      const isCompound = ex.muscleGroups.length >= 3;
      return `- ${ex.name} (${ex.muscleGroups.join(', ')}, ${isCompound ? 'compound' : 'isolation'}, ${ex.difficulty})`;
    })
    .join('\n');

  return `Select exercises from the available library for this workout.

Target muscle groups: ${targetMuscleGroups.join(', ')}
${constraints.maxExercises ? `Maximum exercises: ${constraints.maxExercises}` : ''}
${constraints.requireCompound ? 'Must include at least one compound movement' : ''}

Available exercises:
${exercisesList}

Think step by step:
1. Identify which exercises target the required muscle groups
2. Prioritize compound movements (work multiple muscle groups)
3. Ensure variety (don't repeat similar movements)
4. Match difficulty to user level
5. Verify equipment availability

Select the best exercises for this session.`;
}

/**
 * Build prompt for set/rep assignment
 */
export function buildSetRepAssignmentPrompt(
  exercises: Exercise[],
  trainingPhase: string,
  userLevel: 'beginner' | 'intermediate' | 'expert',
  targetVolume?: {
    setsPerMuscle?: number;
    totalSets?: number;
  }
): string {
  const exercisesList = exercises.map(ex => `- ${ex.name}`).join('\n');

  return `Assign sets and reps for these exercises.

Exercises:
${exercisesList}

Training phase: ${trainingPhase}
User level: ${userLevel}
${targetVolume ? `Target volume: ${JSON.stringify(targetVolume)}` : ''}

Think step by step:
1. Determine rep ranges based on phase:
   - Foundation: 8-12 reps (hypertrophy)
   - Progression: 6-10 reps (hypertrophy/strength)
   - Peak: 4-8 reps (strength)

2. Assign sets per exercise:
   - Compound movements: 3-5 sets
   - Isolation movements: 2-4 sets
   - Adjust for user level (${userLevel})

3. Consider rest periods:
   - Compound movements: 2-3 minutes
   - Isolation movements: 60-90 seconds

4. Calculate total volume:
   - Sum sets per muscle group
   - Verify it meets targets if provided

5. Verify assignment:
   - Is volume appropriate for phase?
   - Will user complete session in reasonable time?
   - Is recovery manageable?

Assign sets, reps, and rest periods for each exercise.`;
}

/**
 * Build prompt for volume calculation verification
 */
export function buildVolumeVerificationPrompt(
  sessionTemplate: {
    exercises: Array<{
      name: string;
      sets: number;
      reps: number;
      muscleGroups: string[];
    }>;
  },
  targetVolume: {
    setsPerMuscle?: Record<string, number>;
    totalSets?: number;
  }
): string {
  const exercisesList = sessionTemplate.exercises
    .map(ex => `- ${ex.name}: ${ex.sets} sets × ${ex.reps} reps (${ex.muscleGroups.join(', ')})`)
    .join('\n');

  const targetInfo = targetVolume.setsPerMuscle
    ? `Target sets per muscle group:\n${Object.entries(targetVolume.setsPerMuscle).map(([mg, sets]) => `- ${mg}: ${sets} sets`).join('\n')}`
    : '';
  const totalSetsInfo = targetVolume.totalSets
    ? `Target total sets: ${targetVolume.totalSets}`
    : '';

  return `Verify the workout session volume meets targets.

Session exercises:
${exercisesList}

${targetInfo}
${totalSetsInfo}

Think step by step:
1. Calculate sets per muscle group:
   - Sum sets for each muscle group across all exercises
   - Account for exercises that hit multiple muscle groups

2. Calculate total sets:
   - Sum all sets from all exercises

3. Compare to targets:
   - Does each muscle group meet its target?
   - Does total volume meet the target?

4. Identify any issues:
   - Muscle groups under-trained
   - Muscle groups over-trained
   - Total volume too high or too low

5. Recommend adjustments if needed

Verify and provide feedback on the session volume.`;
}

