// Cardio-Specific Knowledge Base
// Evidence-based facts about cardiovascular training, HIIT, LISS, and cardio protocols

import { ResearchFact } from '@/ai/knowledgeBase';

export interface CardioResearchFact extends ResearchFact {
  cardioType?: string[];
  intensity?: string;
  duration?: {
    min: number;
    max: number;
    units: string;
  };
  frequency?: {
    min: number;
    max: number;
    units: string;
  };
  population?: string;
}

/**
 * Cardio-specific research facts
 * Organized by cardio type, intensity, and goal
 */
export const CARDIO_KNOWLEDGE_BASE: CardioResearchFact[] = [
  // HIIT Research
  {
    id: 'hiit_fat_loss',
    content: 'HIIT (High-Intensity Interval Training) can burn 25-30% more calories than steady-state cardio in the same time period, with EPOC (excess post-exercise oxygen consumption) contributing to additional calorie burn for 24-48 hours post-exercise',
    category: 'training',
    confidence: 0.92,
    source: 'Boutcher, 2011 - High-Intensity Intermittent Exercise and Fat Loss',
    authors: ['Stephen H. Boutcher'],
    year: 2011,
    studyType: 'review',
    formulas: ['EPOC = 6-15% of total exercise energy expenditure'],
    dataPoints: [
      { description: 'HIIT calorie burn advantage', value: 25, units: '%', context: 'fat_loss' },
      { description: 'EPOC duration', value: 24, units: 'hours', context: 'post_exercise' }
    ],
    cardioType: ['HIIT', 'Tabata'],
    intensity: 'Very High',
    duration: { min: 10, max: 30, units: 'minutes' },
    frequency: { min: 2, max: 4, units: 'sessions/week' },
    population: 'Trained individuals'
  },
  {
    id: 'hiit_muscle_preservation',
    content: 'HIIT performed 2-3x per week preserves lean mass better than steady-state cardio during caloric deficit, especially when performed on separate days from resistance training',
    category: 'training',
    confidence: 0.89,
    source: 'Wilson et al., 2012 - Concurrent Training',
    authors: ['Jacob M. Wilson', 'Gabriel J. Marin', 'Matthew R. Rhea'],
    year: 2012,
    studyType: 'meta_analysis',
    formulas: ['HIIT frequency = 2-3 sessions/week for muscle preservation'],
    dataPoints: [
      { description: 'Optimal HIIT frequency for muscle preservation', value: 2.5, units: 'sessions/week', context: 'deficit' },
      { description: 'Minimum rest between HIIT and resistance', value: 6, units: 'hours', context: 'recovery' }
    ],
    cardioType: ['HIIT'],
    intensity: 'Very High',
    duration: { min: 15, max: 25, units: 'minutes' },
    frequency: { min: 2, max: 3, units: 'sessions/week' },
    population: 'Natural bodybuilders in deficit'
  },

  // Zone 2 / LISS Research
  {
    id: 'zone2_aerobic_base',
    content: 'Zone 2 training (60-70% HRmax) improves mitochondrial density, fat oxidation, and aerobic capacity. Optimal duration is 30-90 minutes, 3-5x per week for endurance athletes',
    category: 'training',
    confidence: 0.94,
    source: 'Seiler & Kjerland, 2006 - Quantifying training intensity distribution',
    authors: ['Stephen Seiler', 'Gunnar Kjerland'],
    year: 2006,
    studyType: 'rct',
    formulas: ['Zone 2 HR = 60-70% of HRmax'],
    dataPoints: [
      { description: 'Zone 2 HR range', value: 65, units: '% HRmax', context: 'aerobic_base' },
      { description: 'Optimal Zone 2 duration', value: 60, units: 'minutes', context: 'endurance' },
      { description: 'Optimal frequency', value: 4, units: 'sessions/week', context: 'endurance' }
    ],
    cardioType: ['Zone 2', 'LISS'],
    intensity: 'Low',
    duration: { min: 30, max: 90, units: 'minutes' },
    frequency: { min: 3, max: 5, units: 'sessions/week' },
    population: 'Endurance athletes'
  },
  {
    id: 'liss_recovery',
    content: 'Low-intensity steady-state (LISS) cardio on rest days or post-workout aids recovery by increasing blood flow without significant fatigue. 20-30 minutes at 50-60% HRmax is optimal',
    category: 'training',
    confidence: 0.87,
    source: 'Peake et al., 2017 - Recovery and adaptation',
    authors: ['Jonathan M. Peake', 'Kazunori Nosaka', 'Kazushige Goto'],
    year: 2017,
    studyType: 'review',
    formulas: ['LISS recovery HR = 50-60% HRmax'],
    dataPoints: [
      { description: 'Recovery LISS duration', value: 25, units: 'minutes', context: 'recovery' },
      { description: 'Recovery LISS HR', value: 55, units: '% HRmax', context: 'active_recovery' }
    ],
    cardioType: ['LISS', 'Walking'],
    intensity: 'Very Low',
    duration: { min: 20, max: 30, units: 'minutes' },
    frequency: { min: 1, max: 3, units: 'sessions/week' },
    population: 'All populations'
  },

  // Fat Loss Cardio Protocols
  {
    id: 'cardio_fat_loss_frequency',
    content: 'For fat loss, 3-5 cardio sessions per week totaling 150-300 minutes is optimal. Mix of HIIT (2-3x) and LISS (1-2x) prevents adaptation and maximizes calorie burn',
    category: 'training',
    confidence: 0.91,
    source: 'ACSM Position Stand on Physical Activity',
    authors: ['American College of Sports Medicine'],
    year: 2018,
    studyType: 'consensus',
    formulas: ['Weekly cardio volume = 150-300 minutes for fat loss'],
    dataPoints: [
      { description: 'Minimum weekly cardio for fat loss', value: 150, units: 'minutes/week', context: 'fat_loss' },
      { description: 'Optimal weekly cardio for fat loss', value: 225, units: 'minutes/week', context: 'fat_loss' },
      { description: 'HIIT sessions per week', value: 2.5, units: 'sessions/week', context: 'fat_loss' },
      { description: 'LISS sessions per week', value: 1.5, units: 'sessions/week', context: 'fat_loss' }
    ],
    cardioType: ['HIIT', 'LISS', 'MISS'],
    intensity: 'Variable',
    duration: { min: 20, max: 60, units: 'minutes' },
    frequency: { min: 3, max: 5, units: 'sessions/week' },
    population: 'Fat loss goals'
  },

  // Muscle Gain Cardio
  {
    id: 'cardio_muscle_gain',
    content: 'For muscle gain, limit cardio to 1-2 sessions per week of low-intensity (50-60% HRmax) for 20-30 minutes. Excessive cardio can interfere with muscle protein synthesis and recovery',
    category: 'training',
    confidence: 0.88,
    source: 'Wilson et al., 2012 - Concurrent Training',
    authors: ['Jacob M. Wilson', 'Gabriel J. Marin', 'Matthew R. Rhea'],
    year: 2012,
    studyType: 'meta_analysis',
    formulas: ['Muscle gain cardio = 1-2 sessions/week, 20-30 min, 50-60% HRmax'],
    dataPoints: [
      { description: 'Maximum cardio frequency for muscle gain', value: 1.5, units: 'sessions/week', context: 'muscle_gain' },
      { description: 'Optimal duration', value: 25, units: 'minutes', context: 'muscle_gain' },
      { description: 'Optimal HR', value: 55, units: '% HRmax', context: 'muscle_gain' }
    ],
    cardioType: ['LISS', 'Zone 2', 'Walking'],
    intensity: 'Very Low',
    duration: { min: 20, max: 30, units: 'minutes' },
    frequency: { min: 1, max: 2, units: 'sessions/week' },
    population: 'Muscle gain goals'
  },

  // Cardio Timing
  {
    id: 'cardio_timing_fasted',
    content: 'Fasted cardio (morning, before breakfast) may increase fat oxidation by 20-30% compared to fed state, but total fat loss difference is minimal over time. More important is total weekly volume',
    category: 'training',
    confidence: 0.75,
    source: 'Schoenfeld, 2011 - Does Cardio After an Overnight Fast Maximize Fat Loss?',
    authors: ['Brad Schoenfeld'],
    year: 2011,
    studyType: 'review',
    formulas: ['Fasted fat oxidation = +20-30% vs fed'],
    dataPoints: [
      { description: 'Fasted fat oxidation increase', value: 25, units: '%', context: 'fasted_cardio' }
    ],
    cardioType: ['LISS', 'Zone 2'],
    intensity: 'Low',
    duration: { min: 20, max: 45, units: 'minutes' },
    frequency: { min: 1, max: 3, units: 'sessions/week' },
    population: 'Fat loss goals'
  },
  {
    id: 'cardio_timing_post_workout',
    content: 'Post-resistance training cardio should be low-intensity (50-60% HRmax) to avoid interference with muscle protein synthesis. Wait 30-60 minutes after resistance training before cardio',
    category: 'training',
    confidence: 0.86,
    source: 'Wilson et al., 2012 - Concurrent Training',
    authors: ['Jacob M. Wilson'],
    year: 2012,
    studyType: 'meta_analysis',
    formulas: ['Post-workout cardio delay = 30-60 minutes'],
    dataPoints: [
      { description: 'Minimum delay after resistance', value: 30, units: 'minutes', context: 'post_workout' },
      { description: 'Optimal post-workout HR', value: 55, units: '% HRmax', context: 'recovery' }
    ],
    cardioType: ['LISS', 'Walking'],
    intensity: 'Very Low',
    duration: { min: 15, max: 30, units: 'minutes' },
    frequency: { min: 1, max: 2, units: 'sessions/week' },
    population: 'Concurrent training'
  },

  // Phase-Specific Cardio
  {
    id: 'cardio_foundation_phase',
    content: 'Foundation phase should introduce cardio gradually: 1-2 sessions/week of LISS (20-30 min) to build aerobic base without interfering with resistance training adaptation',
    category: 'training',
    confidence: 0.85,
    source: 'Periodization principles for natural bodybuilders',
    authors: ['Eric R. Helms'],
    year: 2014,
    studyType: 'consensus',
    formulas: ['Foundation cardio = 1-2 sessions/week, 20-30 min LISS'],
    dataPoints: [
      { description: 'Foundation frequency', value: 1.5, units: 'sessions/week', context: 'foundation' },
      { description: 'Foundation duration', value: 25, units: 'minutes', context: 'foundation' }
    ],
    cardioType: ['LISS', 'Zone 2'],
    intensity: 'Low',
    duration: { min: 20, max: 30, units: 'minutes' },
    frequency: { min: 1, max: 2, units: 'sessions/week' },
    population: 'Foundation phase'
  },
  {
    id: 'cardio_peak_phase',
    content: 'Peak phase can increase cardio to 4-5 sessions/week with mix of HIIT (2-3x) and LISS (1-2x) to maximize calorie deficit while preserving muscle mass',
    category: 'training',
    confidence: 0.88,
    source: 'Peos et al., 2021 - Contest preparation',
    authors: ['Matthew Peos', 'Eric R. Helms'],
    year: 2021,
    studyType: 'consensus',
    formulas: ['Peak cardio = 4-5 sessions/week, mixed HIIT/LISS'],
    dataPoints: [
      { description: 'Peak frequency', value: 4.5, units: 'sessions/week', context: 'peak' },
      { description: 'Peak HIIT sessions', value: 2.5, units: 'sessions/week', context: 'peak' },
      { description: 'Peak LISS sessions', value: 2, units: 'sessions/week', context: 'peak' }
    ],
    cardioType: ['HIIT', 'LISS', 'MISS'],
    intensity: 'Variable',
    duration: { min: 20, max: 45, units: 'minutes' },
    frequency: { min: 4, max: 5, units: 'sessions/week' },
    population: 'Peak phase fat loss'
  }
];

