// Plan Consistency Validator
// Main orchestrator that runs all validation checks and calculates overall confidence score

import {
  ConsistentPlan,
  ValidationReport,
  calculatePlanChecksum
} from '@/models/ConsistentPlanModels';
import { MacroConsistencyValidator, MacroConsistencyResult } from './validators/MacroConsistencyValidator';
import { TraceabilityValidator, TraceabilityResult } from './validators/TraceabilityValidator';
import { VarietyValidator, VarietyResult } from './validators/VarietyValidator';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;  // 0-100%
  report: ValidationReport;
}

export class PlanConsistencyValidator {
  private macroValidator: MacroConsistencyValidator;
  private traceabilityValidator: TraceabilityValidator;
  private varietyValidator: VarietyValidator;

  constructor() {
    this.macroValidator = new MacroConsistencyValidator();
    this.traceabilityValidator = new TraceabilityValidator();
    this.varietyValidator = new VarietyValidator();
  }

  /**
   * Run all validation checks and generate comprehensive report
   */
  validate(plan: ConsistentPlan, adjustments: Array<{ type: string; location: string; before: any; after: any; reason: string; success: boolean }> = []): ValidationResult {
    // Run all validators
    const macroResult = this.macroValidator.validate(plan);
    const traceabilityResult = this.traceabilityValidator.validate(plan);
    const varietyResult = this.varietyValidator.validate(plan);

    // Calculate overall confidence score
    // Weights: Macro consistency: 40%, Traceability: 30%, Variety: 20%, Data completeness: 10%
    const macroWeight = 0.40;
    const traceabilityWeight = 0.30;
    const varietyWeight = 0.20;
    const completenessWeight = 0.10;

    // Calculate data completeness score
    const completenessScore = this.calculateCompletenessScore(plan);

    const overallConfidence = (
      macroResult.score * macroWeight +
      traceabilityResult.score * traceabilityWeight +
      varietyResult.score * varietyWeight +
      completenessScore * completenessWeight
    );

    // Generate checksum for reproducibility
    const checksum = calculatePlanChecksum(plan);

    // Build validation report
    const report: ValidationReport = {
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      macroConsistency: {
        score: macroResult.score,
        weeklyAlignment: macroResult.weeklyAlignment,
        dailyAlignment: macroResult.dailyAlignment,
        mealAlignment: macroResult.mealAlignment,
        discrepancies: macroResult.discrepancies
      },
      ingredientTraceability: {
        score: traceabilityResult.score,
        traceableItems: traceabilityResult.traceableItems,
        totalItems: traceabilityResult.totalItems,
        untraceableItems: traceabilityResult.untraceableItems
      },
      variety: {
        score: varietyResult.score,
        duplicateMeals: varietyResult.duplicateMeals,
        weeklyRotation: varietyResult.weeklyRotation
      },
      adjustments: {
        appliedFixes: adjustments.filter(a => a.success).map(a => ({
          type: a.type as any,
          location: a.location,
          before: a.before,
          after: a.after,
          reason: a.reason,
          success: true
        })),
        failedFixes: adjustments.filter(a => !a.success).map(a => ({
          type: a.type,
          location: a.location,
          issue: JSON.stringify(a.before),
          reason: a.reason
        }))
      },
      checksum
    };

    // CRITICAL: Protein targets MUST be met - fail validation if protein is below target
    const proteinBelowTarget = report.macroConsistency.discrepancies.some(
      d => d.macro === 'protein' && d.calculated < d.declared
    );
    
    const isValid = (
      macroResult.isValid &&
      traceabilityResult.isValid &&
      varietyResult.isValid &&
      overallConfidence >= 99 &&
      !proteinBelowTarget // NEVER allow protein below target
    );

    return {
      isValid,
      confidence: overallConfidence,
      report
    };
  }

  /**
   * Calculate data completeness score
   * Checks for missing data at any level
   */
  private calculateCompletenessScore(plan: ConsistentPlan): number {
    if (plan.weeks.length === 0) return 0;

    let totalChecks = 0;
    let passedChecks = 0;

    for (const week of plan.weeks) {
      // Check week has targets
      totalChecks++;
      if (week.dailyTargets && 
          week.dailyTargets.calories > 0 &&
          week.dailyTargets.protein > 0) {
        passedChecks++;
      }

      // Check week has days
      totalChecks++;
      if (week.days && week.days.length === 7) {
        passedChecks++;
      }

      // Check each day has meals
      for (const day of week.days) {
        totalChecks++;
        if (day.meals && day.meals.length > 0) {
          passedChecks++;
        }

        // Check each meal has ingredients
        for (const meal of day.meals) {
          totalChecks++;
          if (meal.ingredients && meal.ingredients.length > 0) {
            passedChecks++;
          }

          // Check meal has macros
          totalChecks++;
          if (meal.declaredMacros && 
              meal.declaredMacros.calories > 0 &&
              meal.calculatedMacros &&
              meal.calculatedMacros.calories > 0) {
            passedChecks++;
          }
        }
      }

      // Check shopping list exists
      totalChecks++;
      if (week.shoppingList && week.shoppingList.categories) {
        passedChecks++;
      }
    }

    return totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  }

