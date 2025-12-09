/**
 * Training Split Service
 *
 * Determines optimal training split based on user goals and weekly guidance.
 * Fully AI-driven with minimal post-processing and advanced optimization.
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';

/**
 * Training Split Schema with enhanced metadata
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
      intensity: z.enum(['low', 'moderate', 'high']).optional(),
      estimatedDuration: z.number().optional(), // minutes
      primaryMuscleGroups: z.array(z.string()).optional(),
      secondaryMuscleGroups: z.array(z.string()).optional(),
    })
  ),
  reasoning: z.string().optional(),
  periodizationNotes: z.string().optional(),
  recoveryStrategy: z.string().optional(),
  progressionGuidelines: z.string().optional(),
});

export type TrainingSplit = z.infer<typeof TrainingSplitSchema>;

/**
 * Split quality metrics for monitoring AI performance
 */
interface SplitQualityMetrics {
  structuralScore: number; // 0-100
  recoveryScore: number; // 0-100
  balanceScore: number; // 0-100
  overallScore: number; // 0-100
  warnings: string[];
  suggestions: string[];
}

const MAX_SPLIT_ATTEMPTS = 3;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Quality thresholds
const QUALITY_THRESHOLD = 70; // Minimum acceptable overall quality score
const ENABLE_QUALITY_CHECKS = true; // Toggle for quality validation

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
    let bestSplit: TrainingSplit | null = null;
    let bestScore = 0;

    for (let attempt = 1; attempt <= MAX_SPLIT_ATTEMPTS; attempt++) {
      const split = await this.generateSplitAttempt(userProfile, weeklyOutlines, issues, attempt);
      const validationIssues = this.validateSplit(split, userProfile);

      if (validationIssues.length === 0) {
        // Passed structural validation
        if (ENABLE_QUALITY_CHECKS) {
          const qualityMetrics = this.assessSplitQuality(split, userProfile);
          console.log(`✓ Split attempt ${attempt} - Quality Score: ${qualityMetrics.overallScore}/100`);
          
          // Track best split
          if (qualityMetrics.overallScore > bestScore) {
            bestScore = qualityMetrics.overallScore;
            bestSplit = split;
          }

          // If quality is excellent, return immediately
          if (qualityMetrics.overallScore >= 90) {
            console.log('✓ Excellent quality split generated!');
            return this.applySchedulePreference(split, userProfile);
          }

          // If quality is acceptable and we're on last attempt, use it
          if (qualityMetrics.overallScore >= QUALITY_THRESHOLD || attempt === MAX_SPLIT_ATTEMPTS) {
            if (qualityMetrics.warnings.length > 0) {
              console.warn('⚠️  Split quality warnings:', qualityMetrics.warnings);
            }
            return this.applySchedulePreference(split, userProfile);
          }

          // Quality too low, try again with feedback
          issues = [
            ...qualityMetrics.warnings,
            ...qualityMetrics.suggestions,
          ];
        } else {
          return this.applySchedulePreference(split, userProfile);
        }
      } else {
        console.warn(`⚠️  Training split validation failed (attempt ${attempt}):`, validationIssues);
        issues = validationIssues;
      }
    }

    // Return best AI-generated split if we have one
    if (bestSplit) {
      console.warn(`⚠️  Using best available AI split from attempts (score: ${bestScore}/100)`);
      return this.applySchedulePreference(bestSplit, userProfile);
    }

    const failureMessage = 'Failed to generate a valid training split after multiple AI attempts. Please adjust profile inputs or try again.';
    console.error(`❌ ${failureMessage}`);
    throw new Error(failureMessage);
  }

  private async generateSplitAttempt(
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[] | undefined,
    previousIssues: string[],
    attemptNumber: number
  ): Promise<TrainingSplit> {
    const prompt = this.buildSplitPrompt(userProfile, weeklyOutlines, previousIssues, attemptNumber);

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
    previousIssues?: string[],
    attemptNumber?: number
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
        ? `\n⚠️ CRITICAL - Previous attempt had these issues. You MUST address ALL of them:\n${previousIssues
            .map((issue, i) => `${i + 1}. ${issue}`)
            .join('\n')}\n`
        : '';

    const attemptGuidance = attemptNumber && attemptNumber > 1
      ? `\n📍 This is attempt ${attemptNumber}/${MAX_SPLIT_ATTEMPTS}. Focus on quality and precision.\n`
      : '';

    // Advanced context for experienced users
    const advancedContext = userProfile.workoutLevel === 'advanced'
      ? `\n💪 ADVANCED USER CONSIDERATIONS:
- Consider periodization and progressive overload principles
- Include strategic deload planning if applicable
- Optimize volume distribution across the week
- Consider adding intensity specifications (low/moderate/high)
- Think about muscle group overlap and synergies\n`
      : '';

    return `You are an expert strength coach designing a training split. Generate a high-quality, scientifically sound training split.

USER PROFILE:
- Training frequency: ${userProfile.trainingDaysPerWeek} days per week
- Experience: ${userProfile.workoutLevel}
- Goal: ${userProfile.goal}
- Equipment: ${userProfile.equipment}
- Preferred split: ${splitPreference}
- Schedule: ${userProfile.schedule || 'Flexible'}
- Body stats: ${userProfile.heightCm}cm, ${userProfile.weightKg}kg, ${userProfile.bodyFat ? userProfile.bodyFat + '%' : 'N/A'} BF

WEEKLY PLAN CONTEXT:
${weeklyGuidance}${advancedContext}${attemptGuidance}${issueSection}

MANDATORY STRUCTURAL REQUIREMENTS:
1. Generate EXACTLY 7 days (Monday through Sunday) in order
2. Each day must have dayNumber (1-7) and dayName (Monday-Sunday)
3. EXACTLY ${userProfile.trainingDaysPerWeek} training days (isRestDay: false)
4. AT LEAST 1 rest day (isRestDay: true) - unless user specified 7 training days
5. Rest days: empty focus array []
6. Training days: focus array with specific muscle groups/workout types
${userProfile.schedule ? `
⚠️ CRITICAL - USER'S TRAINING SCHEDULE (MUST FOLLOW):
The user has specified their availability: "${userProfile.schedule}"
- These are the ONLY days the user can train
- Mark these days as training days (isRestDay: false)
- Mark all other days as rest days (isRestDay: true)
- The user's schedule takes PRIORITY over any default patterns` : ''}

SPLIT-SPECIFIC GUIDELINES:
${this.getSplitGuidelines(userProfile.workoutSplit, userProfile.trainingDaysPerWeek)}

QUALITY FACTORS (aim for excellence):
- Recovery: Space out similar muscle groups (48-72 hours ideal)
- Balance: Ensure proportional volume across push/pull/legs movements
- Periodization: Consider weekly progression if context provided
- Practicality: Realistic session durations (45-90 minutes typical)
- Intensity distribution: Mix high/moderate/low intensity days appropriately

OPTIONAL ENHANCEMENTS (highly recommended):
- intensity: 'low' | 'moderate' | 'high' for each training day
- estimatedDuration: Session length in minutes
- primaryMuscleGroups: Main muscle groups targeted
- secondaryMuscleGroups: Secondary muscle groups involved
- periodizationNotes: How this split supports progression
- recoveryStrategy: Recovery considerations for this split
- progressionGuidelines: How to progress over weeks

EXAMPLES OF EXCELLENT FOCUS VALUES:
- Full Body: ["Full Body Strength"], ["Full Body Hypertrophy"], ["Full Body Power"]
- Upper/Lower: ["Upper Body Push Focus"], ["Lower Body Quad Dominant"], ["Upper Body Pull Focus"]
- Push/Pull/Legs: ["Push (Chest & Shoulders)"], ["Pull (Back & Biceps)"], ["Legs (Quads & Glutes)"]
- Body Part: ["Chest & Triceps"], ["Back & Rear Delts"], ["Legs (Quads)"], ["Shoulders & Abs"]

Think step-by-step through your split design considering recovery, balance, and the user's goals. Then return a complete, high-quality 7-day training split.`;
  }

  private getSplitGuidelines(
    splitPreference: UserProfile['workoutSplit'],
    trainingDays: number
  ): string {
    switch (splitPreference) {
      case 'full_body':
        return `Full Body Split Guidelines:
- Each training day works ALL major muscle groups
- Vary intensity and volume across sessions (e.g., Heavy/Light/Moderate)
- Space sessions with at least 1 rest day between workouts when possible
- Focus examples: "Full Body Strength", "Full Body Hypertrophy", "Full Body Conditioning"`;

      case 'upper_lower':
        return `Upper/Lower Split Guidelines:
- Alternate between upper and lower body sessions
- For ${trainingDays} days: ${trainingDays <= 4 ? 'Standard 2x upper, 2x lower pattern' : 'Consider 3 upper, 2 lower or 2 upper, 3 lower based on needs'}
- Upper sessions: Push + Pull movements
- Lower sessions: Quads, Hamstrings, Glutes, Calves
- Avoid back-to-back upper or lower days when possible`;

      case 'push_pull_legs':
        return `Push/Pull/Legs Split Guidelines:
- Rotate through Push → Pull → Legs pattern
- Push: Chest, Shoulders, Triceps
- Pull: Back, Biceps, Rear Delts
- Legs: Quads, Hamstrings, Glutes, Calves
- For ${trainingDays} days: ${trainingDays === 6 ? 'Run 2 FULL cycles (Push/Pull/Legs/Push/Pull/Legs)' : trainingDays === 3 ? '1 cycle exactly' : 'Repeat pattern as needed'}
- IMPORTANT: Use the user's schedule to determine WHICH days to train
- This is a proven and balanced approach`;

      case 'body_part':
        return `Body Part Split Guidelines:
- Each day focuses on 1-2 specific muscle groups
- Common pairings: Chest+Triceps, Back+Biceps, Shoulders+Abs, Legs
- Space similar movements (e.g., Chest and Shoulders need 48-72hr apart)
- Allow adequate recovery between sessions (48-72 hours per muscle group)
- Avoid training same muscle group on consecutive days`;

      case 'custom':
        return `Custom Split Guidelines:
- Design based on user's specific goals and preferences
- Ensure balanced volume across major muscle groups over the week
- Consider recovery and muscle group overlap
- Be creative but scientifically sound`;

      default:
        return `General Guidelines:
- Balance push/pull/legs movements across the week
- Provide adequate rest and recovery
- Consider the user's experience level and goals`;
    }
  }

  private assessSplitQuality(split: TrainingSplit, userProfile: UserProfile): SplitQualityMetrics {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let structuralScore = 100;
    let recoveryScore = 100;
    let balanceScore = 100;

    const trainingDays = split.days.filter(d => !d.isRestDay);

    // Recovery analysis
    const recoveryIssues = this.analyzeRecovery(split);
    if (recoveryIssues.length > 0) {
      recoveryScore -= recoveryIssues.length * 15;
      warnings.push(...recoveryIssues);
    }

    // Balance analysis
    const balanceIssues = this.analyzeBalance(split, userProfile);
    if (balanceIssues.length > 0) {
      balanceScore -= balanceIssues.length * 10;
      warnings.push(...balanceIssues);
    }

    // Enhancement suggestions
    const missingIntensity = trainingDays.filter(d => !d.intensity).length;
    if (missingIntensity > 0) {
      suggestions.push('Consider adding intensity levels (low/moderate/high) to training days for better planning');
      structuralScore -= 5;
    }

    const missingDuration = trainingDays.filter(d => !d.estimatedDuration).length;
    if (missingDuration > 0) {
      suggestions.push('Adding estimated session durations would help with time management');
      structuralScore -= 5;
    }

    if (!split.periodizationNotes) {
      suggestions.push('Periodization notes would enhance long-term progression planning');
      structuralScore -= 5;
    }

    const overallScore = Math.round(
      (structuralScore * 0.3 + recoveryScore * 0.4 + balanceScore * 0.3)
    );

    return {
      structuralScore: Math.max(0, structuralScore),
      recoveryScore: Math.max(0, recoveryScore),
      balanceScore: Math.max(0, balanceScore),
      overallScore: Math.max(0, overallScore),
      warnings,
      suggestions,
    };
  }

  private analyzeRecovery(split: TrainingSplit): string[] {
    const issues: string[] = [];
    const days = split.days;

    // Check for back-to-back training days without consideration
    let consecutiveTraining = 0;
    for (const day of days) {
      if (!day.isRestDay) {
        consecutiveTraining++;
        if (consecutiveTraining >= 4) {
          issues.push(`${consecutiveTraining} consecutive training days detected - recovery may be compromised`);
          break;
        }
      } else {
        consecutiveTraining = 0;
      }
    }

    // Check for muscle group overlap in consecutive days
    for (let i = 0; i < days.length - 1; i++) {
      const current = days[i];
      const next = days[i + 1];

      if (!current.isRestDay && !next.isRestDay) {
        const overlap = this.detectMuscleGroupOverlap(
          current.focus,
          next.focus,
          current.primaryMuscleGroups,
          next.primaryMuscleGroups
        );
        
        if (overlap.length > 0) {
          issues.push(
            `Potential overtraining: ${overlap.join(', ')} trained on ${current.dayName} and ${next.dayName}`
          );
        }
      }
    }

    return issues;
  }

  private analyzeBalance(split: TrainingSplit, userProfile: UserProfile): string[] {
    const issues: string[] = [];
    const trainingDays = split.days.filter(d => !d.isRestDay);

    // For specific split types, check adherence to pattern
    if (userProfile.workoutSplit === 'push_pull_legs' && trainingDays.length >= 3) {
      const hasPush = trainingDays.some(d => 
        d.focus.some(f => f.toLowerCase().includes('push'))
      );
      const hasPull = trainingDays.some(d => 
        d.focus.some(f => f.toLowerCase().includes('pull'))
      );
      const hasLegs = trainingDays.some(d => 
        d.focus.some(f => f.toLowerCase().includes('leg'))
      );

      if (!hasPush || !hasPull || !hasLegs) {
        issues.push('Push/Pull/Legs split should include all three movement patterns');
      }
    }

    if (userProfile.workoutSplit === 'upper_lower' && trainingDays.length >= 2) {
      const hasUpper = trainingDays.some(d => 
        d.focus.some(f => f.toLowerCase().includes('upper'))
      );
      const hasLower = trainingDays.some(d => 
        d.focus.some(f => f.toLowerCase().includes('lower'))
      );

      if (!hasUpper || !hasLower) {
        issues.push('Upper/Lower split should include both upper and lower body sessions');
      }
    }

    if (userProfile.workoutSplit === 'full_body') {
      const allFullBody = trainingDays.every(d => 
        d.focus.some(f => f.toLowerCase().includes('full'))
      );

      if (!allFullBody) {
        issues.push('Full Body split should have all training days targeting full body');
      }
    }

    return issues;
  }

  private detectMuscleGroupOverlap(
    focus1: string[],
    focus2: string[],
    primary1?: string[],
    primary2?: string[]
  ): string[] {
    const overlap: string[] = [];

    // Define muscle group relationships
    const muscleGroups: Record<string, string[]> = {
      push: ['chest', 'shoulder', 'tricep', 'pec', 'delt'],
      pull: ['back', 'bicep', 'lat', 'trap', 'rhomboid'],
      legs: ['quad', 'hamstring', 'glute', 'calf', 'leg'],
      chest: ['chest', 'pec', 'push'],
      shoulders: ['shoulder', 'delt', 'push'],
      back: ['back', 'lat', 'trap', 'pull'],
      arms: ['bicep', 'tricep', 'arm'],
    };

    // Combine all focus and primary muscle groups
    const allFocus1 = [...focus1, ...(primary1 || [])].map(f => f.toLowerCase());
    const allFocus2 = [...focus2, ...(primary2 || [])].map(f => f.toLowerCase());

    // Check for overlap
    for (const group1 of allFocus1) {
      for (const [category, keywords] of Object.entries(muscleGroups)) {
        if (keywords.some(k => group1.includes(k))) {
          for (const group2 of allFocus2) {
            if (keywords.some(k => group2.includes(k))) {
              overlap.push(category);
              break;
            }
          }
        }
      }
    }

    return [...new Set(overlap)]; // Remove duplicates
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

    // If user provided a schedule, validate that those days are training days
    if (userProfile.schedule) {
      const scheduledDays = this.parseScheduleSlots(userProfile.schedule)
        .map(idx => DAY_NAMES[idx].toLowerCase());
      
      if (scheduledDays.length > 0) {
        const trainingDayNames = split.days
          .filter(d => !d.isRestDay)
          .map(d => d.dayName.toLowerCase());
        
        const missingScheduledDays = scheduledDays.filter(
          day => !trainingDayNames.includes(day)
        );
        
        if (missingScheduledDays.length > 0 && missingScheduledDays.length <= 2) {
          // Only warn if a few days are missing (might be intentional for rest)
          console.warn(`⚠️ User schedule includes ${missingScheduledDays.join(', ')} but these are marked as rest days`);
        }
      }
    }

    return issues;
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

  private parseScheduleSlots(schedule?: string): number[] {
    if (!schedule) return [];
    
    const dayIndexMap: Record<string, number> = {
      monday: 0,
      mon: 0,
      tuesday: 1,
      tue: 1,
      tues: 1,
      wednesday: 2,
      wed: 2,
      thursday: 3,
      thu: 3,
      thurs: 3,
      friday: 4,
      fri: 4,
      saturday: 5,
      sat: 5,
      sunday: 6,
      sun: 6,
    };

    // Normalize and strip time information
    let normalized = schedule.toLowerCase();
    normalized = normalized.replace(/\b(from\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?\s*(to|-)\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '');
    normalized = normalized.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '');
    
    const result: number[] = [];
    
    // Check for range patterns like "Monday to Saturday", "Mon-Sat"
    const rangeMatch = normalized.match(/(\w+)\s*(?:to|through|-)\s*(\w+)/i);
    if (rangeMatch) {
      const startIdx = dayIndexMap[rangeMatch[1].trim()];
      const endIdx = dayIndexMap[rangeMatch[2].trim()];
      
      if (startIdx !== undefined && endIdx !== undefined) {
        if (startIdx <= endIdx) {
          for (let i = startIdx; i <= endIdx; i++) {
            if (!result.includes(i)) result.push(i);
          }
        } else {
          // Wrap around
          for (let i = startIdx; i < 7; i++) {
            if (!result.includes(i)) result.push(i);
          }
          for (let i = 0; i <= endIdx; i++) {
            if (!result.includes(i)) result.push(i);
          }
        }
        return result.sort((a, b) => a - b);
      }
    }
    
    // Parse individual days
    return normalized
      .split(/[,|;/\n\s]+/)
      .map((part) => part.trim())
      .map((token) => dayIndexMap[token])
      .filter((idx): idx is number => typeof idx === 'number')
      .filter((idx, i, arr) => arr.indexOf(idx) === i) // unique
      .sort((a, b) => a - b);
  }

  private applySchedulePreference(split: TrainingSplit, userProfile: UserProfile): TrainingSplit {
    const scheduleSlots = this.parseScheduleSlots(userProfile.schedule);
    const requiredTrainingDays = userProfile.trainingDaysPerWeek;
    let adjustedSplit = split;

    if (scheduleSlots.length === requiredTrainingDays && scheduleSlots.length > 0) {
      const desiredNames = scheduleSlots.map((idx) => DAY_NAMES[idx]);
      const trainingTemplates = split.days.filter((d) => !d.isRestDay);

      if (trainingTemplates.length > 0) {
        const updatedDays = split.days.map((day) => {
          const desiredIndex = desiredNames.findIndex(
            (name) => name.toLowerCase() === day.dayName.toLowerCase()
          );
          if (desiredIndex !== -1) {
            const template = trainingTemplates[desiredIndex % trainingTemplates.length];
            return {
              ...day,
              focus: [...template.focus],
              isRestDay: false,
              isCardioDay: template.isCardioDay,
              intensity: template.intensity,
              estimatedDuration: template.estimatedDuration,
              primaryMuscleGroups: template.primaryMuscleGroups,
              secondaryMuscleGroups: template.secondaryMuscleGroups,
            };
          }
          return {
            ...day,
            focus: [],
            isRestDay: true,
            isCardioDay: false,
          };
        });
        adjustedSplit = { ...split, days: updatedDays };
      }
    }

    if (userProfile.workoutSplit === 'full_body') {
      adjustedSplit = {
        ...adjustedSplit,
        days: adjustedSplit.days.map((day) =>
          day.isRestDay
            ? { ...day, focus: [] }
            : { ...day, focus: ['Full Body'] }
        ),
      };
    }

    return adjustedSplit;
  }
}
