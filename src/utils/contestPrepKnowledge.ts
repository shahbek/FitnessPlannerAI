// Contest Prep Knowledge Base
// Based on current bodybuilding and contest prep methodologies

export interface ContestPrepPhase {
  name: string;
  weeks: number;
  bodyFatTarget: number;
  waterIntake: number; // ml per kg bodyweight
  sodiumIntake: number; // mg per day
  carbCycling: boolean;
  refeedFrequency: number; // days between refeeds
  cardioMinutes: number;
  trainingVolume: number; // % of base volume
  description: string;
  keyStrategies: string[];
}

export interface MealSuggestion {
  name: string;
  phase: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: string[];
  timing: string;
  prepTime: number; // minutes
  description: string;
}

export interface WaterManipulation {
  week: number;
  waterIntake: number; // ml per kg
  sodiumIntake: number; // mg per day
  potassiumIntake: number; // mg per day
  strategy: string;
  rationale: string;
}

// Contest Prep Phases (20-week timeline)
export const CONTEST_PREP_PHASES: ContestPrepPhase[] = [
  {
    name: "Base Building",
    weeks: 4,
    bodyFatTarget: 20,
    waterIntake: 50, // 50ml per kg
    sodiumIntake: 3000,
    carbCycling: false,
    refeedFrequency: 7,
    cardioMinutes: 120,
    trainingVolume: 100,
    description: "Establish base metabolic rate and training consistency",
    keyStrategies: [
      "High protein intake (2.2g/kg)",
      "Consistent training schedule",
      "Adequate sleep (8+ hours)",
      "Stress management"
    ]
  },
  {
    name: "Moderate Cut",
    weeks: 6,
    bodyFatTarget: 15,
    waterIntake: 45,
    sodiumIntake: 2500,
    carbCycling: true,
    refeedFrequency: 5,
    cardioMinutes: 180,
    trainingVolume: 90,
    description: "Steady fat loss with carb cycling",
    keyStrategies: [
      "Carb cycling (high/low days)",
      "Increased cardio volume",
      "Protein timing optimization",
      "Regular refeed days"
    ]
  },
  {
    name: "Aggressive Cut",
    weeks: 6,
    bodyFatTarget: 10,
    waterIntake: 40,
    sodiumIntake: 2000,
    carbCycling: true,
    refeedFrequency: 3,
    cardioMinutes: 240,
    trainingVolume: 80,
    description: "Intense fat loss phase",
    keyStrategies: [
      "Strict carb cycling",
      "High cardio volume",
      "Metabolic flexibility training",
      "Frequent refeeds"
    ]
  },
  {
    name: "Peak Week",
    weeks: 2,
    bodyFatTarget: 8,
    waterIntake: 60, // Increased for peak
    sodiumIntake: 1000, // Reduced
    carbCycling: false,
    refeedFrequency: 0,
    cardioMinutes: 300,
    trainingVolume: 60,
    description: "Final preparation and water manipulation",
    keyStrategies: [
      "Water loading and depletion",
      "Sodium manipulation",
      "Carb loading",
      "Peak week protocols"
    ]
  },
  {
    name: "Show Day",
    weeks: 1,
    bodyFatTarget: 7,
    waterIntake: 30, // Minimal
    sodiumIntake: 500, // Very low
    carbCycling: false,
    refeedFrequency: 0,
    cardioMinutes: 0,
    trainingVolume: 0,
    description: "Final day preparation",
    keyStrategies: [
      "Minimal water intake",
      "Very low sodium",
      "High carb loading",
      "Pump-up protocols"
    ]
  }
];

