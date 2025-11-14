/**
 * Workout Verification Service
 * 
 * Verifies workout plans for:
 * - Volume (sets per muscle group)
 * - Recovery (rest days, muscle group balance)
 * - Muscle group balance
 * - Correction loops for issues
 */

import { SessionTemplate } from '../models/PlanModels';
import { TrainingSplit } from './TrainingSplitService';
import { FeedbackLoopManager } from '../utils/cotHelpers';
import { ChainOfThoughtService } from './ChainOfThoughtService';
import { SessionTemplateGenerator } from './SessionTemplateGenerator';

/**
 * Volume Targets
 */
export interface VolumeTargets {
  setsPerMuscleGroup?: Record<string, number>;
  totalSetsPerWeek?: number;
  minSetsPerMuscle?: number;
  maxSetsPerMuscle?: number;
}

/**
 * Verification Result
 */
export interface WorkoutVerificationResult {
  passed: boolean;
  volumeVerification: {
    passed: boolean;
    actualSetsPerMuscle: Record<string, number>;
    targetSetsPerMuscle?: Record<string, number>;
    differences: Record<string, number>;
    issues: string[];
  };
  recoveryVerification: {
    passed: boolean;
    restDays: number;
    consecutiveTrainingDays: number;
    issues: string[];
  };
  muscleBalanceVerification: {
    passed: boolean;
    muscleGroupDistribution: Record<string, number>;
    imbalances: string[];
  };
  summary: {
    allPassed: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Workout Verification Service
 */
export class WorkoutVerificationService {
  private cotService?: ChainOfThoughtService;
  private sessionGenerator?: SessionTemplateGenerator;
  private feedbackLoopManager: FeedbackLoopManager;

  constructor(
    cotService?: ChainOfThoughtService,
    sessionGenerator?: SessionTemplateGenerator
  ) {
    this.cotService = cotService;
    this.sessionGenerator = sessionGenerator;
    this.feedbackLoopManager = new FeedbackLoopManager(3); // Max 3 correction iterations
  }
  /**
   * Verify a week of workout sessions
   */
  verifyWeeklyWorkout(
    sessions: SessionTemplate[],
    trainingSplit: TrainingSplit,
    volumeTargets?: VolumeTargets
  ): WorkoutVerificationResult {
    // Volume verification
    const volumeResult = this.verifyVolume(sessions, volumeTargets);

    // Recovery verification
    const recoveryResult = this.verifyRecovery(trainingSplit);

    // Muscle balance verification
    const muscleBalanceResult = this.verifyMuscleBalance(sessions);

    // Compile summary
    const allPassed =
      volumeResult.passed &&
      recoveryResult.passed &&
      muscleBalanceResult.passed;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!volumeResult.passed) {
      errors.push(...volumeResult.issues);
    } else if (volumeResult.issues.length > 0) {
      warnings.push(...volumeResult.issues);
    }

    if (!recoveryResult.passed) {
      errors.push(...recoveryResult.issues);
    } else if (recoveryResult.issues.length > 0) {
      warnings.push(...recoveryResult.issues);
    }

    if (!muscleBalanceResult.passed) {
      errors.push(...muscleBalanceResult.imbalances);
    } else if (muscleBalanceResult.imbalances.length > 0) {
      warnings.push(...muscleBalanceResult.imbalances);
    }

    return {
      passed: allPassed,
      volumeVerification: volumeResult,
      recoveryVerification: recoveryResult,
      muscleBalanceVerification: muscleBalanceResult,
      summary: {
        allPassed,
        errors,
        warnings,
      },
    };
  }

  /**
   * Verify volume per muscle group
   */
  private verifyVolume(
    sessions: SessionTemplate[],
    targets?: VolumeTargets
  ): WorkoutVerificationResult['volumeVerification'] {
    // Calculate actual sets per muscle group
    const actualSetsPerMuscle: Record<string, number> = {};

    sessions.forEach((session) => {
      // SessionTemplate uses 'structure' array, not 'exercises'
      const exercises = session.structure || [];
      exercises.forEach((exercise) => {
        // Get muscle groups for this exercise (would need exercise library lookup)
        // For now, we'll use the exercise's muscle groups if available
        const muscleGroups = this.getMuscleGroupsFromExercise(exercise);

        muscleGroups.forEach((mg) => {
          actualSetsPerMuscle[mg] = (actualSetsPerMuscle[mg] || 0) + exercise.sets;
        });
      });
    });

    // Compare to targets if provided
    const differences: Record<string, number> = {};
    const issues: string[] = [];

    if (targets?.setsPerMuscleGroup) {
      Object.keys(targets.setsPerMuscleGroup).forEach((mg) => {
        const target = targets.setsPerMuscleGroup![mg];
        const actual = actualSetsPerMuscle[mg] || 0;
        const diff = actual - target;

        differences[mg] = diff;

        if (Math.abs(diff) > target * 0.2) {
          // More than 20% difference
          if (diff > 0) {
            issues.push(`${mg}: ${actual} sets (target: ${target}, +${diff} over)`);
          } else {
            issues.push(`${mg}: ${actual} sets (target: ${target}, ${diff} under)`);
          }
        }
      });
    }

    // Check min/max limits
    if (targets?.minSetsPerMuscle || targets?.maxSetsPerMuscle) {
      Object.keys(actualSetsPerMuscle).forEach((mg) => {
        const sets = actualSetsPerMuscle[mg];

        if (targets.minSetsPerMuscle && sets < targets.minSetsPerMuscle) {
          issues.push(`${mg}: ${sets} sets (minimum: ${targets.minSetsPerMuscle})`);
        }

        if (targets.maxSetsPerMuscle && sets > targets.maxSetsPerMuscle) {
          issues.push(`${mg}: ${sets} sets (maximum: ${targets.maxSetsPerMuscle})`);
        }
      });
    }

    // Check total sets
    const totalSets = Object.values(actualSetsPerMuscle).reduce((sum, sets) => sum + sets, 0);
    if (targets?.totalSetsPerWeek) {
      const diff = totalSets - targets.totalSetsPerWeek;
      if (Math.abs(diff) > targets.totalSetsPerWeek * 0.1) {
        issues.push(`Total sets: ${totalSets} (target: ${targets.totalSetsPerWeek}, diff: ${diff > 0 ? '+' : ''}${diff})`);
      }
    }

    return {
      passed: issues.length === 0,
      actualSetsPerMuscle,
      targetSetsPerMuscle: targets?.setsPerMuscleGroup,
      differences,
      issues,
    };
  }

  /**
   * Verify recovery (rest days, consecutive training days)
   */
  private verifyRecovery(
    trainingSplit: TrainingSplit
  ): WorkoutVerificationResult['recoveryVerification'] {
    const issues: string[] = [];
    const restDays = trainingSplit.days.filter(d => d.isRestDay).length;
    const trainingDays = trainingSplit.days.filter(d => !d.isRestDay);

    // Check minimum rest days
    if (restDays < 1) {
      issues.push('No rest days scheduled - at least 1 rest day required');
    }

    // Check consecutive training days on same muscle groups
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (let i = 0; i < trainingSplit.days.length; i++) {
      const day = trainingSplit.days[i];

      if (!day.isRestDay) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);

        // Check if next day also trains same muscle groups
        if (i < trainingSplit.days.length - 1) {
          const nextDay = trainingSplit.days[i + 1];
          if (!nextDay.isRestDay) {
            const overlap = day.focus.filter(f => nextDay.focus.includes(f));
            if (overlap.length > 0 && day.focus.length <= 2) {
              // Same muscle group trained consecutively
              issues.push(
                `Consecutive training days on ${overlap.join(', ')} may affect recovery`
              );
            }
          }
        }
      } else {
        currentConsecutive = 0;
      }
    }

