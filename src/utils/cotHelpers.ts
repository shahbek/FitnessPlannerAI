/**
 * Chain-of-Thought Helper Utilities
 * 
 * Utilities for tracking reasoning, feedback loops, and correction iterations
 */

import { CoTReasoningStep, CoTReasoningResult } from '../services/ChainOfThoughtService';

/**
 * Reasoning Tracker
 * Tracks reasoning steps throughout a generation session
 */
export class ReasoningTracker {
  private steps: CoTReasoningStep[] = [];
  private sessionId: string;
  private startTime: number;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session-${Date.now()}`;
    this.startTime = Date.now();
  }

  /**
   * Add a reasoning step
   */
  addStep(step: Omit<CoTReasoningStep, 'timestamp'>): void {
    this.steps.push({
      ...step,
      timestamp: Date.now(),
    });
  }

  /**
   * Add multiple steps
   */
  addSteps(steps: Omit<CoTReasoningStep, 'timestamp'>[]): void {
    steps.forEach(step => this.addStep(step));
  }

  /**
   * Get all steps
   */
  getSteps(): CoTReasoningStep[] {
    return [...this.steps];
  }

  /**
   * Get steps by index range
   */
  getStepsRange(start: number, end?: number): CoTReasoningStep[] {
    return this.steps.slice(start, end);
  }

  /**
   * Get the latest step
   */
  getLatestStep(): CoTReasoningStep | null {
    return this.steps.length > 0 ? this.steps[this.steps.length - 1] : null;
  }

  /**
   * Get reasoning summary
   */
  getSummary(): {
    totalSteps: number;
    duration: number;
    hasCalculations: boolean;
    hasResults: boolean;
  } {
    return {
      totalSteps: this.steps.length,
      duration: Date.now() - this.startTime,
      hasCalculations: this.steps.some(step => step.calculation),
      hasResults: this.steps.some(step => step.result !== undefined),
    };
  }

  /**
   * Clear all steps
   */
  clear(): void {
    this.steps = [];
    this.startTime = Date.now();
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Export reasoning as JSON
   */
  export(): CoTReasoningResult {
    return {
      steps: this.getSteps(),
      finalResult: this.getLatestStep()?.result,
    };
  }

  /**
   * Import reasoning from result
   */
  import(reasoning: CoTReasoningResult): void {
    this.steps = reasoning.steps;
  }
}

/**
 * Feedback Loop Manager
 * Manages correction iterations with safeguards
 */
export class FeedbackLoopManager {
  private maxIterations: number;
  private currentIteration: number = 0;
  private iterations: Array<{
    iteration: number;
    result: any;
    reasoning: CoTReasoningResult;
    verification?: {
      passed: boolean;
      message?: string;
    };
    timestamp: number;
  }> = [];

  constructor(maxIterations: number = 3) {
    this.maxIterations = maxIterations;
  }

  /**
   * Start a new iteration
   */
  startIteration(): { iteration: number; canContinue: boolean } {
    if (this.currentIteration >= this.maxIterations) {
      return {
        iteration: this.currentIteration,
        canContinue: false,
      };
    }

    this.currentIteration++;
    return {
      iteration: this.currentIteration,
      canContinue: true,
    };
  }

  /**
   * Record iteration result
   */
  recordIteration(
    result: any,
    reasoning: CoTReasoningResult,
    verification?: { passed: boolean; message?: string }
  ): void {
    this.iterations.push({
      iteration: this.currentIteration,
      result,
      reasoning,
      verification,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current iteration
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Get all iterations
   */
  getIterations(): typeof this.iterations {
    return [...this.iterations];
  }

  /**
   * Get the latest iteration
   */
  getLatestIteration(): typeof this.iterations[0] | null {
    return this.iterations.length > 0
      ? this.iterations[this.iterations.length - 1]
      : null;
  }

  /**
   * Check if max iterations reached
   */
  hasReachedMax(): boolean {
    return this.currentIteration >= this.maxIterations;
  }

  /**
   * Check if latest iteration passed verification
   */
  hasLatestPassed(): boolean {
    const latest = this.getLatestIteration();
    return latest?.verification?.passed ?? false;
  }

  /**
   * Get iteration summary
   */
  getSummary(): {
    totalIterations: number;
    maxIterations: number;
    passed: boolean;
    latestResult: any;
  } {
    const latest = this.getLatestIteration();
    return {
      totalIterations: this.currentIteration,
      maxIterations: this.maxIterations,
      passed: this.hasLatestPassed(),
      latestResult: latest?.result ?? null,
    };
  }

  /**
   * Reset for new feedback loop
   */
  reset(): void {
    this.currentIteration = 0;
    this.iterations = [];
  }

  /**
   * Generate correction context for next iteration
   */
  generateCorrectionContext(): {
    previousIterations: number;
    previousResults: any[];
    needsCorrection: boolean;
  } {
    return {
      previousIterations: this.currentIteration,
      previousResults: this.iterations.map(iter => iter.result),
      needsCorrection: !this.hasLatestPassed(),
    };
  }
}

/**
 * Self-Consistency Checker
 * Checks consistency across reasoning steps
 */
export class SelfConsistencyChecker {
  /**
   * Check if reasoning steps are consistent
   */
  static checkConsistency(reasoning: CoTReasoningResult): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if steps build on each other
    if (reasoning.steps.length < 2) {
      issues.push('Insufficient reasoning steps for consistency check');
    }

    // Check if calculations are present where numbers are involved
    const hasNumbers = reasoning.steps.some(
      step => step.thought.match(/\d+/)
    );
    const hasCalculations = reasoning.steps.some(step => step.calculation);

    if (hasNumbers && !hasCalculations) {
      issues.push('Numbers mentioned but no calculations shown');
    }

    // Check if final result aligns with reasoning
    if (reasoning.finalResult && reasoning.steps.length > 0) {
      const lastStep = reasoning.steps[reasoning.steps.length - 1];
      if (lastStep.result && lastStep.result !== reasoning.finalResult) {
        issues.push('Final result does not match last reasoning step result');
      }
    }

    // Check step progression
    for (let i = 1; i < reasoning.steps.length; i++) {
      const prevStep = reasoning.steps[i - 1];
      const currStep = reasoning.steps[i];

      if (currStep.step !== prevStep.step + 1) {
        issues.push(`Step numbering inconsistent at step ${currStep.step}`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate reasoning completeness
   */
  static validateCompleteness(reasoning: CoTReasoningResult): {
    isComplete: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    if (reasoning.steps.length === 0) {
      missing.push('No reasoning steps');
    }

    if (!reasoning.finalResult) {
      missing.push('No final result');
    }

    if (reasoning.steps.length > 0) {
      const hasThoughts = reasoning.steps.every(step => step.thought);
      if (!hasThoughts) {
        missing.push('Some steps missing thoughts');
      }
    }

    return {
      isComplete: missing.length === 0,
      missing,
    };
  }
}

/**
 * Reasoning Formatter
 * Formats reasoning for display or logging
 */
export class ReasoningFormatter {
  /**
   * Format reasoning steps as markdown
   */
  static formatAsMarkdown(reasoning: CoTReasoningResult): string {
    const lines: string[] = ['# Chain-of-Thought Reasoning\n'];

    reasoning.steps.forEach((step, index) => {
      lines.push(`## Step ${step.step}\n`);
      lines.push(`**Thought:** ${step.thought}\n`);

