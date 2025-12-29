import type { WeeklyOutline } from '@/models/PlanModels';

export type DailyMacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinPerKg?: number;
};

function toDailyMacroTargets(source: any): DailyMacroTargets {
  return {
    calories: Number(source?.calories ?? 0),
    protein: Number(source?.protein ?? 0),
    carbs: Number(source?.carbs ?? 0),
    fat: Number(source?.fat ?? source?.fats ?? 0),
    proteinPerKg:
      source?.proteinPerKg !== undefined ? Number(source.proteinPerKg) : undefined,
  };
}

export function getDayTargets(
  weeklyOutline: WeeklyOutline | undefined,
  dayIndex: number
): DailyMacroTargets {
  if (!weeklyOutline) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const override = (weeklyOutline as any)?.dailyTargetsOverride?.[dayIndex];
  if (override) return toDailyMacroTargets(override);

  return toDailyMacroTargets((weeklyOutline as any)?.dailyTargets);
}

export function getAverageDailyTargets(
  weeklyOutline: WeeklyOutline | undefined
): DailyMacroTargets {
  if (!weeklyOutline) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const overrides: any[] | undefined = (weeklyOutline as any)?.dailyTargetsOverride;
  if (Array.isArray(overrides) && overrides.length > 0) {
    const totals = overrides.reduce(
      (sum, day) => {
        const m = toDailyMacroTargets(day);
        return {
          calories: sum.calories + m.calories,
          protein: sum.protein + m.protein,
          carbs: sum.carbs + m.carbs,
          fat: sum.fat + m.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const divisor = overrides.length || 1;
    return {
      calories: totals.calories / divisor,
      protein: totals.protein / divisor,
      carbs: totals.carbs / divisor,
      fat: totals.fat / divisor,
    };
  }

  return toDailyMacroTargets((weeklyOutline as any)?.dailyTargets);
}

