// Dynamic Calculator System (self-contained)
// Provides evidence-aligned calculations without relying on the removed enhancedRAG layer.

import {
  researchKnowledgeBase,
  ResearchFact,
} from './knowledgeBase';

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
   * Basal metabolic rate using Katch–McArdle (if body-fat% available) or Mifflin–St Jeor.
   */
  async calculateBMR(userProfile: any): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const hasBodyFat =
      typeof userProfile.bodyFat === 'number' && userProfile.bodyFat > 0;
    let value: number;
    let formula: string;
    let variables: Record<string, number>;
    let sourceFact: ResearchFact | undefined;

    if (hasBodyFat) {
      const leanBodyMass =
        userProfile.weightKg * (1 - userProfile.bodyFat / 100);
      value = 370 + 21.6 * leanBodyMass;
      formula = 'BMR = 370 + (21.6 × LBM_kg)';
      variables = { LBM_kg: leanBodyMass };
      sourceFact = researchKnowledgeBase.getFactById('katch_mcardle_bmr');
    } else {
      const genderFactor = userProfile.sex === 'male' ? 5 : -161;
      value =
        10 * userProfile.weightKg +
        6.25 * userProfile.heightCm -
        5 * userProfile.age +
        genderFactor;
      formula =
        'BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + gender_factor';
      variables = {
        weight_kg: userProfile.weightKg,
        height_cm: userProfile.heightCm,
        age: userProfile.age,
        gender_factor: genderFactor,
      };
      sourceFact = researchKnowledgeBase.getFactById('mifflin_st_jeor_bmr');
    }

    return {
      value: Math.round(value),
      confidence: 0.92,
      formula,
      variables,
      source: sourceFact?.source ?? 'Research-backed BMR formula',
      warnings: [],
      recommendations: [],
    };
  }

  /**
   * Total daily energy expenditure based on activity factors.
   */
  async calculateTDEE(
    userProfile: any,
    bmr: number,
  ): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const activityFactor = this.determineActivityFactor(userProfile);
    const tdee = bmr * activityFactor;

    return {
      value: Math.round(tdee),
      confidence: 0.9,
      formula: 'TDEE = BMR × activity_factor',
      variables: { BMR: bmr, activity_factor: activityFactor },
      source:
        researchKnowledgeBase.getFactById('activity_factors')?.source ??
        'Activity factor guidelines',
      warnings: [],
      recommendations: [],
    };
  }

  /**
   * Macro distribution tailored to goal (fat loss, recomp, gain).
   */
  async calculateMacroTargets(
    userProfile: any,
    tdee: number,
    goal: string,
  ): Promise<MacroTargets> {
    await this.ensureKnowledgeBase();

    const { proteinPerKg, fatPerKg } = this.deriveMacroRatios(goal);
    const protein = userProfile.weightKg * proteinPerKg;
    const fat = userProfile.weightKg * fatPerKg;
    const remainingCalories = Math.max(tdee - protein * 4 - fat * 9, 200);
    const carbs = remainingCalories / 4;

    return {
      calories: Math.round(tdee),
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      confidence: 0.88,
      sources: this.collectMacroSources(goal),
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
   */
  async calculateTrainingVolume(
    userProfile: any,
    goal: string,
  ): Promise<CalculationResult> {
    await this.ensureKnowledgeBase();

    const { setsPerWeek, frequency } = this.deriveTrainingVolume(
      userProfile,
      goal,
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
   * Basic hydration guidance (35 ml/kg baseline).
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

  private determineActivityFactor(userProfile: any): number {
    const trainingDays =
      userProfile.trainingDaysPerWeek ??
      userProfile.currentTrainingDaysPerWeek ??
      userProfile.trainingHistory?.currentTrainingDaysPerWeek;

    if (typeof userProfile.activityLevel === 'number') {
      return this.clampActivity(userProfile.activityLevel);
    }

    if (
      typeof userProfile.activityLevel === 'string' &&
      ACTIVITY_LEVEL_MAP[userProfile.activityLevel]
    ) {
      return ACTIVITY_LEVEL_MAP[userProfile.activityLevel];
    }

    if (typeof trainingDays === 'number') {
      return this.clampActivity(this.mapTrainingDaysToActivityFactor(trainingDays));
    }

    return 1.45;
  }

  private clampActivity(value: number): number {
    return Math.min(Math.max(value, 1.2), 1.9);
  }

  private mapTrainingDaysToActivityFactor(days: number): number {
    if (days <= 1) return 1.2;
    if (days === 2) return 1.35;
    if (days === 3) return 1.5;
    if (days === 4) return 1.6;
    if (days === 5) return 1.7;
    return 1.8;
  }

  private deriveMacroRatios(goal: string): { proteinPerKg: number; fatPerKg: number } {
    const lowerGoal = goal.toLowerCase();
    if (lowerGoal.includes('fat') || lowerGoal.includes('cut')) {
      return { proteinPerKg: 2.2, fatPerKg: 0.7 };
    }
    if (lowerGoal.includes('muscle') || lowerGoal.includes('gain')) {
      return { proteinPerKg: 2.0, fatPerKg: 0.9 };
    }
    return { proteinPerKg: 1.8, fatPerKg: 0.8 };
  }

  private collectMacroSources(goal: string): string[] {
    const sourceSet = new Set<string>();
    [
      'helms_protein_cut',
      'peos_protein_peak',
      'helms_calorie_deficit',
    ].forEach((id) => {
      const fact = researchKnowledgeBase.getFactById(id);
      if (fact) {
        sourceSet.add(fact.source);
      }
    });

    if (goal.toLowerCase().includes('muscle')) {
      const muscleFact = researchKnowledgeBase.searchFacts(
        'hypertrophy volume protein',
        'training',
      )[0];
      if (muscleFact) {
        sourceSet.add(muscleFact.source);
      }
    }

    return Array.from(sourceSet);
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

const ACTIVITY_LEVEL_MAP: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very_active': 1.9,
};

export const dynamicCalculator = new DynamicCalculator();
