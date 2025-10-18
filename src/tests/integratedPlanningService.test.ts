// Integrated Planning Service Tests
// Tests for RAG + AI pipeline

import { 
  IntegratedPlanningService, 
  CompletePlan 
} from '@/services/integratedPlanningService';
import { CandidateProfile, ActivityLevel, GoalType } from '@/types/candidateProfile';

// Mock the dependencies
jest.mock('@/ai/realAIClient');
jest.mock('@/ai/enhancedRAG');
jest.mock('@/utils/apiKeyValidator');

describe('IntegratedPlanningService', () => {
  let service: IntegratedPlanningService;
  let mockProfile: CandidateProfile;

  beforeEach(() => {
    service = new IntegratedPlanningService();
    
    // Create a mock candidate profile
    mockProfile = {
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
        hasEquipment: ['barbell', 'dumbbells'],
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
      },
      profileId: 'test-profile-1',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completenessScore: 100,
      missingFields: []
    };
  });

  describe('generateCompletePlan', () => {
    it('should throw error when not initialized', async () => {
      await expect(service.generateCompletePlan(mockProfile)).rejects.toThrow('not initialized');
    });

    it('should generate complete plan successfully', async () => {
      // Mock the service as initialized
      service['isInitialized'] = true;
      
      // Mock the RAG and AI responses
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Test RAG response',
        confidence: 0.9,
        sources: ['Test Source 1', 'Test Source 2']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          is_feasible: true,
          needs_adjustment: false,
          confidence_score: 0.9,
          reasoning: 'Goal is feasible',
          physiological_concerns: [],
          research_citations: ['Citation 1']
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const result = await service.generateCompletePlan(mockProfile);

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.profile).toBe(mockProfile);
      expect(result.weeklyPlans).toBeDefined();
      expect(result.dailyPlans).toBeDefined();
      expect(result.mealPlans).toBeDefined();
    });

    it('should handle goal not feasible', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Goal not feasible',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          is_feasible: false,
          needs_adjustment: false,
          confidence_score: 0.9,
          reasoning: 'Goal is not physiologically possible',
          physiological_concerns: ['Excessive weight loss rate'],
          alternatives: [{ goalType: 'fat_loss', targetWeightKg: 78, desiredTimelineWeeks: 16 }],
          research_citations: ['Citation 1']
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const result = await service.generateCompletePlan(mockProfile);

      expect(result.status).toBe('goal_not_feasible');
      expect(result.feasibility?.isFeasible).toBe(false);
      expect(result.weeklyPlans).toHaveLength(0);
    });

    it('should handle goal needs adjustment', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Goal needs adjustment',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          is_feasible: true,
          needs_adjustment: true,
          confidence_score: 0.9,
          reasoning: 'Goal is possible but timeline needs adjustment',
          physiological_concerns: ['Timeline too aggressive'],
          adjusted_goal: { desiredTimelineWeeks: 16 },
          research_citations: ['Citation 1']
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const result = await service.generateCompletePlan(mockProfile);

      expect(result.status).toBe('goal_needs_adjustment');
      expect(result.feasibility?.needsAdjustment).toBe(true);
      expect(result.feasibility?.adjustedGoal).toBeDefined();
    });
  });

  describe('assessGoalFeasibility', () => {
    it('should assess goal feasibility correctly', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Feasibility analysis',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          is_feasible: true,
          needs_adjustment: false,
          confidence_score: 0.9,
          reasoning: 'Goal is feasible',
          physiological_concerns: [],
          research_citations: ['Citation 1']
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const result = await service['assessGoalFeasibility'](mockProfile);

      expect(result.isFeasible).toBe(true);
      expect(result.needsAdjustment).toBe(false);
      expect(result.confidenceScore).toBe(0.9);
      expect(result.reasoning).toBe('Goal is feasible');
    });

    it('should handle malformed AI response', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Feasibility analysis',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: 'Invalid JSON response',
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const result = await service['assessGoalFeasibility'](mockProfile);

      expect(result.isFeasible).toBe(false);
      expect(result.confidenceScore).toBe(0.3);
      expect(result.reasoning).toBe('Unable to parse feasibility analysis');
    });
  });

  describe('generateWeeklyPlans', () => {
    it('should generate weekly plans for all weeks', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Weekly plan guidance',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          week: 1,
          phase: 'Adaptation',
          calories: 2000,
          protein: 160,
          fat: 70,
          carbs: 200,
          training_volume: 12,
          cardio_minutes: 60,
          confidence: 0.9,
          scientific_references: ['Reference 1'],
          reasoning: 'Week 1 plan'
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const mockStrategy = {
        trainingApproach: { style: 'strength', frequency: 4, volumeProgression: 'linear', periodization: 'block' },
        nutritionStrategy: { calorieApproach: 'deficit', macroDistribution: 'high protein', mealTiming: 'around training', specialConsiderations: [] },
        recoveryProtocols: { sleepOptimization: '8 hours', deloadSchedule: 'every 4 weeks', stressManagement: 'meditation' },
        periodization: { phases: [{ name: 'Adaptation', weeks: [1, 4], focus: 'strength' }], progression: 'linear' },
        successFactors: ['consistency'],
        obstacles: [{ obstacle: 'time', mitigation: 'schedule' }],
        reasoning: 'Strategy reasoning',
        citations: ['Citation 1']
      };

      const result = await service['generateWeeklyPlans'](mockProfile, mockStrategy);

      expect(result).toHaveLength(12); // 12 weeks
      expect(result[0].week).toBe(1);
      expect(result[0].phase).toBe('Adaptation');
      expect(result[0].calories).toBe(2000);
    });
  });

  describe('generateDailyPlans', () => {
    it('should generate daily plans for all days', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Daily plan guidance',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          day: 1,
          week: 1,
          is_training_day: true,
          workout_time: '07:00',
          calorie_target: 2000,
          protein_grams: 160,
          carb_grams: 200,
          fat_grams: 70,
          exercises: [{ name: 'Squat', sets: 4, reps: '8-10', intensity: 'RPE 8', rest_minutes: 3 }],
          focus: 'Lower body strength',
          confidence: 0.9,
          reasoning: 'Day 1 plan'
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const mockWeeklyPlans = [
        { week: 1, phase: 'Adaptation', calories: 2000, protein: 160, fat: 70, carbs: 200, trainingVolume: 12, cardioMinutes: 60, confidence: 0.9, scientificReferences: [], reasoning: 'Week 1' }
      ];

      const result = await service['generateDailyPlans'](mockProfile, mockWeeklyPlans);

      expect(result).toHaveLength(7); // 7 days
      expect(result[0].day).toBe(1);
      expect(result[0].week).toBe(1);
      expect(result[0].isTrainingDay).toBe(true);
    });
  });

  describe('generateMealPlans', () => {
    it('should generate meal plans for all days', async () => {
      service['isInitialized'] = true;
      
      const mockRAGQuery = jest.fn().mockResolvedValue({
        answer: 'Meal plan guidance',
        confidence: 0.9,
        sources: ['Test Source']
      });
      service['ragSystem'].query = mockRAGQuery;

      const mockAIResponse = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          day: 1,
          week: 1,
          meals: [
            { name: 'Breakfast', timing: '07:00', calories: 500, protein: 30, carbs: 50, fat: 20, foods: [{ name: 'Oatmeal', amount: '50g', calories: 200 }], prep_time: 10, description: 'Oatmeal with protein' }
          ],
          shopping_list: ['Oatmeal', 'Protein powder'],
          prep_tips: ['Prep overnight'],
          confidence: 0.9,
          reasoning: 'Day 1 meal plan'
        }),
        confidence: 0.9,
        reasoning: 'AI analysis complete'
      });
      service['aiClient'].generateStructuredResponse = mockAIResponse;

      const mockDailyPlans = [
        { day: 1, week: 1, isTrainingDay: true, calorieTarget: 2000, proteinGrams: 160, carbGrams: 200, fatGrams: 70, confidence: 0.9, reasoning: 'Day 1' }
      ];

      const result = await service['generateMealPlans'](mockProfile, mockDailyPlans);

      expect(result).toHaveLength(1); // 1 day
      expect(result[0].day).toBe(1);
      expect(result[0].week).toBe(1);
      expect(result[0].meals).toHaveLength(1);
      expect(result[0].meals[0].name).toBe('Breakfast');
    });
  });
});
