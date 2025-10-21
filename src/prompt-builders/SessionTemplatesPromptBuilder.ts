// Phase 6: Session Templates Prompt Builder
// Builds context-aware prompts for detailed session template generation

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class SessionTemplatesPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    trainingFramework: any,
    exerciseLibrary: any[],
    weeklyOutlines: any[],
    metrics: PlanningMetrics
  ): string {
    const { workoutLevel, trainingDaysPerWeek } = userProfile;
    const sessionDuration = trainingFramework.sessionDurationMinutes || 60;
    
    return `
Create detailed session templates for ${userProfile.workoutSplit} split:

WEEKLY STRUCTURE (from phase 5):
${this.formatWeeklyStructure(weeklyOutlines)}

EXERCISE LIBRARY:
${exerciseLibrary.map(ex => `${ex.exerciseId}: ${ex.name} (${ex.muscleGroups.join(', ')})`).join('\n')}

FRAMEWORK TARGETS:
- Volume per muscle: ${JSON.stringify(trainingFramework.volumePerMuscle)}
- Session duration: ${sessionDuration} min
- Training days: ${trainingDaysPerWeek}/week

USER CONTEXT:
- Experience: ${workoutLevel}
- Dietary carbs: ${metrics.macros.carbs}g/day
  ${metrics.macros.carbs < 50 ? '⚠️ Low carb - keep rest periods 90-120s for ATP recovery' : ''}

CREATE TEMPLATES FOR EACH PHASE:
1. **Foundation Phase Template**
   - Focus: Form, baseline strength
   - Volume: Moderate
   - Intensity: 65-75% 1RM
   
2. **Progression Phase Template**
   - Focus: Progressive overload
   - Volume: High
   - Intensity: 75-85% 1RM
   
3. **Peak Phase Template**
   - Focus: Maintenance, definition
   - Volume: Moderate (fatigue management)
   - Intensity: 80-90% 1RM

For each exercise specify:
- Exercise ID (from library)
- Sets × Reps
- Rest period
- Tempo (if relevant)
- Notes (cues, progressions)

Ensure exercises use IDs from the exercise library provided.

EVIDENCE-BASED REQUIREMENTS:
- Volume progression across phases
- Appropriate intensity zones for each phase
- Rest periods optimized for energy systems
- Exercise selection based on available equipment
- Progression/regression options included

Return structured session templates with detailed specifications.
`;
  }

  private static formatWeeklyStructure(weeklyOutlines: any[]): string {
    return weeklyOutlines.slice(0, 4).map(week => `
Week ${week.weekNumber} (${week.phase}):
- Training Days: ${week.trainingSchedule?.resistanceDays?.join(', ') || 'Not specified'}
- Cardio Days: ${week.trainingSchedule?.cardioDays?.join(', ') || 'Not specified'}
- Focus Areas: ${week.trainingSchedule?.focusAreas?.join(', ') || 'Not specified'}
- Cardio: ${week.cardioSchedule?.sessions || 0} sessions, ${week.cardioSchedule?.duration || 0}min, ${week.cardioSchedule?.intensity || 'Not specified'}
`).join('\n');
  }
}