    // Warn about too many consecutive training days
    if (maxConsecutive > 3) {
      issues.push(`Too many consecutive training days (${maxConsecutive}) - may affect recovery`);
    }

    return {
      passed: issues.length === 0,
      restDays,
      consecutiveTrainingDays: maxConsecutive,
      issues,
    };
  }

  /**
   * Verify muscle group balance
   */
  private verifyMuscleBalance(
    sessions: SessionTemplate[]
  ): WorkoutVerificationResult['muscleBalanceVerification'] {
    const muscleGroupDistribution: Record<string, number> = {};

    // Count sessions per muscle group
    sessions.forEach((session) => {
      // SessionTemplate uses 'structure' array, not 'exercises'
      const exercises = session.structure || [];
      exercises.forEach((exercise) => {
        const muscleGroups = this.getMuscleGroupsFromExercise(exercise);
        muscleGroups.forEach((mg) => {
          muscleGroupDistribution[mg] = (muscleGroupDistribution[mg] || 0) + 1;
        });
      });
    });

    // Find imbalances
    const imbalances: string[] = [];
    const values = Object.values(muscleGroupDistribution);
    const max = Math.max(...values);
    const min = Math.min(...values);

    if (max > 0 && min > 0) {
      const ratio = max / min;
      if (ratio > 3) {
        // One muscle group trained 3x more than another
        const overTrained = Object.entries(muscleGroupDistribution)
          .filter(([_, count]) => count === max)
          .map(([mg]) => mg);
        const underTrained = Object.entries(muscleGroupDistribution)
          .filter(([_, count]) => count === min)
          .map(([mg]) => mg);

        imbalances.push(
          `${overTrained.join(', ')} trained ${Math.round(ratio)}x more than ${underTrained.join(', ')}`
        );
      }
    }

    // Check for completely missing muscle groups
    const majorMuscleGroups = [
      'chest',
      'back',
      'shoulders',
      'quads',
      'hamstrings',
      'glutes',
    ];
    const missing = majorMuscleGroups.filter(
      mg => !muscleGroupDistribution[mg] || muscleGroupDistribution[mg] === 0
    );

    if (missing.length > 0) {
      imbalances.push(`Missing training for: ${missing.join(', ')}`);
    }

    return {
      passed: imbalances.length === 0,
      muscleGroupDistribution,
      imbalances,
    };
  }

  /**
   * Get muscle groups from exercise (helper method)
   * In a real implementation, this would look up from exercise library
   */
  private getMuscleGroupsFromExercise(exercise: any): string[] {
    // Try to extract from exercise name or notes
    // This is a simplified version - in production, would look up from exercise library
    // SessionTemplate.structure has exerciseId, so we need to look it up from library
    if (Array.isArray(exercise.targetMuscles) && exercise.targetMuscles.length > 0) {
      return exercise.targetMuscles.map((mg: string) => mg.toLowerCase());
    }
    
    // Fallback: try to extract from name if available
    const name = (exercise.name || '').toLowerCase();

    const muscleGroups: string[] = [];

    if (name.includes('chest') || name.includes('press') && name.includes('bench')) {
      muscleGroups.push('chest');
    }
    if (name.includes('back') || name.includes('row') || name.includes('pull')) {
      muscleGroups.push('back');
    }
    if (name.includes('shoulder') || name.includes('press') && name.includes('overhead')) {
      muscleGroups.push('shoulders');
    }
    if (name.includes('squat') || name.includes('leg press') || name.includes('quad')) {
      muscleGroups.push('quads');
    }
    if (name.includes('deadlift') || name.includes('hamstring') || name.includes('curl')) {
      muscleGroups.push('hamstrings');
    }
    if (name.includes('glute') || name.includes('hip')) {
      muscleGroups.push('glutes');
    }
    if (name.includes('bicep') || name.includes('curl')) {
      muscleGroups.push('biceps');
    }
    if (name.includes('tricep') || name.includes('dip') || name.includes('pushdown')) {
      muscleGroups.push('triceps');
    }

    // Default to empty if we can't determine
    return muscleGroups.length > 0 ? muscleGroups : ['unknown'];
  }

  /**
   * Generate correction suggestions
   */
  generateCorrections(
    verification: WorkoutVerificationResult
  ): string[] {
    const corrections: string[] = [];

    if (!verification.volumeVerification.passed) {
      verification.volumeVerification.issues.forEach((issue) => {
        if (issue.includes('under')) {
          corrections.push(`Increase volume for ${issue.split(':')[0]}`);
        } else if (issue.includes('over')) {
          corrections.push(`Reduce volume for ${issue.split(':')[0]}`);
        }
      });
    }

    if (!verification.recoveryVerification.passed) {
      if (verification.recoveryVerification.restDays < 1) {
        corrections.push('Add rest days to the schedule');
      }
      if (verification.recoveryVerification.consecutiveTrainingDays > 3) {
        corrections.push('Add rest days between training sessions');
      }
      if (verification.recoveryVerification.issues.some(i => i.includes('Consecutive'))) {
        corrections.push('Avoid training same muscle groups on consecutive days');
      }
    }

    if (!verification.muscleBalanceVerification.passed) {
      verification.muscleBalanceVerification.imbalances.forEach((imbalance) => {
        if (imbalance.includes('Missing')) {
          corrections.push(imbalance);
        } else {
          corrections.push(`Balance muscle group training: ${imbalance}`);
        }
      });
    }

    return corrections;
  }

  /**
   * Verify and correct workout plan (with correction loop)
   */
  async verifyAndCorrect(
    sessions: SessionTemplate[],
    trainingSplit: TrainingSplit,
    volumeTargets?: VolumeTargets,
    correctionOptions?: {
      maxIterations?: number;
      onIterationUpdate?: (iteration: number, result: WorkoutVerificationResult) => void;
    }
  ): Promise<{
    sessions: SessionTemplate[];
    trainingSplit: TrainingSplit;
    verification: WorkoutVerificationResult;
    iterations: number;
    success: boolean;
  }> {
    const maxIterations = correctionOptions?.maxIterations || 3;
    this.feedbackLoopManager.reset();

    let currentSessions = sessions;
    let currentSplit = trainingSplit;
    let verification: WorkoutVerificationResult;
    let iterations = 0;

    do {
      // Start iteration
      const { canContinue } = this.feedbackLoopManager.startIteration();
      if (!canContinue) {
        // Max iterations reached
        return {
          sessions: currentSessions,
          trainingSplit: currentSplit,
          verification: verification!,
          iterations,
          success: false,
        };
      }

      iterations++;

      // Verify current plan
      verification = this.verifyWeeklyWorkout(
        currentSessions,
        currentSplit,
        volumeTargets
      );

      // Callback for iteration update
      if (correctionOptions?.onIterationUpdate) {
        correctionOptions.onIterationUpdate(iterations, verification);
      }

      // If verification passed, we're done
      if (verification.passed) {
        this.feedbackLoopManager.recordIteration(
          { sessions: currentSessions, split: currentSplit },
          { steps: [], finalResult: verification },
          { passed: true, message: 'Workout plan verified' }
        );

        return {
          sessions: currentSessions,
          trainingSplit: currentSplit,
          verification,
          iterations,
          success: true,
        };
      }

      // Correction needed
      const corrections = this.generateCorrections(verification);

      // Try to correct automatically
      try {
        // For now, we'll just record the correction suggestions
        // In a full implementation, we'd use CoT to regenerate sessions
        this.feedbackLoopManager.recordIteration(
          { sessions: currentSessions, split: currentSplit },
          { steps: [], finalResult: verification },
          { passed: false, message: corrections.join('; ') }
        );

        // If we have the necessary services, we could regenerate sessions here
        // For now, we'll return with suggestions
        if (iterations >= maxIterations) {
          return {
            sessions: currentSessions,
            trainingSplit: currentSplit,
            verification,
            iterations,
            success: false,
          };
        }
      } catch (correctionError) {
        // Correction failed
        return {
          sessions: currentSessions,
          trainingSplit: currentSplit,
          verification,
          iterations,
          success: false,
        };
      }
    } while (iterations < maxIterations);

    // Max iterations reached
    return {
      sessions: currentSessions,
      trainingSplit: currentSplit,
      verification: verification!,
      iterations,
      success: false,
    };
  }
}
