// Confidence Scoring and Uncertainty Quantification System
// This system provides confidence scores for all AI-generated recommendations

export interface ConfidenceScore {
  overall: number; // 0-1
  breakdown: {
    evidenceQuality: number;
    dataCompleteness: number;
    populationMatch: number;
    recency: number;
    consistency: number;
  };
  factors: {
    strengths: string[];
    weaknesses: string[];
    assumptions: string[];
  };
  recommendations: string[];
}

export interface UncertaintyBounds {
  lower: number;
  upper: number;
  confidence: number;
  method: 'empirical' | 'bayesian' | 'ensemble';
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export class ConfidenceScoringSystem {
  private evidenceWeights = {
    meta_analysis: 1.0,
    rct: 0.9,
    cohort: 0.7,
    review: 0.6,
    consensus: 0.8
  };

  private populationWeights = {
    exact_match: 1.0,
    similar: 0.8,
    general: 0.6,
    different: 0.3
  };

  /**
   * Calculate comprehensive confidence score for a recommendation
   */
  calculateConfidence(
    recommendation: any,
    supportingFacts: any[],
    userProfile: any,
    context: string[]
  ): ConfidenceScore {
    const evidenceQuality = this.calculateEvidenceQuality(supportingFacts);
    const dataCompleteness = this.calculateDataCompleteness(userProfile, recommendation);
    const populationMatch = this.calculatePopulationMatch(supportingFacts, userProfile);
    const recency = this.calculateRecency(supportingFacts);
    const consistency = this.calculateConsistency(recommendation, supportingFacts);

    const breakdown = {
      evidenceQuality,
      dataCompleteness,
      populationMatch,
      recency,
      consistency
    };

    // Weighted average with evidence quality being most important
    const overall = (
      evidenceQuality * 0.35 +
      dataCompleteness * 0.25 +
      populationMatch * 0.20 +
      recency * 0.10 +
      consistency * 0.10
    );

    const factors = this.analyzeFactors(breakdown, supportingFacts, userProfile);
    const recommendations = this.generateConfidenceRecommendations(breakdown, factors);

    return {
      overall,
      breakdown,
      factors,
      recommendations
    };
  }

  /**
   * Calculate uncertainty bounds for numerical predictions
   */
  calculateUncertaintyBounds(
    prediction: number,
    confidence: number,
    supportingFacts: any[],
    method: 'empirical' | 'bayesian' | 'ensemble' = 'empirical'
  ): UncertaintyBounds {
    let lower: number, upper: number;

    switch (method) {
      case 'empirical':
        const empiricalRange = this.calculateEmpiricalRange(prediction, confidence, supportingFacts);
        lower = empiricalRange.lower;
        upper = empiricalRange.upper;
        break;
      
      case 'bayesian':
        const bayesianRange = this.calculateBayesianRange(prediction, confidence, supportingFacts);
        lower = bayesianRange.lower;
        upper = bayesianRange.upper;
        break;
      
      case 'ensemble':
        const ensembleRange = this.calculateEnsembleRange(prediction, confidence, supportingFacts);
        lower = ensembleRange.lower;
        upper = ensembleRange.upper;
        break;
      
      default:
        throw new Error(`Unknown uncertainty method: ${method}`);
    }

    return {
      lower,
      upper,
      confidence,
      method
    };
  }

  /**
   * Validate a recommendation against confidence thresholds
   */
  validateRecommendation(
    recommendation: any,
    confidence: ConfidenceScore,
    thresholds: {
      minimum: number;
      warning: number;
      high: number;
    } = { minimum: 0.7, warning: 0.8, high: 0.9 }
  ): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (confidence.overall < thresholds.minimum) {
      errors.push(`Confidence too low (${(confidence.overall * 100).toFixed(0)}% < ${(thresholds.minimum * 100).toFixed(0)}%)`);
    } else if (confidence.overall < thresholds.warning) {
      warnings.push(`Low confidence (${(confidence.overall * 100).toFixed(0)}% < ${(thresholds.warning * 100).toFixed(0)}%)`);
    }

    // Check individual factors
    if (confidence.breakdown.evidenceQuality < 0.7) {
      warnings.push('Limited high-quality evidence available');
      suggestions.push('Consider waiting for more research or using conservative estimates');
    }

    if (confidence.breakdown.dataCompleteness < 0.8) {
      warnings.push('Incomplete user data may affect accuracy');
      suggestions.push('Collect additional measurements (body fat %, activity level, etc.)');
    }

    if (confidence.breakdown.populationMatch < 0.6) {
      warnings.push('Limited data for your specific population');
      suggestions.push('Consider consulting with a specialist or using more general guidelines');
    }

    if (confidence.breakdown.consistency < 0.7) {
      warnings.push('Conflicting evidence in supporting research');
      suggestions.push('Consider multiple approaches or conservative implementation');
    }

    return {
      isValid: errors.length === 0,
      confidence: confidence.overall,
      warnings,
      errors,
      suggestions
    };
  }

