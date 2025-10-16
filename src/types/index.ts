// Form state types
export interface FormState {
  apiKey: string;
  endpoint: string;
  model: string;
  age: number | string;
  sex: 'male' | 'female' | 'other' | string;
  heightCm: number | string;
  weightKg: number | string;
  bodyFat: number | string;
  activity: number | string;
  trainingAge: 'new' | 'intermediate' | 'advanced' | string;
  goal: string;
  targetBf?: number | string;
  schedule: string;
  preferences: string;
  avoid: string;
  repetitionOk: boolean;
  equipment: string;
}

// API response types
export interface Feasibility {
  status: 'ok' | 'adjusted' | 'refused';
  reason?: string;
  proposed_timeline_weeks?: number;
}

export interface Calories {
  daily_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
}

export interface ExerciseBlock {
  name: string;
  sets: number;
  reps_or_time: string;
  rir_or_rpe?: string;
}

export interface DayPlan {
  day: string;
  session_minutes: number;
  focus: string;
  blocks: ExerciseBlock[];
}

export interface MealItem {
  food: string;
  grams: number;
}

export interface Meal {
  name: string;
  items: MealItem[];
  kcal: number;
}

export interface Adjustments {
  missed_workout: string;
  diet_deviation: string;
  low_sleep: string;
}

export interface FitnessPlan {
  feasibility: Feasibility;
  calories: Calories;
  week_plan: DayPlan[];
  meals: Meal[];
  adjustments: Adjustments;
  rationale: string;
  references: string[];
}

// Component prop types
export interface TabsProps {
  tabs: string[];
  current: string;
  onChange: (tab: string) => void;
}

export interface KbdProps {
  children: React.ReactNode;
}

export interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

// API types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
}

export interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Progressive Plan Types
export interface ProgressionPhase {
  id: string;
  name: string;
  type: 'aggressive_cut' | 'moderate_cut' | 'mini_cut' | 'diet_break' | 'maintenance' | 'deload' | 'contest_prep' | 'peak_week';
  startWeek: number;
  endWeek: number;
  targetDeficit: number; // percentage below TDEE
  proteinMultiplier: number; // g/kg bodyweight
  volumeAdjustment: number; // percentage of base volume
  description: string;
  rationale: string;
}

export interface WeeklyCheckpoint {
  week: number;
  phase: string;
  predictedWeight: number;
  predictedBodyFat: number;
  predictedLeanMass: number;
  dailyCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbGrams: number;
  trainingVolume: number; // total sets per week
  cardioMinutes: number;
  notes: string;
  adaptations: string[];
}

export interface MetabolicAdaptation {
  week: number;
  tdeeReduction: number; // percentage reduction from baseline
  leptinLevel: number; // relative to baseline
  cortisolLevel: number; // relative to baseline
  sleepQuality: number; // 1-10 scale
  hungerLevel: number; // 1-10 scale
  energyLevel: number; // 1-10 scale
}

export interface ProgressivePlan {
  id: string;
  userId: string;
  createdAt: string;
  currentState: {
    weight: number;
    bodyFat: number;
    leanMass: number;
    tdee: number;
  };
  goalState: {
    targetBodyFat: number;
    targetWeight: number;
    targetLeanMass: number;
  };
  timeline: {
    totalWeeks: number;
    phases: ProgressionPhase[];
    checkpoints: WeeklyCheckpoint[];
    adaptations: MetabolicAdaptation[];
  };
  strategy: {
    approach: 'aggressive' | 'moderate' | 'conservative';
    dietBreakFrequency: number; // weeks between diet breaks
    refeedFrequency: number; // days between refeeds
    deloadFrequency: number; // weeks between deloads
  };
  rationale: string;
  references: string[];
}

// Multi-Agent System Types
export interface AgentContext {
  userId: string;
  currentPhase: ProgressionPhase;
  previousResults: WeeklyCheckpoint[];
  userFeedback: string[];
  metabolicState: MetabolicAdaptation;
}

export interface AgentResponse {
  agent: 'physiological_analyst' | 'training_programmer' | 'nutrition_strategist';
  reasoning: string;
  recommendations: any;
  confidence: number; // 0-1
  citations: string[];
  nextSteps: string[];
}

export interface MultiAgentPlan {
  physiologicalAnalysis: AgentResponse;
  trainingProgram: AgentResponse;
  nutritionStrategy: AgentResponse;
  synthesis: {
    overallApproach: string;
    keyInsights: string[];
    riskFactors: string[];
    successMetrics: string[];
  };
}

// Streaming Types
export interface StreamingProgress {
  phase: 'analysis' | 'planning' | 'synthesis' | 'complete';
  progress: number; // 0-100
  currentStep: string;
  reasoning: string[];
  partialResults: any;
}

// Export types
export interface ExportOptions {
  format: 'pdf' | 'json';
  filename?: string;
}
