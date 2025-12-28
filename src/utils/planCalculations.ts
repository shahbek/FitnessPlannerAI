/**
 * Plan Calculation Utilities
 *
 * Functions for calculating calories, body composition, and other plan metrics
 */

/**
 * MET (Metabolic Equivalent) values for different exercise intensities
 */
const MET_VALUES = {
  resistance: {
    light: 3.5,
    moderate: 5.0,
    vigorous: 8.0,
  },
  cardio: {
    walking_slow: 3.0,
    walking_moderate: 4.0,
    walking_brisk: 5.0,
    jogging: 7.0,
    running: 10.0,
    cycling_moderate: 6.8,
    cycling_vigorous: 10.0,
    swimming: 7.0,
    rowing: 7.0,
    'steady state': 5.0,
    'moderate': 6.0,
    'vigorous': 8.0,
  }
};

/**
 * Calculate calories burned during exercise using MET formula
 * Formula: (METs * weight in kg * duration in hours * 1.05)
 *
 * @param intensity - Exercise intensity level
 * @param weightKg - User's weight in kg
 * @param durationMinutes - Duration of exercise in minutes
 * @param exerciseType - 'resistance' or 'cardio'
 * @returns Estimated calories burned
 */
export function calculateExerciseCalories(
  intensity: string,
  weightKg: number,
  durationMinutes: number,
  exerciseType: 'resistance' | 'cardio' = 'cardio'
): number {
  const intensityLower = intensity.toLowerCase();

  // Get MET value based on type and intensity
  let mets: number;
  if (exerciseType === 'resistance') {
    if (intensityLower.includes('light')) mets = MET_VALUES.resistance.light;
    else if (intensityLower.includes('vigorous') || intensityLower.includes('high')) mets = MET_VALUES.resistance.vigorous;
    else mets = MET_VALUES.resistance.moderate;
  } else {
    // Try to match specific cardio type
    const cardioMets = MET_VALUES.cardio[intensityLower as keyof typeof MET_VALUES.cardio];
    if (cardioMets) {
      mets = cardioMets;
    } else if (intensityLower.includes('light')) {
      mets = 4.0;
    } else if (intensityLower.includes('vigorous') || intensityLower.includes('high')) {
      mets = 8.0;
    } else {
      mets = 6.0; // Default moderate
    }
  }

  const durationHours = durationMinutes / 60;
  const calories = mets * weightKg * durationHours * 1.05;

  return Math.round(calories);
}

/**
 * Estimate resistance training calories based on session details
 *
 * @param sessionDuration - Duration in minutes
 * @param weightKg - User's weight in kg
 * @param intensity - Workout intensity (light/moderate/vigorous)
 * @returns Estimated calories burned
 */
export function estimateResistanceCalories(
  sessionDuration: number,
  weightKg: number,
  intensity: string = 'moderate'
): number {
  return calculateExerciseCalories(intensity, weightKg, sessionDuration, 'resistance');
}

/**
 * Calculate total weekly exercise calorie burn
 * Uses ACTUAL cardio session data when available (summing individual session calories)
 *
 * @param weeklyOutline - Week outline data with training and cardio schedules
 * @param weightKg - User's weight in kg
 * @param plan - Optional full plan data to access detailed cardio schedules
 * @returns Object with resistance, cardio, and total calories
 */
