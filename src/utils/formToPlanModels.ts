/**
 * Form to Plan Models Converter
 * 
 * Converts form data from MultistepProfileForm to UserProfile and WeeklyOutline
 * for use with IntegratedPlanGenerator
 */

import { 
  UserProfile, 
  GoalCategory, 
  BodyFatGoal,
  LegacyGoal,
  legacyGoalToCategory,
  getEffectiveGoalType 
} from '@/models/UserProfile';
import { WeeklyOutline } from '@/models/PlanModels';
import { GOAL_CALORIE_ADJUSTMENTS } from '@/services/NutritionCalculationService';

interface FormData {
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  bodyFat?: number;
  trainingDaysPerWeek: number;
  workoutLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  workoutSplit: string;
  timelineWeeks: number;
  preferences?: string;
  avoid?: string;
  equipment: 'gym_membership' | 'home_gym' | 'home_gym_advanced' | 'bodyweight' | 'calisthenics' | 'minimal_equipment' | 'minimal';
  schedule?: string;
  mealFrequency?: number;
  
  // New goal category system
  goalCategory?: GoalCategory;
  bodyFatGoal?: BodyFatGoal;
  
  // Legacy fields (deprecated but supported for backward compatibility)
  primaryGoal?: LegacyGoal;
  targetBf?: number;
}

/**
 * Get the effective goal category from form data
 * Handles both new goalCategory and legacy primaryGoal
 */
function getGoalCategory(formData: FormData): GoalCategory {
  // If new goalCategory is provided, use it directly
  if (formData.goalCategory) {
    return formData.goalCategory;
  }
  
  // Fall back to converting legacy primaryGoal
  if (formData.primaryGoal) {
    return legacyGoalToCategory(formData.primaryGoal);
  }
  
  // Default to maintenance
  return 'maintenance';
}

/**
 * Get the body fat goal from form data
 * Only returns a value if goalCategory is 'body_fat_goal'
 */
function getBodyFatGoal(formData: FormData): BodyFatGoal | undefined {
  const goalCategory = getGoalCategory(formData);
  
  if (goalCategory !== 'body_fat_goal') {
    return undefined;
  }
  
  // Check for new bodyFatGoal structure
  if (formData.bodyFatGoal) {
    return formData.bodyFatGoal;
  }
  
  // Fall back to legacy fields
  if (formData.bodyFat !== undefined && formData.targetBf !== undefined) {
    return {
      currentBf: formData.bodyFat,
      targetBf: formData.targetBf,
    };
  }
  
  return undefined;
}

/**
 * Convert form data to UserProfile
 */
