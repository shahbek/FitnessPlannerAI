// Profile Prompt Generator
// Converts candidate profiles into structured prompts for AI consumption

import { CandidateProfile, PhysicalStats, TrainingHistory, LifestyleFactors, DietaryPreferences, Goal } from '@/types/candidateProfile';

export class ProfilePromptGenerator {
  /**
   * Convert profile to structured prompt for AI analysis
   */
  static toPrompt(profile: CandidateProfile): string {
    return `
# CANDIDATE PROFILE

## Physical Stats
- Age: ${profile.physicalStats.age} years
- Sex: ${profile.physicalStats.sex}
- Height: ${profile.physicalStats.heightCm} cm
- Weight: ${profile.physicalStats.weightKg} kg
- Body Fat: ${profile.physicalStats.bodyFatPercentage || 'Unknown'}%
- BMI: ${profile.physicalStats.bmi.toFixed(1)}
- Lean Body Mass: ${profile.physicalStats.leanBodyMassKg || 'Unknown'} kg

## Training Background
- Training Experience: ${profile.trainingHistory.yearsTraining} years
- Current Training: ${profile.trainingHistory.currentTrainingDaysPerWeek} days/week
- Training Styles: ${profile.trainingHistory.trainingStyle.join(', ')}
- Gym Access: ${profile.trainingHistory.hasGymAccess ? 'Yes' : 'No'}
- Available Equipment: ${profile.trainingHistory.hasEquipment.join(', ')}
- Limitations: ${profile.trainingHistory.injuriesOrLimitations.join(', ') || 'None'}

## Lifestyle Context
- Activity Level: ${profile.lifestyle.activityLevel}
- Sleep: ${profile.lifestyle.averageSleepHours} hours/night
- Stress Level: ${profile.lifestyle.stressLevel}/10
- Available Training Time: ${profile.lifestyle.availableTrainingTimeMinutes} min/day
- Available Meal Prep Time: ${profile.lifestyle.availableMealPrepTimeMinutes} min/day
- Job Type: ${profile.lifestyle.jobType}
- Shift Work: ${profile.lifestyle.shiftWork ? 'Yes' : 'No'}

## Dietary Context
- Restrictions: ${profile.dietaryPreferences.dietaryRestrictions.join(', ')}
- Allergies: ${profile.dietaryPreferences.foodAllergies.join(', ') || 'None'}
- Foods to Avoid: ${profile.dietaryPreferences.foodsToAvoid.join(', ') || 'None'}
- Preferred Meals/Day: ${profile.dietaryPreferences.preferredMealCount}
- Cooking Skill: ${profile.dietaryPreferences.cookingSkill}
- Budget: ${profile.dietaryPreferences.budgetLevel}

## GOAL
- Primary Goal: ${profile.goal.goalType}
- Target Weight: ${profile.goal.targetWeightKg || 'Not specified'} kg
- Target Body Fat: ${profile.goal.targetBodyFatPercentage || 'Not specified'}%
- Target Muscle Gain: ${profile.goal.targetMuscleGainKg || 'Not specified'} kg
- Timeline: ${profile.goal.desiredTimelineWeeks} weeks
- Motivation: ${profile.goal.motivation}
- Previous Attempts: ${profile.goal.previousAttempts.join(', ') || 'None'}
- Biggest Challenge: ${profile.goal.biggestChallenge}

## Profile Quality
- Completeness: ${profile.completenessScore}%
- Missing Fields: ${profile.missingFields.join(', ') || 'None'}
`;
  }

  /**
   * Convert profile to structured dict for RAG queries
   */
  static toStructuredDict(profile: CandidateProfile): Record<string, any> {
    return {
      physical: {
        age: profile.physicalStats.age,
        sex: profile.physicalStats.sex,
        heightCm: profile.physicalStats.heightCm,
        weightKg: profile.physicalStats.weightKg,
        bodyFatPercentage: profile.physicalStats.bodyFatPercentage,
        bmi: profile.physicalStats.bmi,
        leanBodyMassKg: profile.physicalStats.leanBodyMassKg
      },
      training: {
        yearsTraining: profile.trainingHistory.yearsTraining,
        currentTrainingDaysPerWeek: profile.trainingHistory.currentTrainingDaysPerWeek,
        trainingStyle: profile.trainingHistory.trainingStyle,
        hasGymAccess: profile.trainingHistory.hasGymAccess,
        hasEquipment: profile.trainingHistory.hasEquipment,
        injuriesOrLimitations: profile.trainingHistory.injuriesOrLimitations
      },
      lifestyle: {
        activityLevel: profile.lifestyle.activityLevel,
        averageSleepHours: profile.lifestyle.averageSleepHours,
        stressLevel: profile.lifestyle.stressLevel,
        availableTrainingTimeMinutes: profile.lifestyle.availableTrainingTimeMinutes,
        availableMealPrepTimeMinutes: profile.lifestyle.availableMealPrepTimeMinutes,
        jobType: profile.lifestyle.jobType,
        shiftWork: profile.lifestyle.shiftWork
      },
      dietary: {
        dietaryRestrictions: profile.dietaryPreferences.dietaryRestrictions,
        foodAllergies: profile.dietaryPreferences.foodAllergies,
        foodsToAvoid: profile.dietaryPreferences.foodsToAvoid,
        preferredMealCount: profile.dietaryPreferences.preferredMealCount,
        cookingSkill: profile.dietaryPreferences.cookingSkill,
        budgetLevel: profile.dietaryPreferences.budgetLevel
      },
      goal: {
        goalType: profile.goal.goalType,
        targetWeightKg: profile.goal.targetWeightKg,
        targetBodyFatPercentage: profile.goal.targetBodyFatPercentage,
        targetMuscleGainKg: profile.goal.targetMuscleGainKg,
        desiredTimelineWeeks: profile.goal.desiredTimelineWeeks,
        motivation: profile.goal.motivation,
        previousAttempts: profile.goal.previousAttempts,
        biggestChallenge: profile.goal.biggestChallenge
      }
    };
  }

