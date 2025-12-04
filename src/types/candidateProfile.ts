// Comprehensive Candidate Profile System
// Foundation for all personalization and plan generation

export enum ActivityLevel {
  SEDENTARY = "sedentary",
  LIGHT = "light",
  MODERATE = "moderate",
  ACTIVE = "active",
  VERY_ACTIVE = "very_active"
}

export enum GoalType {
  FAT_LOSS = "fat_loss",
  MUSCLE_GAIN = "muscle_gain",
  RECOMP = "body_recomposition",
  MAINTENANCE = "maintenance",
  PERFORMANCE = "athletic_performance"
}

export interface PhysicalStats {
  /** Current physical measurements */
  age: number;
  sex: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  bodyFatPercentage?: number;

  /** Calculated fields */
  bmi: number;
  leanBodyMassKg?: number;
}

export interface TrainingHistory {
  /** Experience and current capabilities */
  yearsTraining: number;
  currentTrainingDaysPerWeek: number;
  trainingStyle: string[]; // ["strength", "cardio", "sports", "none"]
  experienceLevel?: 'beginner' | 'intermediate' | 'expert';
  preferredSplit?: string;

  /** Current capabilities */
  canDoPushups: boolean;
  canDoPullups: boolean;
  hasGymAccess: boolean;
  hasEquipment: string[]; // ["barbell", "dumbbells", "bands", "none"]

  injuriesOrLimitations: string[];
}

export interface LifestyleFactors {
  /** Daily life context */
  activityLevel: ActivityLevel;
  averageSleepHours: number;
  stressLevel: number; // 1-10 scale

  /** Schedule constraints */
  availableTrainingTimeMinutes: number;
  availableMealPrepTimeMinutes: number;

  /** Work/life */
  jobType: string; // "sedentary", "active", "manual_labor"
  shiftWork: boolean;
}

export interface DietaryPreferences {
  /** Food preferences and restrictions */
  dietaryRestrictions: string[]; // ["vegetarian", "vegan", "halal", "kosher", "none"]
  foodAllergies: string[];
  foodsToAvoid: string[];
  preferredMealCount: number; // Meals per day
  preferredCuisines: string[]; // ["italian", "asian", "mexican", "mediterranean", "flexible"]

  cookingSkill: 'beginner' | 'intermediate' | 'advanced';
  budgetLevel: 'low' | 'medium' | 'high';
}

export interface Goal {
  /** What the candidate wants to achieve */
  goalType: GoalType;

  /** Specific targets */
  targetWeightKg?: number;
  targetBodyFatPercentage?: number;
  targetMuscleGainKg?: number;

  /** Timeline */
  desiredTimelineWeeks: number;

  /** Motivation and context */
  motivation: string; // Free text explaining why
  previousAttempts: string[]; // What they've tried before
  biggestChallenge: string; // What usually stops them
}

export interface MedicalHistory {
  injuries: string[];
  chronicConditions: string[];
  medications: string[];
  supplements: string[];
}

export interface CandidateProfile {
  /** Complete candidate profile for AI analysis */

  // Core data
  physicalStats: PhysicalStats;
  trainingHistory: TrainingHistory;
  lifestyle: LifestyleFactors;
  dietaryPreferences: DietaryPreferences;
  goal: Goal;
  medicalHistory: MedicalHistory;

  // Metadata
  profileId: string;
  createdAt: string;
  lastUpdated: string;

  /** Profile completeness scoring */
  completenessScore: number; // 0-100%
  missingFields: string[];
}

// Helper functions for profile management
export class CandidateProfileBuilder {
  static createEmpty(): Partial<CandidateProfile> {
    return {
      physicalStats: {
        age: 0,
        sex: 'male',
        heightCm: 0,
        weightKg: 0,
        bodyFatPercentage: undefined,
        bmi: 0,
        leanBodyMassKg: undefined
      },
      trainingHistory: {
        yearsTraining: 0,
        currentTrainingDaysPerWeek: 0,
        trainingStyle: [],
        canDoPushups: false,
        canDoPullups: false,
        hasGymAccess: false,
        hasEquipment: [],
        injuriesOrLimitations: []
      },
      lifestyle: {
        activityLevel: ActivityLevel.SEDENTARY,
        averageSleepHours: 8,
        stressLevel: 5,
        availableTrainingTimeMinutes: 60,
        availableMealPrepTimeMinutes: 30,
        jobType: 'sedentary',
        shiftWork: false
      },
      dietaryPreferences: {
        dietaryRestrictions: ['none'],
        foodAllergies: [],
        foodsToAvoid: [],
        preferredMealCount: 3,
        preferredCuisines: [],
        cookingSkill: 'intermediate',
        budgetLevel: 'medium'
      },
      goal: {
        goalType: GoalType.MAINTENANCE,
        targetWeightKg: undefined,
        targetBodyFatPercentage: undefined,
        targetMuscleGainKg: undefined,
        desiredTimelineWeeks: 12,
        motivation: '',
        previousAttempts: [],
        biggestChallenge: ''
      }
    };
  }

