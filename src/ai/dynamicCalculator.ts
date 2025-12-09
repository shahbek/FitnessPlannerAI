// Dynamic Calculator System (self-contained)
// Provides evidence-aligned calculations without relying on the removed enhancedRAG layer.
//
// NOTE: This class now delegates to NutritionCalculationService for core calculations.
// It maintains backward compatibility while using the centralized calculation logic.

import {
  researchKnowledgeBase,
  ResearchFact,
} from './knowledgeBase';

import {
  nutritionCalculationService,
  UserMetrics,
  GoalConfig,
  GoalCategoryConfig,
  GOAL_CALORIE_ADJUSTMENTS,
} from '../services/NutritionCalculationService';

import {
  GoalCategory,
  BodyFatGoal,
  getEffectiveGoalType,
} from '../models/UserProfile';

export interface CalculationResult {
  value: number;
  confidence: number;
  formula: string;
  variables: Record<string, number>;
  source: string;
  warnings: string[];
  recommendations: string[];
}

export interface MacroTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  confidence: number;
  sources: string[];
}

export class DynamicCalculator {
  constructor() {
    if (!researchKnowledgeBase.isReady()) {
      void researchKnowledgeBase.initialize();
    }
  }

  /**
   * Basal metabolic rate using Katch–McArdle (if body-fat% available) or Mifflin–St Jeor.
   *
   * NOTE: Now delegates to NutritionCalculationService for calculation.
   */
  async calculateBMR(userProfile: any): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const metrics = this.convertToUserMetrics(userProfile);
    const maintenanceCalories = await nutritionCalculationService.calculateMaintenanceCalories(metrics);

    // Extract BMR-related variables for backward compatibility
    const hasBodyFat = typeof userProfile.bodyFat === 'number' && userProfile.bodyFat > 0;
    const variables: Record<string, number> = {};

    if (hasBodyFat) {
      const leanBodyMass = userProfile.weightKg * (1 - userProfile.bodyFat / 100);
      variables.LBM_kg = leanBodyMass;
    } else {
      variables.weight_kg = userProfile.weightKg;
      variables.height_cm = userProfile.heightCm;
      variables.age = userProfile.age;
      variables.gender_factor = userProfile.sex === 'male' ? 5 : -161;
    }

