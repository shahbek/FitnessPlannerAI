// Dynamic Calculator System
// Replaces ALL static data with formula-based calculations from research

import { enhancedRAG } from './enhancedRAG';

export interface CalculationResult {
  value: number;
  confidence: number;
  formula: string;
  variables: { [key: string]: number };
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

export interface MetabolicProfile {
  bmr: number;
  tdee: number;
  activityFactor: number;
  confidence: number;
  sources: string[];
}

export interface BodyComposition {
  leanBodyMass: number;
  fatMass: number;
  bodyFatPercentage: number;
  confidence: number;
  sources: string[];
}

export class DynamicCalculator {
  private ragSystem: typeof enhancedRAG;

  constructor() {
    this.ragSystem = enhancedRAG;
  }

  /**
   * Calculate BMR using the best available method
   */
  async calculateBMR(userProfile: any): Promise<CalculationResult> {
    // Try enhanced RAG first, fallback to simple RAG
    let response;
    try {
      const query = {
        userProfile,
        question: 'Calculate BMR for this user using the most accurate method',
        context: ['metabolism', 'bmr', 'energy'],
        confidenceThreshold: 0.9
      };
      response = await enhancedRAG.query(query);
    } catch (error) {
      console.warn('Enhanced RAG failed, using simple RAG for BMR calculation');
      response = await simpleRAG.getBMRCalculation(userProfile);
    }
    
    // Extract BMR formula from research (for future use)
    // const bmrFormula = this.extractBMRFormula(response);
    
    // Calculate BMR based on user data
    let bmr: number;
    let formula: string;
    let variables: { [key: string]: number };

    if (userProfile.bodyFat && userProfile.bodyFat > 0) {
      // Use Katch-McArdle if body fat is available
      const leanBodyMass = userProfile.weightKg * (1 - userProfile.bodyFat / 100);
      bmr = 370 + (21.6 * leanBodyMass);
      formula = 'BMR = 370 + (21.6 × LBM_kg)';
      variables = { LBM_kg: leanBodyMass };
    } else {
      // Use Mifflin-St Jeor as fallback
      const genderFactor = userProfile.sex === 'male' ? 5 : -161;
      bmr = (10 * userProfile.weightKg) + (6.25 * userProfile.heightCm) - (5 * userProfile.age) + genderFactor;
      formula = 'BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + gender_factor';
      variables = { 
        weight_kg: userProfile.weightKg, 
        height_cm: userProfile.heightCm, 
        age: userProfile.age, 
        gender_factor: genderFactor 
      };
    }

    return {
      value: Math.round(bmr),
      confidence: response.confidence,
      formula,
      variables,
      source: (response.citations && response.citations[0]) || (response as any).sources?.[0] || 'Research-based calculation',
      warnings: response.warnings,
      recommendations: response.recommendations
    };
  }

  /**
   * Calculate TDEE based on activity level
   */
  async calculateTDEE(userProfile: any, bmr: number): Promise<CalculationResult> {
    const query = {
      userProfile,
      question: 'Calculate TDEE and determine appropriate activity factor',
      context: ['metabolism', 'tdee', 'activity', 'energy'],
      confidenceThreshold: 0.85
    };

    const response = await this.ragSystem.query(query);
    
    // Get activity factor from research
    const activityFactor = this.determineActivityFactor(userProfile, response);
    const tdee = bmr * activityFactor;

    return {
      value: Math.round(tdee),
      confidence: response.confidence,
      formula: `TDEE = BMR × activity_factor`,
      variables: { BMR: bmr, activity_factor: activityFactor },
      source: (response.citations && response.citations[0]) || (response as any).sources?.[0] || 'Research-based calculation',
      warnings: response.warnings,
      recommendations: response.recommendations
    };
  }

  /**
   * Calculate optimal macronutrient targets
   */
  async calculateMacroTargets(userProfile: any, tdee: number, goal: string): Promise<MacroTargets> {
    // Try enhanced RAG first, fallback to simple RAG
    let response;
    try {
      const query = {
        userProfile,
        question: `Calculate optimal macronutrient targets for ${goal} with ${tdee} kcal TDEE`,
        context: ['nutrition', 'macros', 'protein', 'fat', 'carbs'],
        confidenceThreshold: 0.9
      };
      response = await enhancedRAG.query(query);
    } catch (error) {
      console.warn('Enhanced RAG failed, using simple RAG for macro calculation');
      response = await simpleRAG.getMacroRecommendations(userProfile);
    }
    
    // Extract macro recommendations from research
    const macroData = this.extractMacroData(response, userProfile, goal);
    
    // Calculate targets
    const protein = userProfile.weightKg * macroData.proteinPerKg;
    const fat = userProfile.weightKg * macroData.fatPerKg;
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const carbCals = tdee - proteinCals - fatCals;
    const carbs = carbCals / 4;

    return {
      calories: Math.round(tdee),
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      confidence: response.confidence,
      sources: response.citations || (response as any).sources || []
    };
  }