  /**
   * Get human-readable validation summary
   */
  getValidationSummary(result: ValidationResult): string {
    const { report } = result;
    const summary: string[] = [];

    summary.push('=== PLAN VALIDATION REPORT ===');
    summary.push(`Overall Confidence: ${report.overallConfidence.toFixed(1)}%`);
    summary.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    summary.push('');

    summary.push('--- Macro Consistency ---');
    summary.push(`Score: ${report.macroConsistency.score.toFixed(1)}%`);
    summary.push(`Weekly Alignment: ${report.macroConsistency.weeklyAlignment.toFixed(1)}%`);
    summary.push(`Daily Alignment: ${report.macroConsistency.dailyAlignment.toFixed(1)}%`);
    summary.push(`Meal Alignment: ${report.macroConsistency.mealAlignment.toFixed(1)}%`);
    if (report.macroConsistency.discrepancies.length > 0) {
      summary.push(`Discrepancies: ${report.macroConsistency.discrepancies.length}`);
      report.macroConsistency.discrepancies.slice(0, 3).forEach(d => {
        summary.push(`  - ${d.location}: ${d.macro} ${d.declared} → ${d.calculated} (diff: ${d.difference.toFixed(1)})`);
      });
      if (report.macroConsistency.discrepancies.length > 3) {
        summary.push(`  ... and ${report.macroConsistency.discrepancies.length - 3} more`);
      }
    }
    summary.push('');

    summary.push('--- Ingredient Traceability ---');
    summary.push(`Score: ${report.ingredientTraceability.score.toFixed(1)}%`);
    summary.push(`Traceable: ${report.ingredientTraceability.traceableItems}/${report.ingredientTraceability.totalItems}`);
    if (report.ingredientTraceability.untraceableItems.length > 0) {
      summary.push(`Untraceable Items: ${report.ingredientTraceability.untraceableItems.length}`);
      report.ingredientTraceability.untraceableItems.slice(0, 3).forEach(item => {
        summary.push(`  - ${item.name} (${item.location}): ${item.reason}`);
      });
      if (report.ingredientTraceability.untraceableItems.length > 3) {
        summary.push(`  ... and ${report.ingredientTraceability.untraceableItems.length - 3} more`);
      }
    }
    summary.push('');

    summary.push('--- Meal Variety ---');
    summary.push(`Score: ${report.variety.score.toFixed(1)}%`);
    summary.push(`Weekly Rotation: ${report.variety.weeklyRotation.toFixed(1)}%`);
    if (report.variety.duplicateMeals.length > 0) {
      summary.push(`Duplicate Meals: ${report.variety.duplicateMeals.length}`);
      report.variety.duplicateMeals.slice(0, 3).forEach(dup => {
        const weeks = new Set(dup.occurrences.map(o => o.weekNumber));
        summary.push(`  - "${dup.mealName}": ${dup.occurrences.length} occurrences in week(s) ${Array.from(weeks).join(', ')}`);
      });
    }
    summary.push('');

    if (report.adjustments.appliedFixes.length > 0 || report.adjustments.failedFixes.length > 0) {
      summary.push('--- Adjustments ---');
      summary.push(`Applied Fixes: ${report.adjustments.appliedFixes.length}`);
      summary.push(`Failed Fixes: ${report.adjustments.failedFixes.length}`);
      report.adjustments.appliedFixes.slice(0, 3).forEach(adj => {
        summary.push(`  ✅ ${adj.type}: ${adj.location} - ${adj.reason}`);
      });
      if (report.adjustments.appliedFixes.length > 3) {
        summary.push(`  ... and ${report.adjustments.appliedFixes.length - 3} more applied fixes`);
      }
      summary.push('');
    }

    summary.push(`Plan Checksum: ${report.checksum.substring(0, 16)}...`);

    return summary.join('\n');
  }
}

