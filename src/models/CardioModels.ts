// Cardio Session Models
// Defines the structure for detailed cardio session templates

/**
 * Cardio Template - Similar to Exercise and MealTemplate
 * Provides detailed cardio session specifications
 */
export interface CardioTemplate {
  templateId: string;
  name: string;
  type: CardioType;
  intensity: CardioIntensity;
  durationMinutes: number;
  targetHeartRate?: {
    min: number;
    max: number;
    zone: string; // "Zone 1", "Zone 2", "Zone 3", etc.
  };
  caloriesBurned?: number; // Estimated calories for user's weight
  equipment: string[]; // Equipment needed (treadmill, bike, none, etc.)
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  structure: CardioStructure;
  progressionOptions: string[];
  regressionOptions: string[];
  formCues: string[];
  contraindications: string[];
  recoveryTime: number; // Hours needed before next intense session
  phase: 'foundation' | 'progression' | 'peak';
  notes?: string;
}

/**
 * Cardio Type - Specific cardio modalities
 */
export type CardioType =
  | 'HIIT' // High-Intensity Interval Training
  | 'MISS' // Moderate-Intensity Steady State
  | 'LISS' // Low-Intensity Steady State
  | 'Zone 2' // Aerobic base building
  | 'Tempo Run' // Sustained moderate-high intensity
  | 'Fartlek' // Speed play - varied pace
  | 'Tabata' // 20s on, 10s off protocol
  | 'Circuit' // Cardio circuit training
  | 'Rowing' // Rowing machine
  | 'Cycling' // Stationary or outdoor cycling
  | 'Swimming' // Swimming laps
  | 'Stair Climbing' // Stair machine or stairs
  | 'Elliptical' // Elliptical machine
  | 'Walking' // Brisk walking
  | 'Rucking' // Weighted walking
  | 'Sled Push' // Sled pushing
  | 'Battle Ropes' // Battle rope intervals
  | 'Assault Bike' // Assault bike intervals
  | 'SkiErg' // Ski ergometer
  | 'Other';

/**
 * Cardio Intensity Levels
 */
export type CardioIntensity =
  | 'Very Low' // 50-60% HRmax, recovery
  | 'Low' // 60-70% HRmax, aerobic base
  | 'Moderate' // 70-80% HRmax, tempo
  | 'High' // 80-90% HRmax, threshold
  | 'Very High' // 90-100% HRmax, VO2 max
  | 'Variable'; // Mixed intensity (HIIT, Fartlek)

/**
 * Cardio Structure - Detailed session breakdown
 */
export interface CardioStructure {
  warmup?: {
    durationMinutes: number;
    description: string;
  };
  mainWorkout: {
    type: 'interval' | 'steady' | 'progressive' | 'circuit';
    intervals?: Array<{
      workDurationSeconds: number;
      restDurationSeconds: number;
      intensity: CardioIntensity;
      rounds: number;
      description: string;
    }>;
    steadyState?: {
      durationMinutes: number;
      intensity: CardioIntensity;
      description: string;
    };
    progressive?: Array<{
      durationMinutes: number;
      intensity: CardioIntensity;
      description: string;
    }>;
    circuit?: Array<{
      exercise: string;
      durationSeconds: number;
      restSeconds: number;
      rounds: number;
    }>;
  };
  cooldown?: {
    durationMinutes: number;
    description: string;
  };
  totalDurationMinutes: number;
}

/**
 * Weekly Cardio Schedule
 * Enhanced version of the basic cardioSchedule in WeeklyOutline
 */
export interface WeeklyCardioSchedule {
  weekNumber: number;
  phase: string;
  sessions: CardioSessionAssignment[];
  totalWeeklyVolume: {
    sessions: number;
    totalMinutes: number;
    totalCalories: number;
  };
  progressionNotes: string;
  recoveryStrategy: string;
}

/**
 * Cardio Session Assignment
 * Links a CardioTemplate to a specific day
 */
export interface CardioSessionAssignment {
  dayNumber: number;
  dayName: string;
  templateId: string;
  cardioTemplate: CardioTemplate;
  timing: 'morning' | 'afternoon' | 'evening' | 'post_workout';
  notes?: string;
}

/**
 * Cardio Protocol (for WeeklyOutline compatibility)
 * Simplified version for backward compatibility
 */
export interface CardioProtocol {
  sessions: number;
  duration: number;
  intensity: string;
  type: string;
  estimatedCalories?: number;
}

