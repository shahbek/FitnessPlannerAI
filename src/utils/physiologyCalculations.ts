import { FormState, ProgressionPhase, WeeklyCheckpoint, MetabolicAdaptation } from '@/types';

// BMR Calculation using Katch-McArdle equation (more accurate with body fat %)
export function calculateBMR(weight: number, bodyFat: number, _sex: string): number {
  const leanBodyMass = weight * (1 - bodyFat / 100);
  
  // Katch-McArdle: BMR = 370 + (21.6 * LBM in kg)
  return 370 + (21.6 * leanBodyMass);
}

// BMR Calculation using Mifflin-St Jeor (when body fat % not available)
export function calculateBMRMifflin(weight: number, height: number, age: number, sex: string): number {
  if (sex.toLowerCase() === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

// TDEE Calculation
export function calculateTDEE(bmr: number, activityFactor: number): number {
  return bmr * activityFactor;
}

// Metabolic Adaptation Model
export function calculateMetabolicAdaptation(
  week: number,
  _totalWeeks: number,
  _initialTDEE: number,
  _currentDeficit: number
): MetabolicAdaptation {
  // Metabolic adaptation typically reduces TDEE by 10-15% over 8-12 weeks
  const adaptationRate = 0.12; // 12% reduction over 12 weeks
  const maxAdaptation = Math.min(week / 12, 1) * adaptationRate;
  
  // Leptin decreases with prolonged caloric restriction
  const leptinReduction = Math.min(week * 0.05, 0.4); // Up to 40% reduction
  
  // Cortisol increases with stress and caloric restriction
  const cortisolIncrease = Math.min(week * 0.03, 0.25); // Up to 25% increase
  
  // Sleep quality decreases with prolonged restriction
  const sleepQuality = Math.max(10 - (week * 0.2), 6);
  
  // Hunger increases with leptin reduction
  const hungerLevel = Math.min(5 + (week * 0.3), 8);
  
  // Energy decreases with adaptation
  const energyLevel = Math.max(10 - (week * 0.15), 6);
  
  return {
    week,
    tdeeReduction: maxAdaptation * 100,
    leptinLevel: 1 - leptinReduction,
    cortisolLevel: 1 + cortisolIncrease,
    sleepQuality,
    hungerLevel,
    energyLevel,
  };
}

// Calculate realistic timeline for body fat reduction
export function calculateTimeline(
  currentBF: number,
  targetBF: number,
  _weight: number,
  approach: 'aggressive' | 'moderate' | 'conservative'
): { totalWeeks: number; phases: ProgressionPhase[] } {
  // Use the actual target body fat percentage from user input
  const finalTargetBF = targetBF;
  const bfToLose = currentBF - finalTargetBF;
  
  // Industry-standard bodybuilding rates: 0.5-1.5% body weight per week
  const weeklyRates = {
    aggressive: 1.2, // 1.2% BW/week (contest prep standard)
    moderate: 0.8,   // 0.8% BW/week (moderate cut)
    conservative: 0.5 // 0.5% BW/week (lean bulk prep)
  };
  
  const weeklyRate = weeklyRates[approach];
  const baseWeeks = Math.ceil(bfToLose / weeklyRate);
  
  // Add diet breaks every 6-8 weeks for aggressive cuts
  const dietBreakFrequency = approach === 'aggressive' ? 6 : 8;
  const dietBreaks = Math.floor(baseWeeks / dietBreakFrequency);
  const dietBreakWeeks = dietBreaks * 1; // 1 week per break (contest prep standard)
  
  const totalWeeks = baseWeeks + dietBreakWeeks;
  
  // Generate phases with industry-standard contest prep protocols
  const phases: ProgressionPhase[] = [];
  let currentWeek = 0;
  
  // Phase 1: Aggressive Cut (Weeks 1-8)
  if (currentWeek < totalWeeks) {
    const phase1End = Math.min(7, totalWeeks - 1);
    phases.push({
      id: 'aggressive_cut_1',
      name: 'Aggressive Cut Phase 1',
      type: 'aggressive_cut',
      startWeek: currentWeek,
      endWeek: phase1End,
      targetDeficit: 30, // 30% deficit for aggressive fat loss
      proteinMultiplier: 2.5, // High protein to preserve muscle
      volumeAdjustment: 0.9, // Maintain training volume
      description: 'High-intensity cutting phase with aggressive caloric deficit',
      rationale: 'Maximum fat loss while preserving lean mass during initial weeks'
    });
    currentWeek = phase1End + 1;
  }
  
  // Diet Break (Week 9)
  if (currentWeek < totalWeeks) {
    phases.push({
      id: 'diet_break_1',
      name: 'Metabolic Reset',
      type: 'diet_break',
      startWeek: currentWeek,
      endWeek: currentWeek,
      targetDeficit: 0, // Maintenance calories
      proteinMultiplier: 2.0,
      volumeAdjustment: 1.0,
      description: 'One-week metabolic reset to restore leptin and metabolic rate',
      rationale: 'Prevents metabolic adaptation and psychological fatigue'
    });
    currentWeek += 1;
  }
  
  // Phase 2: Moderate Cut (Weeks 10-16)
  if (currentWeek < totalWeeks) {
    const phase2End = Math.min(currentWeek + 6, totalWeeks - 1);
    phases.push({
      id: 'moderate_cut_1',
      name: 'Moderate Cut Phase 2',
      type: 'moderate_cut',
      startWeek: currentWeek,
      endWeek: phase2End,
      targetDeficit: 25, // 25% deficit
      proteinMultiplier: 2.3,
      volumeAdjustment: 0.85,
      description: 'Sustained cutting phase with moderate caloric deficit',
      rationale: 'Continued fat loss with improved adherence and recovery'
    });
    currentWeek = phase2End + 1;
  }
  
  // Phase 3: Contest Prep (Weeks 17-20)
  if (currentWeek < totalWeeks) {
    const phase3End = Math.min(currentWeek + 3, totalWeeks - 1);
    phases.push({
      id: 'contest_prep',
      name: 'Contest Prep Phase',
      type: 'contest_prep',
      startWeek: currentWeek,
      endWeek: phase3End,
      targetDeficit: 35, // 35% deficit for final push
      proteinMultiplier: 2.8, // Very high protein
      volumeAdjustment: 0.7, // Reduced volume for recovery
      description: 'Final contest preparation with extreme caloric deficit',
      rationale: 'Peak conditioning for competition with maximum fat loss'
    });
    currentWeek = phase3End + 1;
  }
  
  // Phase 4: Peak Week (Final week)
  if (currentWeek < totalWeeks) {
    phases.push({
      id: 'peak_week',
      name: 'Peak Week',
      type: 'peak_week',
      startWeek: currentWeek,
      endWeek: totalWeeks - 1,
      targetDeficit: 40, // 40% deficit for peak conditioning
      proteinMultiplier: 3.0, // Maximum protein
      volumeAdjustment: 0.5, // Minimal training
      description: 'Peak week protocol with extreme deficit and water manipulation',
      rationale: 'Final push to achieve competition-ready conditioning'
    });
  }
  
  return { totalWeeks, phases };
}

// Calculate weekly checkpoints
export function calculateWeeklyCheckpoints(
  phases: ProgressionPhase[],
  initialWeight: number,
  initialBF: number,
  initialTDEE: number,
  _form: FormState
): WeeklyCheckpoint[] {
  const checkpoints: WeeklyCheckpoint[] = [];
  let currentWeight = initialWeight;
  let currentBF = initialBF;
  let currentTDEE = initialTDEE;
  
  // Safe bounds checking
  const maxWeeks = phases.length > 0 ? Math.max(...phases.map(p => p.endWeek)) + 1 : 0;
  
  for (let week = 0; week < maxWeeks; week++) {
    const currentPhase = phases.find(p => week >= p.startWeek && week <= p.endWeek);
    if (!currentPhase) continue;
    
    // Calculate weight loss for this week based on phase type
    let weeklyDeficit: number;
    if (currentPhase.type === 'diet_break') {
      weeklyDeficit = 0; // No deficit during diet breaks
    } else {
      weeklyDeficit = (currentTDEE * currentPhase.targetDeficit / 100) * 7;
    }
    
    const weightLoss = weeklyDeficit / 7700; // 7700 kcal per kg of fat
    currentWeight = Math.max(currentWeight - weightLoss, 50); // Minimum weight safety
    
    // Calculate body fat percentage - ensure it actually decreases
    const leanMass = currentWeight * (1 - currentBF / 100);
    const newBF = ((currentWeight - leanMass) / currentWeight) * 100;
    
    // Industry-standard body fat reduction rates
    let targetBFReduction: number;
    if (currentPhase.type === 'aggressive_cut') {
      targetBFReduction = 0.8; // 0.8% per week
    } else if (currentPhase.type === 'moderate_cut') {
      targetBFReduction = 0.6; // 0.6% per week
    } else if (currentPhase.type === 'contest_prep') {
      targetBFReduction = 1.0; // 1.0% per week
    } else if (currentPhase.type === 'peak_week') {
      targetBFReduction = 1.2; // 1.2% per week
    } else {
      targetBFReduction = 0.3; // 0.3% per week for maintenance
    }
    
    // Ensure body fat actually decreases during cutting phases
    if (currentPhase.type.includes('cut') || currentPhase.type === 'contest_prep' || currentPhase.type === 'peak_week') {
      const finalTargetBF = phases[phases.length - 1].endWeek === week ? 12 : Math.max(currentBF - targetBFReduction, 12);
      currentBF = Math.max(currentBF - targetBFReduction, finalTargetBF);
      // Recalculate weight to match the body fat target
      currentWeight = leanMass / (1 - currentBF / 100);
    } else {
      currentBF = Math.max(newBF, 5); // Minimum 5% body fat safety
    }
    
    // Apply metabolic adaptation
    const adaptation = calculateMetabolicAdaptation(week, phases.length, initialTDEE, currentPhase.targetDeficit);
    currentTDEE = Math.max(initialTDEE * (1 - adaptation.tdeeReduction / 100), 1000); // Minimum TDEE safety
    
    // Calculate macros with industry-standard protocols
    const dailyCalories = Math.max(currentTDEE * (1 - currentPhase.targetDeficit / 100), 1200);
    const proteinGrams = Math.max(currentWeight * currentPhase.proteinMultiplier, 80);
    
    // Industry-standard fat intake (0.3-0.5g per lb bodyweight)
    const fatGrams = Math.max(currentWeight * 0.7, 40); // Minimum 40g fat
    
    // Calculate carbs from remaining calories
    const carbGrams = Math.max((dailyCalories - (proteinGrams * 4) - (fatGrams * 9)) / 4, 0);
    
    // Calculate training volume
    const baseVolume = 20; // Base sets per week
    const trainingVolume = Math.max(baseVolume * currentPhase.volumeAdjustment, 5);
    
    // Industry-standard cardio based on phase
    let cardioMinutes: number;
    if (currentPhase.type === 'aggressive_cut') {
      cardioMinutes = 200; // 200 min/week
    } else if (currentPhase.type === 'moderate_cut') {
      cardioMinutes = 150; // 150 min/week
    } else if (currentPhase.type === 'contest_prep') {
      cardioMinutes = 300; // 300 min/week
    } else if (currentPhase.type === 'peak_week') {
      cardioMinutes = 400; // 400 min/week
    } else {
      cardioMinutes = 60; // 60 min/week for maintenance
    }
    
    checkpoints.push({
      week: week + 1,
      phase: currentPhase.name,
      predictedWeight: Math.round(currentWeight * 10) / 10,
      predictedBodyFat: Math.round(currentBF * 10) / 10,
      predictedLeanMass: Math.round(leanMass * 10) / 10,
      dailyCalories: Math.round(dailyCalories),
      proteinGrams: Math.round(proteinGrams),
      fatGrams: Math.round(fatGrams),
      carbGrams: Math.round(carbGrams),
      trainingVolume: Math.round(trainingVolume),
      cardioMinutes,
      notes: generateWeeklyNotes(currentPhase, adaptation, week),
      adaptations: generateAdaptationNotes(adaptation)
    });
  }
  
  return checkpoints;
}

// Generate weekly notes based on phase and adaptation
function generateWeeklyNotes(
  phase: ProgressionPhase,
  adaptation: MetabolicAdaptation,
  week: number
): string {
  const notes: string[] = [];
  
  if (adaptation.hungerLevel > 7) {
    notes.push('High hunger levels - consider refeed day');
  }
  
  if (adaptation.energyLevel < 7) {
    notes.push('Low energy - reduce training volume if needed');
  }
  
  if (adaptation.sleepQuality < 7) {
    notes.push('Poor sleep quality - prioritize recovery');
  }
  
  if (phase.type === 'diet_break') {
    notes.push('Diet break week - focus on maintenance calories');
  }
  
  if (week % 4 === 0 && phase.type.includes('cut')) {
    notes.push('Consider deload week to manage fatigue');
  }
  
  return notes.join('; ');
}

// Generate adaptation notes
function generateAdaptationNotes(adaptation: MetabolicAdaptation): string[] {
  const notes: string[] = [];
  
  if (adaptation.tdeeReduction > 10) {
    notes.push(`Metabolic adaptation: ${adaptation.tdeeReduction.toFixed(1)}% TDEE reduction`);
  }
  
  if (adaptation.leptinLevel < 0.7) {
    notes.push('Leptin suppression detected - consider refeed');
  }
  
  if (adaptation.cortisolLevel > 1.2) {
    notes.push('Elevated cortisol - manage stress and recovery');
  }
  
  return notes;
}

// Calculate refeed day calories
export function calculateRefeedCalories(tdee: number, _currentCalories: number): number {
  // Refeed at 110% of TDEE with 60%+ carbs
  return Math.round(tdee * 1.1);
}

// Calculate deload week adjustments
export function calculateDeloadAdjustments(
  baseVolume: number,
  baseIntensity: number
): { volume: number; intensity: number } {
  return {
    volume: baseVolume * 0.5, // 50% volume
    intensity: baseIntensity * 0.8 // 80% intensity
  };
}

// Validate realistic goals
export function validateGoalRealism(
  currentBF: number,
  targetBF: number,
  _weight: number,
  trainingAge: string
): { isRealistic: boolean; warnings: string[]; recommendations: string[] } {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  const bfToLose = currentBF - targetBF;
  const isNewbie = trainingAge === 'new';
  
  // Check if goal is too aggressive
  if (bfToLose > 20) {
    warnings.push('Very aggressive goal - may require 6+ months');
    recommendations.push('Consider intermediate target (15-18% BF) first');
  }
  
  // Check if target is too low for experience level
  if (targetBF < 8 && isNewbie) {
    warnings.push('Very low body fat for training experience');
    recommendations.push('Aim for 10-12% BF initially');
  }
  
  // Check if timeline is realistic
  const minWeeks = bfToLose / 0.4; // Conservative rate
  
  if (minWeeks > 52) {
    warnings.push('Goal may take over a year');
    recommendations.push('Consider staged approach with intermediate goals');
  }
  
  return {
    isRealistic: warnings.length === 0,
    warnings,
    recommendations
  };
}