// Meal suggestions based on user preferences
export function generateMealSuggestions(
  userPreferences: string[],
  phase: ContestPrepPhase,
  calories: number,
  protein: number,
  carbs: number,
  fat: number
): MealSuggestion[] {
  const suggestions: MealSuggestion[] = [];
  
  // Breakfast options
  if (userPreferences.some(p => p.toLowerCase().includes('egg'))) {
    suggestions.push({
      name: "Contest Prep Breakfast",
      phase: phase.name,
      calories: Math.round(calories * 0.25),
      protein: Math.round(protein * 0.25),
      carbs: Math.round(carbs * 0.25),
      fat: Math.round(fat * 0.25),
      foods: ["Egg whites", "Whole eggs", "Oatmeal", "Berries"],
      timing: "7:00 AM",
      prepTime: 10,
      description: "High protein breakfast with complex carbs"
    });
  }
  
  // Lunch options
  if (userPreferences.some(p => p.toLowerCase().includes('beef'))) {
    suggestions.push({
      name: "Beef & Greens Power Lunch",
      phase: phase.name,
      calories: Math.round(calories * 0.3),
      protein: Math.round(protein * 0.3),
      carbs: Math.round(carbs * 0.3),
      fat: Math.round(fat * 0.3),
      foods: ["Lean beef", "Broccoli", "Spinach", "Sweet potato"],
      timing: "12:00 PM",
      prepTime: 15,
      description: "Iron-rich meal with leafy greens and complex carbs"
    });
  }
  
  // Dinner options
  if (userPreferences.some(p => p.toLowerCase().includes('cottage cheese'))) {
    suggestions.push({
      name: "Evening Protein Bowl",
      phase: phase.name,
      calories: Math.round(calories * 0.25),
      protein: Math.round(protein * 0.25),
      carbs: Math.round(carbs * 0.25),
      fat: Math.round(fat * 0.25),
      foods: ["Cottage cheese", "Chicken breast", "Broccoli", "Rice"],
      timing: "7:00 PM",
      prepTime: 12,
      description: "Slow-digesting protein for overnight recovery"
    });
  }
  
  // Snack options
  suggestions.push({
    name: "Pre-Workout Fuel",
    phase: phase.name,
    calories: Math.round(calories * 0.1),
    protein: Math.round(protein * 0.1),
    carbs: Math.round(carbs * 0.1),
    fat: Math.round(fat * 0.1),
    foods: ["Banana", "Greek yogurt", "Almonds"],
    timing: "Pre-workout",
    prepTime: 5,
    description: "Quick energy boost before training"
  });
  
  return suggestions;
}

// Water manipulation schedule for peak week
export function generateWaterManipulation(weeks: number): WaterManipulation[] {
  const schedule: WaterManipulation[] = [];
  
  for (let week = 1; week <= weeks; week++) {
    if (week <= weeks - 2) {
      // Normal water intake
      schedule.push({
        week,
        waterIntake: 50,
        sodiumIntake: 3000,
        potassiumIntake: 3500,
        strategy: "Normal hydration",
        rationale: "Maintain normal fluid balance and performance"
      });
    } else if (week === weeks - 1) {
      // Water loading phase
      schedule.push({
        week,
        waterIntake: 80,
        sodiumIntake: 2000,
        potassiumIntake: 4000,
        strategy: "Water loading",
        rationale: "Increase water intake to stimulate diuresis, reduce sodium"
      });
    } else {
      // Peak week - water depletion
      schedule.push({
        week,
        waterIntake: 30,
        sodiumIntake: 500,
        potassiumIntake: 2000,
        strategy: "Water depletion",
        rationale: "Minimal water and sodium for maximum definition"
      });
    }
  }
  
  return schedule;
}

// Sodium cycling for contest prep
export function generateSodiumCycling(weeks: number): { week: number; sodium: number; strategy: string }[] {
  const schedule: { week: number; sodium: number; strategy: string }[] = [];
  
  for (let week = 1; week <= weeks; week++) {
    if (week <= weeks - 3) {
      schedule.push({
        week,
        sodium: 3000,
        strategy: "Normal sodium intake"
      });
    } else if (week === weeks - 2) {
      schedule.push({
        week,
        sodium: 2000,
        strategy: "Moderate sodium reduction"
      });
    } else if (week === weeks - 1) {
      schedule.push({
        week,
        sodium: 1000,
        strategy: "Low sodium phase"
      });
    } else {
      schedule.push({
        week,
        sodium: 500,
        strategy: "Minimal sodium for peak"
      });
    }
  }
  
  return schedule;
}

// Carb cycling protocols
export function generateCarbCycling(phase: ContestPrepPhase): { day: string; carbs: number; strategy: string }[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const cycling: { day: string; carbs: number; strategy: string }[] = [];
  
  if (!phase.carbCycling) {
    // No cycling - consistent carbs
    const dailyCarbs = 200; // Base amount
    days.forEach(day => {
      cycling.push({
        day,
        carbs: dailyCarbs,
        strategy: "Consistent carb intake"
      });
    });
  } else {
    // Carb cycling based on phase
    const highCarbDays = phase.name === "Aggressive Cut" ? 2 : 3;
    
    days.forEach((day, index) => {
      if (index < highCarbDays) {
        cycling.push({
          day,
          carbs: 300,
          strategy: "High carb day - refuel glycogen"
        });
      } else {
        cycling.push({
          day,
          carbs: 100,
          strategy: "Low carb day - fat burning"
        });
      }
    });
  }
  
  return cycling;
}