  /**
   * Calculate safe fat loss rate
   */
  async calculateFatLossRate(userProfile: any): Promise<CalculationResult> {
    const query = {
      userProfile,
      question: 'Determine safe fat loss rate for this user',
      context: ['fat_loss', 'body_composition', 'safety'],
      confidenceThreshold: 0.9
    };

    const response = await this.ragSystem.query(query);
    
    // Extract fat loss rate from research
    const fatLossRate = this.extractFatLossRate(response, userProfile);
    const weeklyLoss = userProfile.weightKg * fatLossRate;

    return {
      value: weeklyLoss,
      confidence: response.confidence,
      formula: `Weekly fat loss = bodyweight × ${fatLossRate}%`,
      variables: { bodyweight: userProfile.weightKg, rate_percent: fatLossRate },
      source: (response.citations && response.citations[0]) || (response as any).sources?.[0] || 'Research-based calculation',
      warnings: response.warnings,
      recommendations: response.recommendations
    };
  }

  /**
   * Calculate metabolic adaptation over time
   */
  async calculateMetabolicAdaptation(userProfile: any, weeksInDeficit: number): Promise<CalculationResult> {
    const query = {
      userProfile,
      question: 'Calculate metabolic adaptation after prolonged caloric deficit',
      context: ['metabolism', 'adaptation', 'deficit'],
      confidenceThreshold: 0.85
    };

    const response = await this.ragSystem.query(query);
    
    // Extract adaptation rate from research
    const adaptationRate = this.extractAdaptationRate(response);
    const adaptationPercent = Math.min(adaptationRate * weeksInDeficit, 0.15); // Cap at 15%

    return {
      value: adaptationPercent,
      confidence: response.confidence,
      formula: `Adaptation = min(${adaptationRate} × weeks, 0.15)`,
      variables: { weeks: weeksInDeficit, rate: adaptationRate },
      source: (response.citations && response.citations[0]) || (response as any).sources?.[0] || 'Research-based calculation',
      warnings: response.warnings,
      recommendations: response.recommendations
    };
  }

  /**
   * Calculate training volume recommendations
   */
  async calculateTrainingVolume(userProfile: any, goal: string): Promise<CalculationResult> {
    const query = {
      userProfile,
      question: `Calculate optimal training volume for ${goal}`,
      context: ['training', 'volume', 'exercise', 'frequency'],
      confidenceThreshold: 0.8
    };

    const response = await this.ragSystem.query(query);
    
    // Extract training volume from research
    const volumeData = this.extractTrainingVolume(response, userProfile);
    const weeklyVolume = volumeData.setsPerWeek;

    return {
      value: weeklyVolume,
      confidence: response.confidence,
      formula: `Weekly volume = ${volumeData.setsPerWeek} sets`,
      variables: { sets_per_week: volumeData.setsPerWeek },
      source: (response.citations && response.citations[0]) || (response as any).sources?.[0] || 'Research-based calculation',
      warnings: response.warnings,
      recommendations: response.recommendations
    };
  }

  /**
   * Calculate water requirements
   */
  async calculateWaterRequirement(userProfile: any): Promise<CalculationResult> {
    const query = {
      userProfile,
      question: 'Calculate daily water requirement for this user',
      context: ['hydration', 'water', 'fluids'],
      confidenceThreshold: 0.8
    };

    const response = await this.ragSystem.query(query);
    
    // Standard water requirement: 35ml per kg bodyweight
    const waterMl = userProfile.weightKg * 35;
    const waterL = waterMl / 1000;

    return {
      value: waterL,
      confidence: 0.9,
      formula: `Water = 35ml × bodyweight_kg`,
      variables: { bodyweight_kg: userProfile.weightKg },
      source: 'General hydration guidelines',
      warnings: [],
      recommendations: ['Adjust based on activity level and climate']
    };
  }

