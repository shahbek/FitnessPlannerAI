/**
 * Verification Service
 * 
 * Verifies that generated meal plans meet macro targets with tolerance checking
 */

import { MacroValues } from '../types/nutrition';
import {
  calculateMacroDifference,
  calculateMacroPercentageDifference,
  validateMacros,
} from '../utils/macroCalculator';

/**
 * Tolerance Levels
 */
export interface ToleranceConfig {
  percentageTolerance: number; // expressed as decimal (0.05 = 5%)
  absoluteTolerance: number; // expressed in macro units (kcal or grams)
}

export const TOLERANCES = {
  CALORIES: {
    percentageTolerance: 0.05, // ±5%
    absoluteTolerance: 100, // ±100 kcal
  },
  PROTEIN: {
    percentageTolerance: 0.03, // ±3% (critical macro)
    absoluteTolerance: 5, // ±5g minimum
  },
  CARBS: {
    percentageTolerance: 0.05, // ±5%
    absoluteTolerance: 15, // ±15g
  },
  FATS: {
    percentageTolerance: 0.05, // ±5%
    absoluteTolerance: 5, // ±5g
  },
} as const;

/**
 * Verification Result
 */
export interface VerificationResult {
  passed: boolean;
  macroResults: {
    calories: MacroVerificationResult;
    protein: MacroVerificationResult;
    carbs: MacroVerificationResult;
    fats: MacroVerificationResult;
  };
  summary: {
    allPassed: boolean;
    passedCount: number;
    totalCount: number;
    errors: string[];
    warnings: string[];
  };
}

export interface MacroVerificationResult {
  passed: boolean;
  target: number;
  actual: number;
  difference: number;
  percentageDifference: number;
  withinTolerance: boolean;
  tolerance: number;
  withinPercentage: boolean;
  withinAbsolute: boolean;
  absoluteTolerance: number;
}

/**
 * Verification Error
 */
export interface VerificationError {
  type: 'MISSING_TARGET' | 'INVALID_MACROS' | 'OUT_OF_TOLERANCE' | 'VALIDATION_ERROR';
  message: string;
  macro?: 'calories' | 'protein' | 'carbs' | 'fats';
  context?: any;
  suggestedAction?: string;
}

/**
 * Verification Service
 */
export class VerificationService {
  /**
   * Verify macros against targets
   */
  verifyMacros(
    actual: MacroValues,
    target: MacroValues
  ): VerificationResult {
    // First validate the macros
    const validation = validateMacros(actual);
    if (!validation.isValid) {
      return {
        passed: false,
        macroResults: this.createEmptyMacroResults(),
        summary: {
          allPassed: false,
          passedCount: 0,
          totalCount: 4,
          errors: validation.errors,
          warnings: [],
        },
      };
    }

    // Calculate differences
    const differences = calculateMacroDifference(actual, target);
    const percentageDifferences = calculateMacroPercentageDifference(actual, target);

    // Verify each macro
    const caloriesResult = this.verifySingleMacro(
      actual.calories,
      target.calories,
      differences.calories,
      percentageDifferences.calories,
      TOLERANCES.CALORIES
    );

    const proteinResult = this.verifySingleMacro(
      actual.protein,
      target.protein,
      differences.protein,
      percentageDifferences.protein,
      TOLERANCES.PROTEIN
    );

    const carbsResult = this.verifySingleMacro(
      actual.carbs,
      target.carbs,
      differences.carbs,
      percentageDifferences.carbs,
      TOLERANCES.CARBS
    );

    const fatsResult = this.verifySingleMacro(
      actual.fats,
      target.fats,
      differences.fats,
      percentageDifferences.fats,
      TOLERANCES.FATS
    );

    const macroResults = {
      calories: caloriesResult,
      protein: proteinResult,
      carbs: carbsResult,
      fats: fatsResult,
    };

    const allPassed =
      caloriesResult.withinTolerance &&
      proteinResult.withinTolerance &&
      carbsResult.withinTolerance &&
      fatsResult.withinTolerance;

    const passedCount = [
      caloriesResult,
      proteinResult,
      carbsResult,
      fatsResult,
    ].filter(r => r.withinTolerance).length;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!caloriesResult.withinTolerance) {
      errors.push(
        `Calories out of tolerance: ${actual.calories} (target: ${target.calories}, diff: ${differences.calories} kcal, ${percentageDifferences.calories > 0 ? '+' : ''}${percentageDifferences.calories}%)`
      );
    }