// Peak week protocols
export function generatePeakWeekProtocol(): {
  day: number;
  water: number;
  sodium: number;
  carbs: number;
  strategy: string;
}[] {
  return [
    {
      day: -7,
      water: 80,
      sodium: 2000,
      carbs: 200,
      strategy: "Water loading begins, reduce sodium"
    },
    {
      day: -6,
      water: 80,
      sodium: 1500,
      carbs: 200,
      strategy: "Continue water loading"
    },
    {
      day: -5,
      water: 80,
      sodium: 1000,
      carbs: 200,
      strategy: "Peak water loading"
    },
    {
      day: -4,
      water: 60,
      sodium: 800,
      carbs: 200,
      strategy: "Begin water reduction"
    },
    {
      day: -3,
      water: 40,
      sodium: 600,
      carbs: 200,
      strategy: "Moderate water reduction"
    },
    {
      day: -2,
      water: 30,
      sodium: 500,
      carbs: 300,
      strategy: "Low water, increase carbs"
    },
    {
      day: -1,
      water: 20,
      sodium: 300,
      carbs: 400,
      strategy: "Minimal water, carb load"
    },
    {
      day: 0,
      water: 15,
      sodium: 200,
      carbs: 500,
      strategy: "Show day - minimal water, max carbs"
    }
  ];
}

// Supplement recommendations for contest prep
export function getContestPrepSupplements(phase: string): {
  essential: string[];
  optional: string[];
  timing: string;
} {
  const supplements: Record<string, { essential: string[]; optional: string[]; timing: string }> = {
    "Base Building": {
      essential: ["Whey Protein", "Creatine", "Multivitamin", "Omega-3"],
      optional: ["Beta-Alanine", "Citrulline Malate"],
      timing: "Protein post-workout, creatine daily, others as directed"
    },
    "Moderate Cut": {
      essential: ["Whey Protein", "Creatine", "Multivitamin", "Omega-3", "L-Carnitine"],
      optional: ["Green Tea Extract", "CLA", "Yohimbine"],
      timing: "L-Carnitine pre-cardio, others as before"
    },
    "Aggressive Cut": {
      essential: ["Whey Protein", "Creatine", "Multivitamin", "Omega-3", "L-Carnitine", "Electrolytes"],
      optional: ["Green Tea Extract", "Yohimbine", "Caffeine", "L-Tyrosine"],
      timing: "Stimulants pre-cardio, electrolytes throughout day"
    },
    "Peak Week": {
      essential: ["Electrolytes", "Potassium", "Magnesium", "Taurine"],
      optional: ["Dandelion Root", "Uva Ursi", "Caffeine"],
      timing: "Electrolytes throughout day, diuretics as needed"
    }
  };
  
  return supplements[phase] || supplements["Base Building"];
}

// Training adjustments for contest prep
export function getTrainingAdjustments(phase: string, _week: number): {
  volume: number;
  intensity: number;
  frequency: number;
  focus: string;
  notes: string[];
} {
  const adjustments: Record<string, any> = {
    "Base Building": {
      volume: 100,
      intensity: 85,
      frequency: 5,
      focus: "Hypertrophy and strength",
      notes: ["Full range of motion", "Progressive overload", "Adequate rest"]
    },
    "Moderate Cut": {
      volume: 90,
      intensity: 80,
      frequency: 5,
      focus: "Muscle preservation",
      notes: ["Maintain strength", "Reduce volume slightly", "Focus on form"]
    },
    "Aggressive Cut": {
      volume: 80,
      intensity: 75,
      frequency: 4,
      focus: "Muscle maintenance",
      notes: ["Compound movements", "Shorter rest periods", "Mind-muscle connection"]
    },
    "Peak Week": {
      volume: 60,
      intensity: 70,
      frequency: 3,
      focus: "Pump and definition",
      notes: ["High reps", "Short rest", "Pump-focused training"]
    }
  };
  
  return adjustments[phase] || adjustments["Base Building"];
}
