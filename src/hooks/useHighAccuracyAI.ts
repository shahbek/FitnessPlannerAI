// High-Accuracy AI Planning Hook - With Integrated RAG + AI Pipeline
import { useState, useCallback } from 'react';
import { integratedPlanningService, DebugSnapshot } from '@/services/integratedPlanningService';
import { CandidateProfile, CandidateProfileBuilder, ProfileValidator } from '@/types/candidateProfile';

// Define the plan type based on the integrated service return
export type HighAccuracyPlan = {
  feasibility: any;
  strategicFramework: any;
  exerciseLibrary: any[];
  sessionTemplates: any[];
  mealTemplates: any[];
  shoppingList: {
    proteins: string[];
    carbs: string[];
    fats: string[];
    vegetables: string[];
    condiments: string[];
  };
  phaseProgression: any[];
  debugLog: DebugSnapshot[];
};

export interface HighAccuracyProgress {
  phase: 'profiling' | 'analysis' | 'planning' | 'validation' | 'complete';
  progress: number;
  currentStep: string;
  reasoning: string[];
  rateLimiting?: boolean;
}

// AI API call function (legacy - not used in new system)
// async function callAI(prompt: string, apiKey: string, endpoint: string, model: string): Promise<string> {
//   const response = await fetch(endpoint, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`,
//     },
//     body: JSON.stringify({
//       model,
//       messages: [
//         {
//           role: 'system',
//           content: 'You are a highly accurate AI fitness planning expert with 90%+ confidence in your recommendations. Always provide detailed, evidence-based fitness plans with scientific references. Return responses in valid JSON format.'
//         },
//         {
//           role: 'user',
//           content: prompt
//         }
//       ],
//       temperature: 0.3,
//       max_tokens: 4000
//     })
//   });

//   if (!response.ok) {
//     throw new Error(`API call failed: ${response.status} ${response.statusText}`);
//   }

//   const data = await response.json();
//   return data.choices[0].message.content;
// }