  /**
   * Generate confidence-aware recommendations
   */
  generateConfidenceAwareRecommendations(
    baseRecommendations: string[],
    confidence: ConfidenceScore
  ): {
    highConfidence: string[];
    mediumConfidence: string[];
    lowConfidence: string[];
    disclaimers: string[];
  } {
    const highConfidence: string[] = [];
    const mediumConfidence: string[] = [];
    const lowConfidence: string[] = [];
    const disclaimers: string[] = [];

    baseRecommendations.forEach(rec => {
      if (confidence.overall >= 0.9) {
        highConfidence.push(rec);
      } else if (confidence.overall >= 0.7) {
        mediumConfidence.push(rec);
      } else {
        lowConfidence.push(rec);
      }
    });

    // Add disclaimers based on confidence factors
    if (confidence.breakdown.evidenceQuality < 0.8) {
      disclaimers.push('Based on limited evidence - monitor results closely');
    }
    if (confidence.breakdown.populationMatch < 0.7) {
      disclaimers.push('May not be optimal for your specific population');
    }
    if (confidence.breakdown.consistency < 0.8) {
      disclaimers.push('Conflicting evidence exists - consider alternatives');
    }

    return {
      highConfidence,
      mediumConfidence,
      lowConfidence,
      disclaimers
    };
  }

  private calculateEvidenceQuality(supportingFacts: any[]): number {
    if (supportingFacts.length === 0) return 0;

    const qualityScores = supportingFacts.map(fact => {
      const studyTypeScore = this.evidenceWeights[fact.evidence.studyTypes[0]] || 0.5;
      const sampleSizeScore = Math.min(1.0, (fact.evidence.sampleSize || 0) / 1000);
      const qualityScore = fact.evidence.quality === 'high' ? 1.0 : 
                          fact.evidence.quality === 'medium' ? 0.7 : 0.4;
      
      return (studyTypeScore + sampleSizeScore + qualityScore) / 3;
    });

    return qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  }

  private calculateDataCompleteness(userProfile: any, recommendation: any): number {
    const baseFields = ['age', 'weightKg', 'heightCm', 'sex'];
    const baseScore = baseFields.filter(field =>
      userProfile[field] !== undefined && userProfile[field] !== null && userProfile[field] !== ''
    ).length / baseFields.length;

    const trainingDays =
      userProfile.trainingDaysPerWeek ??
      userProfile.currentTrainingDaysPerWeek ??
      userProfile.trainingHistory?.currentTrainingDaysPerWeek ??
      userProfile.activity;
    const trainingScore = trainingDays ? 1 : 0;

    const optionalCandidates = [
      userProfile.bodyFat,
      userProfile.experienceLevel ?? userProfile.workoutLevel ?? userProfile.trainingAge,
      userProfile.goal,
      userProfile.targetBf
    ];
    const optionalScore =
      optionalCandidates.filter(value => value !== undefined && value !== null && value !== '').length /
      optionalCandidates.length;

    return baseScore * 0.6 + trainingScore * 0.2 + optionalScore * 0.2;
  }

  private calculatePopulationMatch(supportingFacts: any[], userProfile: any): number {
    if (supportingFacts.length === 0) return 0;

    const matchScores = supportingFacts.map(fact => {
      const population = fact.conditions.population.toLowerCase();
      
      if (population.includes('general') || population.includes('all')) {
        return this.populationWeights.general;
      }
      
      const experience = String(
        userProfile.experienceLevel ||
        userProfile.workoutLevel ||
        userProfile.trainingAge ||
        ''
      ).toLowerCase();

      if ((experience === 'beginner' || experience === 'novice' || experience === 'new') && population.includes('novice')) {
        return this.populationWeights.exact_match;
      }
      
      if ((experience === 'advanced' || experience === 'expert') && population.includes('advanced')) {
        return this.populationWeights.exact_match;
      }
      
      if (userProfile.sex === 'male' && population.includes('male')) {
        return this.populationWeights.similar;
      }
      
      if (userProfile.sex === 'female' && population.includes('female')) {
        return this.populationWeights.similar;
      }
      
      return this.populationWeights.different;
    });

    return matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length;
  }

  private calculateRecency(supportingFacts: any[]): number {
    if (supportingFacts.length === 0) return 0;

    const currentYear = new Date().getFullYear();
    const recencyScores = supportingFacts.map(fact => {
      const yearsDiff = currentYear - fact.publicationYear;
      
      if (yearsDiff <= 2) return 1.0;
      if (yearsDiff <= 5) return 0.8;
      if (yearsDiff <= 10) return 0.6;
      return 0.4;
    });

    return recencyScores.reduce((sum, score) => sum + score, 0) / recencyScores.length;
  }

