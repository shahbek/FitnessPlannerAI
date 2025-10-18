// Comprehensive User Profiling System for Personalized Fitness Planning
// This system creates detailed user profiles for highly accurate AI recommendations

export interface UserProfile {
  // Basic Demographics
  demographics: {
    age: number;
    sex: 'male' | 'female' | 'other';
    heightCm: number;
    weightKg: number;
    bodyFat?: number;
    ethnicity?: string;
  };

  // Physical Characteristics
  bodyComposition: {
    leanBodyMass: number;
    fatMass: number;
    bmi: number;
    bodyFatCategory: 'essential' | 'athletes' | 'fitness' | 'average' | 'obese';
    frameSize: 'small' | 'medium' | 'large';
  };

  // Training Background
  trainingHistory: {
    experienceLevel: 'beginner' | 'intermediate' | 'expert';
    trainingAge: 'new' | 'intermediate' | 'advanced';
    yearsTraining: number;
    primaryGoals: string[];
    trainingPreferences: string[];
    equipment: string[];
    preferredSplit?: string;
    timeConstraints: {
      maxSessionMinutes: number;
      sessionsPerWeek: number;
      preferredTimes: string[];
    };
  };

  // Lifestyle Factors
  lifestyle: {
    activityLevel: number; // 1.2-1.9 multiplier
    occupation: string;
    sleepHours: number;
    stressLevel: 1 | 2 | 3 | 4 | 5; // 1=low, 5=high
    travelFrequency: 'never' | 'rarely' | 'monthly' | 'weekly';
    socialSupport: 'low' | 'medium' | 'high';
  };

  // Health & Medical
  health: {
    medicalConditions: string[];
    medications: string[];
    injuries: string[];
    limitations: string[];
    supplements: string[];
    allergies: string[];
  };

  // Nutrition Preferences
  nutrition: {
    dietaryRestrictions: string[];
    foodPreferences: string[];
    cookingSkill: 'beginner' | 'intermediate' | 'advanced';
    mealPrepFrequency: 'never' | 'rarely' | 'weekly' | 'daily';
    budget: 'low' | 'medium' | 'high';
    culturalPreferences: string[];
  };

  // Goals & Timeline
  goals: {
    primary: string;
    secondary: string[];
    targetBodyFat?: number;
    targetWeight?: number;
    timelineWeeks: number;
    priority: 'health' | 'performance' | 'aesthetics' | 'competition';
  };

  // Psychological Factors
  psychology: {
    motivationLevel: 1 | 2 | 3 | 4 | 5;
    adherenceHistory: 'poor' | 'fair' | 'good' | 'excellent';
    preferredFeedback: 'detailed' | 'simple' | 'visual' | 'data-driven';
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  };

  // Calculated Metrics
  calculated: {
    bmr: number;
    tdee: number;
    proteinRequirement: number;
    fatRequirement: number;
    carbRequirement: number;
    waterRequirement: number;
  };

  // Confidence Scores
  confidence: {
    dataCompleteness: number;
    accuracy: number;
    reliability: number;
  };
}

export interface ProfileValidation {
  isValid: boolean;
  completeness: number;
  warnings: string[];
  recommendations: string[];
  missingFields: string[];
}

export class UserProfilingSystem {
  /**
   * Create a comprehensive user profile from form data
   */
  createProfile(formData: any): UserProfile {
    const demographics = this.extractDemographics(formData);
    const bodyComposition = this.calculateBodyComposition(demographics);
    const trainingHistory = this.extractTrainingHistory(formData);
    const lifestyle = this.extractLifestyle(formData);
    const health = this.extractHealth(formData);
    const nutrition = this.extractNutrition(formData);
    const goals = this.extractGoals(formData);
    const psychology = this.extractPsychology(formData);
    
    const calculated = this.calculateMetrics(demographics, bodyComposition, lifestyle, goals);
    const confidence = this.calculateConfidence(formData);

    return {
      demographics,
      bodyComposition,
      trainingHistory,
      lifestyle,
      health,
      nutrition,
      goals,
      psychology,
      calculated,
      confidence
    };
  }

