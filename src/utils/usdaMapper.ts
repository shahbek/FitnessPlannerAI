/**
 * USDA Mapper Utilities
 * Maps USDA FoodData Central API responses to internal nutrition format
 */

import { USDANutrient, MacroValues } from '../types/nutrition';

/**
 * USDA Nutrient IDs (standard nutrient IDs from FoodData Central)
 */
const NUTRIENT_IDS = {
  CALORIES: 1008, // Energy (kcal)
  PROTEIN: 1003, // Protein
  CARBS: 1005, // Carbohydrate, by difference
  FIBER: 1079, // Fiber, total dietary
  SUGAR: 2000, // Sugars, total including NLEA
  FAT: 1004, // Total lipid (fat)
  SATURATED_FAT: 1258, // Fatty acids, total saturated
  MONOUNSATURATED_FAT: 1292, // Fatty acids, total monounsaturated
  POLYUNSATURATED_FAT: 1293, // Fatty acids, total polyunsaturated
  SODIUM: 1093, // Sodium, Na
  CHOLESTEROL: 1253, // Cholesterol
} as const;

/**
 * Alternative nutrient IDs for energy (some foods use different energy nutrient IDs)
 */
const ALT_CALORIE_NUTRIENT_IDS = [
  1062, // Energy (kJ) - will need conversion
  2047, // Energy (Atwater General Factors)
  2048, // Energy (Atwater Specific Factors)
] as const;

export interface MacroValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate macro values to ensure they are non-zero and within reasonable ranges
 */