export function calculateWeeklyExerciseCalories(
  weeklyOutline: any,
  weightKg: number,
  plan?: any
): {
  resistance: number;
  cardio: number;
  total: number;
} {
  // Resistance training calories
  const resistanceDays = weeklyOutline?.trainingSchedule?.resistanceDays?.length || 0;
  const sessionDuration = weeklyOutline?.trainingSchedule?.sessionDuration || 60;
  const resistanceCalories = resistanceDays * estimateResistanceCalories(sessionDuration, weightKg, 'moderate');

  // Cardio calories - Use detailed cardio schedules if available
  // PRIORITY: Sum actual session calories from cardioTemplate.caloriesBurned
  let cardioCalories = 0;
  const weekNumber = weeklyOutline?.weekNumber;

  if (plan?.weeklyCardioSchedules && Array.isArray(plan.weeklyCardioSchedules) && weekNumber !== undefined) {
    // Try to get detailed cardio schedule for this week (handle both string and number)
    const weekCardioSchedule = plan.weeklyCardioSchedules.find((s: any) => {
      const sWeek = s.weekNumber;
      const targetWeek = weekNumber;
      return sWeek === targetWeek ||
        Number(sWeek) === Number(targetWeek) ||
        String(sWeek) === String(targetWeek);
    });

    if (weekCardioSchedule) {
      // PRIORITY 1: Sum up ACTUAL calories from individual sessions (most accurate)
      if (weekCardioSchedule.sessions && Array.isArray(weekCardioSchedule.sessions) && weekCardioSchedule.sessions.length > 0) {
        cardioCalories = weekCardioSchedule.sessions.reduce((total: number, session: any) => {
          const template = session.cardioTemplate || session;
          const sessionCalories = template.caloriesBurned || 0;
          return total + sessionCalories;
        }, 0);

        if (cardioCalories > 0) {
          return {
            resistance: resistanceCalories,
            cardio: cardioCalories,
            total: resistanceCalories + cardioCalories,
          };
        }
      }

      // PRIORITY 2: Use pre-calculated totalWeeklyVolume.totalCalories
      if (weekCardioSchedule.totalWeeklyVolume?.totalCalories &&
        weekCardioSchedule.totalWeeklyVolume.totalCalories > 0) {
        cardioCalories = weekCardioSchedule.totalWeeklyVolume.totalCalories;
        return {
          resistance: resistanceCalories,
          cardio: cardioCalories,
          total: resistanceCalories + cardioCalories,
        };
      }
    }
  }

  // NO FALLBACK: Cardio data MUST come from CardioGenerationService (weeklyCardioSchedules)
  // If weeklyCardioSchedules doesn't have data for this week, return 0 for cardio
  // This indicates CardioGenerationService did not generate data properly
  console.warn(`[planCalculations] Week ${weekNumber}: No cardio data found in weeklyCardioSchedules - CardioGenerationService may have failed`);

  return {
    resistance: resistanceCalories,
    cardio: 0, // No fallback estimation
    total: resistanceCalories, // Only resistance calories if no cardio data
  };
}

/**
 * Calculate AVERAGE weekly cardio calories across all weeks of the plan
 * Uses actual session calories from weeklyCardioSchedules
 *
 * @param plan - Full plan data with weeklyCardioSchedules
 * @returns Average weekly cardio calories (or 0 if no data)
 */
export function calculateAverageWeeklyCardioCalories(plan: any): number {
  if (!plan?.weeklyCardioSchedules || !Array.isArray(plan.weeklyCardioSchedules) || plan.weeklyCardioSchedules.length === 0) {
    return 0;
  }

  let totalCalories = 0;
  let weeksWithData = 0;

  plan.weeklyCardioSchedules.forEach((weekSchedule: any) => {
    let weekCalories = 0;

    // Sum actual session calories
    if (weekSchedule.sessions && Array.isArray(weekSchedule.sessions)) {
      weekCalories = weekSchedule.sessions.reduce((sum: number, session: any) => {
        const template = session.cardioTemplate || session;
        return sum + (template.caloriesBurned || 0);
      }, 0);
    }

    // Fallback to totalWeeklyVolume if no session data
    if (weekCalories === 0 && weekSchedule.totalWeeklyVolume?.totalCalories) {
      weekCalories = weekSchedule.totalWeeklyVolume.totalCalories;
    }

    if (weekCalories > 0) {
      totalCalories += weekCalories;
      weeksWithData++;
    }
  });

  return weeksWithData > 0 ? Math.round(totalCalories / weeksWithData) : 0;
}

/**
 * Calculate energy balance breakdown for a week
 *
 * @param tdee - Total Daily Energy Expenditure
 * @param dailyMealCalories - Calories from meals per day
 * @param exerciseCalories - Weekly exercise calories
 * @returns Energy balance breakdown
 */
export function calculateEnergyBalance(
  tdee: number,
  dailyMealCalories: number,
  exerciseCalories: { resistance: number; cardio: number; total: number }
): {
  maintenanceCalories: number;
  mealCalories: number;
  dietaryDeficit: number;
  exerciseBurn: { resistance: number; cardio: number; total: number };
  netWeeklyDeficit: number;
  expectedWeightLoss: number;
} {
  const weeklyMaintenance = tdee * 7;
  const weeklyMealCalories = dailyMealCalories * 7;

  // As per user clarification: TDEE represents "Activity outside of cardio/gym" (NEAT).
  // Therefore, specific exercise sessions are EXTRA energy out.
  const dietaryDeficit = tdee - dailyMealCalories;
  const weeklyDietaryDeficit = dietaryDeficit * 7;
  const netWeeklyDeficit = weeklyDietaryDeficit + exerciseCalories.total;

  // 7700 kcal = approximately 1 kg of body fat
  const expectedWeightLoss = netWeeklyDeficit / 7700;

  return {
    maintenanceCalories: tdee,
    mealCalories: dailyMealCalories,
    dietaryDeficit,
    exerciseBurn: exerciseCalories,
    netWeeklyDeficit,
    expectedWeightLoss,
  };
}