  /**
   * Generate RAG query context from profile
   */
  static generateRAGContext(profile: CandidateProfile): string[] {
    const contexts: string[] = [];

    // Physical context
    contexts.push(`${profile.physicalStats.sex} age ${profile.physicalStats.age}`);
    contexts.push(`${profile.physicalStats.weightKg}kg weight`);
    if (profile.physicalStats.bodyFatPercentage) {
      contexts.push(`${profile.physicalStats.bodyFatPercentage}% body fat`);
    }

    // Training context
    contexts.push(`${profile.trainingHistory.yearsTraining} years training experience`);
    contexts.push(`${profile.trainingHistory.currentTrainingDaysPerWeek} days per week`);
    contexts.push(profile.trainingHistory.trainingStyle.join(' '));

    // Goal context
    contexts.push(profile.goal.goalType);
    if (profile.goal.targetBodyFatPercentage) {
      contexts.push(`target ${profile.goal.targetBodyFatPercentage}% body fat`);
    }
    if (profile.goal.targetWeightKg) {
      contexts.push(`target ${profile.goal.targetWeightKg}kg weight`);
    }

    // Lifestyle context
    contexts.push(profile.lifestyle.activityLevel);
    contexts.push(`${profile.lifestyle.availableTrainingTimeMinutes} minutes training time`);

    // Dietary context
    if (profile.dietaryPreferences.dietaryRestrictions.length > 0) {
      contexts.push(profile.dietaryPreferences.dietaryRestrictions.join(' '));
    }

    return contexts;
  }

  /**
   * Generate specific RAG queries for different aspects
   */
  static generateRAGQueries(profile: CandidateProfile): {
    feasibility: string[];
    strategy: string[];
    training: string[];
    nutrition: string[];
    timeline: string[];
  } {
    const { physicalStats, trainingHistory, lifestyle, goal } = profile;

    return {
      feasibility: [
        `Is ${goal.goalType} achievable for ${physicalStats.sex} age ${physicalStats.age} in ${goal.desiredTimelineWeeks} weeks?`,
        `What are the physiological limits for ${goal.goalType}?`,
        `Maximum safe rate for ${goal.goalType} given current stats`,
        `Timeline constraints for ${goal.goalType} with ${trainingHistory.yearsTraining} years experience`
      ],
      strategy: [
        `Best approach for ${goal.goalType} with ${trainingHistory.yearsTraining} years training experience`,
        `Optimal training frequency for ${lifestyle.activityLevel} activity level`,
        `Macro distribution for ${goal.goalType} ${physicalStats.sex}`,
        `Periodization scheme for ${goal.desiredTimelineWeeks} weeks`
      ],
      training: [
        `Training volume for ${goal.goalType} ${trainingHistory.yearsTraining} years experience`,
        `Exercise selection for ${trainingHistory.hasEquipment.join(' ')} equipment`,
        `Progression scheme for ${goal.goalType}`,
        `Recovery needs for ${lifestyle.stressLevel}/10 stress level`
      ],
      nutrition: [
        `Protein requirements for ${goal.goalType} ${physicalStats.leanBodyMassKg}kg lean mass`,
        `Meal timing for ${lifestyle.availableTrainingTimeMinutes} minutes training time`,
        `Budget-friendly meals for ${profile.dietaryPreferences.budgetLevel} budget`,
        `Meal prep strategies for ${profile.dietaryPreferences.cookingSkill} cooking skill`
      ],
      timeline: [
        `Expected timeline for ${goal.goalType} with current profile`,
        `Weekly progression for ${goal.desiredTimelineWeeks} week program`,
        `Adaptation timeline for ${trainingHistory.yearsTraining} years experience`,
        `Recovery timeline for ${lifestyle.averageSleepHours} hours sleep`
      ]
    };
  }

