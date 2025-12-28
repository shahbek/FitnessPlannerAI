// Plan Generation Models
// Defines the structure for all plan components

export interface FeasibilityAssessment {
  isFeasible: boolean;
  confidenceScore: number;
  reasoning: string;
  risks?: string[];
  recommendations?: string[];
  alternativeTimeline?: number;
  optimisticOutlook?: string;
  evidenceLimits?: {
    maxFatLossPerWeek: number;
    minWeeksRequired: number;
    calculatedMetrics: {
      bmr: number;
      tdee: number;
      fatLossRate: number;
    };
  };
}

export interface MetabolicMetrics {
  bmr: {
    value: number;
    formula: string;
    source: string;
  };
  tdee: {
    value: number;
    formula: string;
    source: string;
  };
  bmi?: {
    value: number;
    formula: string;
    source: string;
  };
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  fatLoss: {
    value: number;
    formula: string;
    source: string;
  };
  trainingVolume: {
    value: number;
    formula: string;
    source: string;
  };
  water: {
    value: number;
    formula: string;
    source: string;
  };
}

export interface TrainingFramework {
  trainingApproach: {
    split: string;
    frequencyPerWeek: number;
    sessionDurationMinutes: number;
    periodization: string;
    volumePerMuscleWeekly: Record<string, number>;
  };
  nutritionApproach: {
    caloricStrategy: {
      deficitMagnitude: string;
      dailyDeficitCalories: number;
      weeklyDeficitCalories: number;
    };
    macroTargets: {
      proteinTotalGrams: number;
      proteinPerKg: number;
      carbPercentage: number;
      fatPercentage: number;
    };
    mealFrequency: number;
    timing: {
      preWorkout: string;
      postWorkout: string;
      bedtime: string;
    };
  };
}

export interface Exercise {
  exerciseId: string;
  name: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: string;
  formCues: string[];
  progressionOptions: string[];
  regressionOptions: string[];
  contraindications: string[];
}

export interface SessionTemplate {
  templateId: string;
  name: string;
  targetMuscles: string[];
  totalDurationMinutes: number;
  structure: Array<{
    exerciseId: string;
    name?: string;
    targetMuscles?: string[];
    sets: number;
    reps: string;
    restSeconds: number;
    notes?: string;
  }>;
}

export interface MealTemplate {
  templateId: string;
  name: string;
  mealType: string;
  totalCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  baseRecipe: {
    name: string;
    ingredients: Array<{
      name: string;
      amount: string;
      calories: number;
    }>;
    instructions: string[];
  };
}

export interface WeeklyOutline {
  weekNumber: number;
  phase: string;
  dailyTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    proteinPerKg: number;
  };
  dailyTargetsOverride?: Array<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    proteinPerKg: number;
    carbPercentage?: number;
    fatPercentage?: number;
    reasoning?: string;
  }>;
  trainingSchedule: {
    resistanceDays: string[];
    cardioDays: string[];
    restDays: string[];
    weeklyVolume: string;
    focusAreas: string[];
  };
  // Optional - will be populated by CardioGenerationService
  cardioSchedule?: {
    sessions: number;
    duration: number;
    intensity: string;
    type: string;
  };
  objectives: string[];
  expectedOutcomes: string[];
  adjustments: string;
  specialNotes: string;
}

export interface ShoppingList {
  categories: Array<{
    category: string;
    items: Array<{
      name: string;
      quantity: string;
      estimatedCost?: number;
      priority: string;
    }>;
  }>;
  totalEstimatedCost: number;
  notes: string[];
}

export interface ValidationResults {
  isValid: boolean;
  violations: string[];
  fixes: string[];
  dietaryCompliance: {
    isCompliant: boolean;
    violations: string[];
  };
  macroConsistency: {
    isValid: boolean;
    deviations: string[];
  };
  trainingLogic: {
    isValid: boolean;
    issues: string[];
  };
  progressiveOverload: {
    isValid: boolean;
    issues: string[];
  };
  recovery: {
    isValid: boolean;
    issues: string[];
  };
}

export interface CompletePlan {
  feasibility: FeasibilityAssessment;
  weeklyOutlines: WeeklyOutline[];
  phaseAwareFramework: TrainingFramework;
  phaseExerciseLibraries: Exercise[][];
  phaseSessionTemplates: SessionTemplate[][];
  phaseMealTemplates: MealTemplate[][];
  dailyMealCombinations?: any[]; // Optional: for parser compatibility (converted from phaseMealTemplates)
  phaseCardioTemplates?: any[][]; // Cardio templates by phase (Foundation, Progression, Peak)
  weeklyCardioSchedules?: any[]; // Weekly cardio schedules with day assignments
  shoppingList: ShoppingList;
  metrics: MetabolicMetrics;
  evidenceCitations: string[];
  generatedAt: string;
  confidenceScore: number;
  validationResults: ValidationResults;
}
