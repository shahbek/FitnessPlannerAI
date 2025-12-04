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
  
  // Fallback to estimation using basic cardioSchedule
  const cardioSessions = weeklyOutline?.cardioSchedule?.sessions || 0;
  const cardioDuration = weeklyOutline?.cardioSchedule?.duration || 0;
  const cardioIntensity = weeklyOutline?.cardioSchedule?.intensity || 'moderate';
  cardioCalories = cardioSessions * calculateExerciseCalories(cardioIntensity, weightKg, cardioDuration, 'cardio');

  return {
    resistance: resistanceCalories,
    cardio: cardioCalories,
    total: resistanceCalories + cardioCalories,
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