export function formToUserProfile(formData: FormData): UserProfile {
  // Map workout level
  const workoutLevelMap: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
    'beginner': 'beginner',
    'intermediate': 'intermediate',
    'advanced': 'advanced',
    'expert': 'expert',
  };

  // Map equipment
  const equipmentMap: Record<
    string,
    'gym_membership' | 'home_gym' | 'home_gym_advanced' | 'bodyweight' | 'calisthenics' | 'minimal_equipment' | 'minimal'
  > = {
    'gym_membership': 'gym_membership',
    'home_gym': 'home_gym',
    'home_gym_advanced': 'home_gym_advanced',
    'bodyweight': 'bodyweight',
    'calisthenics': 'calisthenics',
    'minimal_equipment': 'minimal_equipment',
    'minimal': 'minimal',
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

  const goalCategory = getGoalCategory(formData);
  const bodyFatGoal = getBodyFatGoal(formData);

  return {
    age: formData.age,
    sex: formData.sex,
    weightKg: formData.weightKg,
    heightCm: formData.heightCm,
    bodyFat: formData.bodyFat,
    goalCategory,
    bodyFatGoal,
    // Legacy fields for backward compatibility
    goal: formData.primaryGoal,
    targetBf: formData.targetBf,
    timelineWeeks: formData.timelineWeeks,
    preferences: formData.preferences || '',
    mealFrequency: formData.mealFrequency || 4,
    workoutLevel: workoutLevelMap[formData.workoutLevel] || 'intermediate',
    workoutSplit: splitMap[formData.workoutSplit] || 'upper_lower',
    trainingDaysPerWeek: formData.trainingDaysPerWeek,
    equipment: equipmentMap[formData.equipment] || 'gym_membership',
    activityLevel,
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
  const trainingDays = getTrainingDays(
    formData.workoutSplit,
    formData.trainingDaysPerWeek,
    formData.schedule
  );

  const goalCategory = getGoalCategory(formData);

  // NOTE: cardioSchedule is intentionally NOT provided here
  // The CardioGenerationService will generate the full cardio plan
  // DO NOT add fallback/default cardio data - it MUST come from the AI service

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
      cardioDays: [], // Will be populated by CardioGenerationService
      restDays: getRestDays(trainingDays),
      weeklyVolume: getWeeklyVolume(formData.trainingDaysPerWeek),
      focusAreas: getFocusAreas(goalCategory, formData.workoutSplit),
    },
    // cardioSchedule is intentionally omitted - MUST be generated by CardioGenerationService
    // The aiSdkRagService.generateDetailedWeeklyOutlines will generate proper cardioSchedule
    objectives: [`Week ${weekNumber} objectives for ${goalCategory.replace(/_/g, ' ')}`],
    expectedOutcomes: [`Progress toward ${goalCategory.replace(/_/g, ' ')} goals`],
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
 * Calculate base calories using goal category adjustments
 */
function calculateBaseCalories(formData: FormData): number {
  // BMR using Mifflin-St Jeor (simplified)
  const bmr = formData.sex === 'male'
    ? 10 * formData.weightKg + 6.25 * formData.heightCm - 5 * formData.age + 5
    : 10 * formData.weightKg + 6.25 * formData.heightCm - 5 * formData.age - 161;

  // TDEE multiplier based on activity
  const activityMultiplier: Record<string, number> = {
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9,
  };

  const activity = formData.trainingDaysPerWeek <= 2 ? 'light' :
    formData.trainingDaysPerWeek <= 3 ? 'moderate' :
      formData.trainingDaysPerWeek <= 5 ? 'active' : 'very_active';

  const tdee = bmr * activityMultiplier[activity];

  // Get goal category and apply adjustment
  const goalCategory = getGoalCategory(formData);
  const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];
  
  // Handle body fat goal specially
  if (goalCategory === 'body_fat_goal') {
    const bodyFatGoal = getBodyFatGoal(formData);
    if (bodyFatGoal) {
      // Calculate required deficit/surplus based on BF% change
      const currentFatMass = formData.weightKg * (bodyFatGoal.currentBf / 100);
      const targetFatMass = formData.weightKg * (bodyFatGoal.targetBf / 100);
      const fatChange = currentFatMass - targetFatMass;
      const isLosing = fatChange > 0;
      
      // Calculate required weekly change for timeline
      const timelineWeeks = formData.timelineWeeks || 12;
      const weeklyFatChange = fatChange / timelineWeeks;
      const weeklyCalorieChange = weeklyFatChange * 7700;
      const dailyCalorieChange = weeklyCalorieChange / 7;
      
      // Clamp to safe ranges
      let adjustmentPercent = dailyCalorieChange / tdee;
      if (isLosing) {
        adjustmentPercent = Math.min(adjustmentPercent, 0.30);
      } else {
        adjustmentPercent = Math.max(adjustmentPercent, -0.20);
      }
      
      return Math.round(tdee * (1 - adjustmentPercent));
    }
    // Fall back to moderate deficit if no BF goal specified
    return Math.round(tdee * 0.80);
  }
  
  // Apply goal-specific adjustment
  const adjustmentPercent = (adjustment.range.MIN + adjustment.range.MAX) / 2;
  
  if (adjustment.type === 'surplus') {
    return Math.round(tdee * (1 + adjustmentPercent));
  } else if (adjustment.type === 'deficit') {
    return Math.round(tdee * (1 - adjustmentPercent));
  }
  
  // Maintenance
  return Math.round(tdee);
}

/**
 * Calculate protein target based on goal category
 */
function calculateProtein(formData: FormData): number {
  const goalCategory = getGoalCategory(formData);
  const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];
  
  // Use midpoint of protein range for the goal
  const proteinPerKg = (adjustment.proteinRange.MIN + adjustment.proteinRange.MAX) / 2;
  return Math.round(formData.weightKg * proteinPerKg);
}

/**
 * Calculate carbs target
 */
function calculateCarbs(formData: FormData, calories: number, protein: number): number {
  const goalCategory = getGoalCategory(formData);
  const adjustment = GOAL_CALORIE_ADJUSTMENTS[goalCategory];
  
  const proteinCals = protein * 4;
  const fatPerKg = (adjustment.fatRange.MIN + adjustment.fatRange.MAX) / 2;
  const fatCals = (formData.weightKg * fatPerKg) * 9;
  const remainingCals = calories - proteinCals - fatCals;
  return Math.max(0, Math.round(remainingCals / 4));
}

/**
 * Calculate fats target
 */
function calculateFats(formData: FormData, calories: number, protein: number, carbs: number): number {
  const proteinCals = protein * 4;
  const carbCals = carbs * 4;
  const fatCals = calories - proteinCals - carbCals;
  return Math.max(0, Math.round(fatCals / 9));
}

/**
 * Get training days based on split
 */
