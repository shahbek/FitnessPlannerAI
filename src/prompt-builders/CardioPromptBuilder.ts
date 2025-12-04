// Cardio Prompt Builder
// Builds context-aware prompts for cardio template and schedule generation

import { UserProfile } from '../models/UserProfile';
import { WeeklyOutline } from '../models/PlanModels';
import { CardioTemplate } from '../models/CardioModels';
import { getCardioRecommendations } from '../rag/cardio/cardioKnowledgeBase';

export class CardioPromptBuilder {
  /**
   * Build prompt for generating cardio templates
   */
  static buildTemplatesPrompt(
    userProfile: UserProfile,
    phase: 'foundation' | 'progression' | 'peak',
    recommendations: ReturnType<typeof getCardioRecommendations>,
    cardioKnowledge: any[]
  ): string {
    const userLevel = (userProfile.workoutLevel as 'beginner' | 'intermediate' | 'expert') || 'intermediate';

    const knowledgeText = cardioKnowledge
      .slice(0, 5)
      .map(fact => `- ${fact.content} (${fact.source})`)
      .join('\n');

    return `
Generate ${phase.toUpperCase()} phase cardio templates:

USER CONTEXT:
- Goal: ${userProfile.goal}
- Level: ${userLevel}
- Equipment: ${userProfile.equipment}
- Weight: ${userProfile.weightKg}kg

EVIDENCE-BASED TARGETS:
- Frequency: ${recommendations.frequency.min}-${recommendations.frequency.max} sessions/week
- Duration: ${recommendations.duration.min}-${recommendations.duration.max} minutes
- Intensity: ${recommendations.intensity.join(', ')}
- Types: ${recommendations.types.join(', ')}

SCIENTIFIC EVIDENCE:
${knowledgeText}

Generate 3-5 detailed cardio templates with full structure, progression options, and safety considerations.
`;
  }

  /**
   * Build prompt for weekly cardio scheduling
   */
  static buildSchedulePrompt(
    userProfile: UserProfile,
    weeklyOutline: WeeklyOutline,
    cardioTemplates: CardioTemplate[],
    resistanceDays: string[]
  ): string {
    const availableTemplates = cardioTemplates
      .map(t => `- ${t.templateId}: ${t.name} (${t.type}, ${t.durationMinutes}min, ${t.intensity})`)
      .join('\n');

    return `
Schedule cardio for Week ${weeklyOutline.weekNumber}:

USER PROFILE:
- Goal: ${userProfile.goal}
- Resistance Days: ${resistanceDays.join(', ')}
- Rest Days: ${weeklyOutline.trainingSchedule.restDays.join(', ')}

TARGETS:
- Sessions: ${weeklyOutline.cardioSchedule.sessions}
- Duration: ${weeklyOutline.cardioSchedule.duration} min/session
- Intensity: ${weeklyOutline.cardioSchedule.intensity}
- Type: ${weeklyOutline.cardioSchedule.type}

AVAILABLE TEMPLATES:
${availableTemplates}

SCHEDULING RULES:
1. Assign ${weeklyOutline.cardioSchedule.sessions} sessions
2. Avoid intense cardio on heavy resistance days
3. Space HIIT sessions 48+ hours apart
4. LISS can be on rest days or post-workout
5. Consider timing preferences

Generate optimal weekly schedule.
`;
  }
}

