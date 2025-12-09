/**
 * Cardio Generation Service
 * 
 * Generates detailed cardio session templates similar to how exercises and meals are generated.
 * Creates phase-specific, goal-optimized cardio protocols with detailed structure.
 */

import { z } from 'zod';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';
import {
  CardioTemplate,
  CardioType,
  CardioIntensity,
  WeeklyCardioSchedule,
  CardioSessionAssignment,
} from '../models/CardioModels';
import { searchCardioKnowledge, getCardioRecommendations } from '../rag/cardio/cardioKnowledgeBase';

/**
 * Cardio Template Schema for AI generation
 */
const CardioTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  type: z.enum([
    'HIIT', 'MISS', 'LISS', 'Zone 2', 'Tempo Run', 'Fartlek', 'Tabata',
    'Circuit', 'Rowing', 'Cycling', 'Swimming', 'Stair Climbing',
    'Elliptical', 'Walking', 'Rucking', 'Sled Push', 'Battle Ropes',
    'Assault Bike', 'SkiErg', 'Other'
  ]),
  intensity: z.enum(['Very Low', 'Low', 'Moderate', 'High', 'Very High', 'Variable']),
  durationMinutes: z.number(),
  targetHeartRate: z.object({
    min: z.number(),
    max: z.number(),
    zone: z.string(),
  }).optional(),
  caloriesBurned: z.number().optional(),
  equipment: z.array(z.string()),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  structure: z.object({
    warmup: z.object({
      durationMinutes: z.number(),
      description: z.string(),
    }).optional(),
    mainWorkout: z.object({
      type: z.enum(['interval', 'steady', 'progressive', 'circuit', 'steadyState']),
      intervals: z.array(z.object({
        workDurationSeconds: z.number(),
        restDurationSeconds: z.number().optional(),
        restSeconds: z.number().optional(),
        intensity: z.string(),
        rounds: z.number(),
        description: z.string(),
      })).optional(),
      steadyState: z.object({
        durationMinutes: z.number(),
        intensity: z.string(),
        description: z.string(),
      }).optional(),
      progressive: z.array(z.object({
        durationMinutes: z.number(),
        intensity: z.string(),
        description: z.string(),
      })).optional(),
      circuit: z.array(z.object({
        exercise: z.string(),
        durationSeconds: z.number(),
        restSeconds: z.number(),
        rounds: z.number(),
      })).optional(),
    }),
    cooldown: z.object({
      durationMinutes: z.number(),
      description: z.string(),
    }).optional(),
    totalDurationMinutes: z.number().optional(),
  }),
  progressionOptions: z.array(z.string()),
  regressionOptions: z.array(z.string()),
  formCues: z.array(z.string()),
  contraindications: z.array(z.string()),
  recoveryTime: z.number(),
  phase: z.enum(['foundation', 'progression', 'peak']),
  notes: z.string().optional(),
});

const WeeklyCardioScheduleSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  sessions: z.array(z.object({
    dayNumber: z.number(),
    dayName: z.string(),
    templateId: z.string(),
    timing: z.enum(['morning', 'afternoon', 'evening', 'post_workout']),
    notes: z.string().optional(),
  })),
  totalWeeklyVolume: z.object({
    sessions: z.number(),
    totalMinutes: z.number(),
    totalCalories: z.number(),
  }),
  progressionNotes: z.string(),
  recoveryStrategy: z.string(),
});

export class CardioGenerationService {
  private cotService: ChainOfThoughtService;

  constructor(cotService: ChainOfThoughtService) {
    this.cotService = cotService;
  }

  /**
   * Normalize phase name to lowercase standard form
   * Handles variations like "Foundation", "FOUNDATION", "Foundation Phase", etc.
   */
  private normalizePhase(phaseName: string | undefined): string {
    if (!phaseName) return '';
    // Remove common suffixes and normalize
    return phaseName
      .toLowerCase()
      .replace(/\s*phase\s*/gi, '')
      .replace(/\s+/g, '')
      .trim();
  }

