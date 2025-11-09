/**
 * Form to Plan Models Converter
 * 
 * Converts form data from MultistepProfileForm to UserProfile and WeeklyOutline
 * for use with IntegratedPlanGenerator
 */

import { UserProfile } from '@/models/UserProfile';
import { WeeklyOutline } from '@/models/PlanModels';

interface FormData {
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  bodyFat?: number;
  targetBf?: number;
  trainingDaysPerWeek: number;
  workoutLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  workoutSplit: string;
  primaryGoal: 'fat_loss' | 'muscle_gain' | 'maintenance' | 'strength' | 'endurance';
  timelineWeeks: number;
  preferences?: string;
  avoid?: string;
  equipment: 'gym_membership' | 'home_gym' | 'bodyweight' | 'minimal_equipment';
  schedule?: string;
  mealFrequency?: number;
}

/**
 * Convert form data to UserProfile
 */
export function formToUserProfile(formData: FormData): UserProfile {
  // Map workout level
  const workoutLevelMap: Record<string, 'beginner' | 'intermediate' | 'expert'> = {
    'beginner': 'beginner',
    'intermediate': 'intermediate',
    'advanced': 'intermediate',
    'expert': 'expert',
  };

  // Map equipment
  const equipmentMap: Record<string, 'gym_membership' | 'home_gym' | 'bodyweight' | 'minimal_equipment'> = {
    'gym_membership': 'gym_membership',
    'home_gym': 'home_gym',
    'bodyweight': 'bodyweight',
    'minimal_equipment': 'minimal_equipment',
    'full': 'gym_membership',
    'limited': 'minimal_equipment',
    'none': 'bodyweight',
  };

  // Calculate activity level based on training days
  let activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' = 'moderate';
  if (formData.trainingDaysPerWeek <= 2) {
    activityLevel = 'light';
  } else if (formData.trainingDaysPerWeek <= 3) {
    activityLevel = 'moderate';
  } else if (formData.trainingDaysPerWeek <= 5) {
    activityLevel = 'active';
  } else {
    activityLevel = 'very_active';
  }

  // Map workout split string to enum
  const splitMap: Record<string, 'full_body' | 'upper_lower' | 'push_pull_legs' | 'body_part' | 'custom'> = {
    'full_body': 'full_body',
    'upper_lower': 'upper_lower',
    'upper-lower': 'upper_lower',
    'push_pull_legs': 'push_pull_legs',
    'push-pull-legs': 'push_pull_legs',
    'body_part': 'body_part',
    'bro_split': 'body_part',
    'custom': 'custom',
  };

  return {
    age: formData.age,
    sex: formData.sex,
    weightKg: formData.weightKg,
    heightCm: formData.heightCm,
    bodyFat: formData.bodyFat,
    targetBf: formData.targetBf,
    goal: formData.primaryGoal,
    timelineWeeks: formData.timelineWeeks,
    preferences: formData.preferences || '',
    mealFrequency: formData.mealFrequency || 4,
    workoutLevel: workoutLevelMap[formData.workoutLevel] || 'intermediate',
    workoutSplit: splitMap[formData.workoutSplit] || 'upper_lower',
    trainingDaysPerWeek: formData.trainingDaysPerWeek,
    equipment: equipmentMap[formData.equipment] || 'gym_membership',
    schedule: formData.schedule,
  };
}

/**
 * Create initial WeeklyOutline from form data
 * This is a basic outline - the actual macros will be calculated by the system
 */
export function formToWeeklyOutline(
  formData: FormData,
  weekNumber: number = 1,
  phaseOverride?: string
): WeeklyOutline {
  // Calculate basic daily targets based on goal
  // These are initial estimates - the system will refine them
  const baseCalories = calculateBaseCalories(formData);
  const protein = calculateProtein(formData);
  const carbs = calculateCarbs(formData, baseCalories, protein);
  const fats = calculateFats(formData, baseCalories, protein, carbs);

  // Map workout split to training days
  const trainingDays = getTrainingDays(formData.workoutSplit, formData.trainingDaysPerWeek);

  return {
    weekNumber,
    phase: phaseOverride || 'foundation', // Will be determined by the system
    dailyTargets: {
      calories: baseCalories,
      protein,
      carbs,
      fat: fats,
      proteinPerKg: protein / formData.weightKg,
    },
    trainingSchedule: {
      resistanceDays: trainingDays,
      cardioDays: [],
      restDays: getRestDays(trainingDays),
      weeklyVolume: getWeeklyVolume(formData.trainingDaysPerWeek),
      focusAreas: getFocusAreas(formData.primaryGoal, formData.workoutSplit),
    },
    cardioSchedule: {
      sessions: 0,
      duration: 0,
      intensity: 'Low',
      type: 'None',
    },
    objectives: [`Week ${weekNumber} objectives for ${formData.primaryGoal}`],
    expectedOutcomes: [`Progress toward ${formData.primaryGoal} goals`],
    adjustments: 'None',
    specialNotes: formData.preferences || '',
  };
}

