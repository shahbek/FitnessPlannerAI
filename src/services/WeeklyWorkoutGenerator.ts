/**
 * Weekly Workout Generator
 *
 * Generates a complete week (7 days) of workout sessions in a SINGLE AI call.
 * This ensures proper exercise variation, prevents duplicates, and allows for
 * progressive programming across the entire week.
 *
 * Key features:
 * - Single AI call per week (not per day)
 * - Full week context for exercise selection
 * - Automatic variation for similar training days
 * - Progressive overload built-in
 * - Proper muscle group distribution
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { SessionTemplate } from '../models/PlanModels';
import { TrainingSplit } from './TrainingSplitService';
import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';

/**
 * Single Exercise Schema
 */
const ExerciseSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  sets: z.number(),
  reps: z.string(),
  restSeconds: z.number().optional(),
  order: z.number(),
  notes: z.string().optional(),
  primaryMuscles: z.array(z.string()).optional(),
});

/**
 * Single Day Workout Schema
 */
const DayWorkoutSchema = z.object({
  dayNumber: z.number().min(1).max(7),
  dayName: z.string(),
  isRestDay: z.boolean(),
  sessionName: z.string().optional(),
  exercises: z.array(ExerciseSchema).optional(),
  estimatedDuration: z.number().optional(),
  totalVolume: z.object({
    totalSets: z.number(),
    setsPerMuscleGroup: z.record(z.string(), z.number()),
  }).optional(),
  reasoning: z.string().optional(),
});

/**
 * Weekly Workout Plan Schema
 */
const WeeklyWorkoutPlanSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  days: z.array(DayWorkoutSchema),
  weeklyVolume: z.object({
    totalSets: z.number(),
    setsPerMuscleGroup: z.record(z.string(), z.number()),
  }).optional(),
  progressionNotes: z.string().optional(),
  reasoning: z.string().optional(),
});

export type WeeklyWorkoutPlan = z.infer<typeof WeeklyWorkoutPlanSchema>;
export type DayWorkout = z.infer<typeof DayWorkoutSchema>;

/**
 * Weekly Workout Generation Options
 */
export interface WeeklyWorkoutOptions {
  enableReasoning?: boolean;
  onReasoningUpdate?: (reasoning: string) => void;
  previousWeekSessions?: SessionTemplate[];
}

/**
 * Weekly Workout Generator
 */
export class WeeklyWorkoutGenerator {
  private cotService: ChainOfThoughtService;