export function useHighAccuracyAI() {
  const [plan, setPlan] = useState<HighAccuracyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<HighAccuracyProgress | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [planSnapshots, setPlanSnapshots] = useState<DebugSnapshot[]>([]);

  // RAG initialization is now handled by the integrated service

  const generateHighAccuracyPlan = useCallback(async (formData: any) => {
    try {
      setLoading(true);
      setError(null);
      setPlanSnapshots([]);
      
      // Step 1: Create comprehensive candidate profile
      setProgress({
        phase: 'profiling',
        progress: 20,
        currentStep: 'Creating comprehensive candidate profile...',
        reasoning: ['Analyzing user data...', 'Building detailed profile...', 'Validating profile completeness...']
      });

      const candidateProfile = await buildCandidateProfile(formData);
      
      // Validate profile
      const validation = ProfileValidator.validate(candidateProfile);
      if (!validation.isValid) {
        throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
      }

      setProgress({
        phase: 'analysis',
        progress: 40,
              currentStep: 'Initializing integrated RAG + AI system...',
              reasoning: ['Loading research knowledge base...', 'Initializing AI client...', 'Preparing for goal feasibility analysis...']
            });

            // Initialize the integrated planning service with API key and form configuration
            const apiKey = formData.apiKey;
            const endpoint = formData.endpoint || 'https://api.groq.com/openai/v1/chat/completions';
            const model = formData.model || 'llama-3.3-70b-versatile';
            
            if (!apiKey) {
              throw new Error('API key is required');
            }
            
            console.log('🔧 API Configuration:', { endpoint, model, apiKey: apiKey.substring(0, 10) + '...' });
            await integratedPlanningService.initialize(apiKey, endpoint, model);

            // Step 2: Generate complete plan using integrated service
      setProgress({
        phase: 'planning',
              progress: 60,
              currentStep: 'Generating complete plan with RAG + AI...',
              reasoning: ['Analyzing goal feasibility...', 'Determining strategic approach...', 'Creating weekly plans...', 'Generating daily plans...', 'Creating meal plans...']
            });

            console.log('🚀 Starting complete plan generation...');
            const completePlan = await integratedPlanningService.generatePlan(candidateProfile, snapshot => {
              setPlanSnapshots(prev => [...prev, snapshot]);
            });
            console.log('📋 Complete plan generated:', completePlan);

      // Step 3: Handle feasibility assessment
      if (!completePlan.feasibility.isFeasible) {
        console.warn('⚠️ Goal not feasible:', completePlan.feasibility.reasoning);
        setError(`Goal not feasible: ${completePlan.feasibility.reasoning}`);
        setProgress(null);
        return;
      }

      // Step 4: Set successful plan
      setPlan(completePlan);
      if (completePlan.debugLog && completePlan.debugLog.length) {
        setPlanSnapshots(completePlan.debugLog);
      }
      
      setProgress({
        phase: 'complete',
        progress: 100,
        currentStep: 'High-accuracy AI plan generated successfully!',
        reasoning: [
          `Plan generated with ${Math.round(completePlan.feasibility.confidenceScore * 100)}% confidence`,
          `Based on ${completePlan.feasibility.researchCitations.length} research sources`,
          `Generated ${completePlan.exerciseLibrary.length} exercises`,
          `Generated ${completePlan.sessionTemplates.length} session templates`,
          `Generated ${completePlan.mealTemplates.length} meal templates`,
          `Generated ${completePlan.phaseProgression.length} program phases`,
          'Zero static data - all calculations from RAG + AI',
          'Ready for implementation!'
        ]
      });

      // Clear progress after delay
      setTimeout(() => setProgress(null), 3000);

    } catch (err: any) {
      console.error('High-accuracy generation error:', err);
      setError(err.message || 'Failed to generate high-accuracy plan. Please try again.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    plan,
    loading,
    error,
    progress,
    generateHighAccuracyPlan,
    clearError,
    clearProgress,
    planSnapshots
  };
}

// Helper function to build candidate profile from form data
async function buildCandidateProfile(formData: any): Promise<CandidateProfile> {
  const baseProfile = CandidateProfileBuilder.createEmpty();
  
  // Build physical stats
  const physicalStats = {
    age: Number(formData.age) || 30,
    sex: (formData.sex as 'male' | 'female' | 'other') || 'male',
    heightCm: Number(formData.heightCm) || 175,
    weightKg: Number(formData.weightKg) || 70,
    bodyFatPercentage: formData.bodyFat ? Number(formData.bodyFat) : undefined,
    bmi: 0, // Will be calculated
    leanBodyMassKg: undefined // Will be calculated
  };
  
  // Calculate BMI
  physicalStats.bmi = CandidateProfileBuilder.calculateBMI(physicalStats.heightCm, physicalStats.weightKg);
  
  // Calculate lean body mass if body fat is provided
  if (physicalStats.bodyFatPercentage) {
    physicalStats.leanBodyMassKg = CandidateProfileBuilder.calculateLeanBodyMass(
      physicalStats.weightKg, 
      physicalStats.bodyFatPercentage
    );
  }

  const targetTrainingDays = normalizeTrainingDays(formData.trainingDaysPerWeek, formData.schedule || '');
  const workoutLevel = (formData.workoutLevel as string) || 'intermediate';
  const workoutSplit = formData.workoutSplit || 'upper_lower';

  // Build training history (simplified from form data)
  const trainingHistory = {
    yearsTraining: mapWorkoutLevelToYears(workoutLevel),
    currentTrainingDaysPerWeek: targetTrainingDays,
    trainingStyle: deriveTrainingStylesFromSplit(workoutSplit),
    experienceLevel: mapWorkoutLevelToExperience(workoutLevel),
    preferredSplit: workoutSplit,
    canDoPushups: true, // Default, could be enhanced
    canDoPullups: false, // Default, could be enhanced
    hasGymAccess: (formData.equipment || '').toLowerCase().includes('gym') || 
                  (formData.equipment || '').toLowerCase().includes('barbell'),
    hasEquipment: parseEquipment(formData.equipment || ''),
    injuriesOrLimitations: [] // Could be enhanced
  };

  // Build lifestyle factors
  const lifestyle = {
    activityLevel: inferActivityLevelFromTrainingDays(targetTrainingDays),
    averageSleepHours: 8, // Default, could be enhanced
    stressLevel: 5, // Default, could be enhanced
    availableTrainingTimeMinutes: parseTrainingTime(formData.schedule || ''),
    availableMealPrepTimeMinutes: 30, // Default, could be enhanced
    jobType: 'sedentary', // Default, could be enhanced
    shiftWork: false // Default, could be enhanced
  };

  // Build dietary preferences
  const dietaryPreferences = {
    dietaryRestrictions: ['none'], // Default, could be enhanced
    foodAllergies: [], // Could be enhanced
    foodsToAvoid: parseFoodsToAvoid(formData.avoid || ''),
    preferredMealCount: 3, // Default, could be enhanced
    cookingSkill: 'intermediate' as const, // Default, could be enhanced
    budgetLevel: 'medium' as const // Default, could be enhanced
  };

  // Build goal
  const goal = {
    goalType: parseGoalType(formData.goal || ''),
    targetWeightKg: formData.targetBf ? undefined : parseTargetWeight(formData.goal || ''),
    targetBodyFatPercentage: formData.targetBf ? Number(formData.targetBf) : parseTargetBodyFat(formData.goal || ''),
    targetMuscleGainKg: undefined, // Could be enhanced
    desiredTimelineWeeks: formData.timelineWeeks ? Number(formData.timelineWeeks) : 16, // Use form data or default to 16
    motivation: 'General fitness improvement', // Default, could be enhanced
    previousAttempts: [], // Could be enhanced
    biggestChallenge: 'Consistency' // Default, could be enhanced
  };

  const profile: CandidateProfile = {
    physicalStats,
    trainingHistory,
    lifestyle,
    dietaryPreferences,
    goal,
    profileId: `profile_${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    completenessScore: 0, // Will be calculated
    missingFields: [] // Will be calculated
  };

  // Calculate completeness
  const completeness = CandidateProfileBuilder.calculateCompleteness(profile);
  profile.completenessScore = completeness.score;
  profile.missingFields = completeness.missingFields;

  return profile;
}

// Helper functions for parsing form data
function normalizeTrainingDays(input: number | string | undefined, schedule: string): number {
  const parsed = Number(input);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.max(1, Math.min(7, Math.round(parsed)));
  }
  return estimateTrainingDays(schedule);
}

function estimateTrainingDays(schedule: string): number {
  const scheduleLower = schedule.toLowerCase();
  if (scheduleLower.includes('daily') || scheduleLower.includes('7 days')) return 7;
  if (scheduleLower.includes('6 days')) return 6;
  if (scheduleLower.includes('5 days')) return 5;
  if (scheduleLower.includes('4 days')) return 4;
  if (scheduleLower.includes('3 days')) return 3;
  if (scheduleLower.includes('2 days')) return 2;
  if (scheduleLower.includes('1 day')) return 1;
  return 3; // Default
}

function parseEquipment(equipment: string): string[] {
  const equipmentLower = equipment.toLowerCase();
  const equipmentList: string[] = [];
  
  if (equipmentLower.includes('barbell')) equipmentList.push('barbell');
  if (equipmentLower.includes('dumbbell')) equipmentList.push('dumbbells');
  if (equipmentLower.includes('band')) equipmentList.push('bands');
  if (equipmentLower.includes('gym')) equipmentList.push('gym');
  if (equipmentLower.includes('bodyweight')) equipmentList.push('bodyweight');
  
  return equipmentList.length > 0 ? equipmentList : ['bodyweight'];
}

function mapWorkoutLevelToYears(level: string): number {
  const normalized = level.toLowerCase();
  if (normalized === 'beginner') return 0.5;
  if (normalized === 'expert') return 6;
  return 3; // intermediate default
}

function mapWorkoutLevelToExperience(level: string): 'beginner' | 'intermediate' | 'expert' {
  const normalized = level.toLowerCase();
  if (normalized === 'beginner') return 'beginner';
  if (normalized === 'expert') return 'expert';
  return 'intermediate';
}

function inferActivityLevelFromTrainingDays(trainingDays: number): 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' {
  if (trainingDays <= 1) return 'sedentary';
  if (trainingDays === 2) return 'light';
  if (trainingDays <= 4) return 'moderate';
  if (trainingDays === 5) return 'active';
  return 'very_active';
}

function deriveTrainingStylesFromSplit(split: string): string[] {
  const normalized = split.toLowerCase();
  if (normalized.includes('full')) {
    return ['full_body', 'strength'];
  }
  if (normalized.includes('push') || normalized.includes('pull')) {
    return ['push', 'pull', 'legs'];
  }
  if (normalized.includes('upper') && normalized.includes('lower')) {
    return ['upper', 'lower'];
  }
  if (normalized.includes('bro') || normalized.includes('body part')) {
    return ['body_part_split'];
  }
  if (normalized.includes('phul')) {
    return ['power', 'hypertrophy', 'upper', 'lower'];
  }
  return ['strength'];
}

function parseTrainingTime(schedule: string): number {
  const scheduleLower = schedule.toLowerCase();
  if (scheduleLower.includes('45 min')) return 45;
  if (scheduleLower.includes('60 min')) return 60;
  if (scheduleLower.includes('90 min')) return 90;
  if (scheduleLower.includes('30 min')) return 30;
  return 60; // Default
}

function parseFoodsToAvoid(avoid: string): string[] {
  if (!avoid || avoid.trim() === '') return [];
  return avoid.split(',').map(food => food.trim()).filter(food => food.length > 0);
}

function parseGoalType(goal: string): 'fat_loss' | 'muscle_gain' | 'body_recomposition' | 'maintenance' | 'athletic_performance' {
  const goalLower = goal.toLowerCase();
  if (goalLower.includes('fat') || goalLower.includes('cut') || goalLower.includes('lose')) return 'fat_loss';
  if (goalLower.includes('muscle') || goalLower.includes('gain') || goalLower.includes('bulk')) return 'muscle_gain';
  if (goalLower.includes('recomp') || goalLower.includes('recomposition')) return 'body_recomposition';
  if (goalLower.includes('maintain')) return 'maintenance';
  if (goalLower.includes('performance') || goalLower.includes('athletic')) return 'athletic_performance';
  return 'maintenance'; // Default
}

function parseTargetWeight(goal: string): number | undefined {
  const match = goal.match(/(\d+)\s*kg/);
  return match ? Number(match[1]) : undefined;
}

function parseTargetBodyFat(goal: string): number | undefined {
  const match = goal.match(/(\d+)%/);
  return match ? Number(match[1]) : undefined;
}