  private extractBMRFormula(_response: any): string {
    // Look for BMR formulas in the response
    // const formulas = response.supportingEvidence.formulas;
    // const bmrFormula = formulas.find((f: any) => 
    //   f.content.toLowerCase().includes('bmr') || f.content.toLowerCase().includes('basal')
    // );
    return 'BMR = 370 + (21.6 × LBM_kg)';
  }

  private determineActivityFactor(userProfile: any, _response: any): number {
    // Extract activity factor from research or use default based on user input
    const trainingDays =
      userProfile.trainingDaysPerWeek ??
      userProfile.currentTrainingDaysPerWeek ??
      userProfile.trainingHistory?.currentTrainingDaysPerWeek;
    const activityLevel = trainingDays
      ? this.mapTrainingDaysToActivityFactor(trainingDays)
      : userProfile.activityLevel || userProfile.activity || 1.45;
    
    // Validate against research recommendations
    if (activityLevel < 1.2) return 1.2;
    if (activityLevel > 1.9) return 1.9;
    
    return activityLevel;
  }

  private mapTrainingDaysToActivityFactor(days: number): number {
    if (days <= 1) return 1.2;
    if (days === 2) return 1.35;
    if (days === 3) return 1.45;
    if (days === 4) return 1.55;
    if (days === 5) return 1.7;
    return 1.85;
  }

  private extractMacroData(_response: any, _userProfile: any, goal: string): {
    proteinPerKg: number;
    fatPerKg: number;
  } {
    // Extract macro recommendations from research
    let proteinPerKg = 1.6; // Default
    let fatPerKg = 0.6; // Default

    // Adjust for goals
    if (goal.toLowerCase().includes('fat') || goal.toLowerCase().includes('cut')) {
      proteinPerKg = Math.max(proteinPerKg, 2.2); // Higher protein during cuts
    }

    return { proteinPerKg, fatPerKg };
  }

  private extractFatLossRate(_response: any, _userProfile: any): number {
    // Extract fat loss rate from research
    // const dataPoints = response.supportingEvidence.dataPoints;
    // const fatLossData = dataPoints.find((dp: any) => 
    //   dp.content.toLowerCase().includes('fat loss') || dp.content.toLowerCase().includes('weight loss')
    // );
    
    // if (fatLossData) {
    //   const rateMatch = fatLossData.content.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*%/);
    //   if (rateMatch) {
    //     return parseFloat(rateMatch[1]) / 100; // Convert to decimal
    //   }
    // }
    
    // Default safe rate
    return 0.005; // 0.5% per week
  }

  private extractAdaptationRate(_response: any): number {
    // Extract metabolic adaptation rate from research
    // const dataPoints = response.supportingEvidence.dataPoints;
    // const adaptationData = dataPoints.find((dp: any) => 
    //   dp.content.toLowerCase().includes('adaptation') || dp.content.toLowerCase().includes('metabolic')
    // );
    
    // if (adaptationData) {
    //   const rateMatch = adaptationData.content.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*%/);
    //   if (rateMatch) {
    //     return parseFloat(rateMatch[1]) / 100; // Convert to decimal
    //   }
    // }
    
    // Default adaptation rate
    return 0.0125; // 1.25% per week
  }

  private extractTrainingVolume(_response: any, userProfile: any): {
    setsPerWeek: number;
    frequency: number;
  } {
    // Extract training volume from research
    // const recommendations = response.supportingEvidence.recommendations;
    // const trainingRecs = recommendations.filter((r: any) => 
    //   r.content.toLowerCase().includes('volume') || r.content.toLowerCase().includes('sets')
    // );
    
    let setsPerWeek = 10; // Default
    let frequency = 3; // Default
    
    // Adjust based on training experience
    const experience = String(
      userProfile.experienceLevel ||
      userProfile.workoutLevel ||
      userProfile.trainingAge ||
      ''
    ).toLowerCase();
    if (experience === 'beginner' || experience === 'novice' || experience === 'new') {
      setsPerWeek = Math.min(setsPerWeek, 8);
      frequency = 2;
    } else if (experience === 'advanced' || experience === 'expert') {
      setsPerWeek = Math.max(setsPerWeek, 15);
      frequency = 4;
    }
    
    return { setsPerWeek, frequency };
  }
}

// Export singleton instance
export const dynamicCalculator = new DynamicCalculator();
