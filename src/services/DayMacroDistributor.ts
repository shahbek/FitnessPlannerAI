/**
 * Day-Level Macro Distributor
 * 
 * Distributes weekly macro targets to individual days.
 * Supports macro cycling (training vs rest days).
 */

import { MacroValues } from '../types/nutrition';
import { WeeklyOutline } from '../models/PlanModels';

/**
 * Day Type for Macro Cycling
 */
export type DayType = 'training' | 'rest' | 'cardio';

/**
 * Day Macro Targets
 */
export interface DayMacroTargets {
  dayNumber: number; // 1-7 (Monday-Sunday)
  dayName: string;
  dayType: DayType;
  targets: MacroValues;
}

/**
 * Macro Cycling Strategy
 */
export interface MacroCyclingStrategy {
  trainingDays: {
    caloriesMultiplier?: number; // e.g., 1.05 for 5% more on training days
    proteinMultiplier?: number;
    carbsMultiplier?: number; // Typically higher on training days
    fatsMultiplier?: number; // Typically lower on training days
  };
  restDays: {
    caloriesMultiplier?: number; // e.g., 0.95 for 5% less on rest days
    proteinMultiplier?: number;
    carbsMultiplier?: number; // Typically lower on rest days
    fatsMultiplier?: number; // Typically higher on rest days
  };
}

/**
 * Default cycling strategy (conservative approach)
 */
const DEFAULT_CYCLING_STRATEGY: MacroCyclingStrategy = {
  trainingDays: {
    caloriesMultiplier: 1.03, // 3% more calories on training days
    proteinMultiplier: 1.0, // Same protein
    carbsMultiplier: 1.1, // 10% more carbs on training days
    fatsMultiplier: 0.9, // 10% less fats on training days
  },
  restDays: {
    caloriesMultiplier: 0.97, // 3% less calories on rest days
    proteinMultiplier: 1.0, // Same protein
    carbsMultiplier: 0.9, // 10% less carbs on rest days
    fatsMultiplier: 1.1, // 10% more fats on rest days
  },
};

/**
 * Day-Level Macro Distributor
 */
export class DayMacroDistributor {
  /**
   * Distribute weekly targets to daily targets
   */
  distributeWeeklyTargets(
    weeklyOutline: WeeklyOutline,
    enableCycling: boolean = true,
    customStrategy?: MacroCyclingStrategy
  ): DayMacroTargets[] {
    const baseDailyTargets = this.calculateBaseDailyTargets(weeklyOutline);
    const dayTypes = this.determineDayTypes(weeklyOutline);

    if (!enableCycling) {
      // Return same targets for all days
      return dayTypes.map((dayType, index) => ({
        dayNumber: index + 1,
        dayName: this.getDayName(index),
        dayType,
        targets: baseDailyTargets,
      }));
    }

    // Apply cycling strategy
    const strategy = customStrategy || DEFAULT_CYCLING_STRATEGY;

    return dayTypes.map((dayType, index) => {
      const targets = this.applyCyclingStrategy(
        baseDailyTargets,
        dayType,
        strategy
      );

      return {
        dayNumber: index + 1,
        dayName: this.getDayName(index),
        dayType,
        targets: this.roundTargets(targets),
      };
    });
  }

  /**
   * Calculate base daily targets from weekly outline
   * Assumes equal distribution across 7 days
   */
  private calculateBaseDailyTargets(
    weeklyOutline: WeeklyOutline
  ): MacroValues {
    const dailyTargets = weeklyOutline.dailyTargets;

    return {
      calories: Math.round(dailyTargets.calories),
      protein: Math.round(dailyTargets.protein * 10) / 10,
      carbs: dailyTargets.carbs ? Math.round(dailyTargets.carbs * 10) / 10 : 0,
      fats: dailyTargets.fat ? Math.round(dailyTargets.fat * 10) / 10 : 0,
    };
  }

  /**
   * Determine day types based on training schedule
   */
  private determineDayTypes(weeklyOutline: WeeklyOutline): DayType[] {
    const days: DayType[] = [];
    const trainingSchedule = weeklyOutline.trainingSchedule;
    const resistanceDays = trainingSchedule.resistanceDays || [];
    const cardioDays = trainingSchedule.cardioDays || [];
    const restDays = trainingSchedule.restDays || [];

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < 7; i++) {
      const dayName = dayNames[i];

      if (restDays.includes(dayName)) {
        days.push('rest');
      } else if (resistanceDays.includes(dayName)) {
        days.push('training');
      } else if (cardioDays.includes(dayName)) {
        days.push('cardio');
      } else {
        // Default to rest if not specified
        days.push('rest');
      }
    }

