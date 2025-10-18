// Candidate Profile Tests
// Tests for comprehensive profile system

import { 
  CandidateProfile, 
  CandidateProfileBuilder, 
  ProfileValidator,
  ActivityLevel,
  GoalType 
} from '@/types/candidateProfile';

describe('CandidateProfileBuilder', () => {
  describe('createEmpty', () => {
    it('should create empty profile with default values', () => {
      const profile = CandidateProfileBuilder.createEmpty();
      
      expect(profile.physicalStats?.age).toBe(0);
      expect(profile.physicalStats?.sex).toBe('male');
      expect(profile.trainingHistory?.yearsTraining).toBe(0);
      expect(profile.lifestyle?.activityLevel).toBe(ActivityLevel.SEDENTARY);
      expect(profile.goal?.goalType).toBe(GoalType.MAINTENANCE);
    });
  });

  describe('calculateBMI', () => {
    it('should calculate BMI correctly', () => {
      const bmi = CandidateProfileBuilder.calculateBMI(180, 80);
      expect(bmi).toBeCloseTo(24.69, 2);
    });

    it('should handle edge cases', () => {
      const bmi = CandidateProfileBuilder.calculateBMI(100, 30);
      expect(bmi).toBe(30);
    });
  });

  describe('calculateLeanBodyMass', () => {
    it('should calculate lean body mass correctly', () => {
      const lbm = CandidateProfileBuilder.calculateLeanBodyMass(80, 20);
      expect(lbm).toBe(64);
    });

    it('should handle 0% body fat', () => {
      const lbm = CandidateProfileBuilder.calculateLeanBodyMass(80, 0);
      expect(lbm).toBe(80);
    });
  });

  describe('calculateCompleteness', () => {
    it('should calculate completeness score correctly', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        },
        trainingHistory: {
          yearsTraining: 3,
          currentTrainingDaysPerWeek: 4,
          trainingStyle: ['strength'],
          canDoPushups: true,
          canDoPullups: false,
          hasGymAccess: true,
          hasEquipment: ['barbell'],
          injuriesOrLimitations: []
        },
        lifestyle: {
          activityLevel: ActivityLevel.ACTIVE,
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
          cookingSkill: 'intermediate',
          budgetLevel: 'medium'
        },
        goal: {
          goalType: GoalType.FAT_LOSS,
          targetWeightKg: 75,
          targetBodyFatPercentage: 15,
          targetMuscleGainKg: undefined,
          desiredTimelineWeeks: 12,
          motivation: 'Get in shape for summer',
          previousAttempts: [],
          biggestChallenge: 'Consistency'
        }
      };

      const result = CandidateProfileBuilder.calculateCompleteness(profile);
      expect(result.score).toBe(100);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify missing fields', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 0, // Missing
          sex: 'male',
          heightCm: 0, // Missing
          weightKg: 0, // Missing
          bodyFatPercentage: undefined,
          bmi: 0,
          leanBodyMassKg: undefined
        }
      };

      const result = CandidateProfileBuilder.calculateCompleteness(profile);
      expect(result.score).toBeLessThan(100);
      expect(result.missingFields).toContain('physicalStats.age');
      expect(result.missingFields).toContain('physicalStats.heightCm');
      expect(result.missingFields).toContain('physicalStats.weightKg');
    });
  });
});

describe('ProfileValidator', () => {
  describe('validate', () => {
    it('should validate complete profile successfully', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        },
        trainingHistory: {
          yearsTraining: 3,
          currentTrainingDaysPerWeek: 4,
          trainingStyle: ['strength'],
          canDoPushups: true,
          canDoPullups: false,
          hasGymAccess: true,
          hasEquipment: ['barbell'],
          injuriesOrLimitations: []
        },
        lifestyle: {
          activityLevel: ActivityLevel.ACTIVE,
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
          cookingSkill: 'intermediate',
          budgetLevel: 'medium'
        },
        goal: {
          goalType: GoalType.FAT_LOSS,
          targetWeightKg: 75,
          targetBodyFatPercentage: 15,
          targetMuscleGainKg: undefined,
          desiredTimelineWeeks: 12,
          motivation: 'Get in shape for summer',
          previousAttempts: [],
          biggestChallenge: 'Consistency'
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch invalid age', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 150, // Invalid
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Age must be between 13 and 100 years');
    });

    it('should catch invalid height', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 50, // Invalid
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Height must be between 100 and 250 cm');
    });

    it('should catch invalid weight', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 500, // Invalid
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Weight must be between 30 and 300 kg');
    });

    it('should warn about unusual body fat percentage', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 1, // Unusual
          bmi: 24.69,
          leanBodyMassKg: 64
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.warnings).toContain('Body fat percentage seems unusual - please verify');
    });

    it('should warn about excessive fat loss rate', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        },
        goal: {
          goalType: GoalType.FAT_LOSS,
          targetWeightKg: 60, // 20kg loss
          targetBodyFatPercentage: 15,
          targetMuscleGainKg: undefined,
          desiredTimelineWeeks: 10, // Very aggressive
          motivation: 'Quick weight loss',
          previousAttempts: [],
          biggestChallenge: 'Consistency'
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.warnings).toContain('Target weight loss rate exceeds 1kg/week - may be unsafe');
    });

    it('should warn about unrealistic muscle gain rate', () => {
      const profile: Partial<CandidateProfile> = {
        physicalStats: {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        },
        goal: {
          goalType: GoalType.MUSCLE_GAIN,
          targetWeightKg: undefined,
          targetBodyFatPercentage: undefined,
          targetMuscleGainKg: 10, // 10kg muscle gain
          desiredTimelineWeeks: 12, // Very aggressive
          motivation: 'Quick muscle gain',
          previousAttempts: [],
          biggestChallenge: 'Consistency'
        }
      };

      const result = ProfileValidator.validate(profile);
      expect(result.warnings).toContain('Target muscle gain rate exceeds 0.5kg/week - may be unrealistic');
    });
  });
});