    if (!proteinResult.withinTolerance) {
      errors.push(
        `Protein out of tolerance: ${actual.protein}g (target: ${target.protein}g, diff: ${differences.protein > 0 ? '+' : ''}${differences.protein}g, ${percentageDifferences.protein > 0 ? '+' : ''}${percentageDifferences.protein}%)`
      );
    }

    if (!carbsResult.withinTolerance) {
      warnings.push(
        `Carbs out of tolerance: ${actual.carbs}g (target: ${target.carbs}g, diff: ${differences.carbs > 0 ? '+' : ''}${differences.carbs}g, ${percentageDifferences.carbs > 0 ? '+' : ''}${percentageDifferences.carbs}%)`
      );
    }

    if (!fatsResult.withinTolerance) {
      warnings.push(
        `Fats out of tolerance: ${actual.fats}g (target: ${target.fats}g, diff: ${differences.fats > 0 ? '+' : ''}${differences.fats}g, ${percentageDifferences.fats > 0 ? '+' : ''}${percentageDifferences.fats}%)`
      );
    }

    const macroRatios = {
      protein:
        target.protein > 0 ? actual.protein / target.protein : undefined,
      carbs: target.carbs > 0 ? actual.carbs / target.carbs : undefined,
      fats: target.fats > 0 ? actual.fats / target.fats : undefined,
    };

    const ratioErrors: string[] = [];

    if (macroRatios.protein !== undefined) {
      if (macroRatios.protein < 0.8 || macroRatios.protein > 1.2) {
        ratioErrors.push(
          `Protein ratio out of range: ${(macroRatios.protein * 100).toFixed(1)}% of target (allowed 80%-120%)`
        );
      }
    }

    if (macroRatios.carbs !== undefined) {
      if (macroRatios.carbs < 0.8 || macroRatios.carbs > 1.2) {
        ratioErrors.push(
          `Carbs ratio out of range: ${(macroRatios.carbs * 100).toFixed(1)}% of target (allowed 80%-120%)`
        );
      }
    }

    if (macroRatios.fats !== undefined) {
      if (macroRatios.fats < 0.8 || macroRatios.fats > 1.2) {
        ratioErrors.push(
          `Fats ratio out of range: ${(macroRatios.fats * 100).toFixed(1)}% of target (allowed 80%-120%)`
        );
      }
    }

    errors.push(...ratioErrors);
    const ratioValid = ratioErrors.length === 0;

    const passed = allPassed && ratioValid;

