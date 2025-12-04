/**
 * Session Template CoT Prompts
 * 
 * Chain-of-Thought prompts for workout session template generation
 */

import { Exercise } from '../models/PlanModels';
import { SessionTemplateContext } from '../services/SessionTemplateGenerator';

/**
 * Build CoT prompt for session template planning
 */
export interface SessionTemplatePromptOptions {
  excludeExercises?: string[];
  variationSeed?: string;
  targetExerciseCount?: number;
}

export function buildSessionTemplateCoTPrompt(
  dayFocus: string[], // Muscle groups to train this day
  trainingPhase: string, // e.g., 'foundation', 'progression', 'peak'
  userLevel: 'beginner' | 'intermediate' | 'expert',
  targetVolume?: {
    setsPerMuscle?: Record<string, number>;
    totalSets?: number;
  },
  context?: SessionTemplateContext,
  promptOptions?: SessionTemplatePromptOptions
): string {
  const targetVolumeInfo = targetVolume
    ? `\nTarget volume:\n- Sets per muscle: ${targetVolume.setsPerMuscle ? JSON.stringify(targetVolume.setsPerMuscle) : 'varies'}\n- Total sets: ${targetVolume.totalSets || 'varies'}`
    : '';

  const metricsInfo = context?.userMetrics
    ? `\nUser metrics:\n- Weight: ${context.userMetrics.weightKg ?? 'n/a'} kg\n- BMI: ${context.userMetrics.bmi ?? 'n/a'}\n- BMR: ${context.userMetrics.bmr ?? 'n/a'} kcal\n- TDEE: ${context.userMetrics.tdee ?? 'n/a'} kcal\n- Goal: ${context.userMetrics.goal ?? 'not specified'}`
    : '';

  const planGuidance = context?.planGuidance
    ? `\nWeekly strategy guidance:\n${context.planGuidance}`
    : '';

  const focusHistoryInfo = context?.focusHistorySummary
    ? `\nRecent focus coverage:\n${context.focusHistorySummary}\nDesign this session to complement earlier work by emphasizing different muscle subdivisions, movement angles, and equipment selections.`
    : '';

  const excludeExercisesInfo =
    promptOptions?.excludeExercises && promptOptions.excludeExercises.length > 0
      ? `\nExercises to avoid (recently used or user preference):\n${promptOptions.excludeExercises.join(', ')}`
      : '';

  const variationInfo = promptOptions?.variationSeed
    ? `\nVariation guidance: Consider alternative exercise selection using seed "${promptOptions.variationSeed}".`
    : '';

  const targetExerciseCountInfo = promptOptions?.targetExerciseCount
    ? `\nAim for approximately ${promptOptions.targetExerciseCount} total exercises unless rationale suggests otherwise.`
    : '';

  const sessionContext = context
    ? `\nSession context:\n- Split: ${context.splitName}\n- Day: ${context.dayName} (Day ${context.dayNumber}${context.weekNumber ? `, Week ${context.weekNumber}` : ''})\n- Phase: ${context.phase || trainingPhase}\n- Objectives: ${(context.objectives && context.objectives.length > 0) ? context.objectives.join('; ') : 'Refer to weekly guidance'}`
    : '';

  return `You are a strength and conditioning coach planning a workout session.

Training focus for this session:
${dayFocus.join(', ')}

Training phase: ${trainingPhase}
User experience level: ${userLevel}
${sessionContext}
${metricsInfo}
${targetVolumeInfo}
${planGuidance}
${focusHistoryInfo}
${excludeExercisesInfo}
${variationInfo}
${targetExerciseCountInfo}

Think step by step:
1. Design exactly 6 distinct exercises that effectively target the focus muscle groups
   - Prioritize proven compound movements first
   - Include 1-2 isolation exercises if needed
   - Provide realistic equipment (free weights, bodyweight, cables, machines)
   - Ensure exercises match user's experience level (${userLevel})
   - When repeating a muscle group within the week, rotate emphasis across different fiber orientations/angles (e.g., upper vs. lower chest, medial vs. posterior delts) and avoid duplicating the movement patterns outlined in the focus coverage summary

2. For each exercise provide:
   - Clear exerciseId (kebab-case)
   - Exercise name
   - Primary muscle groups (array)
   - Sets and reps aligned with the training phase
   - Rest period in seconds
   - Coaching note or cue

3. Determine exercise order:
   - Start with most demanding compound movements
   - Progress to accessory/isolation work
   - Consider fatigue management and movement patterns

4. Assign sets and reps based on training phase:
   - Foundation: 3-4 sets, 8-12 reps
   - Progression: 3-5 sets, 6-10 reps
   - Peak: 4-6 sets, 4-8 reps
   - Adjust for user level (${userLevel})

5. Calculate total volume:
   - Count total sets per muscle group
   - Ensure it meets volume targets if provided
   - Verify recovery is feasible

6. Name the session using industry-standard terminology (e.g., "Upper Body Hypertrophy", "Push Strength Session", "Leg Day Power") without referencing phases or weekdays.

7. Verify the session:
   - Does it target all focus muscle groups?
   - Is the volume appropriate for the phase?
   - Will the user recover adequately?
   - Are there exactly six unique exercises?

Generate a detailed workout session template with six unique exercises, their primary muscles, sets, reps, rest periods, and coaching notes.`;
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