/**
 * Search cardio knowledge base by criteria
 */
export function searchCardioKnowledge(
  query: string,
  filters?: {
    goal?: 'fat_loss' | 'muscle_gain' | 'endurance' | 'general_fitness';
    phase?: 'foundation' | 'progression' | 'peak';
    cardioType?: string[];
    intensity?: string;
  }
): CardioResearchFact[] {
  let results = CARDIO_KNOWLEDGE_BASE;

  // Text search
  if (query) {
    const queryLower = query.toLowerCase();
    results = results.filter(fact =>
      fact.content.toLowerCase().includes(queryLower) ||
      fact.id.toLowerCase().includes(queryLower) ||
      fact.cardioType?.some(type => type.toLowerCase().includes(queryLower))
    );
  }

  // Apply filters
  if (filters) {
    if (filters.goal) {
      results = results.filter(fact =>
        fact.dataPoints.some(dp => 
          dp.context.includes(filters.goal!) ||
          fact.content.toLowerCase().includes(filters.goal!)
        )
      );
    }

    if (filters.phase) {
      results = results.filter(fact =>
        fact.dataPoints.some(dp => dp.context.includes(filters.phase!)) ||
        fact.content.toLowerCase().includes(filters.phase!)
      );
    }

    if (filters.cardioType && filters.cardioType.length > 0) {
      results = results.filter(fact =>
        fact.cardioType?.some(type => 
          filters.cardioType!.some(filterType => 
            type.toLowerCase().includes(filterType.toLowerCase())
          )
        )
      );
    }

    if (filters.intensity) {
      results = results.filter(fact => fact.intensity === filters.intensity);
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get cardio recommendations based on goal and phase
 */
export function getCardioRecommendations(
  goal: 'fat_loss' | 'muscle_gain' | 'endurance' | 'general_fitness',
  phase: 'foundation' | 'progression' | 'peak',
  _userLevel: 'beginner' | 'intermediate' | 'expert' // Reserved for future level-specific adjustments
): {
  frequency: { min: number; max: number };
  duration: { min: number; max: number };
  intensity: string[];
  types: string[];
  facts: CardioResearchFact[];
} {
  const facts = searchCardioKnowledge('', { goal, phase });

  // Extract recommendations from facts
  const frequencyRanges = facts
    .map(f => f.frequency)
    .filter((f): f is { min: number; max: number; units: string } => f !== undefined);
  
  const durationRanges = facts
    .map(f => f.duration)
    .filter((d): d is { min: number; max: number; units: string } => d !== undefined);

  const allTypes = facts.flatMap(f => f.cardioType || []);
  const uniqueTypes = Array.from(new Set(allTypes));

  const allIntensities = facts
    .map(f => f.intensity)
    .filter((i): i is string => i !== undefined);
  const uniqueIntensities = Array.from(new Set(allIntensities));

  return {
    frequency: {
      min: Math.min(...frequencyRanges.map(f => f.min)),
      max: Math.max(...frequencyRanges.map(f => f.max))
    },
    duration: {
      min: Math.min(...durationRanges.map(d => d.min)),
      max: Math.max(...durationRanges.map(d => d.max))
    },
    intensity: uniqueIntensities,
    types: uniqueTypes,
    facts
  };
}