    return {
      passed,
      macroResults,
      summary: {
        allPassed: passed,
        passedCount,
        totalCount: 4,
        errors,
        warnings,
      },
    };
  }

  /**
   * Verify a single macro
   */
  private verifySingleMacro(
    actual: number,
    target: number,
    difference: number,
    percentageDifference: number,
    tolerance: ToleranceConfig
  ): MacroVerificationResult {
    const absPercentageDiff = Math.abs(percentageDifference);
    const absDifference = Math.abs(difference);

    const percentageLimit = tolerance.percentageTolerance * 100;
    const withinPercentage =
      target === 0
        ? absDifference <= tolerance.absoluteTolerance
        : absPercentageDiff <= percentageLimit;
    const withinAbsolute = absDifference <= tolerance.absoluteTolerance;
    const withinTolerance = withinPercentage && withinAbsolute;

    return {
      passed: withinTolerance,
      target,
      actual,
      difference,
      percentageDifference,
      withinTolerance,
      tolerance: percentageLimit,
      withinPercentage,
      withinAbsolute,
      absoluteTolerance: tolerance.absoluteTolerance,
    };
  }

  /**
   * Create empty macro results (for error cases)
   */
  private createEmptyMacroResults(): VerificationResult['macroResults'] {
    const empty = {
      passed: false,
      target: 0,
      actual: 0,
      difference: 0,
      percentageDifference: 0,
      withinTolerance: false,
      tolerance: 0,
      withinPercentage: false,
      withinAbsolute: false,
      absoluteTolerance: 0,
    };

    return {
      calories: { ...empty },
      protein: { ...empty },
      carbs: { ...empty },
      fats: { ...empty },
    };
  }

  /**
   * Generate verification error with suggested actions
   */
  generateVerificationError(
    result: VerificationResult
  ): VerificationError | null {
    if (result.passed) {
      return null;
    }

    // Find the most critical failure
    const failures: Array<{
      macro: 'calories' | 'protein' | 'carbs' | 'fats';
      result: MacroVerificationResult;
    }> = [];

    if (!result.macroResults.calories.withinTolerance) {
      failures.push({ macro: 'calories', result: result.macroResults.calories });
    }
    if (!result.macroResults.protein.withinTolerance) {
      failures.push({ macro: 'protein', result: result.macroResults.protein });
    }
    if (!result.macroResults.carbs.withinTolerance) {
      failures.push({ macro: 'carbs', result: result.macroResults.carbs });
    }
    if (!result.macroResults.fats.withinTolerance) {
      failures.push({ macro: 'fats', result: result.macroResults.fats });
    }

    // Prioritize protein (critical macro)
    const proteinFailure = failures.find(f => f.macro === 'protein');
    const criticalFailure = proteinFailure || failures[0];

    if (!criticalFailure) {
      return {
        type: 'OUT_OF_TOLERANCE',
        message: 'Macros are out of tolerance',
        suggestedAction: 'Review macro calculations and adjust portions',
      };
    }

    const { macro, result: macroResult } = criticalFailure;
    const isOver = macroResult.difference > 0;

    let suggestedAction: string;
    switch (macro) {
      case 'calories':
        suggestedAction = isOver
          ? 'Reduce portion sizes or swap to lower-calorie foods'
          : 'Increase portion sizes or add higher-calorie foods';
        break;
      case 'protein':
        suggestedAction = isOver
          ? 'Reduce protein source portions or swap to lower-protein options'
          : 'Increase protein source portions or add high-protein foods';
        break;
      case 'carbs':
        suggestedAction = isOver
          ? 'Reduce carb source portions'
          : 'Increase carb source portions';
        break;
      case 'fats':
        suggestedAction = isOver
          ? 'Reduce fat source portions or cooking oils'
          : 'Increase fat source portions or add healthy fats';
        break;
    }

    return {
      type: 'OUT_OF_TOLERANCE',
      message: `${macro.charAt(0).toUpperCase() + macro.slice(1)} is out of tolerance: ${macroResult.actual} (target: ${macroResult.target}, diff: ${macroResult.difference > 0 ? '+' : ''}${macroResult.difference}${macro === 'calories' ? ' kcal' : 'g'}, ${macroResult.percentageDifference > 0 ? '+' : ''}${macroResult.percentageDifference}%)`,
      macro,
      context: {
        actual: macroResult.actual,
        target: macroResult.target,
        difference: macroResult.difference,
        percentageDifference: macroResult.percentageDifference,
        tolerance: macroResult.tolerance,
        absoluteTolerance: macroResult.absoluteTolerance,
      },
      suggestedAction,
    };
  }

  /**
   * Format verification result for display
   */
  formatVerificationResult(result: VerificationResult): string {
    const lines: string[] = [];

    if (result.passed) {
      lines.push('✅ All macros verified and within tolerance');
    } else {
      lines.push('❌ Verification failed');
    }

    lines.push('\nMacro Results:');
    lines.push(`  Calories: ${result.macroResults.calories.withinTolerance ? '✅' : '❌'} ${result.macroResults.calories.actual} / ${result.macroResults.calories.target} (${result.macroResults.calories.percentageDifference > 0 ? '+' : ''}${result.macroResults.calories.percentageDifference}%)`);
    lines.push(`  Protein: ${result.macroResults.protein.withinTolerance ? '✅' : '❌'} ${result.macroResults.protein.actual}g / ${result.macroResults.protein.target}g (${result.macroResults.protein.percentageDifference > 0 ? '+' : ''}${result.macroResults.protein.percentageDifference}%)`);
    lines.push(`  Carbs: ${result.macroResults.carbs.withinTolerance ? '✅' : '❌'} ${result.macroResults.carbs.actual}g / ${result.macroResults.carbs.target}g (${result.macroResults.carbs.percentageDifference > 0 ? '+' : ''}${result.macroResults.carbs.percentageDifference}%)`);
    lines.push(`  Fats: ${result.macroResults.fats.withinTolerance ? '✅' : '❌'} ${result.macroResults.fats.actual}g / ${result.macroResults.fats.target}g (${result.macroResults.fats.percentageDifference > 0 ? '+' : ''}${result.macroResults.fats.percentageDifference}%)`);

    if (result.summary.errors.length > 0) {
      lines.push('\nErrors:');
      result.summary.errors.forEach(error => {
        lines.push(`  ❌ ${error}`);
      });
    }

    if (result.summary.warnings.length > 0) {
      lines.push('\nWarnings:');
      result.summary.warnings.forEach(warning => {
        lines.push(`  ⚠️  ${warning}`);
      });
    }

    return lines.join('\n');
  }
}