/**
 * Calculate body composition changes based on weight loss and protein intake
 *
 * Assumptions:
 * - High protein (2g/kg) + resistance training = 75% fat loss, 25% muscle loss
 * - Moderate protein (1.5g/kg) = 65% fat, 35% muscle
 * - Low protein (<1.5g/kg) = 55% fat, 45% muscle
 *
 * @param currentWeight - Current weight in kg
 * @param currentBodyFat - Current body fat percentage (0-100)
 * @param weightLoss - Expected weight loss in kg
 * @param proteinPerKg - Protein intake per kg bodyweight
 * @param hasResistanceTraining - Whether doing resistance training
 * @returns New body composition
 */
export function calculateBodyCompositionChange(
  currentWeight: number,
  currentBodyFat: number,
  weightLoss: number,
  proteinPerKg: number,
  hasResistanceTraining: boolean = true
): {
  newWeight: number;
  newBodyFat: number;
  newLeanMass: number;
  fatLoss: number;
  muscleLoss: number;
  fatMassChange: number;
  leanMassChange: number;
} {
  // Current composition
  const currentFatMass = currentWeight * (currentBodyFat / 100);
  const currentLeanMass = currentWeight - currentFatMass;

  // Determine fat loss percentage based on protein and training
  let fatLossPercentage = 0.55; // Low protein

  if (proteinPerKg >= 2.0 && hasResistanceTraining) {
    fatLossPercentage = 0.75;
  } else if (proteinPerKg >= 1.8 && hasResistanceTraining) {
    fatLossPercentage = 0.70;
  } else if (proteinPerKg >= 1.5) {
    fatLossPercentage = 0.65;
  } else if (proteinPerKg >= 1.2) {
    fatLossPercentage = 0.60;
  }

  // Calculate fat and muscle loss
  const fatLoss = weightLoss * fatLossPercentage;
  const muscleLoss = weightLoss * (1 - fatLossPercentage);

  // New composition
  const newFatMass = currentFatMass - fatLoss;
  const newLeanMass = currentLeanMass - muscleLoss;
  const newWeight = newFatMass + newLeanMass;
  const newBodyFat = (newFatMass / newWeight) * 100;

  return {
    newWeight,
    newBodyFat,
    newLeanMass,
    fatLoss,
    muscleLoss,
    fatMassChange: -fatLoss,
    leanMassChange: -muscleLoss,
  };
}

/**
 * Project body composition changes over multiple weeks
 *
 * @param startingWeight - Starting weight in kg
 * @param startingBodyFat - Starting body fat percentage
 * @param weeklyOutlines - Array of weekly outlines with calorie targets
 * @param weightKg - User's weight in kg (for exercise calculations)
 * @param proteinPerKg - Protein intake per kg bodyweight
 * @returns Array of weekly body composition projections
 */