  /**
   * Generate phase-specific cardio templates
   * Similar to generatePhaseExerciseLibraries
   * 
   * CRITICAL: This method MUST generate templates. Empty results are not acceptable.
   */
  async generatePhaseCardioTemplates(
    userProfile: UserProfile,
    weeklyOutlines: WeeklyOutline[],
    phase: 'foundation' | 'progression' | 'peak'
  ): Promise<CardioTemplate[]> {
    if (!this.cotService.isAIAvailable()) {
      throw new Error('AI service is required to generate cardio templates. Configure an AI API key.');
    }

    // ROBUST PHASE MATCHING: Handle various phase name formats
    const normalizedTargetPhase = this.normalizePhase(phase);
    
    const phaseWeeks = weeklyOutlines.filter(w => {
      const normalizedOutlinePhase = this.normalizePhase(w.phase);
      return normalizedOutlinePhase === normalizedTargetPhase;
    });

    console.log(`🏃 [CARDIO] Phase matching for "${phase}":`);
    console.log(`   Target (normalized): "${normalizedTargetPhase}"`);
    console.log(`   Outline phases: ${weeklyOutlines.map(w => `Week ${w.weekNumber}: "${w.phase}" → "${this.normalizePhase(w.phase)}"`).join(', ')}`);
    console.log(`   Matched weeks: ${phaseWeeks.map(w => w.weekNumber).join(', ') || 'NONE'}`);

    if (phaseWeeks.length === 0) {
      // CRITICAL: If no weeks match, this is a configuration error - throw instead of returning empty
      const allPhases = weeklyOutlines.map(w => w.phase).filter(Boolean);
      const uniquePhases = [...new Set(allPhases)];
      
      throw new Error(
        `CARDIO GENERATION FAILED: No weeks found for phase "${phase}" (normalized: "${normalizedTargetPhase}").\n` +
        `Available phases in outline: ${uniquePhases.join(', ') || 'NONE'}\n` +
        `This indicates a phase naming mismatch. Phases must be: foundation, progression, or peak.`
      );
    }

    // Get evidence-based recommendations
    const recommendations = getCardioRecommendations(
      userProfile.goal as 'fat_loss' | 'muscle_gain' | 'endurance' | 'general_fitness',
      phase,
      (userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert') || 'intermediate'
    );

    // Search cardio knowledge base
    const cardioKnowledge = searchCardioKnowledge('', {
      goal: userProfile.goal as any,
      phase,
    });

    const prompt = this.buildCardioTemplatesPrompt(
      userProfile,
      phase,
      phaseWeeks,
      recommendations,
      cardioKnowledge
    );

    try {
      const { result } = await this.cotService.generateWithCoT(
        prompt,
        z.object({
          cardioTemplates: z.array(CardioTemplateSchema),
        }),
        {
          enableVerification: true,
        }
      );

      // Post-process templates to fix AI output variations and calculate missing fields
      const processedTemplates: CardioTemplate[] = result.cardioTemplates.map(template => {
        // Fix mainWorkout.type: transform 'steadyState' to 'steady'
        const fixedTemplate = { ...template };
        if (fixedTemplate.structure.mainWorkout.type === 'steadyState') {
          fixedTemplate.structure.mainWorkout = {
            ...fixedTemplate.structure.mainWorkout,
            type: 'steady' as 'interval' | 'steady' | 'progressive' | 'circuit'
          };
        }

        // Fix intervals: map restSeconds to restDurationSeconds if needed
        if (fixedTemplate.structure.mainWorkout.intervals) {
          fixedTemplate.structure.mainWorkout.intervals = fixedTemplate.structure.mainWorkout.intervals.map(interval => ({
            ...interval,
            restDurationSeconds: interval.restDurationSeconds ?? interval.restSeconds ?? 0
          }));
        }

        // Calculate missing totalDurationMinutes
        if (!fixedTemplate.structure.totalDurationMinutes) {
          // Calculate from structure components
          let total = 0;
          if (fixedTemplate.structure.warmup) {
            total += fixedTemplate.structure.warmup.durationMinutes;
          }
          if (fixedTemplate.structure.mainWorkout.type === 'steady' && fixedTemplate.structure.mainWorkout.steadyState) {
            total += fixedTemplate.structure.mainWorkout.steadyState.durationMinutes;
          } else if (fixedTemplate.structure.mainWorkout.type === 'interval' && fixedTemplate.structure.mainWorkout.intervals) {
            fixedTemplate.structure.mainWorkout.intervals.forEach(interval => {
              const intervalTime = (interval.workDurationSeconds + (interval.restDurationSeconds ?? 0)) * interval.rounds;
              total += intervalTime / 60; // Convert to minutes
            });
          } else if (fixedTemplate.structure.mainWorkout.type === 'progressive' && fixedTemplate.structure.mainWorkout.progressive) {
            total += fixedTemplate.structure.mainWorkout.progressive.reduce((sum, stage) => sum + stage.durationMinutes, 0);
          } else if (fixedTemplate.structure.mainWorkout.type === 'circuit' && fixedTemplate.structure.mainWorkout.circuit) {
            fixedTemplate.structure.mainWorkout.circuit.forEach(circuit => {
              const circuitTime = (circuit.durationSeconds + circuit.restSeconds) * circuit.rounds;
              total += circuitTime / 60; // Convert to minutes
            });
          }
          if (fixedTemplate.structure.cooldown) {
            total += fixedTemplate.structure.cooldown.durationMinutes;
          }
          // Fallback to durationMinutes if calculation fails
          fixedTemplate.structure.totalDurationMinutes = total > 0 ? Math.round(total) : fixedTemplate.durationMinutes;
        }

        // CRITICAL: Always calculate caloriesBurned if missing or zero
        // This ensures ALL templates have calorie data for energy balance calculations
        if (!fixedTemplate.caloriesBurned || fixedTemplate.caloriesBurned === 0) {
          const duration = fixedTemplate.structure.totalDurationMinutes || fixedTemplate.durationMinutes;
          fixedTemplate.caloriesBurned = this.calculateCaloriesBurned(
            userProfile.weightKg,
            duration,
            fixedTemplate.intensity as CardioIntensity,
            fixedTemplate.type as CardioType
          );
          console.log(`   📊 Calculated calories for "${fixedTemplate.name}": ${fixedTemplate.caloriesBurned} kcal (${duration} min @ ${fixedTemplate.intensity})`);
        }

        return fixedTemplate as CardioTemplate;
      });

      console.log(`✅ Successfully generated ${processedTemplates.length} ${phase} cardio templates`);
      return processedTemplates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : '';

      console.error(`❌ Failed to generate ${phase} cardio templates:`);
      console.error(`   Error: ${errorMessage}`);
      if (errorDetails) {
        console.error(`   Stack: ${errorDetails}`);
      }

      // Check if it's a schema validation error that might be recoverable
      if (errorMessage.includes('schema') || errorMessage.includes('validation') || errorMessage.includes('No object generated')) {
        console.warn(`   ⚠️  Schema validation error - this might be a transient AI issue`);
        console.warn(`   💡 Consider retrying or checking the prompt structure`);
      }

      throw new Error(`Cardio template generation failed for ${phase} phase: ${errorMessage}`);
    }
  }

  /**
   * Generate weekly cardio schedule with specific session assignments
   */
  async generateWeeklyCardioSchedule(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    cardioTemplates: CardioTemplate[],
    resistanceDays: string[]
  ): Promise<WeeklyCardioSchedule> {
    if (!this.cotService.isAIAvailable()) {
      throw new Error('AI service is required to generate cardio schedule.');
    }

    const prompt = this.buildWeeklySchedulePrompt(
      userProfile,
      weeklyOutline,
      cardioTemplates,
      resistanceDays
    );

    try {
      const { result } = await this.cotService.generateWithCoT(
        prompt,
        WeeklyCardioScheduleSchema,
        {
          enableVerification: true,
        }
      );

      // Enrich with full cardio template objects
      const enrichedSessions: CardioSessionAssignment[] = result.sessions.map(session => {
        const template = cardioTemplates.find(t => t.templateId === session.templateId);
        if (!template) {
          throw new Error(`Cardio template not found: ${session.templateId}`);
        }

        return {
          ...session,
          cardioTemplate: template,
        };
      });

      return {
        ...result,
        sessions: enrichedSessions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to generate weekly cardio schedule for Week ${weeklyOutline.weekNumber}:`);
      console.error(`   Error: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }

      // No fallback - AI generation is required
      throw new Error(`Cardio schedule generation failed for Week ${weeklyOutline.weekNumber}: ${errorMessage}`);
    }
  }

  /**
   * Build prompt for cardio template generation
   */
  private buildCardioTemplatesPrompt(
    userProfile: UserProfile,
    phase: string,
    phaseWeeks: WeeklyOutline[],
    recommendations: ReturnType<typeof getCardioRecommendations>,
    cardioKnowledge: any[]
  ): string {
    const userLevel = (userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert') || 'intermediate';
    const goal = userProfile.goal;
    const equipment = userProfile.equipment;

    // Format knowledge base facts
    const knowledgeText = cardioKnowledge
      .slice(0, 5)
      .map(fact => `- ${fact.content} (${fact.source})`)
      .join('\n');

    return `You are an expert exercise physiologist designing ${phase.toUpperCase()} phase cardio templates for a ${userLevel} trainee.

USER PROFILE:
- Goal: ${goal}
- Experience Level: ${userLevel}
- Equipment Available: ${equipment}
- Weight: ${userProfile.weightKg}kg
- Age: ${userProfile.age}

PHASE: ${phase.toUpperCase()}
- Weeks: ${phaseWeeks.length} weeks
- Phase weeks: ${phaseWeeks.map(w => w.weekNumber).join(', ')}

EVIDENCE-BASED RECOMMENDATIONS:
- Frequency: ${recommendations.frequency.min}-${recommendations.frequency.max} sessions/week
- Duration: ${recommendations.duration.min}-${recommendations.duration.max} minutes per session
- Intensity: ${recommendations.intensity.join(', ')}
- Types: ${recommendations.types.join(', ')}

SCIENTIFIC CONTEXT:
${knowledgeText}

GOAL-SPECIFIC GUIDANCE:
${this.getGoalSpecificGuidance(goal)}

EQUIPMENT-SPECIFIC GUIDANCE:
${this.getEquipmentGuidance(equipment)}

GENERATE 3-5 CARDIO TEMPLATES for the ${phase} phase:

Each template must include:
1. **Template ID**: Unique identifier (e.g., "${phase}-hiit-1", "${phase}-liss-1")
2. **Name**: Descriptive name (e.g., "HIIT Treadmill Intervals", "Zone 2 Cycling")
3. **Type**: One of: ${recommendations.types.join(', ')}
4. **Intensity**: ${recommendations.intensity.join(', ')}
5. **Duration**: ${recommendations.duration.min}-${recommendations.duration.max} minutes
6. **Target Heart Rate**: Calculate based on age (220 - age) and intensity zone
7. **Equipment**: List required equipment (must match: ${equipment})
8. **Difficulty**: ${userLevel}
9. **Structure**: Detailed breakdown:
   - Warmup (if needed): duration and description
   - Main Workout: 
     * For intervals: work/rest durations, rounds, intensity per interval
     * For steady state: duration, intensity, description
     * For progressive: stages with increasing intensity
     * For circuit: exercises, durations, rest, rounds
   - Cooldown (if needed): duration and description
10. **Progression Options**: How to make it harder (e.g., "Increase work interval duration", "Add rounds")
11. **Regression Options**: How to make it easier (e.g., "Reduce intensity", "Shorten duration")
12. **Form Cues**: Technique tips (e.g., "Maintain upright posture", "Land softly on balls of feet")
13. **Contraindications**: Safety warnings (e.g., "Avoid if knee pain", "Not for beginners")
14. **Recovery Time**: Hours needed before next intense session
15. **Phase**: "${phase}"
16. **Notes**: Any additional guidance

CRITICAL REQUIREMENTS:
- Templates must be appropriate for ${userLevel} level
- Equipment must match: ${equipment}
- Structure must be detailed and actionable
- Heart rate zones must be calculated accurately
- Progression/regression options must be practical
- Safety considerations must be included

Generate ${phase} phase cardio templates now.`;
  }

  /**
   * Build prompt for weekly cardio schedule
   */
  private buildWeeklySchedulePrompt(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    cardioTemplates: CardioTemplate[],
    resistanceDays: string[]
  ): string {
    const availableTemplates = cardioTemplates
      .map(t => `- ${t.templateId}: ${t.name} (${t.type}, ${t.durationMinutes} min, ${t.intensity})`)
      .join('\n');

    return `You are scheduling cardio sessions for Week ${weeklyOutline.weekNumber} (${weeklyOutline.phase} phase).

USER PROFILE:
- Goal: ${userProfile.goal}
- Training Days: ${resistanceDays.join(', ')}
- Rest Days: ${weeklyOutline.trainingSchedule.restDays.join(', ')}

WEEKLY OUTLINE:
- Cardio sessions target: ${weeklyOutline.cardioSchedule.sessions} sessions
- Duration target: ${weeklyOutline.cardioSchedule.duration} minutes per session
- Intensity: ${weeklyOutline.cardioSchedule.intensity}
- Type: ${weeklyOutline.cardioSchedule.type}

AVAILABLE CARDIO TEMPLATES:
${availableTemplates}

SCHEDULING REQUIREMENTS:
1. Assign ${weeklyOutline.cardioSchedule.sessions} cardio sessions to appropriate days
2. Avoid scheduling intense cardio on heavy resistance training days
3. Space out intense sessions (HIIT) with at least 48 hours recovery
4. Low-intensity cardio (LISS) can be done on rest days or post-workout
5. Consider timing: morning fasted, afternoon, evening, or post-workout

GENERATE WEEKLY SCHEDULE:
- Assign specific templates to specific days
- Specify timing (morning/afternoon/evening/post_workout)
- Calculate total weekly volume (sessions, minutes, estimated calories)
- Provide progression notes
- Include recovery strategy

Return structured weekly cardio schedule.`;
  }

  /**
   * Get goal-specific cardio guidance
   */
  private getGoalSpecificGuidance(goal: string): string {
    const guidance: Record<string, string> = {
      'fat_loss': `FAT LOSS GOAL:
- Prioritize calorie burn: Mix of HIIT (2-3x/week) and LISS (1-2x/week)
- Total weekly volume: 150-300 minutes
- HIIT sessions: 15-30 minutes, very high intensity
- LISS sessions: 30-60 minutes, low-moderate intensity
- Can perform fasted cardio in morning for additional fat oxidation
- Post-workout LISS is acceptable for additional calorie burn`,

      'muscle_gain': `MUSCLE GAIN GOAL:
- Minimize cardio to avoid interference: 1-2 sessions/week maximum
- Low-intensity only: 50-60% HRmax, 20-30 minutes
- Best on rest days or post-workout (low intensity)
- Avoid HIIT - can interfere with muscle protein synthesis
- Focus on Zone 2 or LISS for cardiovascular health without muscle loss`,

      'endurance': `ENDURANCE GOAL:
- Higher volume: 3-5 sessions/week, 30-90 minutes
- Mix of Zone 2 (3-4x) and tempo runs (1-2x)
- Zone 2: 60-70% HRmax, 60-90 minutes for aerobic base
- Tempo: 70-80% HRmax, 20-40 minutes for lactate threshold
- Progressive overload: Gradually increase duration or intensity`,

      'general_fitness': `GENERAL FITNESS GOAL:
- Balanced approach: 2-3 sessions/week
- Mix of intensities: 1 HIIT, 1-2 LISS
- Duration: 20-45 minutes
- Focus on enjoyment and sustainability`,
    };

    return guidance[goal] || guidance['general_fitness'];
  }

  /**
   * Get equipment-specific guidance
   */
  private getEquipmentGuidance(equipment: string): string {
    const guidance: Record<string, string> = {
      'gym_membership': `EQUIPMENT: Full gym access
- Can use: Treadmill, bike, rower, elliptical, stair climber, assault bike
- All cardio types available
- Focus on variety to prevent boredom`,

      'home_gym': `EQUIPMENT: Home gym
- May have: Treadmill, bike, rower, or none
- Bodyweight cardio: Burpees, mountain climbers, jumping jacks
- Can do: HIIT circuits, LISS walking/running outside
- Creative with available equipment`,

      'bodyweight': `EQUIPMENT: Bodyweight only
- HIIT: Burpees, mountain climbers, jumping jacks, high knees
- LISS: Brisk walking, jogging in place, step-ups
- Circuit training: Combine bodyweight movements
- No equipment needed`,

      'minimal_equipment': `EQUIPMENT: Minimal (dumbbells, bands)
- Can add: Weighted walks, resistance band exercises
- Bodyweight HIIT with added resistance
- Walking/running outside
- Limited equipment options`,
    };

    return guidance[equipment] || guidance['gym_membership'];
  }

  /**
   * Calculate estimated calories burned for a cardio session
   * 
   * Uses MET (Metabolic Equivalent of Task) values from the Compendium of Physical Activities
   * Formula: Calories = MET × weight(kg) × duration(hours)
   */
  calculateCaloriesBurned(
    weightKg: number,
    durationMinutes: number,
    intensity: CardioIntensity,
    type: CardioType
  ): number {
    // MET values (Metabolic Equivalent of Task) for different activities
    // Based on the 2011 Compendium of Physical Activities
    const metValues: Record<string, Record<string, number>> = {
      // High-Intensity Interval Training
      'HIIT': { 'Very High': 12, 'High': 10, 'Moderate': 8, 'Variable': 10 },
      'Tabata': { 'Very High': 14, 'High': 12, 'Variable': 12 },
      
      // Steady State Cardio
      'MISS': { 'High': 8, 'Moderate': 7, 'Low': 5 },
      'LISS': { 'Moderate': 5, 'Low': 4, 'Very Low': 3 },
      'Zone 2': { 'Moderate': 6, 'Low': 5, 'Very Low': 4 },
      
      // Running Variants
      'Tempo Run': { 'High': 10, 'Moderate': 8.5 },
      'Fartlek': { 'High': 9, 'Moderate': 8, 'Variable': 8.5 },
      
      // Machine Cardio
      'Rowing': { 'Very High': 12, 'High': 9.5, 'Moderate': 7, 'Low': 5 },
      'Cycling': { 'Very High': 12, 'High': 10, 'Moderate': 8, 'Low': 6 },
      'Swimming': { 'Very High': 10, 'High': 8.5, 'Moderate': 7, 'Low': 5.5 },
      'Stair Climbing': { 'Very High': 12, 'High': 9, 'Moderate': 7, 'Low': 5 },
      'Elliptical': { 'High': 8, 'Moderate': 6.5, 'Low': 5 },
      'Assault Bike': { 'Very High': 14, 'High': 11, 'Moderate': 8, 'Variable': 10 },
      'SkiErg': { 'Very High': 12, 'High': 9, 'Moderate': 7 },
      
      // Low Impact
      'Walking': { 'Moderate': 4.5, 'Low': 3.5, 'Very Low': 2.5 },
      'Rucking': { 'High': 8, 'Moderate': 6.5, 'Low': 5 },
      
      // Functional
      'Circuit': { 'Very High': 10, 'High': 8, 'Moderate': 6, 'Variable': 7.5 },
      'Sled Push': { 'Very High': 10, 'High': 8, 'Moderate': 6 },
      'Battle Ropes': { 'Very High': 12, 'High': 10, 'Moderate': 7, 'Variable': 9 },
      
      // Fallback for 'Other' type
      'Other': { 'Very High': 10, 'High': 8, 'Moderate': 6, 'Low': 4, 'Very Low': 3, 'Variable': 6 },
    };

    // Get the MET value for this type and intensity
    const typeMetValues = metValues[type] || metValues['Other'];
    let met = typeMetValues[intensity];
    
    // If exact intensity not found, find closest match
    if (!met) {
      const intensityOrder: CardioIntensity[] = ['Very Low', 'Low', 'Moderate', 'High', 'Very High', 'Variable'];
      const currentIdx = intensityOrder.indexOf(intensity);
      
      // Try to find a nearby intensity value
      for (let offset = 1; offset <= 5; offset++) {
        if (currentIdx - offset >= 0 && typeMetValues[intensityOrder[currentIdx - offset]]) {
          met = typeMetValues[intensityOrder[currentIdx - offset]];
          break;
        }
        if (currentIdx + offset < intensityOrder.length && typeMetValues[intensityOrder[currentIdx + offset]]) {
          met = typeMetValues[intensityOrder[currentIdx + offset]];
          break;
        }
      }
      
      // Ultimate fallback
      if (!met) {
        met = 6; // Default moderate cardio MET
      }
    }

    // Calories = MET × weight(kg) × duration(hours)
    const calories = met * weightKg * (durationMinutes / 60);
    return Math.round(calories);
  }

}