export function validateMacroValues(macros: MacroValues): MacroValidationResult {
  const errors: string[] = [];
  const { calories, protein, carbs, fats } = macros;

  const checks: Array<{
    key: keyof MacroValues;
    value: number | undefined;
    min: number;
    max: number;
  }> = [
      { key: 'calories', value: calories, min: 0, max: 9000 },
      { key: 'protein', value: protein, min: 0, max: 500 },
      { key: 'carbs', value: carbs, min: 0, max: 1000 },
      { key: 'fats', value: fats, min: 0, max: 500 },
    ];

  for (const check of checks) {
    const { key, value, min, max } = check;
    if (value === undefined || Number.isNaN(value)) {
      errors.push(`${String(key)} is missing or NaN`);
      continue;
    }

    if (!Number.isFinite(value)) {
      errors.push(`${String(key)} must be a finite number`);
      continue;
    }

    if (value < min) {
      errors.push(`${String(key)} is below minimum (${value} < ${min})`);
    }

    if (value > max) {
      errors.push(`${String(key)} exceeds maximum (${value} > ${max})`);
    }
  }

  // Check for all primary macros being zero
  if (
    calories === 0 &&
    protein === 0 &&
    carbs === 0 &&
    fats === 0
  ) {
    errors.push('All primary macro values are zero');
  }

  const calculatedCalories =
    protein * 4 + carbs * 4 + fats * 9;

  if (Number.isFinite(calories) && Number.isFinite(calculatedCalories)) {
    const baseline = calculatedCalories || calories;
    if (baseline > 0) {
      const diff = Math.abs(calories - calculatedCalories);
      if (diff > baseline * 0.5) {
        errors.push(
          `Calorie mismatch exceeds 50% (reported ${calories} vs calculated ${calculatedCalories})`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Extract macro values from USDA nutrient array
 * Handles both "value" and "amount" fields (USDA API may use either)
 */
export function extractMacrosFromUSDA(
  nutrients: USDANutrient[],
  options?: { foodName?: string; fdcId?: number; debug?: boolean }
): MacroValues {
  const debug = options?.debug ?? false;
  const foodName = options?.foodName ?? 'Unknown food';
  const fdcId = options?.fdcId ?? 0;

  if (debug) {
    console.log(`\n🔬 [USDA EXTRACT] Processing: "${foodName}" (FDC ID: ${fdcId})`);
    console.log(`   Total nutrients available: ${nutrients.length}`);
  }

  const getNutrientValue = (nutrientId: number): { value: number; nutrient?: USDANutrient } => {
    const nutrient = nutrients.find(n => n.nutrientId === nutrientId);
    if (!nutrient) {
      return { value: 0 };
    }

    const value =
      (nutrient as any).value ?? (nutrient as any).amount ?? 0;

    if (debug) {
      console.log(`   Nutrient ID ${nutrientId} (${nutrient.nutrientName}): ${value} ${nutrient.unitName || ''}`);
    }

    return { value, nutrient };
  };

  const findNutrient = (nutrientId: number, nutrientLabel: string): number => {
    const { value, nutrient } = getNutrientValue(nutrientId);

    if (value === 0 && nutrientId !== NUTRIENT_IDS.FIBER) {
      const label = nutrient?.nutrientName || `ID ${nutrientId}`;
      console.warn(
        `⚠️ [USDA] Zero value for ${nutrientLabel} (${label}) in "${foodName}" (${fdcId}) - data may be incomplete`
      );
    }

    // CRITICAL: Check for impossible values
    if (value > 1000 && nutrientId === NUTRIENT_IDS.CARBS) {
      console.error(
        `🚨 [USDA] IMPOSSIBLE CARBS VALUE: ${value}g/100g for "${foodName}" (${fdcId})! This is corrupted data.`
      );
      console.error(`   Nutrient details:`, nutrient);
    }

    if (value > 500 && (nutrientId === NUTRIENT_IDS.PROTEIN || nutrientId === NUTRIENT_IDS.FAT)) {
      console.error(
        `🚨 [USDA] IMPOSSIBLE ${nutrientLabel} VALUE: ${value}g/100g for "${foodName}" (${fdcId})!`
      );
      console.error(`   Nutrient details:`, nutrient);
    }

    return value;
  };

  const macros: MacroValues = {
    calories: findNutrient(NUTRIENT_IDS.CALORIES, 'Calories'),
    protein: findNutrient(NUTRIENT_IDS.PROTEIN, 'Protein'),
    carbs: findNutrient(NUTRIENT_IDS.CARBS, 'Carbs'),
    fats: findNutrient(NUTRIENT_IDS.FAT, 'Fat'),
    fiber: findNutrient(NUTRIENT_IDS.FIBER, 'Fiber') || undefined,
    sugar: findNutrient(NUTRIENT_IDS.SUGAR, 'Sugar') || undefined,
    sodium: findNutrient(NUTRIENT_IDS.SODIUM, 'Sodium') || undefined,
  };

  if (!macros.calories || macros.calories === 0) {
    for (const altId of ALT_CALORIE_NUTRIENT_IDS) {
      const alt = getNutrientValue(altId);
      if (alt.value > 0) {
        macros.calories = Math.round(alt.value);
        console.warn(
          `⚠️ Missing primary calorie nutrient (ID ${NUTRIENT_IDS.CALORIES}); using alternative energy value from nutrient ${altId} (${alt.value} kcal)`
        );
        break;
      }
    }
  }

  const calculatedCalories =
    macros.protein * 4 + macros.carbs * 4 + macros.fats * 9;

  if (calculatedCalories > 0) {
    if (!macros.calories || macros.calories === 0) {
      macros.calories = Math.round(calculatedCalories);
      console.warn(
        `⚠️ Calories missing from USDA data; using calculated calories (${macros.calories} kcal)`
      );
    } else {
      const diff = Math.abs(macros.calories - calculatedCalories);
      if (diff > calculatedCalories * 0.5) {
        macros.calories = Math.round(calculatedCalories);
        console.warn(
          `⚠️ Reported calories differ significantly from calculated calories (${calculatedCalories} kcal); using calculated value`
        );
      }
    }
  }

  const validation = validateMacroValues(macros);
  if (!validation.isValid) {
    throw new Error(
      `Invalid nutrition data extracted: ${validation.errors.join(', ')}`
    );
  }

  return macros;
}

/**
 * Normalize food name for consistent searching and caching
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common prefixes/suffixes
 */
export function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    ;
}

/**
 * Calculate macros for a specific amount of food
 */
export function calculateMacrosForAmount(
  macrosPer100g: MacroValues,
  amount: number,
  unit: 'g' | 'kg' | 'oz' | 'lb' = 'g'
): MacroValues {
  // Convert to grams
  let amountInGrams = amount;
  switch (unit) {
    case 'kg':
      amountInGrams = amount * 1000;
      break;
    case 'oz':
      amountInGrams = amount * 28.3495;
      break;
    case 'lb':
      amountInGrams = amount * 453.592;
      break;
    default:
      amountInGrams = amount;
  }

  // Calculate proportion
  const proportion = amountInGrams / 100;

  return {
    calories: Math.round(macrosPer100g.calories * proportion),
    protein: Math.round(macrosPer100g.protein * proportion * 10) / 10,
    carbs: Math.round(macrosPer100g.carbs * proportion * 10) / 10,
    fats: Math.round(macrosPer100g.fats * proportion * 10) / 10,
    fiber: macrosPer100g.fiber
      ? Math.round(macrosPer100g.fiber * proportion * 10) / 10
      : undefined,
    sugar: macrosPer100g.sugar
      ? Math.round(macrosPer100g.sugar * proportion * 10) / 10
      : undefined,
    sodium: macrosPer100g.sodium
      ? Math.round(macrosPer100g.sodium * proportion)
      : undefined,
  };
}

/**
 * Sum multiple macro values
 */
export function sumMacros(macros: MacroValues[]): MacroValues {
  return macros.reduce(
    (total, macro) => ({
      calories: total.calories + macro.calories,
      protein: total.protein + macro.protein,
      carbs: total.carbs + macro.carbs,
      fats: total.fats + macro.fats,
      fiber: (total.fiber || 0) + (macro.fiber || 0),
      sugar: (total.sugar || 0) + (macro.sugar || 0),
      sodium: (total.sodium || 0) + (macro.sodium || 0),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    }
  );
}
