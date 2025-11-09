/**
 * Training Split Service
 * 
 * Determines optimal training split based on user goals and preferences
 * Supports both LLM-based and rule-based approaches
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { UserProfile } from '../models/UserProfile';

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
      focus: z.array(z.string()), // Muscle groups or training type
      isRestDay: z.boolean(),
      isCardioDay: z.boolean(),
    })
  ),
  reasoning: z.string().optional(),
});

export type TrainingSplit = z.infer<typeof TrainingSplitSchema>;

/**
 * Common Training Split Templates
 */
export const TRAINING_SPLIT_TEMPLATES: Record<string, TrainingSplit> = {
  'upper-lower-4': {
    splitName: 'Upper/Lower 4-Day',
    daysPerWeek: 4,
    days: [
      { dayNumber: 1, dayName: 'Monday', focus: ['chest', 'back', 'shoulders', 'arms'], isRestDay: false, isCardioDay: false },
      { dayNumber: 2, dayName: 'Tuesday', focus: ['quads', 'hamstrings', 'glutes', 'calves'], isRestDay: false, isCardioDay: false },
      { dayNumber: 3, dayName: 'Wednesday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 4, dayName: 'Thursday', focus: ['chest', 'back', 'shoulders', 'arms'], isRestDay: false, isCardioDay: false },
      { dayNumber: 5, dayName: 'Friday', focus: ['quads', 'hamstrings', 'glutes', 'calves'], isRestDay: false, isCardioDay: false },
      { dayNumber: 6, dayName: 'Saturday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false },
    ],
    reasoning: 'Classic upper/lower split with 4 training days',
  },
  'push-pull-legs-6': {
    splitName: 'Push/Pull/Legs 6-Day',
    daysPerWeek: 6,
    days: [
      { dayNumber: 1, dayName: 'Monday', focus: ['chest', 'shoulders', 'triceps'], isRestDay: false, isCardioDay: false },
      { dayNumber: 2, dayName: 'Tuesday', focus: ['back', 'biceps'], isRestDay: false, isCardioDay: false },
      { dayNumber: 3, dayName: 'Wednesday', focus: ['quads', 'hamstrings', 'glutes', 'calves'], isRestDay: false, isCardioDay: false },
      { dayNumber: 4, dayName: 'Thursday', focus: ['chest', 'shoulders', 'triceps'], isRestDay: false, isCardioDay: false },
      { dayNumber: 5, dayName: 'Friday', focus: ['back', 'biceps'], isRestDay: false, isCardioDay: false },
      { dayNumber: 6, dayName: 'Saturday', focus: ['quads', 'hamstrings', 'glutes', 'calves'], isRestDay: false, isCardioDay: false },
      { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false },
    ],
    reasoning: 'Push/pull/legs split with 6 training days, rotating twice per week',
  },
  'full-body-3': {
    splitName: 'Full Body 3-Day',
    daysPerWeek: 3,
    days: [
      { dayNumber: 1, dayName: 'Monday', focus: ['full body'], isRestDay: false, isCardioDay: false },
      { dayNumber: 2, dayName: 'Tuesday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 3, dayName: 'Wednesday', focus: ['full body'], isRestDay: false, isCardioDay: false },
      { dayNumber: 4, dayName: 'Thursday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 5, dayName: 'Friday', focus: ['full body'], isRestDay: false, isCardioDay: false },
      { dayNumber: 6, dayName: 'Saturday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false },
    ],
    reasoning: 'Full body training 3 days per week with rest days in between',
  },
  'bro-split-5': {
    splitName: 'Bro Split 5-Day',
    daysPerWeek: 5,
    days: [
      { dayNumber: 1, dayName: 'Monday', focus: ['chest'], isRestDay: false, isCardioDay: false },
      { dayNumber: 2, dayName: 'Tuesday', focus: ['back'], isRestDay: false, isCardioDay: false },
      { dayNumber: 3, dayName: 'Wednesday', focus: ['shoulders'], isRestDay: false, isCardioDay: false },
      { dayNumber: 4, dayName: 'Thursday', focus: ['arms'], isRestDay: false, isCardioDay: false },
      { dayNumber: 5, dayName: 'Friday', focus: ['legs'], isRestDay: false, isCardioDay: false },
      { dayNumber: 6, dayName: 'Saturday', focus: [], isRestDay: true, isCardioDay: false },
      { dayNumber: 7, dayName: 'Sunday', focus: [], isRestDay: true, isCardioDay: false },
    ],
    reasoning: 'One muscle group per day, 5 days per week',
  },
};

/**
 * Training Split Service
 */
export class TrainingSplitService {
  private cotService?: ChainOfThoughtService;

  constructor(cotService?: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  /**
   * Determine training split for user
   */
  async determineSplit(
    userProfile: UserProfile,
    useLLM: boolean = true
  ): Promise<TrainingSplit> {
    if (useLLM && this.cotService) {
      return this.determineSplitWithLLM(userProfile);
    } else {
      return this.determineSplitRuleBased(userProfile);
    }
  }

  /**
   * Determine split using LLM with CoT
   */
  private async determineSplitWithLLM(
    userProfile: UserProfile
  ): Promise<TrainingSplit> {
    if (!this.cotService) {
      throw new Error('CoT service not available');
    }

    const prompt = this.buildSplitPrompt(userProfile);

    const { result } = await this.cotService.generateWithCoT(
      prompt,
      TrainingSplitSchema,
      {
        enableVerification: true,
      }
    );

    // Validate the split
    this.validateSplit(result, userProfile);

    return result;
  }

  /**
   * Build prompt for split determination
   */
  private buildSplitPrompt(userProfile: UserProfile): string {
    return `Determine the optimal training split for this user.

User Profile:
- Training days per week: ${userProfile.trainingDaysPerWeek}
- Experience level: ${userProfile.workoutLevel}
- Goal: ${userProfile.goal}
- Equipment: ${userProfile.equipment}
- Schedule availability: ${userProfile.schedule || 'Flexible'}

Think step by step:
1. Consider the user's training frequency (${userProfile.trainingDaysPerWeek} days/week)
2. Determine appropriate split based on experience level (${userProfile.workoutLevel})
3. Consider recovery needs (at least 1-2 rest days per week)
4. Ensure proper muscle group distribution throughout the week
5. Account for goal (${userProfile.goal})

Generate a training split that:
- Matches the ${userProfile.trainingDaysPerWeek} days/week requirement
- Includes appropriate rest days
- Distributes muscle groups effectively
- Supports the user's goals

Return a structured training split.`;
  }

  /**
   * Determine split using rule-based templates
   */
  private determineSplitRuleBased(userProfile: UserProfile): TrainingSplit {
    const daysPerWeek = userProfile.trainingDaysPerWeek || 4;

    // Select appropriate template based on days per week
    let templateKey: string;
    switch (daysPerWeek) {
      case 3:
        templateKey = 'full-body-3';
        break;
      case 4:
        templateKey = 'upper-lower-4';
        break;
      case 5:
        templateKey = 'bro-split-5';
        break;
      case 6:
        templateKey = 'push-pull-legs-6';
        break;
      default:
        // Default to upper/lower 4-day
        templateKey = 'upper-lower-4';
    }

    const template = TRAINING_SPLIT_TEMPLATES[templateKey];

    // Adjust based on user preferences
    if (userProfile.goal?.toLowerCase().includes('strength')) {
      // For strength, prefer upper/lower or full body
      if (daysPerWeek <= 4) {
        return TRAINING_SPLIT_TEMPLATES['upper-lower-4'];
      }
    }

    if (userProfile.goal?.toLowerCase().includes('hypertrophy')) {
      // For hypertrophy, prefer push/pull/legs or bro split
      if (daysPerWeek >= 5) {
        return TRAINING_SPLIT_TEMPLATES['push-pull-legs-6'];
      }
    }

    // Customize based on schedule if provided
    if (userProfile.schedule) {
      return this.customizeSplitForSchedule(template, userProfile.schedule);
    }

    return template;
  }

  /**
   * Customize split based on schedule
   */
  private customizeSplitForSchedule(
    template: TrainingSplit,
    schedule: string
  ): TrainingSplit {
    // Parse schedule to determine available days
    // For now, return template as-is (can be enhanced later)
    return template;
  }

  /**
   * Validate training split
   */
  private validateSplit(
    split: TrainingSplit,
    userProfile: UserProfile
  ): void {
    const trainingDays = split.days.filter(d => !d.isRestDay);
    
    if (trainingDays.length !== userProfile.trainingDaysPerWeek) {
      throw new Error(
        `Split has ${trainingDays.length} training days but user requires ${userProfile.trainingDaysPerWeek}`
      );
    }

    const restDays = split.days.filter(d => d.isRestDay);
    if (restDays.length < 1) {
      throw new Error('Split must include at least one rest day');
    }

    // Check for consecutive heavy training days on same muscle groups
    for (let i = 0; i < split.days.length - 1; i++) {
      const current = split.days[i];
      const next = split.days[i + 1];

      if (!current.isRestDay && !next.isRestDay) {
        const overlap = current.focus.filter(f => next.focus.includes(f));
        if (overlap.length > 0 && current.focus.length <= 2) {
          // Warning: consecutive days hitting same muscle group
          console.warn(
            `Warning: Consecutive training days on ${overlap.join(', ')} may affect recovery`
          );
        }
      }
    }
  }

  /**
   * Get split template by name
   */
  getSplitTemplate(name: string): TrainingSplit | undefined {
    const key = Object.keys(TRAINING_SPLIT_TEMPLATES).find(
      k => TRAINING_SPLIT_TEMPLATES[k].splitName === name
    );
    return key ? TRAINING_SPLIT_TEMPLATES[key] : undefined;
  }

  /**
   * List available split templates
   */
  listAvailableTemplates(): string[] {
    return Object.keys(TRAINING_SPLIT_TEMPLATES);
  }
}

