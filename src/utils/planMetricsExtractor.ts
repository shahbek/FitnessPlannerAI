/**
 * Plan Metrics Extractor
 * 
 * Extracts and validates metrics from plan data, ensuring we use
 * plan-calculated values when available, with accurate fallbacks.
 */

import { calculateBMI, getBMIClassification } from './planCalculations';
import type { UserMetrics } from '@/services/NutritionCalculationService';

export interface ExtractedPlanMetrics {
  // User Profile
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  primaryGoal?: string;
  experienceLevel?: string;
  workoutDaysPerWeek?: number;
  sessionDuration?: number;
  equipmentAccess?: string[];
  dietaryRestrictions?: string[];

  // Calculated Metrics (from plan or computed)
  bmr: number;
  tdee: number;
  bmi: number;
  bmiClassification: string;
  
  // Macros
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinPerKg: number;

  // Energy Balance
  dailyDeficit: number;
  weeklyDeficit: number;
  expectedWeeklyWeightLoss: number;
  expectedWeeklyBodyFatLoss: number;

  // Training
  trainingFrequency: number;
  sessionDurationMinutes: number;
  trainingSplit: string;
  periodization: string;

  // Confidence
  confidenceScore: number;
  
  // Validation
  hasValidMetrics: boolean;
  missingFields: string[];
}

/**
 * Extract and validate all plan metrics
 */
export function extractPlanMetrics(
  plan: any,
  userProfile?: {
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    primaryGoal?: string;
    experienceLevel?: string;
    workoutDaysPerWeek?: number;
    sessionDuration?: number;
    equipmentAccess?: string[];
    dietaryRestrictions?: string[];
  }
): ExtractedPlanMetrics {
  const metrics = plan?.metrics || {};
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const feasibility = plan?.feasibility || {};
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Extract user profile (prioritize plan's embedded profile)
  const planUserProfile = plan?.userProfile || userProfile || {};
  const age = planUserProfile?.age;
  const gender = planUserProfile?.gender;
  const height = planUserProfile?.height;
  const weight = planUserProfile?.weight;
  const primaryGoal = planUserProfile?.primaryGoal || framework?.nutritionApproach?.goal;
  const experienceLevel = planUserProfile?.experienceLevel;
  const workoutDaysPerWeek = planUserProfile?.workoutDaysPerWeek || framework?.trainingApproach?.frequencyPerWeek;
  const sessionDuration = planUserProfile?.sessionDuration || framework?.trainingApproach?.sessionDurationMinutes;

  // Calculate BMR (use plan value if available and valid, otherwise calculate)
  let bmr = metrics?.bmr?.value || 0;
  if (!bmr && weight && height && age && gender) {
    const sex = gender.toLowerCase() === 'male' || gender.toLowerCase() === 'm' ? 'male' : 'female';
    bmr = sex === 'male'
      ? Math.round(10 * weight + 6.25 * height - 5 * age + 5)
      : Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }

  // Calculate TDEE (use plan value if available and valid, otherwise calculate)
  let tdee = metrics?.tdee?.value || 0;
  if (!tdee && bmr > 0) {
    const trainingDays = workoutDaysPerWeek || 3;
    let activityFactor = 1.55; // Moderate default
    if (trainingDays <= 2) activityFactor = 1.375;
    else if (trainingDays <= 3) activityFactor = 1.55;
    else if (trainingDays <= 5) activityFactor = 1.725;
    else activityFactor = 1.9;
    tdee = Math.round(bmr * activityFactor);
  }

  // Calculate BMI
  let bmi = metrics?.bmi?.value || 0;
  if (!bmi && height && weight) {
    bmi = calculateBMI(height, weight);
  }
  const bmiClassification = bmi > 0 ? getBMIClassification(bmi) : 'Unknown';

  // Extract macros
  const targetCalories = metrics?.macros?.calories || weeklyOutlines[0]?.dailyTargets?.calories || 0;
  const protein = metrics?.macros?.protein || weeklyOutlines[0]?.dailyTargets?.protein || 0;
  const carbs = metrics?.macros?.carbs || weeklyOutlines[0]?.dailyTargets?.carbs || 0;
  const fat = metrics?.macros?.fat || weeklyOutlines[0]?.dailyTargets?.fat || 0;
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg || 
                       (weight > 0 ? protein / weight : 0);

  // Calculate energy balance
  const dailyDeficit = framework?.nutritionApproach?.caloricStrategy?.dailyDeficitCalories > 0
    ? framework.nutritionApproach.caloricStrategy.dailyDeficitCalories
    : (tdee > 0 && targetCalories > 0 ? tdee - targetCalories : 0);
  
  const weeklyDeficit = framework?.nutritionApproach?.caloricStrategy?.weeklyDeficitCalories > 0
    ? framework.nutritionApproach.caloricStrategy.weeklyDeficitCalories
    : (dailyDeficit * 7);

  const expectedWeeklyWeightLoss = weeklyDeficit > 0 ? weeklyDeficit / 7700 : 0;

  // Calculate body fat loss percentage
  const hasResistanceTraining = (framework?.trainingApproach?.frequencyPerWeek || 
                                weeklyOutlines[0]?.trainingSchedule?.resistanceDays?.length || 0) > 0;
  const fatLossPercentage = (proteinPerKg >= 2.0 && hasResistanceTraining) ? 0.75 : 
                            (proteinPerKg >= 1.5) ? 0.65 : 0.55;
  const expectedWeeklyBodyFatLoss = expectedWeeklyWeightLoss * fatLossPercentage;

  // Training metrics
  const trainingFrequency = framework?.trainingApproach?.frequencyPerWeek || 
                           weeklyOutlines[0]?.trainingSchedule?.resistanceDays?.length || 0;
  const sessionDurationMinutes = framework?.trainingApproach?.sessionDurationMinutes || 
                                weeklyOutlines[0]?.trainingSchedule?.sessionDuration || 60;
  const trainingSplit = framework?.trainingApproach?.split || 'Not specified';
  const periodization = framework?.trainingApproach?.periodization || 'Progressive';

  // Confidence
  const confidenceScore = feasibility?.confidenceScore || 0;

  // Validation
  const missingFields: string[] = [];
  if (!weight) missingFields.push('weight');
  if (!height) missingFields.push('height');
  if (!age) missingFields.push('age');
  if (!gender) missingFields.push('gender');
  if (tdee === 0) missingFields.push('TDEE');
  if (targetCalories === 0) missingFields.push('target calories');

  const hasValidMetrics = missingFields.length === 0 && tdee > 0 && targetCalories > 0;

  return {
    // User Profile
    age,
    gender,
    height,
    weight,
    primaryGoal,
    experienceLevel,
    workoutDaysPerWeek,
    sessionDuration,
    equipmentAccess: planUserProfile?.equipmentAccess,
    dietaryRestrictions: planUserProfile?.dietaryRestrictions,

    // Metrics
    bmr,
    tdee,
    bmi,
    bmiClassification,

    // Macros
    targetCalories,
    protein,
    carbs,
    fat,
    proteinPerKg,

    // Energy Balance
    dailyDeficit,
    weeklyDeficit,
    expectedWeeklyWeightLoss,
    expectedWeeklyBodyFatLoss,

    // Training
    trainingFrequency,
    sessionDurationMinutes,
    trainingSplit,
    periodization,

    // Confidence
    confidenceScore,

    // Validation
    hasValidMetrics,
    missingFields,
  };
}