export function projectBodyComposition(
  startingWeight: number,
  startingBodyFat: number,
  weeklyOutlines: any[],
  proteinPerKg: number,
  tdee: number,
  plan?: any // Optional plan data for detailed cardio calorie calculations
): Array<{
  weekNumber: number;
  weight: number;
  bodyFat: number;
  fatMass: number;
  leanMass: number;
  weeklyWeightChange: number;
  cumulativeWeightChange: number;
  weeklyFatLoss: number;
  cumulativeFatLoss: number;
  milestone?: string;
}> {
  if (!weeklyOutlines || weeklyOutlines.length === 0) {
    return [];
  }

  const projections: Array<any> = [];
  let currentWeight = startingWeight;
  let currentBodyFat = startingBodyFat;
  let cumulativeWeightChange = 0;
  let cumulativeFatLoss = 0;

  weeklyOutlines.forEach((week, index) => {
    // Calculate weekly weight loss
    const dailyCalories = week?.dailyTargets?.calories || 2000;
    // Pass plan to use detailed cardio calorie data if available
    const exerciseCalories = calculateWeeklyExerciseCalories(week, currentWeight, plan);
    const energyBalance = calculateEnergyBalance(tdee, dailyCalories, exerciseCalories);
    const weeklyWeightLoss = energyBalance.expectedWeightLoss;

    // Calculate body composition change
    const bodyCompChange = calculateBodyCompositionChange(
      currentWeight,
      currentBodyFat,
      weeklyWeightLoss,
      proteinPerKg,
      true
    );

    // Update cumulative totals
    cumulativeWeightChange -= weeklyWeightLoss;
    cumulativeFatLoss += bodyCompChange.fatLoss;

    // Check for milestones
    let milestone: string | undefined;
    if (Math.abs(cumulativeWeightChange) >= 5 && index > 0) {
      milestone = `${Math.abs(Math.round(cumulativeWeightChange))}kg lost`;
    }

    projections.push({
      weekNumber: week.weekNumber || index + 1,
      weight: bodyCompChange.newWeight,
      bodyFat: bodyCompChange.newBodyFat,
      fatMass: bodyCompChange.newWeight * (bodyCompChange.newBodyFat / 100),
      leanMass: bodyCompChange.newLeanMass,
      weeklyWeightChange: -weeklyWeightLoss,
      cumulativeWeightChange,
      weeklyFatLoss: bodyCompChange.fatLoss,
      cumulativeFatLoss,
      milestone,
    });

    // Update current values for next iteration
    currentWeight = bodyCompChange.newWeight;
    currentBodyFat = bodyCompChange.newBodyFat;
  });

  return projections;
}

/**
 * Calculate BMI from height and weight
 *
 * @param heightCm - Height in centimeters
 * @param weightKg - Weight in kilograms
 * @returns BMI value
 */
export function calculateBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Get BMI classification
 *
 * @param bmi - BMI value
 * @returns Classification string
 */
export function getBMIClassification(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Estimate starting body fat percentage based on BMI and gender
 * (Rough estimation for when body fat is not available)
 *
 * @param bmi - BMI value
 * @param gender - 'male' or 'female'
 * @returns Estimated body fat percentage
 */
export function estimateBodyFatFromBMI(bmi: number, gender: string): number {
  // Deurenberg formula (simplified)
  const genderFactor = gender === 'female' ? 1 : 0;
  const bodyFat = (1.20 * bmi) + (0.23 * 25) - (10.8 * genderFactor) - 5.4;

  // Clamp between reasonable values
  return Math.max(5, Math.min(50, bodyFat));
}

/**
 * Calculate water intake recommendation
 *
 * @param weightKg - Weight in kg
 * @param activityLevel - Activity level (sedentary/moderate/active)
 * @returns Daily water intake in liters
 */
export function calculateWaterIntake(
  weightKg: number,
  activityLevel: 'sedentary' | 'moderate' | 'active' = 'moderate'
): number {
  // Base: 30-35ml per kg
  let mlPerKg = 33;

  // Adjust for activity
  if (activityLevel === 'active') {
    mlPerKg = 40;
  } else if (activityLevel === 'sedentary') {
    mlPerKg = 30;
  }

  const totalMl = weightKg * mlPerKg;
  return Math.round((totalMl / 1000) * 10) / 10; // Convert to liters, round to 1 decimal
}

/**
 * CENTRALIZED TDEE CALCULATION
 * 
 * This is the SINGLE source of truth for TDEE calculations.
 * All components should use this function to ensure consistency.
 * 
 * Uses Mifflin-St Jeor formula for BMR, then applies activity factor.
 * 
 * @param params - User parameters for calculation
 * @returns TDEE calculation result with breakdown
 */
export interface TDEEParams {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: 'male' | 'female';
  experienceLevel?: string;
  activityLevel?: string;
  trainingDaysPerWeek?: number;
  bodyFat?: number; // Optional: if provided, uses Katch-McArdle instead
}

export interface TDEEResult {
  tdee: number;
  bmr: number;
  activityFactor: number;
  formula: 'mifflin-st-jeor' | 'katch-mcardle';
  activityLevel?: string;
}

export function calculateTDEE(params: TDEEParams): TDEEResult {
  const {
    weightKg,
    heightCm,
    age,
    gender,
    experienceLevel,
    trainingDaysPerWeek = 3,
    bodyFat
  } = params;

  let bmr: number;
  let formula: 'mifflin-st-jeor' | 'katch-mcardle';

  // Calculate BMR
  const hasValidBodyFat = typeof bodyFat === 'number' && bodyFat > 0 && bodyFat < 50;

  if (hasValidBodyFat) {
    // Katch-McArdle: More accurate when body fat is known
    // BMR = 370 + (21.6 × lean body mass in kg)
    const leanBodyMass = weightKg * (1 - bodyFat! / 100);
    bmr = Math.round(370 + 21.6 * leanBodyMass);
    formula = 'katch-mcardle';
  } else {
    // Mifflin-St Jeor: Standard calculation
    const genderFactor = gender === 'male' ? 5 : -161;
    bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderFactor);
    formula = 'mifflin-st-jeor';
  }

  // Determine activity factor based on activityLevel first, then experienceLevel, then fall back to training days
  let activityFactor = 1.55; // Default moderate
  const actualActivityLevel = params.activityLevel || experienceLevel;
  const levelLower = actualActivityLevel?.toLowerCase() || '';

  if (levelLower === 'beginner' || levelLower === 'sedentary') {
    activityFactor = 1.2; // Sedentary factor is strictly 1.2
  } else if (levelLower === 'intermediate' || levelLower === 'moderate' || levelLower === 'light') {
    // Merge light/moderate into a mid-range if not specified
    activityFactor = levelLower === 'light' ? 1.375 : 1.55;
  } else if (levelLower === 'advanced' || levelLower === 'expert' || levelLower === 'active') {
    activityFactor = 1.725; // Active
  } else if (levelLower === 'athlete' || levelLower === 'very_active' || levelLower === 'very active') {
    activityFactor = 1.9; // Very active
  } else {
    // Fallback to training days if no valid level
    if (trainingDaysPerWeek <= 2) activityFactor = 1.375;
    else if (trainingDaysPerWeek <= 3) activityFactor = 1.55;
    else if (trainingDaysPerWeek <= 5) activityFactor = 1.725;
    else activityFactor = 1.9;
  }

  const tdee = Math.round(bmr * activityFactor);

  return {
    tdee,
    bmr,
    activityFactor,
    formula
  };
}