  /**
   * Validate user profile completeness and accuracy
   */
  validateProfile(profile: UserProfile): ProfileValidation {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const missingFields: string[] = [];
    let completeness = 0;
    const totalFields = 25; // Total important fields

    // Check required fields
    const requiredFields = [
      'demographics.age',
      'demographics.sex',
      'demographics.heightCm',
      'demographics.weightKg',
      'trainingHistory.experienceLevel',
      'lifestyle.activityLevel',
      'goals.primary'
    ];

    let completedFields = 0;
    requiredFields.forEach(field => {
      const value = this.getNestedValue(profile, field);
      if (value !== undefined && value !== null && value !== '') {
        completedFields++;
      } else {
        missingFields.push(field);
      }
    });

    // Check important optional fields
    const optionalFields = [
      'demographics.bodyFat',
      'health.medicalConditions',
      'nutrition.dietaryRestrictions',
      'goals.targetBodyFat',
      'goals.timelineWeeks'
    ];

    optionalFields.forEach(field => {
      const value = this.getNestedValue(profile, field);
      if (value !== undefined && value !== null && value !== '') {
        completedFields++;
      }
    });

    completeness = completedFields / totalFields;

    // Generate warnings and recommendations
    if (!profile.demographics.bodyFat) {
      warnings.push('Body fat percentage not provided - using estimates');
      recommendations.push('Consider getting a DEXA scan or BodPod measurement for accuracy');
    }

    if (profile.health.medicalConditions.length === 0) {
      recommendations.push('Consider consulting with a healthcare provider before starting');
    }

    if (profile.goals.timelineWeeks < 4) {
      warnings.push('Very short timeline may not be realistic');
      recommendations.push('Consider extending timeline for sustainable results');
    }

    if (profile.psychology.adherenceHistory === 'poor') {
      warnings.push('History of poor adherence - plan may need extra support');
      recommendations.push('Consider starting with smaller, more manageable goals');
    }

    if (profile.lifestyle.stressLevel >= 4) {
      warnings.push('High stress levels may affect adherence and results');
      recommendations.push('Consider stress management strategies alongside fitness plan');
    }

    return {
      isValid: missingFields.length === 0,
      completeness,
      warnings,
      recommendations,
      missingFields
    };
  }

  /**
   * Generate personalized recommendations based on profile
   */
  generatePersonalizedRecommendations(profile: UserProfile): {
    nutrition: string[];
    training: string[];
    lifestyle: string[];
    monitoring: string[];
    warnings: string[];
  } {
    const nutrition: string[] = [];
    const training: string[] = [];
    const lifestyle: string[] = [];
    const monitoring: string[] = [];
    const warnings: string[] = [];

    // Nutrition recommendations
    if (profile.goals.primary.includes('fat') || profile.goals.primary.includes('cut')) {
      nutrition.push(`Target ${profile.calculated.proteinRequirement}g protein daily for muscle preservation`);
      nutrition.push(`Maintain minimum ${profile.calculated.fatRequirement}g fat for hormone production`);
    }

    if (profile.nutrition.cookingSkill === 'beginner') {
      nutrition.push('Focus on simple, easy-to-prepare meals');
      nutrition.push('Consider meal prep services or pre-made options');
    }

    if (profile.nutrition.budget === 'low') {
      nutrition.push('Prioritize cost-effective protein sources (eggs, chicken, beans)');
      nutrition.push('Buy seasonal vegetables and bulk grains');
    }

    // Training recommendations
    const experienceLevel = profile.trainingHistory.experienceLevel ||
      this.normalizeExperienceLevel(profile.trainingHistory.trainingAge);

    if (experienceLevel === 'beginner') {
      training.push('Start with 2-3 sessions per week to build consistency');
      training.push('Focus on learning proper form before increasing intensity');
    } else if (experienceLevel === 'expert') {
      training.push('Incorporate periodized blocks to manage fatigue and drive progress');
      training.push('Track performance metrics weekly to fine-tune progression');
    }

    if (profile.trainingHistory.timeConstraints.maxSessionMinutes < 30) {
      training.push('Use high-intensity, time-efficient workouts');
      training.push('Consider circuit training or supersets');
    }

    if (profile.health.injuries.length > 0) {
      training.push('Modify exercises to avoid aggravating injuries');
      training.push('Consider working with a physical therapist');
    }

    // Lifestyle recommendations
    if (profile.lifestyle.sleepHours < 7) {
      lifestyle.push('Prioritize 7-9 hours of sleep for recovery and results');
      warnings.push('Insufficient sleep may hinder progress');
    }

    if (profile.lifestyle.stressLevel >= 4) {
      lifestyle.push('Incorporate stress management techniques (meditation, yoga)');
      lifestyle.push('Consider reducing training intensity during high-stress periods');
    }

    if (profile.psychology.adherenceHistory === 'poor') {
      lifestyle.push('Start with small, achievable goals');
      lifestyle.push('Set up accountability systems (buddy, coach, app)');
    }

    // Monitoring recommendations
    if (profile.goals.primary.includes('fat') || profile.goals.primary.includes('weight')) {
      monitoring.push('Weigh yourself weekly at the same time and conditions');
      monitoring.push('Take progress photos monthly');
    }

    if (profile.psychology.preferredFeedback === 'data-driven') {
      monitoring.push('Track detailed metrics (calories, macros, workouts)');
      monitoring.push('Use apps or spreadsheets for data analysis');
    }

    return {
      nutrition,
      training,
      lifestyle,
      monitoring,
      warnings
    };
  }

