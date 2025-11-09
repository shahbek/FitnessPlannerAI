/**
 * Macro Calculation Utilities
 * 
 * Utilities for calculating, aggregating, and manipulating macro values
 */

import { MacroValues } from '../types/nutrition';
import { sumMacros, calculateMacrosForAmount } from './usdaMapper';

/**
 * Calculate macros for a meal from ingredients
 */
export interface IngredientWithPortion {
  name: string;
  amount: number; // in grams
  macrosPer100g: MacroValues;
}

export function calculateMealMacros(
  ingredients: IngredientWithPortion[]
): MacroValues {
  const ingredientMacros = ingredients.map(ing =>
    calculateMacrosForAmount(ing.macrosPer100g, ing.amount, 'g')
  );

  return sumMacros(ingredientMacros);
}

/**
 * Calculate macros for a day from multiple meals
 */
export interface MealWithMacros {
  mealType: string;
  macros: MacroValues;
}

export function calculateDayMacros(meals: MealWithMacros[]): MacroValues {
  return sumMacros(meals.map(meal => meal.macros));
}

/**
 * Calculate macros for a week from multiple days
 */
export interface DayWithMacros {
  dayNumber: number;
  macros: MacroValues;
}

export function calculateWeekMacros(days: DayWithMacros[]): MacroValues {
  return sumMacros(days.map(day => day.macros));
}

/**
 * Calculate average macros per day from weekly totals
 */
export function calculateAverageDailyMacros(
  weeklyMacros: MacroValues,
  daysInWeek: number = 7
): MacroValues {
  return {
    calories: Math.round(weeklyMacros.calories / daysInWeek),
    protein: Math.round(weeklyMacros.protein / daysInWeek * 10) / 10,
    carbs: Math.round(weeklyMacros.carbs / daysInWeek * 10) / 10,
    fats: Math.round(weeklyMacros.fats / daysInWeek * 10) / 10,
    fiber: weeklyMacros.fiber
      ? Math.round(weeklyMacros.fiber / daysInWeek * 10) / 10
      : undefined,
    sugar: weeklyMacros.sugar
      ? Math.round(weeklyMacros.sugar / daysInWeek * 10) / 10
      : undefined,
    sodium: weeklyMacros.sodium
      ? Math.round(weeklyMacros.sodium / daysInWeek)
      : undefined,
  };
}

/**
 * Calculate macro distribution percentage
 */
export function calculateMacroDistribution(macros: MacroValues): {
  proteinPercent: number;
  carbsPercent: number;
  fatsPercent: number;
} {
  // Protein: 4 kcal/g
  // Carbs: 4 kcal/g
  // Fats: 9 kcal/g
  const proteinCalories = macros.protein * 4;
  const carbsCalories = macros.carbs * 4;
  const fatsCalories = macros.fats * 9;
  const totalCalories = proteinCalories + carbsCalories + fatsCalories;

  if (totalCalories === 0) {
    return {
      proteinPercent: 0,
      carbsPercent: 0,
      fatsPercent: 0,
    };
  }

  return {
    proteinPercent: Math.round((proteinCalories / totalCalories) * 100 * 10) / 10,
    carbsPercent: Math.round((carbsCalories / totalCalories) * 100 * 10) / 10,
    fatsPercent: Math.round((fatsCalories / totalCalories) * 100 * 10) / 10,
  };
}

/**
 * Calculate difference between two macro values
 */
export function calculateMacroDifference(
  actual: MacroValues,
  target: MacroValues
): MacroValues {
  return {
    calories: actual.calories - target.calories,
    protein: Math.round((actual.protein - target.protein) * 10) / 10,
    carbs: Math.round((actual.carbs - target.carbs) * 10) / 10,
    fats: Math.round((actual.fats - target.fats) * 10) / 10,
    fiber: actual.fiber && target.fiber
      ? Math.round((actual.fiber - target.fiber) * 10) / 10
      : undefined,
    sugar: actual.sugar && target.sugar
      ? Math.round((actual.sugar - target.sugar) * 10) / 10
      : undefined,
    sodium: actual.sodium && target.sodium
      ? actual.sodium - target.sodium
      : undefined,
  };
}

/**
 * Calculate percentage difference between two macro values
 */
export function calculateMacroPercentageDifference(
  actual: MacroValues,
  target: MacroValues
): {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
} {
  return {
    calories: target.calories !== 0
      ? Math.round(((actual.calories - target.calories) / target.calories) * 100 * 10) / 10
      : 0,
    protein: target.protein !== 0
      ? Math.round(((actual.protein - target.protein) / target.protein) * 100 * 10) / 10
      : 0,
    carbs: target.carbs !== 0
      ? Math.round(((actual.carbs - target.carbs) / target.carbs) * 100 * 10) / 10
      : 0,
    fats: target.fats !== 0
      ? Math.round(((actual.fats - target.fats) / target.fats) * 100 * 10) / 10
      : 0,
  };
}

/**
 * Round macros to reasonable precision
 */
export function roundMacros(macros: MacroValues): MacroValues {
  return {
    calories: Math.round(macros.calories),
    protein: Math.round(macros.protein * 10) / 10,
    carbs: Math.round(macros.carbs * 10) / 10,
    fats: Math.round(macros.fats * 10) / 10,
    fiber: macros.fiber ? Math.round(macros.fiber * 10) / 10 : undefined,
    sugar: macros.sugar ? Math.round(macros.sugar * 10) / 10 : undefined,
    sodium: macros.sodium ? Math.round(macros.sodium) : undefined,
  };
}

/**
 * Validate macro values (check for negative values, etc.)
 */
export function validateMacros(macros: MacroValues): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (macros.calories < 0) {
    errors.push('Calories cannot be negative');
  }
  if (macros.protein < 0) {
    errors.push('Protein cannot be negative');
  }
  if (macros.carbs < 0) {
    errors.push('Carbs cannot be negative');
  }
  if (macros.fats < 0) {
    errors.push('Fats cannot be negative');
  }
  if (macros.fiber !== undefined && macros.fiber < 0) {
    errors.push('Fiber cannot be negative');
  }
  if (macros.sugar !== undefined && macros.sugar < 0) {
    errors.push('Sugar cannot be negative');
  }
  if (macros.sodium !== undefined && macros.sodium < 0) {
    errors.push('Sodium cannot be negative');
  }

  // Check for reasonable maximums (sanity checks)
  if (macros.calories > 10000) {
    errors.push('Calories exceed reasonable maximum (10,000 kcal)');
  }
  if (macros.protein > 500) {
    errors.push('Protein exceeds reasonable maximum (500g)');
  }
  if (macros.carbs > 1000) {
    errors.push('Carbs exceed reasonable maximum (1000g)');
  }
  if (macros.fats > 500) {
    errors.push('Fats exceed reasonable maximum (500g)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