/**
 * Get TDEE from plan data or calculate from user profile
 * 
 * This helper ensures consistent TDEE values across all components.
 * Always use this function instead of calculating TDEE inline.
 * 
 * @param plan - Plan object (may contain pre-calculated metrics.tdee)
 * @param userProfile - User profile data for fallback calculation
 * @returns TDEE value or null if insufficient data
 */
export function getTDEE(
  plan?: { metrics?: { tdee?: { value: number } }; userProfile?: any },
  userProfile?: {
    weight?: number;
    height?: number;
    age?: number;
    gender?: string;
    experienceLevel?: string;
    activityLevel?: string;
    workoutDaysPerWeek?: number;
    bodyFat?: number;
  }
): number | null {
  // First priority: Use pre-calculated TDEE from plan
  if (plan?.metrics?.tdee?.value && plan.metrics.tdee.value > 0) {
    return plan.metrics.tdee.value;
  }

  // Get user data from plan.userProfile or userProfile parameter
  const profile = plan?.userProfile || userProfile;

  if (!profile?.weight || !profile?.height || !profile?.age || !profile?.gender) {
    return null;
  }

  const result = calculateTDEE({
    weightKg: profile.weight,
    heightCm: profile.height,
    age: profile.age,
    gender: profile.gender.toLowerCase() === 'male' || profile.gender.toLowerCase() === 'm' ? 'male' : 'female',
    experienceLevel: profile.experienceLevel,
    activityLevel: profile.activityLevel,
    trainingDaysPerWeek: profile.workoutDaysPerWeek || 3,
    bodyFat: profile.bodyFat
  });

  return result.tdee;
}

/**
 * Calculate daily calorie deficit for a single day
 * Formula: Deficit = TDEE - calories consumed + exercise burn (resistance + cardio)
 * 
 * @param tdee - Total Daily Energy Expenditure
 * @param caloriesConsumed - Calories from meals consumed that day
 * @param resistanceCalories - Calories burned from resistance training
 * @param cardioCalories - Calories burned from cardio
 * @returns Daily calorie deficit (positive = deficit, negative = surplus)
 */
export function calculateDailyDeficit(
  tdee: number,
  caloriesConsumed: number,
  resistanceCalories: number,
  cardioCalories: number
): number {
  // Total energy out = TDEE (Base Activity/NEAT) + specific exercise sessions
  // Deficit = energy out - energy in
  return (tdee + resistanceCalories + cardioCalories) - caloriesConsumed;
}

/**
 * Day data interface for deficit calculation
 */
