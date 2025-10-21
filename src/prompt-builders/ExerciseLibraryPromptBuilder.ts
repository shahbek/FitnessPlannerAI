// Phase 4: Exercise Library Prompt Builder
// Builds context-aware prompts for exercise library generation

import { UserProfile } from '@/types';

export class ExerciseLibraryPromptBuilder {
  static buildPrompt(
    userProfile: UserProfile,
    trainingFramework: any
  ): string {
    const { workoutLevel, equipment, trainingDaysPerWeek } = userProfile;
    const targetMuscles = Object.keys(trainingFramework.volumePerMuscle || {});
    
    return `
Generate exercise library:

EQUIPMENT AVAILABLE:
${this.formatEquipment(equipment)}

TARGET MUSCLE GROUPS (from framework):
${targetMuscles.join(', ')}

USER EXPERIENCE: ${workoutLevel}

TRAINING SPLIT: ${userProfile.workoutSplit}

REQUIREMENTS:
1. Provide 3-5 exercises per muscle group
2. Include variations for:
   - Foundation phase (learning movements)
   - Progression phase (building intensity)
   - Peak phase (max intensity/volume)
3. Each exercise needs:
   - Appropriate difficulty level
   - Equipment required (must match available)
   - Form cues
   - Progression/regression options

Focus on compound movements for efficiency in ${trainingDaysPerWeek} days/week.

EVIDENCE-BASED REQUIREMENTS:
- Prioritize compound movements for efficiency
- Include both bilateral and unilateral variations
- Ensure proper progression/regression options
- Match equipment availability exactly
- Consider user experience level for complexity

Return structured exercise library with detailed specifications.
`;
  }

  private static formatEquipment(equipment: string): string {
    switch (equipment) {
      case 'gym_membership':
        return 'Full gym access (barbells, dumbbells, machines, cables, cardio equipment)';
      case 'home_gym':
        return 'Home gym setup (barbell, dumbbells, bench, rack)';
      case 'bodyweight':
        return 'Bodyweight exercises only (no equipment)';
      case 'minimal_equipment':
        return 'Limited equipment (dumbbells, resistance bands, pull-up bar)';
      default:
        return equipment;
    }
  }
}
