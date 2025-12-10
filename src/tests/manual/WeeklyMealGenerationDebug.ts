import 'dotenv/config';

import { USDANutritionService } from '../../services/USDANutritionService';
import { ChainOfThoughtService } from '../../services/ChainOfThoughtService';
import { BatchMealGenerator, MealWithUSDA } from '../../services/BatchMealGenerator';
import { TrainingSplitService, TrainingSplit } from '../../services/TrainingSplitService';
import { UserProfile } from '../../models/UserProfile';
import { WeeklyOutline } from '../../models/PlanModels';
import { MacroValues } from '../../types/nutrition';
import { normalizeFoodName } from '../../utils/usdaMapper';

type IngredientSummary = {
  name: string;
  occurrences: number;
  totalAmount: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

const formatDiff = (actual: number, target: number): string => {
  if (target === 0) {
    return `${actual.toFixed(1)} (target 0)`;
  }
  const pct = ((actual / target) * 100) - 100;
  const sign = pct >= 0 ? '+' : '';
  return `${actual.toFixed(1)} vs ${target.toFixed(1)} (${sign}${pct.toFixed(1)}%)`;
};

const calculateDayTargets = (base: WeeklyOutline['dailyTargets'], isRestDay: boolean): MacroValues => {
  if (isRestDay) {
    return {
      calories: Math.round(base.calories * 0.97),
      protein: base.protein,
      carbs: Math.round(base.carbs * 0.9),
      fats: Math.round(base.fat * 1.1),
    };
  }

  return {
    calories: Math.round(base.calories * 1.03),
    protein: base.protein,
    carbs: Math.round(base.carbs * 1.1),
    fats: Math.round(base.fat * 0.9),
  };
};

const summarizeIngredient = (
  summary: Map<string, IngredientSummary>,
  ingredient: MealWithUSDA['ingredients'][number]
) => {
  const key = normalizeFoodName(ingredient.name);
  if (!summary.has(key)) {
    summary.set(key, {
      name: ingredient.name,
      occurrences: 0,
      totalAmount: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    });
  }

  const entry = summary.get(key)!;
  entry.occurrences += 1;
  entry.totalAmount += ingredient.amount;
  entry.calories += ingredient.nutrition.calories;
  entry.protein += ingredient.nutrition.protein;
  entry.carbs += ingredient.nutrition.carbs;
  entry.fats += ingredient.nutrition.fats;
};

async function main() {
  const usdaKey = process.env.VITE_USDA_API_KEY || process.env.USDA_API_KEY;
  if (!usdaKey) {
    console.error('❌ VITE_USDA_API_KEY (or USDA_API_KEY) is required for this debug run.');
    process.exit(1);
  }

  const groqKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error('❌ VITE_GROQ_API_KEY (or GROQ_API_KEY) is required because the batch generator uses AI to draft meals.');
    process.exit(1);
  }

  const usdaService = new USDANutritionService(usdaKey);
  const cotService = new ChainOfThoughtService();

  if (!cotService.isAIAvailable || !cotService.isAIAvailable()) {
    console.error('❌ Chain-of-Thought service is not available. Ensure your Groq key is valid.');
    process.exit(1);
  }

  const batchGenerator = new BatchMealGenerator(usdaService, cotService);
  const trainingSplitService = new TrainingSplitService(cotService);

  const userProfile: UserProfile = {
    age: 32,
    sex: 'male',
    weightKg: 86,
    heightCm: 182,
    goal: 'muscle_gain',
    timelineWeeks: 12,
    preferences: 'No shellfish. Enjoys Mediterranean flavours.',
    mealFrequency: 4,
    workoutLevel: 'intermediate',
    workoutSplit: 'upper_lower',
    trainingDaysPerWeek: 4,
    equipment: 'gym_membership',
  };

  const weeklyOutline: WeeklyOutline = {
    weekNumber: 1,
    phase: 'foundation',
    dailyTargets: {
      calories: 2855,
      protein: 176,
      carbs: 394,
      fat: 64,
      proteinPerKg: 2.0,
    },
    trainingSchedule: {
      resistanceDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      cardioDays: [],
      restDays: ['Wednesday', 'Saturday', 'Sunday'],
      weeklyVolume: 'Moderate volume with progressive overload focus',
      focusAreas: ['Strength', 'Hypertrophy'],
    },
    cardioSchedule: {
      sessions: 0,
      duration: 0,
      intensity: 'Low',
      type: 'None',
    },
    objectives: ['Build lean muscle mass', 'Improve compound lift performance'],
    expectedOutcomes: ['Noticeable strength gains', 'Incremental muscle growth'],
    adjustments: 'None',
    specialNotes: 'Debug run for weekly meal generation accuracy.',
  };

  const trainingSplit: TrainingSplit = await trainingSplitService.determineSplit(userProfile);

  console.log('🚀 Running weekly meal generation debug run...');
  console.log('   User Profile:', JSON.stringify(userProfile, null, 2));
  console.log('   Weekly Outline:', JSON.stringify(weeklyOutline, null, 2));
  console.log('   Training Split:', JSON.stringify(trainingSplit, null, 2));

  const mealsByDay = await batchGenerator.generateWeeklyMeals(
    userProfile,
    weeklyOutline,
    trainingSplit,
    {
      onProgress: (step, progress) => {
        console.log(`   🔄 [PROGRESS] ${progress.toFixed(0)}% - ${step}`);
      },
    }
  );

  console.log('\n================= SUMMARY: DAILY MACROS VS TARGETS =================');
  const ingredientSummary = new Map<string, IngredientSummary>();

  let weeklyTargetTotals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  let weeklyActualTotals = { calories: 0, protein: 0, carbs: 0, fats: 0 };

  mealsByDay.forEach((meals, dayIndex) => {
    const dayInfo = trainingSplit.days[dayIndex];
    const dayTargets = calculateDayTargets(weeklyOutline.dailyTargets, dayInfo?.isRestDay || false);

    const dayActuals = meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + meal.totalMacros.calories,
        protein: totals.protein + meal.totalMacros.protein,
        carbs: totals.carbs + meal.totalMacros.carbs,
        fats: totals.fats + meal.totalMacros.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    weeklyTargetTotals.calories += dayTargets.calories;
    weeklyTargetTotals.protein += dayTargets.protein;
    weeklyTargetTotals.carbs += dayTargets.carbs;
    weeklyTargetTotals.fats += dayTargets.fats;

    weeklyActualTotals.calories += dayActuals.calories;
    weeklyActualTotals.protein += dayActuals.protein;
    weeklyActualTotals.carbs += dayActuals.carbs;
    weeklyActualTotals.fats += dayActuals.fats;

    console.log(
      `\nDay ${dayIndex + 1} - ${dayInfo?.dayName || 'Unknown'} (${dayInfo?.isRestDay ? 'Rest' : 'Training'})`
    );
    console.log(
      `   Calories: ${formatDiff(dayActuals.calories, dayTargets.calories)}`
    );
    console.log(
      `   Protein : ${formatDiff(dayActuals.protein, dayTargets.protein)}`
    );
    console.log(
      `   Carbs   : ${formatDiff(dayActuals.carbs, dayTargets.carbs)}`
    );
    console.log(
      `   Fats    : ${formatDiff(dayActuals.fats, dayTargets.fats)}`
    );

    meals.forEach((meal) => {
      const mealTargets: MacroValues = (batchGenerator as any).calculateMealMacroTargets.call(
        batchGenerator,
        meal.mealType,
        userProfile.mealFrequency || 4,
        dayTargets
      );

      console.log(`      • ${meal.mealName} (${meal.mealType})`);
      console.log(
        `         Calories: ${formatDiff(meal.totalMacros.calories, mealTargets.calories)}`
      );
      console.log(
        `         Protein : ${formatDiff(meal.totalMacros.protein, mealTargets.protein)}`
      );
      console.log(
        `         Carbs   : ${formatDiff(meal.totalMacros.carbs, mealTargets.carbs)}`
      );
      console.log(
        `         Fats    : ${formatDiff(meal.totalMacros.fats, mealTargets.fats)}`
      );

      meal.ingredients.forEach((ingredient) => summarizeIngredient(ingredientSummary, ingredient));
    });
  });

  const weeklyAccuracy = {
    calories: ((weeklyActualTotals.calories / weeklyTargetTotals.calories) * 100 - 100),
    protein: ((weeklyActualTotals.protein / weeklyTargetTotals.protein) * 100 - 100),
    carbs: ((weeklyActualTotals.carbs / weeklyTargetTotals.carbs) * 100 - 100),
    fats: ((weeklyActualTotals.fats / weeklyTargetTotals.fats) * 100 - 100),
  };

  console.log('\n================= WEEKLY SUMMARY =================');
  console.log(
    `Calories: ${weeklyActualTotals.calories.toFixed(1)} vs ${weeklyTargetTotals.calories.toFixed(1)} (${weeklyAccuracy.calories >= 0 ? '+' : ''}${weeklyAccuracy.calories.toFixed(1)}%)`
  );
  console.log(
    `Protein : ${weeklyActualTotals.protein.toFixed(1)} vs ${weeklyTargetTotals.protein.toFixed(1)} (${weeklyAccuracy.protein >= 0 ? '+' : ''}${weeklyAccuracy.protein.toFixed(1)}%)`
  );
  console.log(
    `Carbs   : ${weeklyActualTotals.carbs.toFixed(1)} vs ${weeklyTargetTotals.carbs.toFixed(1)} (${weeklyAccuracy.carbs >= 0 ? '+' : ''}${weeklyAccuracy.carbs.toFixed(1)}%)`
  );
  console.log(
    `Fats    : ${weeklyActualTotals.fats.toFixed(1)} vs ${weeklyTargetTotals.fats.toFixed(1)} (${weeklyAccuracy.fats >= 0 ? '+' : ''}${weeklyAccuracy.fats.toFixed(1)}%)`
  );

  console.log('\n================= INGREDIENT SUMMARY (POST-USDA) =================');
  Array.from(ingredientSummary.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((entry) => {
      const zeroMacros =
        entry.calories === 0 && entry.protein === 0 && entry.carbs === 0 && entry.fats === 0;

      console.log(
        `   ${entry.name} — used ${entry.occurrences}×, total ${entry.totalAmount.toFixed(1)}g`
      );
      console.log(
        `      Macros (total): ${entry.calories.toFixed(1)} kcal | ${entry.protein.toFixed(1)}g protein | ${entry.carbs.toFixed(1)}g carbs | ${entry.fats.toFixed(1)}g fats${zeroMacros ? '  ⚠️ ZERO MACROS' : ''}`
      );
    });

  console.log('\n✅ Debug run complete. Capture this output for deeper analysis or share with the team.');
}

main().catch((error) => {
  console.error('❌ Weekly meal generation debug run failed.');
  console.error(error);
  process.exit(1);
});