  constructor(cotService: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  /**
   * Generate complete week of workouts in a single AI call
   */
  async generateWeeklyWorkouts(
    trainingSplit: TrainingSplit,
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    options?: WeeklyWorkoutOptions
  ): Promise<SessionTemplate[]> {
    if (!this.cotService.isAIAvailable()) {
      throw new Error('AI service is required to generate workout sessions. Configure an AI API key.');
    }

    const prompt = this.buildWeeklyWorkoutPrompt(
      trainingSplit,
      userProfile,
      weeklyOutline,
      options?.previousWeekSessions
    );

    try {
      const { result } = await this.cotService.generateWithCoT(
        prompt,
        WeeklyWorkoutPlanSchema,
        {
          enableVerification: true,
          onStepUpdate: (step) => {
            if (options?.onReasoningUpdate) {
              options.onReasoningUpdate(step.thought);
            }
          },
        }
      );

      // Convert WeeklyWorkoutPlan to SessionTemplate[]
      return this.convertToSessionTemplates(result, weeklyOutline, trainingSplit);
    } catch (error) {
      console.error('Failed to generate weekly workouts:', error);
      throw new Error(`Weekly workout generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build comprehensive prompt for weekly workout generation
   */
  private buildWeeklyWorkoutPrompt(
    trainingSplit: TrainingSplit,
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    previousWeekSessions?: SessionTemplate[]
  ): string {
    const trainingDays = trainingSplit.days.filter(d => !d.isRestDay);
    const trainingPhase = weeklyOutline.phase || 'progression';
    const userLevel = (userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert') || 'intermediate';

    // Build previous week summary to avoid repetition
    const previousWeekSummary = this.buildPreviousWeekSummary(previousWeekSessions);

    // Build split structure
    const splitStructure = trainingSplit.days
      .map(day => {
        if (day.isRestDay) {
          return `  Day ${day.dayNumber} (${day.dayName}): REST DAY`;
        }
        const focusText = day.focus.join(', ');
        const intensityText = day.intensity ? ` [${day.intensity} intensity]` : '';
        return `  Day ${day.dayNumber} (${day.dayName}): ${focusText}${intensityText}`;
      })
      .join('\n');

    // Build objectives
    const objectives = weeklyOutline.objectives?.join('; ') || 'Build strength and muscle';

    return `You are an expert strength and conditioning coach designing a complete 7-day workout program.

CRITICAL REQUIREMENT: Generate exercises for ALL 7 DAYS in a SINGLE response.

USER PROFILE:
- Experience: ${userLevel}
- Goal: ${userProfile.goal}
- Training Days: ${userProfile.trainingDaysPerWeek} per week
- Equipment: ${userProfile.equipment}
- Body stats: ${userProfile.heightCm}cm, ${userProfile.weightKg}kg

WEEKLY PLAN:
- Week Number: ${weeklyOutline.weekNumber}
- Training Phase: ${trainingPhase}
- Objectives: ${objectives}
- Split Type: ${trainingSplit.splitName}

7-DAY TRAINING SPLIT:
${splitStructure}

${previousWeekSummary}

MANDATORY REQUIREMENTS:

1. GENERATE ALL 7 DAYS:
   - Return a complete array with exactly 7 day objects
   - Days 1-7 corresponding to Monday-Sunday
   - Each day must have dayNumber (1-7) and dayName

2. REST DAYS:
   - Mark rest days with isRestDay: true
   - Rest days should have empty exercises array
   - No sessionName or exercises for rest days

3. TRAINING DAYS (${trainingDays.length} days):
   For each training day:
   - Generate exactly 5-7 unique exercises
   - Each exercise must have:
     * exerciseId (kebab-case, e.g., "barbell-bench-press")
     * name (full exercise name)
     * sets (number)
     * reps (string, e.g., "8-12", "5", "10-15")
     * restSeconds (90-180 for compounds, 60-90 for isolation)
     * order (1, 2, 3, etc.)
     * notes (coaching cues)
     * primaryMuscles (array of muscle groups)

4. EXERCISE VARIATION FOR SIMILAR DAYS:
   ⚠️ CRITICAL: If multiple days target the same muscle groups (e.g., two "push" days):
   - Each day MUST use DIFFERENT exercises
   - Vary movement patterns (e.g., barbell vs dumbbell, flat vs incline)
   - Vary angles and grips
   - Vary rep ranges slightly
   - Example:
     * Push Day 1: Barbell Bench Press, Incline Dumbbell Press, Cable Flyes
     * Push Day 2: Dumbbell Bench Press, Decline Barbell Press, Pec Deck Flyes

5. EXERCISE SELECTION PRINCIPLES:
   - Start with compound movements (multi-joint exercises)
   - Progress to isolation exercises
   - Match exercises to user's experience level (${userLevel})
   - Use realistic equipment: barbells, dumbbells, cables, machines, bodyweight
   - Ensure proper muscle group coverage per the split

6. SETS AND REPS BY PHASE:
   - Foundation: 3-4 sets, 8-12 reps (hypertrophy focus)
   - Progression: 3-5 sets, 6-10 reps (strength-hypertrophy)
   - Peak: 4-6 sets, 4-8 reps (strength focus)

7. PROGRESSIVE PROGRAMMING:
   - Order exercises from most to least demanding
   - Manage fatigue appropriately
   - Consider muscle group overlap and recovery
   - Balance push/pull/legs throughout the week

8. VOLUME TARGETS:
   - Per muscle group per week: 10-20 sets (depends on split)
   - Per session: 15-25 total sets
   - Adjust for user level (${userLevel})

9. SESSION NAMING:
   - Use industry-standard names (e.g., "Upper Body Hypertrophy", "Push Day", "Leg Strength")
   - Do NOT include phase names or weekday names in session titles
   - Be specific and descriptive

10. REASONING AND VALIDATION:
    - Explain your exercise selection rationale
    - Verify all muscle groups are adequately trained
    - Ensure exercise variety across similar training days
    - Confirm recovery is adequate between similar muscle groups

EXAMPLE OUTPUT STRUCTURE:
{
  "weekNumber": ${weeklyOutline.weekNumber},
  "phase": "${trainingPhase}",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "isRestDay": false,
      "sessionName": "Upper Body Push",
      "exercises": [
        {
          "exerciseId": "barbell-bench-press",
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "6-8",
          "restSeconds": 180,
          "order": 1,
          "notes": "Control the descent, explosive press",
          "primaryMuscles": ["chest", "triceps", "shoulders"]
        },
        // ... 4-6 more exercises
      ],
      "estimatedDuration": 60,
      "totalVolume": {
        "totalSets": 20,
        "setsPerMuscleGroup": { "chest": 12, "triceps": 8, "shoulders": 6 }
      }
    },
    // ... 6 more days
  ],
  "weeklyVolume": {
    "totalSets": 100,
    "setsPerMuscleGroup": { "chest": 15, "back": 15, "legs": 20, ... }
  },
  "progressionNotes": "Week ${weeklyOutline.weekNumber} focuses on building foundation strength...",
  "reasoning": "Exercise selection prioritized compound movements..."
}

Think step-by-step through the entire week:
1. Review the split structure and identify training days
2. For each training day, determine the muscle groups to target
3. Select 5-7 exercises per training day ensuring variation when days have similar focus
4. Assign sets, reps, and rest periods based on phase and exercise type
5. Order exercises from most to least demanding
6. Calculate total weekly volume and ensure balance
7. Verify exercise uniqueness across similar training days
8. Generate clear session names and coaching notes

Generate the complete 7-day workout program now.`;
  }

  /**
   * Build summary of previous week's workouts
   */
  private buildPreviousWeekSummary(previousWeekSessions?: SessionTemplate[]): string {
    if (!previousWeekSessions || previousWeekSessions.length === 0) {
      return 'PREVIOUS WEEK: No previous week data available (this is Week 1).\n';
    }

    const exerciseList = previousWeekSessions
      .flatMap(session =>
        session.structure.map(ex => ex.name)
      )
      .filter((name, index, arr) => arr.indexOf(name) === index) // unique
      .slice(0, 30); // limit to 30 exercises

    const summary = `PREVIOUS WEEK EXERCISES (avoid repeating these):
${exerciseList.map(ex => `  - ${ex}`).join('\n')}

⚠️ IMPORTANT: Provide exercise variation from last week. If you used "Barbell Bench Press" last week, consider "Dumbbell Bench Press" or "Incline Barbell Press" this week.
`;

    return summary;
  }

  /**
   * Convert WeeklyWorkoutPlan to SessionTemplate[]
   */
  private convertToSessionTemplates(
    weeklyPlan: WeeklyWorkoutPlan,
    weeklyOutline: WeeklyOutline,
    trainingSplit: TrainingSplit
  ): SessionTemplate[] {
    const sessionTemplates: SessionTemplate[] = [];

    for (const day of weeklyPlan.days) {
      // Skip rest days
      if (day.isRestDay || !day.exercises || day.exercises.length === 0) {
        continue;
      }

      // Find corresponding split day
      const splitDay = trainingSplit.days.find(d => d.dayNumber === day.dayNumber);
      const targetMuscles = splitDay?.focus || ['full_body'];

      // Create unique template ID
      const templateId = `${this.slugify(weeklyPlan.phase)}-${this.slugify(day.dayName)}-w${weeklyPlan.weekNumber}-d${day.dayNumber}`;

      const sessionTemplate: SessionTemplate = {
        templateId,
        name: day.sessionName || `${day.dayName} Session`,
        targetMuscles,
        totalDurationMinutes: day.estimatedDuration || this.estimateDuration(day.exercises),
        structure: day.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          targetMuscles: ex.primaryMuscles || targetMuscles,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds || this.getDefaultRest(ex.reps),
          notes: ex.notes || '',
        })),
      };

      sessionTemplates.push(sessionTemplate);
    }

    // Validate we generated the expected number of sessions
    const expectedSessions = trainingSplit.days.filter(d => !d.isRestDay).length;
    if (sessionTemplates.length !== expectedSessions) {
      console.warn(
        `⚠️ Expected ${expectedSessions} sessions but generated ${sessionTemplates.length}. Some training days may be missing.`
      );
    }

    // Validate no duplicate sessions
    this.validateNoDuplicateSessions(sessionTemplates, trainingSplit);

    return sessionTemplates;
  }

  /**
   * Validate no duplicate sessions exist
   */
  private validateNoDuplicateSessions(
    sessionTemplates: SessionTemplate[],
    trainingSplit: TrainingSplit
  ): void {
    const sessionsByFocus = new Map<string, SessionTemplate[]>();

    // Group sessions by their focus
    for (const session of sessionTemplates) {
      const focusKey = session.targetMuscles.sort().join(',');
      if (!sessionsByFocus.has(focusKey)) {
        sessionsByFocus.set(focusKey, []);
      }
      sessionsByFocus.get(focusKey)!.push(session);
    }

    // Check for duplicates in sessions with same focus
    for (const [focusKey, sessions] of sessionsByFocus.entries()) {
      if (sessions.length > 1) {
        // Multiple sessions with same focus - check if they have different exercises
        for (let i = 0; i < sessions.length - 1; i++) {
          for (let j = i + 1; j < sessions.length; j++) {
            const session1 = sessions[i];
            const session2 = sessions[j];

            const exercises1 = new Set(session1.structure.map(e => this.normalizeExerciseName(e.name || '')));
            const exercises2 = new Set(session2.structure.map(e => this.normalizeExerciseName(e.name || '')));

            // Calculate overlap
            const overlap = [...exercises1].filter(ex => exercises2.has(ex));
            const overlapPercentage = (overlap.length / Math.max(exercises1.size, exercises2.size)) * 100;

            if (overlapPercentage > 70) {
              console.warn(
                `⚠️ HIGH SIMILARITY DETECTED between sessions:\n` +
                `   - "${session1.name}" (${session1.templateId})\n` +
                `   - "${session2.name}" (${session2.templateId})\n` +
                `   Focus: ${focusKey}\n` +
                `   Overlap: ${overlapPercentage.toFixed(1)}% (${overlap.length}/${Math.max(exercises1.size, exercises2.size)} exercises)\n` +
                `   Overlapping exercises: ${overlap.join(', ')}`
              );
            }
          }
        }
      }
    }

    // Check for duplicate templateIds (should never happen but defensive)
    const templateIds = new Set<string>();
    for (const session of sessionTemplates) {
      if (templateIds.has(session.templateId)) {
        throw new Error(`Duplicate templateId detected: ${session.templateId}`);
      }
      templateIds.add(session.templateId);
    }
  }

  /**
   * Normalize exercise name for comparison
   */
  private normalizeExerciseName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(barbell|dumbbell|cable|machine|smith|ez-bar|ez)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Estimate session duration from exercises
   */
  private estimateDuration(exercises: z.infer<typeof ExerciseSchema>[]): number {
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
    // Estimate: ~2.25 minutes per set (includes rest) + 10 min warmup/cooldown
    return Math.round((totalSets * 2.25) + 10);
  }

  /**
   * Get default rest period based on rep range
   */
  private getDefaultRest(reps: string): number {
    const repCount = this.parseRepRange(reps);
    if (repCount <= 5) return 180; // Heavy strength work
    if (repCount <= 12) return 90; // Hypertrophy work
    return 60; // Higher rep work
  }

  /**
   * Parse rep range to get average
   */
  private parseRepRange(reps: string): number {
    const match = reps.match(/(\d+)(?:-(\d+))?/);
    if (!match) return 10;
    const low = parseInt(match[1]);
    const high = match[2] ? parseInt(match[2]) : low;
    return (low + high) / 2;
  }

  /**
   * Slugify text for IDs
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