/**
 * Generate weekly outlines for the full timeline
 */
export function formToWeeklyOutlines(formData: FormData): WeeklyOutline[] {
  const totalWeeks = Math.max(1, formData.timelineWeeks || 1);

  const foundationEnd = Math.max(1, Math.ceil(totalWeeks * 0.33));
  const progressionEnd = Math.max(foundationEnd + 1, Math.ceil(totalWeeks * 0.66));

  const outlines: WeeklyOutline[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    let phase: 'foundation' | 'progression' | 'peak' = 'foundation';
    if (week > foundationEnd && week <= progressionEnd) {
      phase = 'progression';
    } else if (week > progressionEnd) {
      phase = 'peak';
    }

    outlines.push(formToWeeklyOutline(formData, week, phase));
  }

  return outlines;
}

/**
 * Calculate base calories (simplified - system will refine)
 */
function calculateBaseCalories(formData: FormData): number {
  // BMR using Mifflin-St Jeor (simplified)
  const bmr = formData.sex === 'male'
    ? 10 * formData.weightKg + 6.25 * formData.heightCm - 5 * formData.age + 5
    : 10 * formData.weightKg + 6.25 * formData.heightCm - 5 * formData.age - 161;

  // TDEE multiplier based on activity
  const activityMultiplier = {
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9,
  };

  const activity = formData.trainingDaysPerWeek <= 2 ? 'light' :
                   formData.trainingDaysPerWeek <= 3 ? 'moderate' :
                   formData.trainingDaysPerWeek <= 5 ? 'active' : 'very_active';

  const tdee = bmr * activityMultiplier[activity];

  // Adjust based on goal
  if (formData.primaryGoal === 'fat_loss') {
    return Math.round(tdee * 0.85); // 15% deficit
  } else if (formData.primaryGoal === 'muscle_gain') {
    return Math.round(tdee * 1.1); // 10% surplus
  }
  return Math.round(tdee); // Maintenance
}

/**
 * Calculate protein target
 */
function calculateProtein(formData: FormData): number {
  const proteinPerKg = formData.primaryGoal === 'fat_loss' ? 2.2 : 2.0;
  return Math.round(formData.weightKg * proteinPerKg);
}

/**
 * Calculate carbs target
 */
function calculateCarbs(formData: FormData, calories: number, protein: number): number {
  const proteinCals = protein * 4;
  const fatCals = (formData.weightKg * 0.8) * 9; // Minimum fat
  const remainingCals = calories - proteinCals - fatCals;
  return Math.round(remainingCals / 4);
}

/**
 * Calculate fats target
 */
function calculateFats(formData: FormData, calories: number, protein: number, carbs: number): number {
  const proteinCals = protein * 4;
  const carbCals = carbs * 4;
  const fatCals = calories - proteinCals - carbCals;
  return Math.round(fatCals / 9);
}

/**
 * Get training days based on split
 */
function getTrainingDays(split: string, daysPerWeek: number): string[] {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Simple distribution
  if (daysPerWeek === 3) {
    return ['Monday', 'Wednesday', 'Friday'];
  } else if (daysPerWeek === 4) {
    return ['Monday', 'Tuesday', 'Thursday', 'Friday'];
  } else if (daysPerWeek === 5) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  } else if (daysPerWeek === 6) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }
  
  return dayNames.slice(0, daysPerWeek);
}

/**
 * Get rest days
 */
function getRestDays(trainingDays: string[]): string[] {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return allDays.filter(day => !trainingDays.includes(day));
}

/**
 * Get weekly volume description
 */
function getWeeklyVolume(daysPerWeek: number): string {
  if (daysPerWeek <= 3) return 'Low';
  if (daysPerWeek <= 4) return 'Moderate';
  if (daysPerWeek <= 5) return 'High';
  return 'Very High';
}

/**
 * Get focus areas based on goal and split
 */
function getFocusAreas(goal: string, split: string): string[] {
  const areas: string[] = [];
  
  if (goal === 'fat_loss') {
    areas.push('Fat Loss', 'Muscle Preservation');
  } else if (goal === 'muscle_gain') {
    areas.push('Hypertrophy', 'Strength');
  } else if (goal === 'strength') {
    areas.push('Strength', 'Power');
  }
  
  return areas;
}