    return days;
  }

  /**
   * Apply cycling strategy to base targets
   */
  private applyCyclingStrategy(
    baseTargets: MacroValues,
    dayType: DayType,
    strategy: MacroCyclingStrategy
  ): MacroValues {
    let multipliers;

    if (dayType === 'training') {
      multipliers = strategy.trainingDays;
    } else if (dayType === 'rest') {
      multipliers = strategy.restDays;
    } else {
      // Cardio days: use a mix (closer to training but less carbs)
      multipliers = {
        caloriesMultiplier:
          (strategy.trainingDays.caloriesMultiplier || 1.0) * 0.98,
        proteinMultiplier: strategy.trainingDays.proteinMultiplier || 1.0,
        carbsMultiplier:
          (strategy.trainingDays.carbsMultiplier || 1.0) * 0.95,
        fatsMultiplier: strategy.trainingDays.fatsMultiplier || 1.0,
      };
    }

    return {
      calories: Math.round(
        baseTargets.calories * (multipliers.caloriesMultiplier || 1.0)
      ),
      protein:
        Math.round(
          baseTargets.protein *
            (multipliers.proteinMultiplier || 1.0) *
            10
        ) / 10,
      carbs:
        Math.round(
          baseTargets.carbs * (multipliers.carbsMultiplier || 1.0) * 10
        ) / 10,
      fats:
        Math.round(
          baseTargets.fats * (multipliers.fatsMultiplier || 1.0) * 10
        ) / 10,
    };
  }

  /**
   * Round targets to reasonable precision
   */
  private roundTargets(targets: MacroValues): MacroValues {
    return {
      calories: Math.round(targets.calories),
      protein: Math.round(targets.protein * 10) / 10,
      carbs: Math.round(targets.carbs * 10) / 10,
      fats: Math.round(targets.fats * 10) / 10,
    };
  }

  /**
   * Get day name from index
   */
  private getDayName(index: number): string {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return days[index];
  }

  /**
   * Verify weekly totals match outline targets
   */
  verifyWeeklyTotals(
    dayTargets: DayMacroTargets[],
    weeklyOutline: WeeklyOutline
  ): {
    passed: boolean;
    differences: MacroValues;
    percentageDifferences: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  } {
    // Sum all day targets
    const weeklyTotals = dayTargets.reduce(
      (total, day) => ({
        calories: total.calories + day.targets.calories,
        protein: total.protein + day.targets.protein,
        carbs: total.carbs + day.targets.carbs,
        fats: total.fats + day.targets.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    // Calculate expected weekly totals (daily * 7)
    const expectedWeekly = {
      calories: weeklyOutline.dailyTargets.calories * 7,
      protein: weeklyOutline.dailyTargets.protein * 7,
      carbs: (weeklyOutline.dailyTargets.carbs || 0) * 7,
      fats: (weeklyOutline.dailyTargets.fat || 0) * 7,
    };

    // Calculate differences
    const differences: MacroValues = {
      calories: weeklyTotals.calories - expectedWeekly.calories,
      protein: Math.round((weeklyTotals.protein - expectedWeekly.protein) * 10) / 10,
      carbs: Math.round((weeklyTotals.carbs - expectedWeekly.carbs) * 10) / 10,
      fats: Math.round((weeklyTotals.fats - expectedWeekly.fats) * 10) / 10,
    };

    // Calculate percentage differences
    const percentageDifferences = {
      calories:
        expectedWeekly.calories !== 0
          ? Math.round(
              ((differences.calories / expectedWeekly.calories) * 100) * 10
            ) / 10
          : 0,
      protein:
        expectedWeekly.protein !== 0
          ? Math.round(
              ((differences.protein / expectedWeekly.protein) * 100) * 10
            ) / 10
          : 0,
      carbs:
        expectedWeekly.carbs !== 0
          ? Math.round(
              ((differences.carbs / expectedWeekly.carbs) * 100) * 10
            ) / 10
          : 0,
      fats:
        expectedWeekly.fats !== 0
          ? Math.round(
              ((differences.fats / expectedWeekly.fats) * 100) * 10
            ) / 10
          : 0,
    };

    // Check if within acceptable tolerance (±2% for weekly totals)
    const tolerance = 2;
    const passed =
      Math.abs(percentageDifferences.calories) <= tolerance &&
      Math.abs(percentageDifferences.protein) <= tolerance &&
      Math.abs(percentageDifferences.carbs) <= tolerance &&
      Math.abs(percentageDifferences.fats) <= tolerance;

    return {
      passed,
      differences,
      percentageDifferences,
    };
  }
}

