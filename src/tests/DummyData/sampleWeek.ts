import { MealWithUSDA } from '../../services/BatchMealGenerator';
import { MacroValues } from '../../types/nutrition';
import { calculateMacrosForAmount, normalizeFoodName } from '../../utils/usdaMapper';
import { WeeklyOutline } from '../../models/PlanModels';
import { TrainingSplit } from '../../services/TrainingSplitService';

// Daily macro target we expect to hit after adjustments
export const dummyDailyTarget: MacroValues = {
  calories: 2400,
  protein: 200,
  carbs: 220,
  fats: 80,
};

// Per-meal macro targets that sum to the daily target above
export const dummyMealTargets: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', MacroValues> = {
  breakfast: {
    calories: 600,
    protein: 45,
    carbs: 55,
    fats: 18,
  },
  lunch: {
    calories: 650,
    protein: 55,
    carbs: 60,
    fats: 20,
  },
  dinner: {
    calories: 650,
    protein: 55,
    carbs: 60,
    fats: 20,
  },
  snack: {
    calories: 500,
    protein: 45,
    carbs: 45,
    fats: 22,
  },
};

// Simplified USDA-style nutrition data (values per 100g) for our dummy ingredients
export const dummyUsdaData: Record<
  string,
  {
    nutrition: MacroValues;
    fdcId: number;
  }
> = (() => {
  const entries: Array<[string, MacroValues]> = [
    ['protein powder', { calories: 400, protein: 80, carbs: 10, fats: 5 }],
    ['rolled oats', { calories: 360, protein: 12, carbs: 60, fats: 6 }],
    ['peanut butter', { calories: 600, protein: 25, carbs: 20, fats: 50 }],
    ['berries', { calories: 60, protein: 1, carbs: 14, fats: 0 }],
    ['chicken breast', { calories: 220, protein: 46, carbs: 0, fats: 5 }],
    ['brown rice', { calories: 180, protein: 4, carbs: 40, fats: 2 }],
    ['almonds', { calories: 600, protein: 21, carbs: 22, fats: 50 }],
    ['broccoli', { calories: 40, protein: 3, carbs: 7, fats: 0 }],
    ['greek yogurt', { calories: 100, protein: 18, carbs: 6, fats: 2 }],
  ];

  const map: Record<string, { nutrition: MacroValues; fdcId: number }> = {};

  entries.forEach(([name, nutrition], index) => {
    map[name] = { nutrition, fdcId: index + 1 };
  });

  return map;
})();

const dayNames = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

type IngredientDef = {
  name: string;
  amount: number; // grams at scale = 1
};

const baseMealBlueprint: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', IngredientDef[]> = {
  breakfast: [
    { name: 'Protein Powder', amount: 55 },
    { name: 'Rolled Oats', amount: 85 },
    { name: 'Peanut Butter', amount: 22 },
    { name: 'Berries', amount: 80 },
  ],
  lunch: [
    { name: 'Chicken Breast', amount: 180 },
    { name: 'Brown Rice', amount: 190 },
    { name: 'Almonds', amount: 22 },
    { name: 'Broccoli', amount: 120 },
  ],
  dinner: [
    { name: 'Chicken Breast', amount: 160 },
    { name: 'Brown Rice', amount: 180 },
    { name: 'Peanut Butter', amount: 18 },
    { name: 'Broccoli', amount: 120 },
  ],
  snack: [
    { name: 'Greek Yogurt', amount: 260 },
    { name: 'Protein Powder', amount: 35 },
    { name: 'Berries', amount: 100 },
    { name: 'Almonds', amount: 18 },
  ],
};

const defaultInstructions = [
  'Combine ingredients according to plan.',
  'Cook or assemble as appropriate.',
  'Season to taste and serve.',
];

