/**
 * Chain-of-Thought Service
 * 
 * Implements CoT feedback loops using AI SDK components.
 * Tracks reasoning steps and enables self-consistency checks.
 */

import { generateObject, streamObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../config/env';

/**
 * CoT Reasoning Step
 */
export interface CoTReasoningStep {
  step: number;
  thought: string;
  calculation?: string;
  result?: any;
  timestamp: number;
}

/**
 * CoT Reasoning Result
 */
export interface CoTReasoningResult {
  steps: CoTReasoningStep[];
  finalResult: any;
  verification?: {
    passed: boolean;
    message?: string;
    corrections?: string[];
  };
}

/**
 * CoT Generation Options
 */
export interface CoTGenerationOptions {
  model?: 'groq' | 'openai'; // Anthropic support removed for now
  apiKey?: string; // Optional - will use env if not provided
  endpoint?: string;
  temperature?: number;
  maxSteps?: number;
  enableVerification?: boolean;
  onStepUpdate?: (step: CoTReasoningStep) => void;
}

/**
 * Chain-of-Thought Service
 */
export class ChainOfThoughtService {
  private groq: any;
  private openai: any;
  private defaultOptions: Partial<CoTGenerationOptions>;
  private isAvailable: boolean = false;

  constructor(options?: CoTGenerationOptions) {
    // Use environment config if options not provided
    const modelProvider = options?.model || env.AI_MODEL_PROVIDER;
    const apiKey = options?.apiKey || env.AI_API_KEY;
    const endpoint = options?.endpoint || env.AI_ENDPOINT;
    const temperature = options?.temperature ?? env.AI_TEMPERATURE;

    this.defaultOptions = {
      model: modelProvider,
      temperature,
      maxSteps: options?.maxSteps || 10,
      enableVerification: options?.enableVerification ?? env.ENABLE_COT,
    };

    // Check if AI is available
    if (!apiKey) {
      console.warn('⚠️  AI API key not provided. ChainOfThoughtService will use fallback methods.');
      this.isAvailable = false;
      return;
    }

    // Initialize providers based on environment or options
    // Currently supporting Groq (primary) and OpenAI (optional)
    try {
      if (modelProvider === 'openai' || endpoint?.includes('openai')) {
        this.openai = createOpenAI({
          apiKey,
          baseURL: endpoint || undefined,
        });
        this.isAvailable = true;
        console.log('✅ OpenAI provider initialized');
      } else {
        // Default to Groq (primary provider)
        this.groq = createGroq({ apiKey });
        this.isAvailable = true;
        console.log('✅ Groq provider initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize AI provider:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if AI service is available
   */
  isAIAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get the model provider
   */
  private getModel() {
    if (!this.isAvailable) {
      throw new Error('AI service is not available. Check API key configuration.');
    }

    const modelName = env.AI_MODEL_NAME;
    const provider = this.defaultOptions.model || env.AI_MODEL_PROVIDER;

    if (provider === 'openai' && this.openai) {
      return this.openai(modelName || 'gpt-4o');
    }

    // Default to Groq (primary provider)
    if (this.groq) {
      return this.groq(modelName || 'llama-3.3-70b-versatile');
    }

    throw new Error(`No AI provider available for ${provider}`);
  }

  /**
   * Generate object with Chain-of-Thought reasoning
   * 
   * Uses AI SDK's experimental_chainOfThought feature when available.
   * Falls back to manual CoT prompting if not supported.
   */
  async generateWithCoT<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: Partial<CoTGenerationOptions>
  ): Promise<{ result: T; reasoning: CoTReasoningResult }> {
    const opts = { ...this.defaultOptions, ...options };
    const model = this.getModel();

    try {
      // Use regular generateObject with CoT-enhanced prompts
      // Note: experimental_chainOfThought is not stable yet, so we use manual CoT prompting
      // The prompt already includes step-by-step reasoning instructions
      const result = await generateObject({
        model,
        schema,
        messages: [{ role: 'user', content: this.buildCoTPrompt(prompt) }],
        temperature: opts.temperature,
      } as any);

      // Extract reasoning if available
      const reasoning: CoTReasoningResult = this.extractReasoning(
        result,
        prompt
      );

      // Trigger step updates
      if (opts.onStepUpdate) {
        reasoning.steps.forEach(step => {
          opts.onStepUpdate!(step);
        });
      }

      // Verify result if enabled
      if (opts.enableVerification) {
        reasoning.verification = await this.verifyResult(
          result.object as T,
          schema,
          reasoning
        );
      }

      return {
        result: result.object as T,
        reasoning,
      };
    } catch (error) {
      console.error('CoT generation error:', error);
      throw new Error(
        `Chain-of-thought generation failed: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Stream object generation with CoT (for real-time feedback)
   */
  async streamWithCoT<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: Partial<CoTGenerationOptions>
  ): Promise<AsyncIterable<{ partial: Partial<T>; reasoning?: CoTReasoningStep }>> {
    const opts = { ...this.defaultOptions, ...options };
    const model = this.getModel();

    const stream = await streamObject({
      model,
      schema,
      messages: [{ role: 'user', content: this.buildCoTPrompt(prompt) }],
      temperature: opts.temperature,
    } as any);

    // Transform stream to include reasoning context
    return this.transformStream(stream, opts);
  }

  /**
   * Build CoT-enhanced prompt
   */
  private buildCoTPrompt(originalPrompt: string): string {
    return `You are a systematic problem solver. Think through this step by step.

${originalPrompt}

Please show your reasoning:
1. Break down the problem into steps
2. Show your calculations or thought process for each step
3. Verify your answer before finalizing

Format your response with clear reasoning steps.`;
  }

  /**
   * Extract reasoning from AI SDK response
   */
  private extractReasoning(
    result: any,
    originalPrompt: string
  ): CoTReasoningResult {
    const steps: CoTReasoningStep[] = [];

    // Check if reasoning is in the result
    if (result.reasoning?.steps) {
      // AI SDK provided reasoning
      result.reasoning.steps.forEach((step: any, index: number) => {
        steps.push({
          step: index + 1,
          thought: step.thought || step.content || '',
          calculation: step.calculation,
          result: step.result,
          timestamp: Date.now(),
        });
      });
    } else if (result.text) {
      // Fallback: parse text for reasoning patterns
      const reasoningText = this.parseReasoningFromText(result.text);
      reasoningText.forEach((thought, index) => {
        steps.push({
          step: index + 1,
          thought,
          timestamp: Date.now(),
        });
      });
    } else {
      // Default: create a single step
      steps.push({
        step: 1,
        thought: 'Generated result using structured output',
        timestamp: Date.now(),
      });
    }

    return {
      steps,
      finalResult: result.object,
    };
  }

  /**
   * Parse reasoning from text (fallback method)
   */
  private parseReasoningFromText(text: string): string[] {
    const steps: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // Look for step patterns like "1.", "Step 1:", etc.
      const stepMatch = line.match(/^(?:step\s*)?(\d+)\.?\s*(.+)/i);
      if (stepMatch) {
        steps.push(stepMatch[2].trim());
      } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        // Bullet points
        steps.push(line.trim().substring(1).trim());
      }
    }

    return steps.length > 0 ? steps : ['Reasoning not available in text format'];
  }

  /**
   * Transform stream to include reasoning context
   */
  private async *transformStream(
    stream: any,
    options: CoTGenerationOptions
  ): AsyncIterable<{ partial: any; reasoning?: CoTReasoningStep }> {
    let stepCounter = 0;

    for await (const chunk of stream) {
      if (chunk.partialObject) {
        yield {
          partial: chunk.partialObject,
        };
      }

      // If reasoning is available in chunk
      if (chunk.reasoning && options.onStepUpdate) {
        stepCounter++;
        const reasoningStep: CoTReasoningStep = {
          step: stepCounter,
          thought: chunk.reasoning.thought || '',
          calculation: chunk.reasoning.calculation,
          result: chunk.reasoning.result,
          timestamp: Date.now(),
        };
        options.onStepUpdate(reasoningStep);
        yield {
          partial: chunk.partialObject || {},
          reasoning: reasoningStep,
        };
      }
    }
  }

  /**
   * Verify result for self-consistency
   */
  private async verifyResult<T>(
    result: T,
    schema: z.ZodSchema<T>,
    reasoning: CoTReasoningResult
  ): Promise<{ passed: boolean; message?: string; corrections?: string[] }> {
    try {
      // Validate against schema
      const validated = schema.parse(result);

      // Check if reasoning steps are coherent
      if (reasoning.steps.length === 0) {
        return {
          passed: false,
          message: 'No reasoning steps found',
          corrections: ['Add reasoning steps to improve transparency'],
        };
      }

      // Basic consistency check
      const hasCalculations = reasoning.steps.some(
        step => step.calculation || step.result
      );

      if (!hasCalculations && reasoning.steps.length < 3) {
        return {
          passed: false,
          message: 'Reasoning lacks sufficient detail',
          corrections: ['Add more detailed reasoning steps with calculations'],
        };
      }

      return {
        passed: true,
        message: 'Result verified and consistent',
      };
    } catch (error) {
      return {
        passed: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        corrections: ['Check schema compliance and data types'],
      };
    }
  }

  /**
   * Generate correction prompt based on verification failure
   */
  generateCorrectionPrompt(
    originalPrompt: string,
    originalResult: any,
    verificationFailure: { message: string; corrections?: string[] }
  ): string {
    return `Previous attempt failed verification: ${verificationFailure.message}

Original task:
${originalPrompt}

Previous result:
${JSON.stringify(originalResult, null, 2)}

Corrections needed:
${verificationFailure.corrections?.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Please review and correct the issues'}

Think step by step about what went wrong and how to fix it. Generate a corrected version.`;
  }
}