  private extractDemographics(formData: any) {
    return {
      age: Number(formData.age) || 30,
      sex: formData.sex || 'male',
      heightCm: Number(formData.heightCm) || 175,
      weightKg: Number(formData.weightKg) || 70,
      bodyFat: formData.bodyFat ? Number(formData.bodyFat) : undefined,
      ethnicity: formData.ethnicity || undefined
    };
  }

  private calculateBodyComposition(demographics: any) {
    const leanBodyMass = demographics.bodyFat ? 
      demographics.weightKg * (1 - demographics.bodyFat / 100) :
      demographics.weightKg * 0.85; // Estimate if not provided

    const fatMass = demographics.weightKg - leanBodyMass;
    const bmi = demographics.weightKg / Math.pow(demographics.heightCm / 100, 2);
    
    let bodyFatCategory: string;
    if (demographics.bodyFat) {
      if (demographics.sex === 'male') {
        if (demographics.bodyFat < 6) bodyFatCategory = 'essential';
        else if (demographics.bodyFat < 14) bodyFatCategory = 'athletes';
        else if (demographics.bodyFat < 18) bodyFatCategory = 'fitness';
        else if (demographics.bodyFat < 25) bodyFatCategory = 'average';
        else bodyFatCategory = 'obese';
      } else {
        if (demographics.bodyFat < 10) bodyFatCategory = 'essential';
        else if (demographics.bodyFat < 16) bodyFatCategory = 'athletes';
        else if (demographics.bodyFat < 20) bodyFatCategory = 'fitness';
        else if (demographics.bodyFat < 32) bodyFatCategory = 'average';
        else bodyFatCategory = 'obese';
      }
    } else {
      bodyFatCategory = 'average';
    }

    // Estimate frame size based on height and weight
    let frameSize: string;
    const heightInches = demographics.heightCm / 2.54;
    const weightLbs = demographics.weightKg * 2.205;
    const frameIndex = heightInches / Math.cbrt(weightLbs);
    
    if (frameIndex > 12.5) frameSize = 'large';
    else if (frameIndex < 11.5) frameSize = 'small';
    else frameSize = 'medium';

    return {
      leanBodyMass,
      fatMass,
      bmi,
      bodyFatCategory: bodyFatCategory as any,
      frameSize: frameSize as any
    };
  }

  private extractTrainingHistory(formData: any) {
    const experienceLevel = this.normalizeExperienceLevel(formData.workoutLevel);
    const trainingAge = this.mapExperienceToLegacy(experienceLevel);
    const sessionsPerWeek = this.resolveSessionsPerWeek(formData);

    return {
      experienceLevel,
      trainingAge,
      yearsTraining: this.estimateYearsTraining(experienceLevel),
      primaryGoals: [formData.goal || 'general fitness'],
      trainingPreferences: formData.preferences ? formData.preferences.split(',').map((p: string) => p.trim()) : [],
      equipment: formData.equipment ? formData.equipment.split(',').map((e: string) => e.trim()) : [],
      preferredSplit: formData.workoutSplit || 'general_split',
      timeConstraints: {
        maxSessionMinutes: this.parseSessionMinutes(formData.schedule),
        sessionsPerWeek,
        preferredTimes: this.parsePreferredTimes(formData.schedule)
      }
    };
  }