function buildMeal(
  dayNumber: number,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  scale: number
): MealWithUSDA {
  const blueprint = baseMealBlueprint[mealType];

  const ingredients = blueprint.map((ingredient) => {
    const scaledAmount = ingredient.amount * scale;
    const normalized = normalizeFoodName(ingredient.name);
    const foodEntry = dummyUsdaData[normalized];

    if (!foodEntry) {
      throw new Error(`Missing dummy USDA data for ingredient "${ingredient.name}"`);
    }

    const nutrition = calculateMacrosForAmount(
      foodEntry.nutrition,
      scaledAmount,
      'g'
    );

    return {
      name: ingredient.name,
      amount: Number(scaledAmount.toFixed(2)),
      nutrition,
      fdcId: foodEntry.fdcId,
    };
  });

  const totalMacros = ingredients.reduce(
    (sum, ing) => ({
      calories: sum.calories + ing.nutrition.calories,
      protein: sum.protein + ing.nutrition.protein,
      carbs: sum.carbs + ing.nutrition.carbs,
      fats: sum.fats + ing.nutrition.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
  );

  return {
    mealName: `${mealType[0].toUpperCase()}${mealType.slice(1)} Builder ${dayNumber}`,
    mealType,
    instructions: [...defaultInstructions],
    ingredients,
    totalMacros,
    dayNumber,
    dayName: dayNames[dayNumber - 1],
  };
}

const baseDayReferenceTotals = (() => {
  const referenceMeals = (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType, index) =>
    buildMeal(index + 1, mealType, 1)
  );

  return referenceMeals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.totalMacros.calories,
      protein: sum.protein + meal.totalMacros.protein,
      carbs: sum.carbs + meal.totalMacros.carbs,
      fats: sum.fats + meal.totalMacros.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 } as MacroValues
  );
})();

const normalizationScale = dummyDailyTarget.calories / baseDayReferenceTotals.calories;

export function createDummyMealsForDay(
  dayNumber: number,
  ratio: number
): MealWithUSDA[] {
  const effectiveScale = ratio * normalizationScale;

  return (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) =>
    buildMeal(dayNumber, mealType, effectiveScale)
  );
}

const defaultOffTargetPattern = [0.62, 1.38, 0.62, 1.38, 0.62, 1.38, 0.62];

export function createDummyWeekMeals(offTargetPattern: number[] = defaultOffTargetPattern): MealWithUSDA[] {
  if (offTargetPattern.length !== 7) {
    throw new Error('offTargetPattern must contain exactly 7 values');
  }

  const meals: MealWithUSDA[] = [];

  offTargetPattern.forEach((scale, index) => {
    meals.push(...createDummyMealsForDay(index + 1, scale));
  });

  return meals;
}

// Basic weekly outline / training split placeholders for tests
export const dummyWeeklyOutline: WeeklyOutline = {
  weekNumber: 1,
  phase: 'dummy',
  dailyTargets: {
    calories: dummyDailyTarget.calories,
    protein: dummyDailyTarget.protein,
    carbs: dummyDailyTarget.carbs,
    fat: dummyDailyTarget.fats,
    proteinPerKg: 2,
  },
  trainingSchedule: {
    resistanceDays: dayNames,
    cardioDays: [],
    restDays: [],
    weeklyVolume: 'Dummy volume',
    focusAreas: ['Dummy focus'],
  },
  cardioSchedule: {
    sessions: 0,
    duration: 0,
    intensity: 'Low',
    type: 'None',
  },
  objectives: ['Dummy objective'],
  expectedOutcomes: ['Dummy outcome'],
  adjustments: 'None',
  specialNotes: 'Dummy data for offline tests',
};

export const dummyTrainingSplit: TrainingSplit = {
  splitName: 'Dummy Split',
  daysPerWeek: 7,
  days: dayNames.map((dayName, index) => ({
    dayNumber: index + 1,
    dayName,
    focus: ['Full body'],
    isRestDay: false,
    isCardioDay: false,
  })),
  reasoning: 'Dummy split for offline testing',
};