function getTrainingDays(split: string, daysPerWeek: number, schedule?: string): string[] {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const scheduledDays = parseScheduleDays(schedule);
  if (scheduledDays.length > 0) {
    const unique = Array.from(new Set(scheduledDays));
    if (unique.length >= daysPerWeek) {
      return unique.slice(0, daysPerWeek);
    }
    const defaults = getDefaultDistribution(daysPerWeek);
    const merged = [...unique];
    defaults.forEach((day) => {
      if (merged.length < daysPerWeek && !merged.includes(day)) {
        merged.push(day);
      }
    });
    return merged.slice(0, daysPerWeek);
  }

  return getDefaultDistribution(daysPerWeek, dayNames);
}

function getDefaultDistribution(daysPerWeek: number, dayNames?: string[]): string[] {
  const defaults = {
    1: ['Wednesday'],
    2: ['Tuesday', 'Friday'],
    3: ['Monday', 'Wednesday', 'Friday'],
    4: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
    5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  } as Record<number, string[]>;

  if (defaults[daysPerWeek]) {
    return defaults[daysPerWeek];
  }

  const fallback = dayNames || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return fallback.slice(0, daysPerWeek);
}

/**
 * Get rest days
 */
function getRestDays(trainingDays: string[]): string[] {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return allDays.filter(day => !trainingDays.includes(day));
}

function parseScheduleDays(schedule?: string): string[] {
  if (!schedule) return [];
  
  const dayMap: Record<string, string> = {
    monday: 'Monday',
    mon: 'Monday',
    tuesday: 'Tuesday',
    tue: 'Tuesday',
    tues: 'Tuesday',
    wednesday: 'Wednesday',
    wed: 'Wednesday',
    thursday: 'Thursday',
    thu: 'Thursday',
    thurs: 'Thursday',
    friday: 'Friday',
    fri: 'Friday',
    saturday: 'Saturday',
    sat: 'Saturday',
    sunday: 'Sunday',
    sun: 'Sunday',
  };
  
  const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Normalize the schedule string
  let normalized = schedule.toLowerCase();
  
  // Strip time information (e.g., "from 8pm to 8.30pm", "8:00am-9:00pm", etc.)
  normalized = normalized.replace(/\b(from\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?\s*(to|-)\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '');
  normalized = normalized.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '');
  
  const result: string[] = [];
  
  // Check for range patterns like "Monday to Saturday", "Mon-Sat", "Mon through Fri"
  const rangePatterns = [
    /(\w+)\s*(?:to|through|-)\s*(\w+)/gi,
  ];
  
  let hasRange = false;
  for (const pattern of rangePatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      const startDay = dayMap[match[1].trim()];
      const endDay = dayMap[match[2].trim()];
      
      if (startDay && endDay) {
        hasRange = true;
        const startIdx = orderedDays.indexOf(startDay);
        const endIdx = orderedDays.indexOf(endDay);
        
        if (startIdx !== -1 && endIdx !== -1) {
          // Handle wrap-around (e.g., "Saturday to Monday")
          if (startIdx <= endIdx) {
            for (let i = startIdx; i <= endIdx; i++) {
              if (!result.includes(orderedDays[i])) {
                result.push(orderedDays[i]);
              }
            }
          } else {
            // Wrap around: Sat to Mon = Sat, Sun, Mon
            for (let i = startIdx; i < 7; i++) {
              if (!result.includes(orderedDays[i])) {
                result.push(orderedDays[i]);
              }
            }
            for (let i = 0; i <= endIdx; i++) {
              if (!result.includes(orderedDays[i])) {
                result.push(orderedDays[i]);
              }
            }
          }
        }
      }
    }
  }
  
  // If no range found, parse individual days
  if (!hasRange) {
    const tokens = normalized
      .split(/[,|;/\n\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    
    for (const token of tokens) {
      const day = dayMap[token];
      if (day && !result.includes(day)) {
        result.push(day);
      }
    }
  }
  
  // Sort by day order
  result.sort((a, b) => orderedDays.indexOf(a) - orderedDays.indexOf(b));
  
  return result;
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
 * Get focus areas based on goal category and split
 */
function getFocusAreas(goalCategory: GoalCategory, split: string): string[] {
  const areas: string[] = [];
  const effectiveGoal = getEffectiveGoalType(goalCategory);

  if (effectiveGoal === 'fat_loss') {
    areas.push('Fat Loss', 'Muscle Preservation');
  } else if (effectiveGoal === 'muscle_gain') {
    areas.push('Hypertrophy', 'Strength');
  } else {
    areas.push('Maintenance', 'Performance');
  }

  // Add goal-specific focus areas
  switch (goalCategory) {
    case 'lean_bulk':
      areas.push('Lean Mass Gain');
      break;
    case 'dirty_bulk':
      areas.push('Maximum Muscle Growth');
      break;
    case 'aggressive_cut':
      areas.push('Rapid Fat Loss');
      break;
    case 'recomp':
      areas.push('Body Recomposition');
      break;
    case 'body_fat_goal':
      areas.push('Target Body Composition');
      break;
  }

  return areas;
}