      if (step.calculation) {
        lines.push(`**Calculation:**\n\`\`\`\n${step.calculation}\n\`\`\`\n`);
      }

      if (step.result !== undefined) {
        lines.push(
          `**Result:** ${typeof step.result === 'object' ? JSON.stringify(step.result, null, 2) : step.result}\n`
        );
      }

      if (index < reasoning.steps.length - 1) {
        lines.push('---\n');
      }
    });

    if (reasoning.finalResult) {
      lines.push('\n## Final Result\n');
      lines.push(
        `\`\`\`json\n${JSON.stringify(reasoning.finalResult, null, 2)}\n\`\`\`\n`
      );
    }

    if (reasoning.verification) {
      lines.push('\n## Verification\n');
      lines.push(
        `**Status:** ${reasoning.verification.passed ? '✅ Passed' : '❌ Failed'}\n`
      );
      if (reasoning.verification.message) {
        lines.push(`**Message:** ${reasoning.verification.message}\n`);
      }
      if (reasoning.verification.corrections) {
        lines.push('**Corrections:**\n');
        reasoning.verification.corrections.forEach((correction, i) => {
          lines.push(`${i + 1}. ${correction}\n`);
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * Format reasoning steps as plain text
   */
  static formatAsText(reasoning: CoTReasoningResult): string {
    const lines: string[] = [];

    reasoning.steps.forEach(step => {
      lines.push(`Step ${step.step}: ${step.thought}`);
      if (step.calculation) {
        lines.push(`  Calculation: ${step.calculation}`);
      }
      if (step.result !== undefined) {
        lines.push(`  Result: ${JSON.stringify(step.result)}`);
      }
    });

    if (reasoning.finalResult) {
      lines.push(`\nFinal Result: ${JSON.stringify(reasoning.finalResult)}`);
    }

    return lines.join('\n');
  }

  /**
   * Format reasoning steps for console logging
   */
  static formatForConsole(reasoning: CoTReasoningResult): void {
    console.log('\n🧠 Chain-of-Thought Reasoning:');
    console.log('='.repeat(50));

    reasoning.steps.forEach((step, index) => {
      console.log(`\n📝 Step ${step.step}:`);
      console.log(`   ${step.thought}`);

      if (step.calculation) {
        console.log(`   💡 Calculation: ${step.calculation}`);
      }

      if (step.result !== undefined) {
        console.log(`   ✅ Result:`, step.result);
      }
    });

    if (reasoning.finalResult) {
      console.log('\n🎯 Final Result:');
      console.log(JSON.stringify(reasoning.finalResult, null, 2));
    }

    if (reasoning.verification) {
      console.log('\n🔍 Verification:');
      console.log(
        `   ${reasoning.verification.passed ? '✅ Passed' : '❌ Failed'}`
      );
      if (reasoning.verification.message) {
        console.log(`   ${reasoning.verification.message}`);
      }
    }

    console.log('='.repeat(50));
  }
}