  private extractLifestyle(formData: any) {
    const sessionsPerWeek = this.resolveSessionsPerWeek(formData);
    return {
      activityLevel: this.estimateActivityFactor(sessionsPerWeek),
      occupation: formData.occupation || 'office worker',
      sleepHours: Number(formData.sleepHours) || 8,
      stressLevel: Number(formData.stressLevel) || 3,
      travelFrequency: formData.travelFrequency || 'rarely',
      socialSupport: formData.socialSupport || 'medium'
    };
  }

  private extractHealth(formData: any) {
    return {
      medicalConditions: formData.medicalConditions ? formData.medicalConditions.split(',').map((c: string) => c.trim()) : [],
      medications: formData.medications ? formData.medications.split(',').map((m: string) => m.trim()) : [],
      injuries: formData.injuries ? formData.injuries.split(',').map((i: string) => i.trim()) : [],
      limitations: formData.limitations ? formData.limitations.split(',').map((l: string) => l.trim()) : [],
      supplements: formData.supplements ? formData.supplements.split(',').map((s: string) => s.trim()) : [],
      allergies: formData.allergies ? formData.allergies.split(',').map((a: string) => a.trim()) : []
    };
  }

  private extractNutrition(formData: any) {
    return {
      dietaryRestrictions: formData.avoid ? formData.avoid.split(',').map((r: string) => r.trim()) : [],
      foodPreferences: formData.preferences ? formData.preferences.split(',').map((p: string) => p.trim()) : [],
      cookingSkill: formData.cookingSkill || 'intermediate',
      mealPrepFrequency: formData.mealPrepFrequency || 'weekly',
      budget: formData.budget || 'medium',
      culturalPreferences: formData.culturalPreferences ? formData.culturalPreferences.split(',').map((c: string) => c.trim()) : []
    };
  }

  private extractGoals(formData: any) {
    return {
      primary: formData.goal || 'general fitness',
      secondary: formData.secondaryGoals ? formData.secondaryGoals.split(',').map((g: string) => g.trim()) : [],
      targetBodyFat: formData.targetBf ? Number(formData.targetBf) : undefined,
      targetWeight: formData.targetWeight ? Number(formData.targetWeight) : undefined,
      timelineWeeks: formData.timelineWeeks || 12,
      priority: this.determinePriority(formData.goal)
    };
  }

  private extractPsychology(formData: any) {
    return {
      motivationLevel: Number(formData.motivationLevel) || 4,
      adherenceHistory: formData.adherenceHistory || 'good',
      preferredFeedback: formData.preferredFeedback || 'detailed',
      learningStyle: formData.learningStyle || 'visual'
    };
  }