export interface DayDeficitData {
  day: string;
  dayNumber: number;
  caloriesConsumed: number;
  resistanceCalories: number;
  cardioCalories: number;
  deficit: number;
}

/**
 * Weekly deficit summary
 */
export interface WeeklyDeficitSummary {
  dailyDeficits: DayDeficitData[];
  totalWeeklyDeficit: number;
  averageDailyDeficit: number;
  projectedWeightLossKg: number;
  projectedWeightLossLbs: number;
}

/**
 * Calculate weekly calorie deficit and projected weight loss
 * Uses data from weeklySchedule (meals) and cardio schedules
 * 
 * @param weekNumber - The week number to calculate for
 * @param tdee - Daily TDEE value
 * @param weeklySchedule - Array of weekly schedule data with daily meals
 * @param plan - Full plan object with cardio schedules
 * @param weightKg - User's weight for resistance calorie calculation
 * @returns Weekly deficit summary with projected weight loss
 */
export function calculateWeeklyDeficitSummary(
  weekNumber: number,
  tdee: number,
  weeklySchedule: any[],
  plan: any,
  weightKg: number
): WeeklyDeficitSummary | null {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Get the week's schedule data (meals)
  const scheduleWeek = weeklySchedule?.find((w: any) => w.weekNumber === weekNumber);

  // Get cardio schedule for this week - ISOLATED SCOPE
  const weeklyCardioSchedules = plan?.weeklyCardioSchedules || [];
  const weekCardioSchedule = weeklyCardioSchedules.find((s: any) =>
    s.weekNumber === weekNumber ||
    Number(s.weekNumber) === Number(weekNumber)
  );

  // Get training schedule from weekly outline - ISOLATED SCOPE
  const weeklyOutline = plan?.weeklyOutlines?.find((w: any) => w.weekNumber === weekNumber);

  if (!weeklyOutline) return null;

  const resistanceDays = weeklyOutline?.trainingSchedule?.resistanceDays || [];
  const sessionDuration = 60; // Default session duration in minutes

  // 1. Calculate Total Weekly Output (Burn)
  // Resistance: Count * Estimate
  const totalWeeklyResistanceCalories = resistanceDays.length * estimateResistanceCalories(sessionDuration, weightKg, 'moderate');

  // Cardio: Sum of exact session burns
  let totalWeeklyCardioCalories = 0;
  if (weekCardioSchedule?.sessions && Array.isArray(weekCardioSchedule.sessions)) {
    totalWeeklyCardioCalories = weekCardioSchedule.sessions.reduce((total: number, session: any) => {
      const template = session.cardioTemplate || session;
      return total + (template.caloriesBurned || 0);
    }, 0);
  }

  // Daily Average Exercise Burn
  const dailyAvgExerciseBurn = (totalWeeklyResistanceCalories + totalWeeklyCardioCalories) / 7;

  const dailyDeficits: DayDeficitData[] = [];

  days.forEach((day, index) => {
    const dayNumber = index + 1;

    // 2. Calculate Daily Intake
    // PRIORITY 1: Use persisted DB metadata (weeklyTargetMacros.dailyTargets) if available
    // PRIORITY 2: Use generated full plan data (dailyTargetsOverride)
    // PRIORITY 3: Fallback to base dailyTargets
    let caloriesConsumed = 0;

    const dbWeekMacros = plan?.weeklyTargetMacros?.find((w: any) =>
      w.week === weekNumber || Number(w.week) === Number(weekNumber)
    );

    if (dbWeekMacros?.dailyTargets && dbWeekMacros.dailyTargets[index]) {
      caloriesConsumed = dbWeekMacros.dailyTargets[index].calories;
    } else if (weeklyOutline.dailyTargetsOverride && weeklyOutline.dailyTargetsOverride[index]) {
      caloriesConsumed = weeklyOutline.dailyTargetsOverride[index].calories;
    } else {
      caloriesConsumed = weeklyOutline.dailyTargets?.calories || 0;

      // Fallback to schedule data if completely missing (rare)
      const scheduleDay = scheduleWeek?.days?.find((d: any) =>
        d.day === day || d.dayNumber === dayNumber
      );
      if (caloriesConsumed === 0 && scheduleDay?.dailyMacros?.totalCalories) {
        caloriesConsumed = scheduleDay.dailyMacros.totalCalories;
      }
    }

    // 3. Calculate Daily Deficit
    // Formula: (BaseTDEE + DailyAvgExerciseBurn) - DailyIntake
    const totalDailyOut = tdee + dailyAvgExerciseBurn;
    const deficit = totalDailyOut - caloriesConsumed;

    // For display purposes, we split the avg burn back into resistance/cardio buckets roughly
    // based on the ratio, or just assign to resistance for simplicity in the UI breakdown
    // but the `deficit` number is the source of truth.
    // We'll distribute the dailyAvgExerciseBurn proportionally for the UI "Burn" columns if needed,
    // or just show it as "Exercise". For now, we populate the fields expected by the UI.
    const resistanceRatio = totalWeeklyResistanceCalories / (totalWeeklyResistanceCalories + totalWeeklyCardioCalories || 1);
    const dailyRes = dailyAvgExerciseBurn * resistanceRatio;
    const dailyCardio = dailyAvgExerciseBurn * (1 - resistanceRatio);

    dailyDeficits.push({
      day,
      dayNumber,
      caloriesConsumed: Math.round(caloriesConsumed),
      resistanceCalories: Math.round(dailyRes),
      cardioCalories: Math.round(dailyCardio),
      deficit: Math.round(deficit)
    });
  });

  // Sum up weekly deficit
  const totalWeeklyDeficit = dailyDeficits.reduce((sum, day) => sum + day.deficit, 0);
  const averageDailyDeficit = totalWeeklyDeficit / 7;

  // 7,700 kcal ≈ 1 kg of body fat
  const projectedWeightLossKg = totalWeeklyDeficit / 7700;
  const projectedWeightLossLbs = projectedWeightLossKg * 2.205;

  return {
    dailyDeficits,
    totalWeeklyDeficit: Math.round(totalWeeklyDeficit),
    averageDailyDeficit: Math.round(averageDailyDeficit),
    projectedWeightLossKg: Math.round(projectedWeightLossKg * 100) / 100,
    projectedWeightLossLbs: Math.round(projectedWeightLossLbs * 100) / 100
  };
}

