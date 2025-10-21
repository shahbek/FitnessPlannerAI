// Phase 5: Weekly Training Outlines Prompt Builder
// Builds context-aware prompts for weekly training progression

import { UserProfile } from '@/types';
import { DietaryConstraints } from '@/utils/dietaryConstraints';
import { PlanningMetrics } from '@/services/aiSdkRagService';

export class WeeklyOutlinesPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    dietaryConstraints: DietaryConstraints,
    trainingFramework: any,
    exerciseLibrary: any[],
    metrics: PlanningMetrics
  ): string {
    const { timelineWeeks, trainingDaysPerWeek, workoutSplit } = userProfile;
    const week1Calories = metrics.macros.calories;
    const weekFinalCalories = Math.round(metrics.macros.calories - (timelineWeeks * 50)); // Progressive reduction
    const week1Deficit = metrics.tdee.value - week1Calories;
    const weekFinalDeficit = metrics.tdee.value - weekFinalCalories;
    
    return `
Create ${timelineWeeks}-week training progression:

FRAMEWORK TARGETS:
- Volume per muscle: ${JSON.stringify(trainingFramework.volumePerMuscle)}
- Training days: ${trainingDaysPerWeek}/week (${workoutSplit} split)
- Session duration: ~${trainingFramework.sessionDurationMinutes || 60} min

METABOLIC PROGRESSION:
Week 1: ${week1Calories} cal/day (${week1Deficit} deficit)
Week ${timelineWeeks}: ${weekFinalCalories} cal/day (${weekFinalDeficit} deficit)

${dietaryConstraints.macroAdjustments.carbs === 'minimize' ? 
  '⚠️ LOW CARB: Energy may decrease over time, plan volume reductions if needed' : ''}

AVAILABLE EXERCISES:
${this.formatExercisesByPhase(exerciseLibrary)}

WEEK-BY-WEEK PLAN:
For each week specify:
1. Training days (which days of week)
2. Focus muscle groups per session
3. Weekly volume (total sets per muscle)
4. Cardio (sessions, duration, type)
5. Expected outcomes
6. Adjustments from previous week

PHASES:
- Weeks 1-${Math.floor(timelineWeeks/3)}: Foundation (establish baseline, higher calories)
- Weeks ${Math.floor(timelineWeeks/3)+1}-${Math.floor(timelineWeeks*2/3)}: Progression (increase intensity)
- Weeks ${Math.floor(timelineWeeks*2/3)+1}-${timelineWeeks}: Peak (lowest calories, maintenance mode)

Include deload week if >12 weeks total.

EVIDENCE-BASED REQUIREMENTS:
- Progressive overload throughout timeline
- Volume adjustments based on caloric deficit
- Appropriate deload scheduling
- Cardio integration that supports fat loss
- Phase-specific adaptations

Return detailed weekly outlines with specific targets and progression.
`;
  }

  private static formatExercisesByPhase(exerciseLibrary: any[]): string {
    const foundationExercises = exerciseLibrary.filter(ex => ex.difficulty === 'beginner' || ex.difficulty === 'intermediate');
    const progressionExercises = exerciseLibrary.filter(ex => ex.difficulty === 'intermediate' || ex.difficulty === 'advanced');
    const peakExercises = exerciseLibrary.filter(ex => ex.difficulty === 'advanced');
    
    return `
Foundation Phase: ${foundationExercises.map(ex => ex.name).join(', ')}
Progression Phase: ${progressionExercises.map(ex => ex.name).join(', ')}
Peak Phase: ${peakExercises.map(ex => ex.name).join(', ')}`;
  }
}