    return {
      value: maintenanceCalories.bmr,
      confidence: maintenanceCalories.confidence,
      formula: maintenanceCalories.bmrFormula,
      variables,
      source: maintenanceCalories.bmrSource,
      warnings: maintenanceCalories.warnings,
      recommendations: [],
    };
  }

  /**
   * Body Mass Index (kg/m^2)
   */
  async calculateBMI(userProfile: any): Promise<CalculationResult> {
    const heightM = (userProfile.heightCm || 0) / 100;
    const weightKg = userProfile.weightKg || 0;
    const value = heightM > 0 ? weightKg / (heightM * heightM) : 0;

    const recommendations: string[] = [];
    if (value > 0) {
      if (value < 18.5) recommendations.push('Consider a gradual weight gain approach with resistance training.');
      else if (value < 25) recommendations.push('Maintain with balanced nutrition and progressive training.');
      else if (value < 30) recommendations.push('Combine moderate caloric deficit with strength training to preserve muscle.');
      else recommendations.push('Prioritize sustainable fat loss with adequate protein and recovery.');
    }

    return {
      value: Number(value.toFixed(1)),
      confidence: 0.98,
      formula: 'BMI = weight_kg / (height_m^2)',
      variables: {
        weight_kg: weightKg,
        height_m: Number(heightM.toFixed(2)),
      },
      source: 'WHO BMI classification',
      warnings: [],
      recommendations,
    };
  }

  /**
   * Total daily energy expenditure based on activity factors.
   *
   * NOTE: Now delegates to NutritionCalculationService for calculation.
   */
  async calculateTDEE(
    userProfile: any,
    bmr: number,
  ): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const metrics = this.convertToUserMetrics(userProfile);
    const maintenanceCalories = await nutritionCalculationService.calculateMaintenanceCalories(metrics);

    return {
      value: maintenanceCalories.tdee,
      confidence: maintenanceCalories.confidence,
      formula: maintenanceCalories.tdeeFormula,
      variables: { BMR: maintenanceCalories.bmr, activity_factor: maintenanceCalories.activityFactor },
      source: maintenanceCalories.activityFactorSource,
      warnings: maintenanceCalories.warnings,
      recommendations: [],
    };
  }

  /**
   * Macro distribution tailored to goal (fat loss, recomp, gain).
   *
   * NOTE: Now uses GoalCategory system when available, falls back to legacy goal string.
   * This ensures new goal categories (dirty_bulk, lean_bulk, etc.) are properly handled.
   */
  async calculateMacroTargets(
    userProfile: any,
    tdee: number,
    goal: string,
  ): Promise<MacroTargets> {
    await this.ensureKnowledgeBase();

    const metrics = this.convertToUserMetrics(userProfile);
    const maintenanceCalories = await nutritionCalculationService.calculateMaintenanceCalories(metrics);

    // Check if userProfile has the new goalCategory field
    const goalCategory = userProfile.goalCategory as GoalCategory | undefined;
    
    if (goalCategory && GOAL_CALORIE_ADJUSTMENTS[goalCategory]) {
      // Use new GoalCategory system for proper surplus/deficit calculation
      const categoryConfig: GoalCategoryConfig = {
        goalCategory,
        timelineWeeks: userProfile.timelineWeeks,
        bodyFatGoal: userProfile.bodyFatGoal as BodyFatGoal | undefined,
      };

      const macros = await nutritionCalculationService.calculateMacroTargetsFromCategory(
        metrics,
        maintenanceCalories,
        categoryConfig
      );

      console.log(`📊 Using GoalCategory: ${goalCategory} → ${macros.calories} kcal (TDEE: ${maintenanceCalories.tdee})`);

      return {
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        carbs: macros.carbs,
        confidence: 0.92, // Higher confidence with explicit goal category
        sources: macros.sources,
      };
    }

    // Fall back to legacy goal string for backward compatibility
    console.log(`⚠️ Using legacy goal: ${goal} (no goalCategory found)`);
    
    const goalConfig: GoalConfig = {
      goal: goal,
      deficitMagnitude: 'moderate',
    };

    const macros = await nutritionCalculationService.calculateMacroTargets(
      metrics,
      maintenanceCalories,
      goalConfig
    );

    return {
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
      confidence: 0.88,
      sources: macros.sources,
    };
  }

  /**
   * Weekly fat-loss rate grounded in Helms/Peos guidelines.
   */
  async calculateFatLossRate(userProfile: any): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const rate = this.deriveFatLossRate(userProfile);
    const weeklyLossKg = userProfile.weightKg * rate;

    return {
      value: weeklyLossKg,
      confidence: 0.9,
      formula: `Weekly fat loss = bodyweight × ${rate * 100}%`,
      variables: { bodyweight: userProfile.weightKg, rate },
      source:
        researchKnowledgeBase.getFactById('helms_fat_loss_rate')?.source ??
        'Evidence-based fat-loss rate',
      warnings: [],
      recommendations: [
        'If average weekly loss exceeds targets, increase calories slightly.',
        'Consider diet breaks if rates stall for >3 weeks.',
      ],
    };
  }

  /**
   * Estimated metabolic adaptation after weeks in deficit.
   */
  async calculateMetabolicAdaptation(
    _userProfile: any,
    weeksInDeficit: number,
  ): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const weeklyRate = 0.0125; // ~1.25% per Trexler et al.
    const adaptation = Math.min(weeklyRate * weeksInDeficit, 0.15);

    return {
      value: adaptation,
      confidence: 0.85,
      formula: `Adaptation = min(${weeklyRate} × weeks, 0.15)`,
      variables: { weeks: weeksInDeficit, weekly_rate: weeklyRate },
      source:
        researchKnowledgeBase.getFactById('trexler_metabolic_adaptation')
          ?.source ?? 'Metabolic adaptation research',
      warnings: [],
      recommendations: [
        'Schedule refeeds/diet breaks every 6–8 weeks.',
        'Monitor resting heart rate and energy levels.',
      ],
    };
  }

  /**
   * Training volume recommendations (sets per muscle per week).
   * Now checks goalCategory first for proper goal-specific recommendations.
   */
  async calculateTrainingVolume(
    userProfile: any,
    goal: string,
  ): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    // Check for goalCategory first
    const goalCategory = userProfile.goalCategory as GoalCategory | undefined;
    const effectiveGoal = goalCategory 
      ? getEffectiveGoalType(goalCategory)
      : goal;

    const { setsPerWeek, frequency } = this.deriveTrainingVolume(
      userProfile,
      effectiveGoal,
    );

    return {
      value: setsPerWeek,
      confidence: 0.82,
      formula: 'Recommended weekly sets per muscle group',
      variables: { sets_per_week: setsPerWeek, frequency },
      source:
        researchKnowledgeBase.searchFacts(
          'resistance training volume hypertrophy',
          'training',
        )[0]?.source ?? 'Hypertrophy volume research',
      warnings: [],
      recommendations: [
        `Distribute volume across ${frequency} sessions for recovery.`,
        'Track performance to adjust sets up or down 10–15%.',
      ],
    };
  }

  /**
   * Basic hydration guidance (35 ml/kg baseline).
   */
  async calculateWaterRequirement(
    userProfile: any,
  ): Promise<CalculationResult> {
    const waterLitres = (userProfile.weightKg * 35) / 1000;

    return {
      value: Number(waterLitres.toFixed(2)),
      confidence: 0.8,
      formula: 'Water = 35ml × bodyweight_kg',
      variables: { bodyweight_kg: userProfile.weightKg },
      source: 'General hydration guidelines (ACSM)',
      warnings: [],
      recommendations: [
        'Increase intake on training days and in hotter climates.',
        'Monitor urine colour as a hydration marker.',
      ],
    };
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private async ensureKnowledgeBase(): Promise<void> {
    if (!researchKnowledgeBase.isReady()) {
      await researchKnowledgeBase.initialize();
    }
  }

  /**
   * Convert user profile to UserMetrics for NutritionCalculationService
   */
  private convertToUserMetrics(userProfile: any): UserMetrics {
    return {
      weightKg: userProfile.weightKg,
      heightCm: userProfile.heightCm,
      age: userProfile.age,
      sex: userProfile.sex,
      bodyFat: userProfile.bodyFat,
      activityLevel: userProfile.activityLevel,
      trainingDaysPerWeek: userProfile.trainingDaysPerWeek ??
                           userProfile.currentTrainingDaysPerWeek ??
                           userProfile.trainingHistory?.currentTrainingDaysPerWeek,
    };
  }

  private deriveFatLossRate(userProfile: any): number {
    const experience =
      String(userProfile.workoutLevel || userProfile.experienceLevel || '').toLowerCase();
    if (experience.includes('advanced') || experience.includes('expert')) {
      return 0.006;
    }
    return 0.0075;
  }

  private deriveTrainingVolume(userProfile: any, goal: string): {
    setsPerWeek: number;
    frequency: number;
  } {
    let sets = 10;
    let frequency = 3;

    const experience =
      String(userProfile.workoutLevel || userProfile.experienceLevel || '').toLowerCase();

    if (experience.includes('beginner')) {
      sets = 8;
      frequency = 2;
    } else if (experience.includes('advanced') || experience.includes('expert')) {
      sets = 14;
      frequency = 4;
    }

    if (goal.toLowerCase().includes('muscle')) {
      sets = Math.max(sets, 12);
    }

    return { setsPerWeek: sets, frequency };
  }
}

export const dynamicCalculator = new DynamicCalculator();
