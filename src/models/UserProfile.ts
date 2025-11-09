// User Profile Model
// Defines the structure for user input data

export interface UserProfile {
  // Basic Information
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  bodyFat?: number;
  targetBf?: number;
  
  // Goals and Preferences
  goal: 'fat_loss' | 'muscle_gain' | 'maintenance' | 'strength' | 'endurance';
  timelineWeeks: number;
  preferences: string; // Dietary preferences and restrictions
  mealFrequency?: number; // Meals per day
  
  // Training Information
  workoutLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  workoutSplit: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'body_part' | 'custom';
  trainingDaysPerWeek: number;
  equipment: 'gym_membership' | 'home_gym' | 'bodyweight' | 'minimal_equipment';
  schedule?: string; // User's available training times (e.g., "Monday-Friday: 6-7 AM")
  
  // API Configuration
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

export interface NormalizedUserProfile extends UserProfile {
  // Normalized values
  lbm: number; // Lean body mass
  bmi: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  
  // Parsed preferences
  dietaryConstraints: {
    include: string[];
    exclude: string[];
    macroAdjustments: {
      carbs: string;
      protein: string;
      fat: string;
    };
    notes: string;
  };
}