  private calculateConsistency(recommendation: any, supportingFacts: any[]): number {
    if (supportingFacts.length <= 1) return 1.0;

    // Check for consistency in value ranges
    const valueRanges = supportingFacts
      .filter(fact => Array.isArray(fact.value))
      .map(fact => fact.value);

    if (valueRanges.length === 0) return 1.0;

    // Calculate overlap between ranges
    const overlaps = [];
    for (let i = 0; i < valueRanges.length - 1; i++) {
      for (let j = i + 1; j < valueRanges.length; j++) {
        const overlap = this.calculateRangeOverlap(valueRanges[i], valueRanges[j]);
        overlaps.push(overlap);
      }
    }

    return overlaps.length > 0 ? 
      overlaps.reduce((sum, overlap) => sum + overlap, 0) / overlaps.length : 1.0;
  }

  private calculateRangeOverlap(range1: [number, number], range2: [number, number]): number {
    const [min1, max1] = range1;
    const [min2, max2] = range2;
    
    const overlapStart = Math.max(min1, min2);
    const overlapEnd = Math.min(max1, max2);
    
    if (overlapStart >= overlapEnd) return 0;
    
    const overlapSize = overlapEnd - overlapStart;
    const totalSize = Math.max(max1, max2) - Math.min(min1, min2);
    
    return overlapSize / totalSize;
  }

  private analyzeFactors(breakdown: any, supportingFacts: any[], userProfile: any): {
    strengths: string[];
    weaknesses: string[];
    assumptions: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const assumptions: string[] = [];

    if (breakdown.evidenceQuality >= 0.8) {
      strengths.push('High-quality evidence base');
    } else {
      weaknesses.push('Limited high-quality evidence');
    }

    if (breakdown.dataCompleteness >= 0.9) {
      strengths.push('Complete user profile data');
    } else if (breakdown.dataCompleteness < 0.7) {
      weaknesses.push('Incomplete user data');
    }

    if (breakdown.populationMatch >= 0.8) {
      strengths.push('Strong population match');
    } else if (breakdown.populationMatch < 0.6) {
      weaknesses.push('Limited population-specific data');
    }

    if (breakdown.consistency >= 0.8) {
      strengths.push('Consistent evidence across sources');
    } else if (breakdown.consistency < 0.7) {
      weaknesses.push('Conflicting evidence in literature');
    }

    // Add assumptions
    if (!userProfile.bodyFat) {
      assumptions.push('Body fat percentage estimated from general population data');
    }
    const experience = String(
      userProfile.experienceLevel ||
      userProfile.workoutLevel ||
      userProfile.trainingAge ||
      ''
    ).toLowerCase();
    if (experience === 'beginner' || experience === 'novice' || experience === 'new') {
      assumptions.push('Novice training response assumed');
    }
    if (breakdown.populationMatch < 0.8) {
      assumptions.push('General population guidelines applied to specific case');
    }

    return { strengths, weaknesses, assumptions };
  }

  private generateConfidenceRecommendations(breakdown: any, factors: any): string[] {
    const recommendations: string[] = [];

    if (breakdown.evidenceQuality < 0.8) {
      recommendations.push('Consider conservative implementation due to limited evidence');
    }

    if (breakdown.dataCompleteness < 0.8) {
      recommendations.push('Collect additional measurements for better accuracy');
    }

    if (breakdown.populationMatch < 0.7) {
      recommendations.push('Monitor results closely as data may not be population-specific');
    }

    if (breakdown.consistency < 0.8) {
      recommendations.push('Consider multiple approaches due to conflicting evidence');
    }

    if (factors.assumptions.length > 0) {
      recommendations.push('Be aware of underlying assumptions in recommendations');
    }

    return recommendations;
  }

  private calculateEmpiricalRange(prediction: number, confidence: number, supportingFacts: any[]): {
    lower: number;
    upper: number;
  } {
    // Use confidence level to determine range
    const margin = (1 - confidence) * 0.2; // 20% margin for 0% confidence
    const range = prediction * margin;
    
    return {
      lower: Math.max(0, prediction - range),
      upper: prediction + range
    };
  }

  private calculateBayesianRange(prediction: number, confidence: number, supportingFacts: any[]): {
    lower: number;
    upper: number;
  } {
    // Simplified Bayesian approach
    const variance = (1 - confidence) * 0.1; // Higher variance for lower confidence
    const stdDev = Math.sqrt(variance) * prediction;
    
    return {
      lower: Math.max(0, prediction - 1.96 * stdDev), // 95% confidence interval
      upper: prediction + 1.96 * stdDev
    };
  }

  private calculateEnsembleRange(prediction: number, confidence: number, supportingFacts: any[]): {
    lower: number;
    upper: number;
  } {
    // Ensemble of different methods
    const empirical = this.calculateEmpiricalRange(prediction, confidence, supportingFacts);
    const bayesian = this.calculateBayesianRange(prediction, confidence, supportingFacts);
    
    return {
      lower: Math.min(empirical.lower, bayesian.lower),
      upper: Math.max(empirical.upper, bayesian.upper)
    };
  }
}

// Export singleton instance
export const confidenceScoring = new ConfidenceScoringSystem();