/**
 * Advanced body composition projection over time
 * Handles both deficit (fat loss focus) and surplus (muscle gain limits)
 */
export function calculateAdvancedBodyCompositionProjection(
  plan: any,
  weeklySchedule: any[],
  userProfile: any
) {
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Use plan metrics first, then fallback to calculations
  const planUserProfile = plan?.userProfile || userProfile;
  const startingWeight = planUserProfile?.weight || userProfile?.weight || 88;
  const height = planUserProfile?.height || userProfile?.height || 180;
  const gender = planUserProfile?.gender || userProfile?.gender || 'male';

  // Get TDEE using centralized function
  const tdee = getTDEE(plan, planUserProfile) || 2200;

  // Get protein per kg from framework
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg ||
    (startingWeight > 0 && plan?.metrics?.macros?.protein
      ? plan.metrics.macros.protein / startingWeight
      : 2.0);

  // Estimate starting body fat if not provided
  const bmi = calculateBMI(height, startingWeight);
  const startingBodyFat = planUserProfile?.bodyFat || userProfile?.bodyFat || estimateBodyFatFromBMI(bmi, gender);

  // Get experience level for muscle gain rate calculation
  const experienceLevel = planUserProfile?.experienceLevel || userProfile?.experienceLevel || 'intermediate';
  const userGender = (gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'm') ? 'male' : 'female';
  const userAge = planUserProfile?.age || userProfile?.age || 30;

  /**
   * Calculate maximum weekly muscle gain rate based on training experience
   */
  const getMaxWeeklyMuscleGain = (): number => {
    const level = experienceLevel.toLowerCase();
    let baseRate: number;

    if (level === 'beginner' || level === 'novice') {
      baseRate = userGender === 'male' ? 0.22 : 0.11;
    } else if (level === 'advanced' || level === 'expert') {
      baseRate = userGender === 'male' ? 0.06 : 0.03;
    } else {
      // Intermediate (default)
      baseRate = userGender === 'male' ? 0.12 : 0.06;
    }

    // Age adjustment: reduce by 1% per year after 30
    const ageAdjustment = userAge > 30 ? Math.max(0.5, 1 - (userAge - 30) * 0.01) : 1;

    // Protein adjustment: need at least 1.6g/kg for optimal muscle synthesis
    const proteinAdjustment = proteinPerKg >= 1.6 ? 1 : (proteinPerKg / 1.6);

    return baseRate * ageAdjustment * proteinAdjustment;
  };

  if (weeklyOutlines.length === 0 || !tdee || !startingWeight) {
    return [];
  }

  const maxWeeklyMuscleGain = getMaxWeeklyMuscleGain();

  // Calories required to build 1 kg of muscle tissue
  const KCAL_PER_KG_MUSCLE = 2800;

  const results: Array<{
    weekNumber: number;
    weight: number;
    bodyFat: number;
    fatMass: number;
    leanMass: number;
    weeklyWeightChange: number;
    cumulativeWeightChange: number;
    weeklyFatLoss: number;
    cumulativeFatLoss: number;
  }> = [];

  let currentWeight = startingWeight;
  let currentFatMass = startingWeight * (startingBodyFat / 100);
  let currentLeanMass = startingWeight - currentFatMass;
  let cumulativeWeightChange = 0;
  let cumulativeFatLoss = 0;

  weeklyOutlines.forEach((week: any) => {
    const weekNumber = week.weekNumber;

    const deficitSummary = calculateWeeklyDeficitSummary(
      weekNumber,
      tdee,
      weeklySchedule || [],
      plan,
      currentWeight
    );

    // Positive = deficit (fat loss), Negative = surplus (potential muscle gain)
    const weeklyBalance = deficitSummary?.projectedWeightLossKg || 0;
    const isDeficit = weeklyBalance > 0;

    let fatChange: number;
    let leanMassChange: number;

    if (isDeficit) {
      // DEFICIT: Fat loss with minimal muscle loss
      const weeklyFatLoss = weeklyBalance;

      // Lean mass preservation based on protein intake
      let leanMassLossRatio = 0.05;
      if (proteinPerKg >= 2.0) {
        leanMassLossRatio = 0.02;
      } else if (proteinPerKg >= 1.8) {
        leanMassLossRatio = 0.05;
      } else if (proteinPerKg >= 1.5) {
        leanMassLossRatio = 0.10;
      } else {
        leanMassLossRatio = 0.15;
      }

      fatChange = -weeklyFatLoss;
      leanMassChange = -weeklyFatLoss * leanMassLossRatio;

    } else {
      // SURPLUS: Muscle gain with some fat gain
      const weeklySurplus = Math.abs(weeklyBalance); // in kg (from 7700 rule)
      const weeklySurplusKcal = weeklySurplus * 7700; // convert back to kcal

      // Calculate max muscle gain for this week
      const maxMuscleGainThisWeek = maxWeeklyMuscleGain;

      // Actual muscle gain = min of (surplus available, max possible)
      const actualMuscleGain = Math.min(
        weeklySurplusKcal / KCAL_PER_KG_MUSCLE,
        maxMuscleGainThisWeek
      );

      // Remaining surplus after muscle synthesis → stored as fat
      const remainingSurplusKcal = Math.max(0, weeklySurplusKcal - (actualMuscleGain * KCAL_PER_KG_MUSCLE));
      const fatGain = remainingSurplusKcal / 7700;

      // With optimal protein (≥1.6g/kg), muscle synthesis is maximized
      const proteinEfficiency = proteinPerKg >= 1.6 ? 1 : (proteinPerKg / 1.6) * 0.7;

      leanMassChange = actualMuscleGain * proteinEfficiency;
      fatChange = fatGain + (actualMuscleGain * (1 - proteinEfficiency)); // Unused protein calories → fat
    }

    // Update masses
    const newFatMass = Math.max(0, currentFatMass + fatChange);
    const newLeanMass = Math.max(0, currentLeanMass + leanMassChange);
    const newWeight = newFatMass + newLeanMass;
    const newBodyFat = newWeight > 0 ? (newFatMass / newWeight) * 100 : 0;

    // Track changes
    const totalWeightChange = (newWeight - currentWeight);
    cumulativeWeightChange += totalWeightChange;
    cumulativeFatLoss += (fatChange < 0 ? Math.abs(fatChange) : 0);

    results.push({
      weekNumber,
      weight: newWeight,
      bodyFat: newBodyFat,
      fatMass: newFatMass,
      leanMass: newLeanMass,
      weeklyWeightChange: totalWeightChange,
      cumulativeWeightChange,
      weeklyFatLoss: fatChange < 0 ? Math.abs(fatChange) : -fatChange, // Negative if gaining fat
      cumulativeFatLoss,
    });

    // Update current values for next iteration
    currentWeight = newWeight;
    currentFatMass = newFatMass;
    currentLeanMass = newLeanMass;
  });

  return results;
}