  /**
   * Generate goal feasibility analysis prompt
   */
  static generateFeasibilityPrompt(profile: CandidateProfile, ragContext: string): string {
    return `
You are a fitness science expert analyzing goal feasibility.

CRITICAL INSTRUCTIONS:
- Base your analysis ONLY on the provided profile data and research evidence.
- Explicitly reference the candidate's current weight, body-fat percentage, desired body-fat change, and timeline in your calculations.
- Calculate the required weekly rate of change and compare it to safe evidence-based ranges before deciding it is infeasible.
- Respect the candidate's stated goal and timeline unless concrete evidence shows it is unsafe or physiologically impossible; if you extend the timeline, quantify exactly why.
- If research is insufficient, state this explicitly and explain the assumptions you are making.
- Cite specific studies for claims about limits and timelines.

CANDIDATE PROFILE:
${this.toPrompt(profile)}

RESEARCH EVIDENCE:
${ragContext}

ANALYSIS REQUIRED:
1. Is the target weight loss/gain rate physiologically safe?
   - Cite research on maximum safe rates
   - Consider candidate's starting point

2. Is the timeline realistic?
   - Compare to research-based timelines
   - Account for candidate's experience level

3. Are there any contraindications?
   - Age, health status, training history
   - Cite relevant research

OUTPUT FORMAT:
{
  "is_feasible": true/false,
  "needs_adjustment": true/false,
  "confidence_score": 0.0-1.0,
  "reasoning": "detailed explanation with citations",
  "physiological_concerns": ["list", "of", "concerns"],
  "adjusted_goal": {...} // if needs_adjustment
  "alternatives": [{...}] // if not feasible
  "research_citations": ["citation1", "citation2"]
}

Be honest and conservative - better to adjust expectations than create unsafe plans.
`;
  }

  /**
   * Generate strategic approach prompt
   */
  static generateStrategyPrompt(profile: CandidateProfile, ragContext: string): string {
    return `
You are designing a research-backed strategy blueprint for a personalised fitness transformation. Deliver one JSON object that captures:
- The strategic overview (training, nutrition, recovery, periodisation, success factors, obstacles)
- Evidence-backed phase blueprints that cover the entire timeline week by week
- Reusable daily and meal templates the engineering layer can expand deterministically

CANDIDATE PROFILE:
${this.toPrompt(profile)}

RESEARCH EVIDENCE:
${ragContext}

STRICT REQUIREMENTS:
- Timeline length = ${profile.goal.desiredTimelineWeeks} weeks. Ensure the sum of phase durations equals this.
- Weekly progression arrays must have exactly the number of weeks covered by their phase.
- Provide pragmatic, safety-first guidance aligned with the candidate's constraints.
- Use citations IDs (short references) for every major recommendation.
- All numbers should be realistic and conservative where evidence is weak.

OUTPUT FORMAT:
{
  "training_approach": {
    "style": "string",
    "frequency": number,
    "volume_progression": "string",
    "periodization": "string"
  },
  "nutrition_strategy": {
    "calorie_approach": "string",
    "macro_distribution": "string",
    "meal_timing": "string",
    "special_considerations": ["string"]
  },
  "recovery_protocols": {
    "sleep_optimization": "string",
    "deload_schedule": "string",
    "stress_management": "string"
  },
  "periodization": {
    "phases": [{"name": "string", "weeks": [number, number], "focus": "string"}],
    "progression": "string"
  },
  "success_factors": ["string"],
  "obstacles": [{"obstacle": "string", "mitigation": "string"}],
  "reasoning": "string",
  "citations": ["string"],
  "phase_blueprints": [
    {
      "name": "string",
      "start_week": number,
      "duration_weeks": number,
      "focus": "string",
      "weekly_progression": {
        "calories": [number],
        "protein": [number],
        "fat": [number],
        "carbs": [number],
        "training_volume": [number],
        "cardio_minutes": [number],
        "confidence": [number],
        "reasoning": ["string"]
      },
      "key_session_focus": ["string"],
      "adaptation_notes": "string",
      "primary_citations": ["string"]
    }
  ],
  "weekly_guidelines": {
    "macro_anchors": {
      "base_calories": number,
      "base_protein": number,
      "base_fat": number,
      "base_carbs": number
    },
    "adjustment_rules": {
      "calories_per_week": number,
      "cardio_minutes_per_week": number,
      "training_volume_percent_per_week": number
    },
    "recovery_directives": ["string"]
  },
  "daily_template": {
    "target_training_days": number,
    "training_day_sequences": [
      {
        "name": "string",
        "focus": "string",
        "duration_minutes": number,
        "intensity": "string",
        "key_exercises": [
          {"name": "string", "sets": number, "reps": "string", "intensity": "string", "rest_minutes": number}
        ],
        "notes": "string"
      }
    ],
    "recovery_day_template": {
      "focus": "string",
      "activities": ["string"],
      "duration_minutes": number,
      "notes": "string"
    },
    "scheduling_notes": "string"
  },
  "meal_template": {
    "meals_per_day": number,
    "meal_blueprints": [
      {
        "name": "string",
        "timing": "string",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "example_foods": [{"name": "string", "amount": "string", "calories": number}],
        "prep_tips": ["string"]
      }
    ],
    "shopping_categories": ["string"],
    "batching_strategies": ["string"],
    "notes": "string"
  },
  "coaching_notes": "string",
  "additional_citations": ["string"]
}
`;
  }
}