  private calculateMetrics(demographics: any, bodyComposition: any, lifestyle: any, goals: any) {
    // BMR using Katch-McArdle if body fat available, otherwise estimate
    const bmr = demographics.bodyFat ? 
      370 + (21.6 * bodyComposition.leanBodyMass) :
      10 * demographics.weightKg + 6.25 * demographics.heightCm - 5 * demographics.age + (demographics.sex === 'male' ? 5 : -161);

    const tdee = bmr * lifestyle.activityLevel;

    // Protein requirements based on goals
    let proteinMultiplier = 1.6; // Base requirement
    if (goals.primary.includes('fat') || goals.primary.includes('cut')) {
      proteinMultiplier = 2.2; // Higher during cuts
    } else if (goals.primary.includes('muscle') || goals.primary.includes('gain')) {
      proteinMultiplier = 1.8; // Moderate for muscle gain
    }

    const proteinRequirement = demographics.weightKg * proteinMultiplier;
    const fatRequirement = Math.max(0.6 * demographics.weightKg, 30); // Minimum for hormone production
    const carbRequirement = (tdee - (proteinRequirement * 4) - (fatRequirement * 9)) / 4;
    const waterRequirement = demographics.weightKg * 35; // ml per kg bodyweight

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      proteinRequirement: Math.round(proteinRequirement),
      fatRequirement: Math.round(fatRequirement),
      carbRequirement: Math.round(carbRequirement),
      waterRequirement: Math.round(waterRequirement)
    };
  }

  private calculateConfidence(formData: any) {
    let dataCompleteness = 0;
    let accuracy = 0.8; // Base accuracy
    let reliability = 0.8; // Base reliability

    // Check data completeness
    const importantFields = ['age', 'sex', 'heightCm', 'weightKg', 'bodyFat', 'trainingDaysPerWeek', 'workoutLevel', 'goal'];
    const completedFields = importantFields.filter(field => 
      formData[field] !== undefined && formData[field] !== null && formData[field] !== ''
    ).length;
    dataCompleteness = completedFields / importantFields.length;

    // Adjust accuracy based on data quality
    if (formData.bodyFat) accuracy += 0.1; // Body fat measurement improves accuracy
    if (String(formData.workoutLevel).toLowerCase() === 'expert') accuracy += 0.05; // More predictable responses
    if (Number(formData.trainingDaysPerWeek) >= 4) accuracy += 0.05; // Consistent training improves predictability

    // Adjust reliability based on user factors
    if (formData.adherenceHistory === 'excellent') reliability += 0.1;
    if (formData.motivationLevel >= 4) reliability += 0.05;

    return {
      dataCompleteness: Math.min(1, dataCompleteness),
      accuracy: Math.min(1, accuracy),
      reliability: Math.min(1, reliability)
    };
  }

  private estimateYearsTraining(experienceLevel: string): number {
    switch ((experienceLevel || '').toLowerCase()) {
      case 'beginner': return 0;
      case 'expert': return 6;
      default: return 3;
    }
  }

  private normalizeExperienceLevel(level: string): 'beginner' | 'intermediate' | 'expert' {
    const normalized = (level || '').toLowerCase();
    if (normalized === 'beginner') return 'beginner';
    if (normalized === 'expert' || normalized === 'advanced') return 'expert';
    return 'intermediate';
  }

  private mapExperienceToLegacy(level: 'beginner' | 'intermediate' | 'expert'): 'new' | 'intermediate' | 'advanced' {
    switch (level) {
      case 'beginner':
        return 'new';
      case 'expert':
        return 'advanced';
      default:
        return 'intermediate';
    }
  }

  private resolveSessionsPerWeek(formData: any): number {
    const fromField = Number(formData.trainingDaysPerWeek);
    if (Number.isFinite(fromField) && fromField >= 1) {
      return Math.max(1, Math.min(7, Math.round(fromField)));
    }
    return this.parseSessionsPerWeek(formData.schedule);
  }

  private estimateActivityFactor(sessionsPerWeek: number): number {
    if (sessionsPerWeek <= 1) return 1.2;
    if (sessionsPerWeek === 2) return 1.35;
    if (sessionsPerWeek === 3) return 1.45;
    if (sessionsPerWeek === 4) return 1.55;
    if (sessionsPerWeek === 5) return 1.7;
    return 1.85;
  }

  private parseSessionMinutes(schedule: string): number {
    if (!schedule) return 45;
    const match = schedule.match(/(\d+)m/);
    return match ? parseInt(match[1]) : 45;
  }

  private parseSessionsPerWeek(schedule: string): number {
    if (!schedule) return 3;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.filter(day => schedule.includes(day)).length;
  }

  private parsePreferredTimes(schedule: string): string[] {
    const times: string[] = [];
    if (schedule.includes('AM') || schedule.includes('morning')) times.push('morning');
    if (schedule.includes('PM') || schedule.includes('evening')) times.push('evening');
    return times.length > 0 ? times : ['morning'];
  }

  private determinePriority(goal: string): 'health' | 'performance' | 'aesthetics' | 'competition' {
    if (goal.includes('competition') || goal.includes('contest')) return 'competition';
    if (goal.includes('strength') || goal.includes('performance')) return 'performance';
    if (goal.includes('fat') || goal.includes('muscle') || goal.includes('aesthetic')) return 'aesthetics';
    return 'health';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Export singleton instance
export const userProfiling = new UserProfilingSystem();