  static calculateBMI(heightCm: number, weightKg: number): number {
    return weightKg / Math.pow(heightCm / 100, 2);
  }

  static calculateLeanBodyMass(weightKg: number, bodyFatPercentage: number): number {
    return weightKg * (1 - bodyFatPercentage / 100);
  }

  static calculateCompleteness(profile: Partial<CandidateProfile>): {
    score: number;
    missingFields: string[];
  } {
    const requiredFields = [
      'physicalStats.age',
      'physicalStats.sex',
      'physicalStats.heightCm',
      'physicalStats.weightKg',
      'trainingHistory.yearsTraining',
      'trainingHistory.currentTrainingDaysPerWeek',
      'lifestyle.activityLevel',
      'lifestyle.averageSleepHours',
      'dietaryPreferences.preferredMealCount',
      'goal.goalType',
      'goal.motivation'
    ];

    const missingFields: string[] = [];
    let completedFields = 0;

    requiredFields.forEach(field => {
      const value = this.getNestedValue(profile, field);
      if (value === undefined || value === null || value === '' || value === 0) {
        missingFields.push(field);
      } else {
        completedFields++;
      }
    });

    return {
      score: Math.round((completedFields / requiredFields.length) * 100),
      missingFields
    };
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Profile validation
export class ProfileValidator {
  static validate(profile: Partial<CandidateProfile>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Physical stats validation
    if (profile.physicalStats) {
      const { age, heightCm, weightKg, bodyFatPercentage } = profile.physicalStats;

      if (age < 13 || age > 100) {
        errors.push('Age must be between 13 and 100 years');
      }

      if (heightCm < 100 || heightCm > 250) {
        errors.push('Height must be between 100 and 250 cm');
      }

      if (weightKg < 30 || weightKg > 300) {
        errors.push('Weight must be between 30 and 300 kg');
      }

      if (bodyFatPercentage && (bodyFatPercentage < 3 || bodyFatPercentage > 50)) {
        warnings.push('Body fat percentage seems unusual - please verify');
      }
    }

    // Training history validation
    if (profile.trainingHistory) {
      const { yearsTraining, currentTrainingDaysPerWeek } = profile.trainingHistory;

      if (yearsTraining < 0 || yearsTraining > 50) {
        errors.push('Years of training must be between 0 and 50');
      }

      if (currentTrainingDaysPerWeek < 0 || currentTrainingDaysPerWeek > 7) {
        errors.push('Training days per week must be between 0 and 7');
      }
    }

    // Lifestyle validation
    if (profile.lifestyle) {
      const { averageSleepHours, stressLevel, availableTrainingTimeMinutes } = profile.lifestyle;

      if (averageSleepHours < 4 || averageSleepHours > 12) {
        warnings.push('Sleep hours seem unusual - please verify');
      }

      if (stressLevel < 1 || stressLevel > 10) {
        errors.push('Stress level must be between 1 and 10');
      }

      if (availableTrainingTimeMinutes < 15) {
        warnings.push('Very limited training time - consider adjusting schedule');
      }
    }

    // Goal validation
    if (profile.goal) {
      const { goalType, desiredTimelineWeeks, targetWeightKg, targetBodyFatPercentage } = profile.goal;

      if (desiredTimelineWeeks < 1 || desiredTimelineWeeks > 104) {
        errors.push('Timeline must be between 1 and 104 weeks (2 years)');
      }

      if (goalType === GoalType.FAT_LOSS && targetWeightKg && profile.physicalStats) {
        const currentWeight = profile.physicalStats.weightKg;
        const weightLoss = currentWeight - targetWeightKg;
        const weeklyLoss = weightLoss / desiredTimelineWeeks;

        if (weeklyLoss > 1.0) {
          warnings.push('Target weight loss rate exceeds 1kg/week - may be unsafe');
        }
      }

      if (goalType === GoalType.MUSCLE_GAIN && profile.goal.targetMuscleGainKg) {
        const weeklyGain = profile.goal.targetMuscleGainKg / desiredTimelineWeeks;
        if (weeklyGain > 0.5) {
          warnings.push('Target muscle gain rate exceeds 0.5kg/week - may be unrealistic');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
