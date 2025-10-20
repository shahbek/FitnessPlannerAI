// Test for Integrated Planning Service
import { integratedPlanningService } from '@/services/integratedPlanningService';
import { CandidateProfile, CandidateProfileBuilder } from '@/types/candidateProfile';

describe('Integrated Planning Service', () => {
  let testProfile: CandidateProfile;

  beforeEach(() => {
    // Create a test profile
    testProfile = {
      profileId: 'test-001',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completenessScore: 100,
      missingFields: [],
      physicalStats: {
        age: 25,
        sex: 'male',
        heightCm: 180,
        weightKg: 80,
        bodyFatPercentage: 15,
        bmi: 24.7,
        leanBodyMassKg: 68
      },
      trainingHistory: {
        yearsTraining: 3,
        currentTrainingDaysPerWeek: 4,
        trainingStyle: ['strength', 'cardio'],
        experienceLevel: 'intermediate',
        preferredSplit: 'upper_lower',
        canDoPushups: true,
        canDoPullups: true,
        hasGymAccess: true,
        hasEquipment: ['barbell', 'dumbbells', 'bench'],
        injuriesOrLimitations: []
      },
      lifestyle: {
        activityLevel: 'moderate' as any,
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
        preferredMealCount: 4,
        preferredCuisines: ['flexible'],
        cookingSkill: 'intermediate',
        budgetLevel: 'medium'
      },
      goal: {
        goalType: 'fat_loss' as any,
        targetBodyFatPercentage: 10,
        desiredTimelineWeeks: 12,
        motivation: 'Get lean for summer',
        previousAttempts: ['tried keto'],
        biggestChallenge: 'consistency'
      },
      medicalHistory: {
        injuries: [],
        chronicConditions: [],
        medications: [],
        supplements: []
      }
    };
  });

  test('should initialize successfully', async () => {
    // Mock API key and endpoint for testing
    await expect(
      integratedPlanningService.initialize('test-key', 'https://api.test.com', 'test-model')
    ).resolves.not.toThrow();
  });

  test('should generate a complete plan', async () => {
    // Initialize the service
    await integratedPlanningService.initialize('test-key', 'https://api.test.com', 'test-model');
    
    // Mock the AI responses to avoid actual API calls
    const mockPlan = await integratedPlanningService.generatePlan(testProfile);
    
    expect(mockPlan).toBeDefined();
    expect(mockPlan.feasibility).toBeDefined();
    expect(mockPlan.strategicFramework).toBeDefined();
    expect(mockPlan.exerciseLibrary).toBeDefined();
    expect(mockPlan.sessionTemplates).toBeDefined();
    expect(mockPlan.mealTemplates).toBeDefined();
    expect(mockPlan.shoppingList).toBeDefined();
    expect(mockPlan.phaseProgression).toBeDefined();
    expect(mockPlan.debugLog).toBeDefined();
  });

  test('should handle errors gracefully', async () => {
    // Test with invalid profile
    const invalidProfile = { ...testProfile, physicalStats: { ...testProfile.physicalStats, age: 0 } };
    
    await integratedPlanningService.initialize('test-key', 'https://api.test.com', 'test-model');
    
    await expect(
      integratedPlanningService.generatePlan(invalidProfile)
    ).rejects.toThrow();
  });
});