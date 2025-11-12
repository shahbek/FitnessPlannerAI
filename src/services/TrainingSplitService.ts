/**
 * Training Split Service
 *
 * Determines optimal training split based on user goals and weekly guidance.
 * Fully AI-driven with minimal post-processing.
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';

/**
 * Training Split Schema
 */
export const TrainingSplitSchema = z.object({
  splitName: z.string(),
  daysPerWeek: z.number(),
  days: z.array(
    z.object({
      dayNumber: z.number(),
      dayName: z.string(),
      focus: z.array(z.string()),
      isRestDay: z.boolean(),
      isCardioDay: z.boolean(),
    })
  ),
  reasoning: z.string().optional(),
});

export type TrainingSplit = z.infer<typeof TrainingSplitSchema>;

const MAX_SPLIT_ATTEMPTS = 3;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export class TrainingSplitService {
  private cotService?: ChainOfThoughtService;

  constructor(cotService?: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  async determineSplit(
    userProfile: UserProfile,
    weeklyOutlines?: WeeklyOutline[]
  ): Promise<TrainingSplit> {
    if (!this.cotService || !this.cotService.isAIAvailable()) {
      throw new Error('AI service is required to determine the training split. Configure an AI API key.');
    }

    let issues: string[] = [];

    for (let attempt = 1; attempt <= MAX_SPLIT_ATTEMPTS; attempt++) {
      const split = await this.generateSplitAttempt(userProfile, weeklyOutlines, issues);
      const validationIssues = this.validateSplit(split, userProfile);

      if (validationIssues.length === 0) {
        return split;
      }

      console.warn(`⚠️  Training split validation failed (attempt ${attempt}):`, validationIssues);
      issues = validationIssues;
    }

    // If all attempts fail, create a simple fallback
    console.error('❌ Failed to generate valid split after all attempts. Using fallback.');
    return this.createFallbackSplit(userProfile);
  }

  private async generateSplitAttempt(
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[] | undefined,
    previousIssues: string[]
  ): Promise<TrainingSplit> {
    const prompt = this.buildSplitPrompt(userProfile, weeklyOutlines, previousIssues);

    const { result } = await this.cotService!.generateWithCoT(
      prompt,
      TrainingSplitSchema,
      { enableVerification: true }
    );

    return result;
  }

  private buildSplitPrompt(
    userProfile: UserProfile,
    weeklyOutlines?: WeeklyOutline[],
    previousIssues?: string[]
  ): string {
    const splitPreference = userProfile.workoutSplit
      ? this.getSplitDisplayName(userProfile.workoutSplit)
      : 'coach recommended';

    const weeklyGuidance = weeklyOutlines && weeklyOutlines.length > 0
      ? weeklyOutlines
          .map(
            (outline) =>
              `Week ${outline.weekNumber} (${outline.phase}): ${outline.objectives?.join(', ') || 'Maintain progression'}`
          )
          .join('\n')
      : 'No specific weekly objectives provided.';

    const issueSection =
      previousIssues && previousIssues.length > 0
        ? `\n⚠️ CRITICAL - Previous attempt had these validation errors. You MUST fix ALL of them:\n${previousIssues
            .map((issue, i) => `${i + 1}. ${issue}`)
            .join('\n')}\n`
        : '';

    return `Generate a training split for this user. Return ONLY the structured split data.

USER PROFILE:
- Training frequency: ${userProfile.trainingDaysPerWeek} days per week
- Experience: ${userProfile.workoutLevel}
- Goal: ${userProfile.goal}
- Equipment: ${userProfile.equipment}
- Preferred split: ${splitPreference}
- Schedule: ${userProfile.schedule || 'Flexible'}

WEEKLY PLAN CONTEXT:
${weeklyGuidance}
${issueSection}

STRICT REQUIREMENTS (you MUST satisfy ALL of these):
1. Generate EXACTLY 7 days (Monday through Sunday) in order
2. Each day must have dayNumber (1-7) and dayName (Monday-Sunday)
3. EXACTLY ${userProfile.trainingDaysPerWeek} training days (isRestDay: false)
4. AT LEAST 1 rest day (isRestDay: true)
5. Rest days must have empty focus array: []
6. Training days must have focus array with muscle groups/workout type
7. The split MUST match the user's preference: ${splitPreference}
   - If "Full Body Split": ALL training days should focus on full body workouts
   - If "Upper Lower Split": Alternate between upper and lower body
   - If "Push Pull Legs Split": Rotate through push, pull, and legs
   - If "Body Part Split": Each day targets specific muscle groups
8. Do NOT add extra rest days beyond what's needed

EXAMPLES OF CORRECT FOCUS VALUES:
- Full Body Split: ["Full Body"]
- Upper Lower: ["Upper Body"] or ["Lower Body"]
- Push Pull Legs: ["Push"], ["Pull"], or ["Legs"]
- Body Part Split: ["Chest", "Triceps"], ["Back", "Biceps"], ["Legs"], ["Shoulders"]

Think through your split design step-by-step, then return the complete 7-day split.`;
  }

  private validateSplit(split: TrainingSplit, userProfile: UserProfile): string[] {
    const issues: string[] = [];

    // Structural validation only
    if (!split.days || split.days.length !== 7) {
      issues.push(`Split must have exactly 7 days. Found ${split.days?.length || 0}.`);
      return issues; // Critical error, no point checking further
    }

    // Check day structure
    const dayNames = split.days.map(d => d.dayName);
    const expectedDays = DAY_NAMES;
    const missingDays = expectedDays.filter(day => 
      !dayNames.some(name => name.toLowerCase() === day.toLowerCase())
    );
    if (missingDays.length > 0) {
      issues.push(`Missing days: ${missingDays.join(', ')}`);
    }

    // Count training days
    const trainingDays = split.days.filter((d) => !d.isRestDay);
    if (trainingDays.length !== userProfile.trainingDaysPerWeek) {
      issues.push(
        `Split has ${trainingDays.length} training days but user requires exactly ${userProfile.trainingDaysPerWeek}.`
      );
    }

    // Ensure at least one rest day
    const restDays = split.days.filter((d) => d.isRestDay);
    if (restDays.length < 1) {
      issues.push('Split must include at least 1 rest day for recovery.');
    }

    // Check that rest days have no focus
    const restDaysWithFocus = split.days.filter(d => d.isRestDay && d.focus.length > 0);
    if (restDaysWithFocus.length > 0) {
      issues.push(`Rest days should not have focus areas. Found focus on: ${restDaysWithFocus.map(d => d.dayName).join(', ')}`);
    }

    // Check that training days have focus
    const trainingDaysNoFocus = split.days.filter(d => !d.isRestDay && (!d.focus || d.focus.length === 0));
    if (trainingDaysNoFocus.length > 0) {
      issues.push(`Training days must have focus areas. Missing focus on: ${trainingDaysNoFocus.map(d => d.dayName).join(', ')}`);
    }

    return issues;
  }

  private createFallbackSplit(userProfile: UserProfile): TrainingSplit {
    const trainingDays = userProfile.trainingDaysPerWeek;
    const preferredSlots = this.getPreferredTrainingSlots(trainingDays);
    const focusPattern = this.getFallbackFocusPattern(userProfile.workoutSplit, trainingDays);
    
    let focusIndex = 0;
    const days = DAY_NAMES.map((dayName, index) => {
      const isTrainingDay = preferredSlots.includes(index);
      
      if (isTrainingDay) {
        const focus = [focusPattern[focusIndex % focusPattern.length]];
        focusIndex++;
        return {
          dayNumber: index + 1,
          dayName,
          focus,
          isRestDay: false,
          isCardioDay: false,
        };
      }
      
      return {
        dayNumber: index + 1,
        dayName,
        focus: [],
        isRestDay: true,
        isCardioDay: false,
      };
    });

    return {
      splitName: `${this.getSplitDisplayName(userProfile.workoutSplit)} (Fallback)`,
      daysPerWeek: trainingDays,
      days,
      reasoning: 'Automatically generated fallback split due to validation failures.',
    };
  }

  private getPreferredTrainingSlots(trainingDays: number): number[] {
    const slotPresets: Record<number, number[]> = {
      1: [2], // Wednesday
      2: [1, 4], // Tuesday, Friday
      3: [0, 2, 4], // Monday, Wednesday, Friday
      4: [0, 1, 3, 5], // Monday, Tuesday, Thursday, Saturday
      5: [0, 1, 3, 4, 6], // Monday, Tuesday, Thursday, Friday, Sunday
      6: [0, 1, 2, 4, 5, 6], // Rest Thursday
    };

    return slotPresets[trainingDays] || [0, 2, 4]; // Default to MWF
  }

  private getFallbackFocusPattern(
    splitPreference: UserProfile['workoutSplit'],
    trainingDays: number
  ): string[] {
    switch (splitPreference) {
      case 'full_body':
        return Array(trainingDays).fill('Full Body');
      
      case 'upper_lower':
        return this.repeatPattern(['Upper Body', 'Lower Body'], trainingDays);
      
      case 'push_pull_legs':
        return this.repeatPattern(['Push', 'Pull', 'Legs'], trainingDays);
      
      case 'body_part':
        return this.repeatPattern(
          ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders', 'Arms'],
          trainingDays
        );
      
      default:
        return Array(trainingDays).fill('Full Body');
    }
  }

  private repeatPattern(pattern: string[], total: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < total; i++) {
      result.push(pattern[i % pattern.length]);
    }
    return result;
  }

  private getSplitDisplayName(splitPreference: UserProfile['workoutSplit']): string {
    const displayMap: Record<UserProfile['workoutSplit'], string> = {
      full_body: 'Full Body Split',
      upper_lower: 'Upper Lower Split',
      push_pull_legs: 'Push Pull Legs Split',
      body_part: 'Body Part Split',
      custom: 'Custom Split',
    };

    return displayMap[splitPreference] || 'Custom Split';
  }
}