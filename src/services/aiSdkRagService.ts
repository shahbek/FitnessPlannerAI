import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import {
  dynamicCalculator,
  CalculationResult,
  MacroTargets,
} from '@/ai/dynamicCalculator';
import { researchKnowledgeBase, ResearchFact } from '@/ai/knowledgeBase';
import {
  buildMealPrompt,
  type UserProfile as PromptUserProfile,
} from '@/utils/promptBuilder';
import { validateMealCompliance } from '@/utils/mealValidator';
import { NutritionalResearchService } from './NutritionalResearchService';
import { MealGenerationService } from './MealGenerationService';
import { ShoppingListGenerationService } from './ShoppingListGenerationService';

// ============================================================================
// CONSTANTS - Extract magic numbers for maintainability
// ============================================================================

const FAT_LOSS_LIMITS = {
  MAX_SAFE_WEEKLY_PERCENTAGE: 0.01,      // 1% bodyweight per week maximum
  TARGET_WEEKLY_PERCENTAGE: 0.0075,      // 0.75% bodyweight per week target
} as const;

const CALORIC_DEFICIT_RANGES = {
  MODERATE_START: 0.15,  // 15% deficit at start
  MODERATE_MAX: 0.25,    // 25% deficit maximum
} as const;

const PHASE_DISTRIBUTION = {
  FOUNDATION_END: 0.33,   // First 33% of timeline
  PROGRESSION_END: 0.66,  // Middle 33% of timeline (33-66%)
  PEAK_END: 1.0,          // Final 34% of timeline (66-100%)
} as const;

const VALIDATION_TOLERANCES = {
  CALORIE_PERCENTAGE: 0.05,   // 5% tolerance for calorie matching
  PROTEIN_PERCENTAGE: 0.10,   // 10% tolerance for protein matching
} as const;

const API_CONFIG = {
  MIN_KEY_LENGTH: 10,
  DEFAULT_TEMPERATURE: 0.3,
  KNOWLEDGE_BASE_MAX_RESULTS: 5,
  MIN_CONFIDENCE_SCORE: 0.8,
} as const;

// ============================================================================
// TYPE DEFINITIONS - Replace 'any' with proper interfaces
// ============================================================================

interface UserProfile {
  age: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  bodyFat?: number;
  targetBf?: number;
  activityLevel: string;
  goal: string;
  timelineWeeks: number;
  trainingDaysPerWeek: number;
  workoutLevel: string;
  workoutSplit: string;
  equipment: string;
  mealFrequency: number;
  preferences?: any;
  schedule?: string;
}

interface PlanningMetrics {
  bmr: CalculationResult;
  tdee: CalculationResult;
  bmi?: CalculationResult;
  macros: MacroTargets;
  fatLoss: CalculationResult;
  trainingVolume: CalculationResult;
  water: CalculationResult;
}

interface FeasibilityResult {
  isFeasible: boolean;
  confidenceScore: number;
  reasoning: string;
  risks?: string[];
  recommendations?: string[];
  alternativeTimeline?: string;
  optimisticOutlook?: string;
  evidenceLimits?: {
    maxFatLossPerWeek: number;
    minWeeksRequired: number;
    calculatedMetrics: {
      bmr: number;
      tdee: number;
      fatLossRate: number;
    };
  };
}

interface ValidationResults {
  timelineValidation: any;
  macroValidation: any;
  volumeValidation: any;
  citationsValidation: any;
  weeksValidation: any;
  mealsValidation: any;
  shoppingValidation: any;
}

interface ProgressUpdate {
  phase: string;
  progress: number;
  currentStep: string;
  reasoning: string[];
  aiReasoning?: string;
  reasoningMode?: string;
}

type ProgressCallback = (update: ProgressUpdate) => void;

// ============================================================================
// ZOD SCHEMAS - Centralized schema definitions
// ============================================================================

const FeasibilitySchema = z.object({
  isFeasible: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  risks: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional()
});

const StrategicFrameworkSchema = z.object({
  planName: z.string().describe(
    "A personalized, compelling plan name (3-6 words) that reflects the user's goal, " +
    "training approach, and timeline. Should be motivating and specific."
  ),
  trainingApproach: z.object({
    split: z.string(),
    frequencyPerWeek: z.number(),
    sessionDurationMinutes: z.number(),
    periodization: z.string(),
    volumePerMuscleWeekly: z.record(z.string(), z.number())
  }),
  nutritionApproach: z.object({
    caloricStrategy: z.object({
      deficitMagnitude: z.string(),
      dailyDeficitCalories: z.number(),
      weeklyDeficitCalories: z.number()
    }),
    macroTargets: z.object({
      proteinTotalGrams: z.number(),
      proteinPerKg: z.number(),
      carbPercentage: z.number(),
      fatPercentage: z.number()
    }),
    mealFrequency: z.number(),
    timing: z.object({
      preWorkout: z.string(),
      postWorkout: z.string(),
      bedtime: z.string()
    })
  })
});

const ExerciseSchema = z.object({
  exerciseId: z.string(),
  name: z.string(),
  muscleGroups: z.array(z.string()),
  equipment: z.array(z.string()),
  difficulty: z.string(),
  formCues: z.array(z.string()),
  progressionOptions: z.array(z.string()),
  regressionOptions: z.array(z.string()),
  contraindications: z.array(z.string())
});

const SessionTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  targetMuscles: z.array(z.string()),
  totalDurationMinutes: z.number(),
  structure: z.array(z.object({
    exerciseId: z.string(),
    sets: z.number(),
    reps: z.string(),
    restSeconds: z.number(),
    notes: z.string().optional()
  }))
});

const WeeklyOutlineSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  dailyTargets: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    proteinPerKg: z.number().optional()
  }),
  trainingSchedule: z.object({
    resistanceDays: z.array(z.string()),
    cardioDays: z.array(z.string()).optional(),
    restDays: z.array(z.string()).optional(),
    weeklyVolume: z.string().optional(),
    focusAreas: z.array(z.string()).optional()
  }),
  cardioSchedule: z.object({
    sessions: z.number().optional(),
    duration: z.number().optional(),
    intensity: z.string().optional(),
    type: z.string().optional()
  }).optional(),
  objectives: z.array(z.string()).optional(),
  expectedOutcomes: z.array(z.string()).optional(),
  adjustments: z.string().optional(),
  specialNotes: z.string().optional()
});

const WeeklyMealTemplateSchema = z.object({
  weekNumber: z.number(),
  totalCalories: z.number(),
  totalProtein: z.number(),
  totalCarbs: z.number(),
  totalFat: z.number(),
  meals: z.array(z.object({
    mealType: z.string(),
    timing: z.string(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({
        name: z.string(),
        amount: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number()
      })),
      instructions: z.array(z.string())
    })
  }))
});

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class AISdkRagService {
  // -------------------------------------------------------------------------
  // Private Properties
  // -------------------------------------------------------------------------
  private openai: any;
  private groq: any;
  private modelName: string;
  private knowledgeReady: Promise<void>;
  private mealGenerationService: MealGenerationService | null = null;
  private shoppingListGenerationService: ShoppingListGenerationService | null = null;
  private onProgressUpdate?: ProgressCallback;

  // -------------------------------------------------------------------------
  // Constructor - Initialize AI providers and services
  // -------------------------------------------------------------------------
  constructor(
    apiKey: string, 
    endpoint: string, 
    modelName: string = 'llama-3.3-70b-versatile',
    onProgressUpdate?: ProgressCallback
  ) {
    this.modelName = modelName;
    this.onProgressUpdate = onProgressUpdate;
    
    console.log('🔧 Initializing AI SDK RAG Service:', { endpoint, modelName });
    
    // Initialize knowledge base asynchronously
    this.knowledgeReady = researchKnowledgeBase.initialize().catch(err => {
      console.error('Failed to initialize research knowledge base:', err);
    });
    
    // Validate and clean API key
    const cleanApiKey = this.validateAndCleanApiKey(apiKey);
    
    // Initialize appropriate provider based on endpoint
    if (endpoint.includes('groq.com') || endpoint === 'groq') {
      this.initializeGroqProvider(cleanApiKey);
    } else if (endpoint.includes('openai.com') || endpoint === 'openai') {
      this.initializeOpenAIProvider(cleanApiKey);
    } else {
      this.initializeCustomProvider(cleanApiKey, endpoint);
    }
  }

  // -------------------------------------------------------------------------
  // Provider Initialization Methods
  // -------------------------------------------------------------------------

  /**
   * Initialize Groq provider and associated services
   */
  private initializeGroqProvider(apiKey: string): void {
    this.groq = createGroq({ apiKey });
    console.log('✅ Groq provider initialized');
    
    // Groq-specific services for advanced features
    this.mealGenerationService = new MealGenerationService(apiKey);
    this.shoppingListGenerationService = new ShoppingListGenerationService(apiKey);
  }

  /**
   * Initialize OpenAI provider with standard endpoint
   */
  private initializeOpenAIProvider(apiKey: string): void {
    this.openai = createOpenAI({ apiKey });
    console.log('✅ OpenAI provider initialized');
  }

  /**
   * Initialize custom OpenAI-compatible provider
   */
  private initializeCustomProvider(apiKey: string, endpoint: string): void {
    this.openai = createOpenAI({ apiKey, baseURL: endpoint });
    console.log('✅ Custom OpenAI provider initialized with endpoint:', endpoint);
  }

  /**
   * Validate API key format and return cleaned version
   * Only removes whitespace - doesn't strip valid characters
   */
  private validateAndCleanApiKey(apiKey: string): string {
    const trimmed = apiKey.trim();
    
    if (!trimmed) {
      throw new Error('Invalid API key: empty or whitespace only');
    }
    
    if (trimmed.length < API_CONFIG.MIN_KEY_LENGTH) {
      throw new Error(`Invalid API key: must be at least ${API_CONFIG.MIN_KEY_LENGTH} characters`);
    }
    
    console.log('🔑 API key validated');
    return trimmed;
  }

  // -------------------------------------------------------------------------
  // Model Selection
  // -------------------------------------------------------------------------

  /**
   * Get the appropriate AI model instance based on configured provider
   */
  private getModel() {
    if (this.groq) {
      return this.groq(this.modelName);
    } else if (this.openai) {
      return this.openai(this.modelName);
    } else {
      throw new Error('No AI provider configured. Please check your API key and endpoint.');
    }
  }

  // -------------------------------------------------------------------------
  // Core Generation Method with Fallback Strategy
  // -------------------------------------------------------------------------

  /**
   * Generate structured output with automatic fallback to text parsing
   * Implements comprehensive error handling and multiple extraction strategies
   */
  private async generateWithFallback<T>(
    schema: z.ZodType<T>,
    prompt: string,
    context: string = 'generation'
  ): Promise<T> {
    try {
      // Strategy 1: Try structured output first (most reliable)
      console.log(`🔄 Attempting structured output for ${context}...`);
      
      const result = await generateObject({
        model: this.getModel(),
        schema,
        prompt,
        temperature: API_CONFIG.DEFAULT_TEMPERATURE
      });
      
      console.log(`✅ Structured output successful for ${context}`);
      return result.object;
      
    } catch (error) {
      console.log(`⚠️ Structured output failed for ${context}, trying fallback strategies...`);
      
      // Strategy 2: Try to extract from error object (AI SDK sometimes includes data)
      const extractedFromError = this.tryExtractFromError(error);
      if (extractedFromError) {
        console.log(`✅ Extracted data from error for ${context}`);
        return extractedFromError;
      }
      
      // Strategy 3: Fallback to text generation with JSON parsing
      try {
        console.log(`🔄 Attempting text generation fallback for ${context}...`);
        
        const textResult = await generateText({
          model: this.getModel(),
          prompt: prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.',
          temperature: API_CONFIG.DEFAULT_TEMPERATURE
        });

        // Try multiple JSON extraction strategies
        const parsed = this.tryExtractJSON(textResult.text);
        if (parsed) {
          console.log(`✅ Successfully parsed JSON from text response for ${context}`);
          return parsed;
        }
        
      } catch (textError) {
        console.error(`❌ Text generation also failed for ${context}:`, textError);
      }

      // All strategies failed - throw descriptive error
      throw new Error(
        `Failed to generate ${context}: All strategies exhausted. ` +
        `Original error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Try to extract valid data from error object
   * AI SDK sometimes includes generated data in error.data or error.cause
   */
  private tryExtractFromError(error: unknown): any | null {
    const errorObj = error as any;
    
    // Check error.data or error.cause
    const potentialData = errorObj?.data || errorObj?.cause;
    if (potentialData && typeof potentialData === 'object') {
      // Validate it looks like our expected data
      if (this.hasExpectedStructure(potentialData)) {
        return potentialData;
      }
    }
    
    // Try to extract from error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Value:') || errorMessage.includes('{')) {
      const extracted = this.tryExtractJSON(errorMessage);
      if (extracted && this.hasExpectedStructure(extracted)) {
        return extracted;
      }
    }
    
    return null;
  }

  /**
   * Check if object has expected structure patterns
   */
  private hasExpectedStructure(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    // Check for common structure patterns
    const patterns = [
      'weeklyOutlines', 'exercises', 'sessions', 'meals',
      'isFeasible', 'trainingApproach', 'nutritionApproach'
    ];
    
    return patterns.some(pattern => pattern in obj);
  }

  /**
   * Try multiple JSON extraction strategies from text
   */
  private tryExtractJSON(text: string): any | null {
    // Strategy 1: Direct JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    // Strategy 2: Markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    // Strategy 3: JSON array (wrap if needed)
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsedArray = JSON.parse(arrayMatch[0]);
        // If array of outlines/exercises, return as-is or wrap
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          const firstItem = parsedArray[0];
          if (firstItem?.weekNumber) {
            return { weeklyOutlines: parsedArray };
          }
          return parsedArray;
        }
      } catch (e) {
        // All strategies failed
      }
    }
    
    return null;
  }

  // -------------------------------------------------------------------------
  // Knowledge Base Integration
  // -------------------------------------------------------------------------

  /**
   * Ensure knowledge base is ready before searching
   */
  private async ensureKnowledgeBaseReady(): Promise<void> {
    await this.knowledgeReady;
    
    if (!researchKnowledgeBase.isReady()) {
      console.warn('Knowledge base not ready after initialization, retrying...');
      await researchKnowledgeBase.initialize();
    }
  }

  /**
   * Search knowledge base for relevant research facts
   */
  private async searchKnowledgeBase(
    query: string, 
    category?: string, 
    minConfidence = API_CONFIG.MIN_CONFIDENCE_SCORE
  ): Promise<ResearchFact[]> {
    await this.ensureKnowledgeBaseReady();
    
    return researchKnowledgeBase
      .searchFacts(query, category, minConfidence)
      .slice(0, API_CONFIG.KNOWLEDGE_BASE_MAX_RESULTS);
  }

  /**
   * Format research facts into readable context string
   */
  private formatFacts(facts: ResearchFact[]): string {
    if (!facts.length) {
      return 'No specific research citations available. Using evidence-based defaults.';
    }
    
    return facts
      .map(fact => 
        `• ${fact.content}\n` +
        `  Source: ${fact.source} (confidence ${Math.round(fact.confidence * 100)}%)`
      )
      .join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Progress Callback Helpers
  // -------------------------------------------------------------------------

  /**
   * Safely emit progress update if callback exists
   */
  private emitProgress(
    phase: string,
    progress: number,
    currentStep: string,
    reasoning: string[] = []
  ): void {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        phase,
        progress,
        currentStep,
        reasoning
      });
    }
  }

  /**
   * Emit progress with AI reasoning content
   */
  private emitProgressWithReasoning(
    phase: string,
    progress: number,
    currentStep: string,
    aiReasoning: string,
    reasoningMode?: string
  ): void {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        phase,
        progress,
        currentStep,
        reasoning: [],
        aiReasoning,
        reasoningMode
      });
    }
  }

  // -------------------------------------------------------------------------
  // Planning Metrics Calculation
  // -------------------------------------------------------------------------

  /**
   * Compute all deterministic planning metrics using scientific formulas
   * These metrics ground the AI generation in evidence-based calculations
   */
  private async computePlanningMetrics(userProfile: UserProfile): Promise<PlanningMetrics> {
    console.log('🧮 Computing planning metrics...');

    // Calculate Basal Metabolic Rate using Katch-McArdle equation
    const bmr = await dynamicCalculator.calculateBMR(userProfile);
    
    // Calculate Total Daily Energy Expenditure based on activity level
    const tdee = await dynamicCalculator.calculateTDEE(userProfile, bmr.value);
    
    // Calculate Body Mass Index for health reference
    const bmi = await dynamicCalculator.calculateBMI(userProfile);
    
    // Calculate macro targets (protein, carbs, fat) based on goals
    const macros = await dynamicCalculator.calculateMacroTargets(
      userProfile,
      tdee.value,
      userProfile.goal
    );
    
    // Calculate safe fat loss rate based on body composition
    const fatLoss = await dynamicCalculator.calculateFatLossRate(userProfile);
    
    // Calculate optimal training volume (sets per muscle group)
    const trainingVolume = await dynamicCalculator.calculateTrainingVolume(
      userProfile,
      userProfile.goal
    );
    
    // Calculate daily water requirements
    const water = await dynamicCalculator.calculateWaterRequirement(userProfile);

    console.log('✅ Planning metrics computed successfully');
    
    return { bmr, tdee, bmi, macros, fatLoss, trainingVolume, water };
  }

  // -------------------------------------------------------------------------
  // Phase 1: Feasibility Assessment
  // -------------------------------------------------------------------------

  /**
   * Assess the feasibility of user's fitness goals based on evidence-based limits
   * Validates timeline against safe fat loss rates and provides recommendations
   */
  async generateFeasibilityAssessment(userProfile: UserProfile): Promise<FeasibilityResult> {
    console.log('📊 Assessing goal feasibility...');
    
    // Compute deterministic metrics first to ground the assessment
    const metrics = await this.computePlanningMetrics(userProfile);
    
    // Search for relevant research on goal feasibility
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} ${userProfile.workoutLevel} ${userProfile.timelineWeeks} weeks`,
      'training'
    );

    // Calculate evidence-based feasibility thresholds
    const maxSafeFatLoss = userProfile.weightKg * FAT_LOSS_LIMITS.MAX_SAFE_WEEKLY_PERCENTAGE;
    const currentFatLossTarget = userProfile.weightKg * FAT_LOSS_LIMITS.TARGET_WEEKLY_PERCENTAGE;
    const bodyFatToLose = userProfile.bodyFat 
      ? userProfile.bodyFat - (userProfile.targetBf || 15) 
      : 0;
    
    // Calculate minimum safe timeline
    const minWeeksForGoal = bodyFatToLose > 0 
      ? Math.ceil(bodyFatToLose / maxSafeFatLoss) 
      : 4; // Minimum 4 weeks for any fitness goal
    
    const isTimelineRealistic = userProfile.timelineWeeks >= minWeeksForGoal;

    const prompt = `
Based on the following user profile, deterministic calculations, and scientific research, 
assess the feasibility of their fitness goal:

USER PROFILE:
- Age: ${userProfile.age}, Sex: ${userProfile.sex}
- Weight: ${userProfile.weightKg} kg, Height: ${userProfile.heightCm} cm
- Body Fat: ${userProfile.bodyFat || 'unknown'}% → Target: ${userProfile.targetBf || 15}%
- Goal: ${userProfile.goal}
- Timeline: ${userProfile.timelineWeeks} weeks
- Experience: ${userProfile.workoutLevel}
- Training: ${userProfile.trainingDaysPerWeek} days/week

DETERMINISTIC CALCULATIONS:
- BMR: ${metrics.bmr.value} kcal (${metrics.bmr.formula})
- TDEE: ${metrics.tdee.value} kcal (${metrics.tdee.formula})
- Safe fat-loss rate: ${maxSafeFatLoss.toFixed(2)} kg/week (evidence limit)
- Current target: ${currentFatLossTarget.toFixed(2)} kg/week
- Minimum weeks needed: ${minWeeksForGoal} weeks
- Timeline realistic: ${isTimelineRealistic ? 'YES' : 'NO'}

SCIENTIFIC CONTEXT:
${this.formatFacts(relevantKnowledge)}

ASSESSMENT REQUIREMENTS:
1. Timeline MUST be at least ${minWeeksForGoal} weeks for safe fat loss
2. Fat-loss rate MUST NOT exceed ${maxSafeFatLoss.toFixed(2)} kg/week
3. If timeline unrealistic, suggest minimum safe timeline
4. Flag any extreme protocols or assumptions

Provide evidence-based assessment with specific calculations.
`;

    // Generate feasibility assessment
    const result = await this.generateWithFallback<FeasibilityResult>(
      FeasibilitySchema,
      prompt,
      'feasibility assessment'
    );
    
    // Add evidence limits to result
    return {
      ...result,
      alternativeTimeline: `${minWeeksForGoal} weeks`,
      optimisticOutlook: isTimelineRealistic 
        ? `With ${userProfile.timelineWeeks} weeks of consistent effort, you can safely achieve significant progress!`
        : `A safe ${minWeeksForGoal}-week timeline will help you achieve sustainable results!`,
      evidenceLimits: {
        maxFatLossPerWeek: maxSafeFatLoss,
        minWeeksRequired: minWeeksForGoal,
        calculatedMetrics: {
          bmr: metrics.bmr.value,
          tdee: metrics.tdee.value,
          fatLossRate: currentFatLossTarget
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Phase 2: Weekly Outlines Generation
  // -------------------------------------------------------------------------

  /**
   * Generate detailed weekly outlines with progressive targets for all weeks
   * Includes training schedule, nutrition targets, and cardio protocols
   */
  async generateDetailedWeeklyOutlines(
    userProfile: UserProfile, 
    metrics: PlanningMetrics
  ): Promise<any[]> {
    console.log('📅 Creating detailed weekly outlines...');
    
    // Search for relevant research on progression and periodization
    const nutritionKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} fat loss progression weekly targets macro cycling cardio`,
      'nutrition'
    );

    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} training progression volume intensity weekly`,
      'training'
    );

    // Calculate progression parameters
    const currentBF = userProfile.bodyFat || 22;
    const targetBF = userProfile.targetBf || 10;
    const bfToLose = currentBF - targetBF;
    const totalWeeks = userProfile.timelineWeeks;
    const weeklyBFReduction = bfToLose / totalWeeks;
    
    // Calculate progressive calorie deficit
    const startingDeficit = metrics.tdee.value * CALORIC_DEFICIT_RANGES.MODERATE_START;
    const maxDeficit = metrics.tdee.value * CALORIC_DEFICIT_RANGES.MODERATE_MAX;
    const deficitIncrease = totalWeeks > 1 
      ? (maxDeficit - startingDeficit) / (totalWeeks - 1) 
      : 0;

    const prompt = `
Create detailed weekly outlines for ALL ${totalWeeks} weeks of this ${userProfile.goal} journey:

USER PROFILE:
- Current: ${currentBF}% BF → Target: ${targetBF}% BF (${bfToLose}% to lose)
- Timeline: ${totalWeeks} weeks (${weeklyBFReduction.toFixed(2)}% BF reduction/week)
- Weight: ${userProfile.weightKg}kg
- Training: ${userProfile.trainingDaysPerWeek} days/week
- Meals: ${userProfile.mealFrequency} per day
${userProfile.schedule ? `- Schedule: ${userProfile.schedule}` : ''}

SCIENTIFIC CALCULATIONS:
- BMR: ${metrics.bmr.value} kcal, TDEE: ${metrics.tdee.value} kcal
- Starting calories: ${Math.round(metrics.tdee.value - startingDeficit)} kcal
- Progressive deficit: +${deficitIncrease.toFixed(0)} kcal/week
- Protein: ${metrics.macros.protein}g (${(metrics.macros.protein / userProfile.weightKg).toFixed(2)}g/kg)
- Fat loss rate: ${metrics.fatLoss.value.toFixed(2)} kg/week

RESEARCH CONTEXT:
${this.formatFacts([...nutritionKnowledge, ...trainingKnowledge])}

PROGRESSIVE STRUCTURE:
- Weeks 1-${Math.ceil(totalWeeks * PHASE_DISTRIBUTION.FOUNDATION_END)}: Foundation (establish patterns)
- Weeks ${Math.ceil(totalWeeks * PHASE_DISTRIBUTION.FOUNDATION_END) + 1}-${Math.ceil(totalWeeks * PHASE_DISTRIBUTION.PROGRESSION_END)}: Progression (increase intensity)
- Weeks ${Math.ceil(totalWeeks * PHASE_DISTRIBUTION.PROGRESSION_END) + 1}-${totalWeeks}: Peak (maximum effort)

For EACH of the ${totalWeeks} weeks, provide:
1. Week number and phase
2. Daily calorie and macro targets (progressive)
3. Training schedule (resistance days, cardio days, rest days)
4. Cardio protocol (type, duration, intensity)
5. Key objectives and expected outcomes
6. Adjustments from previous week

CRITICAL: Generate outlines for ALL ${totalWeeks} weeks, numbered 1 through ${totalWeeks}.
`;

    const result = await this.generateWithFallback<{ weeklyOutlines: any[] }>(
      z.object({
        weeklyOutlines: z.array(WeeklyOutlineSchema)
      }),
      prompt,
      'weekly outlines'
    );

    // Validate we got all weeks
    if (!result.weeklyOutlines || result.weeklyOutlines.length !== totalWeeks) {
      throw new Error(
        `Failed to generate all weekly outlines. Expected ${totalWeeks} weeks, ` +
        `got ${result.weeklyOutlines?.length || 0} weeks.`
      );
    }

    // Validate week numbers are sequential
    const weekNumbers = result.weeklyOutlines.map(w => w.weekNumber).sort((a, b) => a - b);
    const missingWeeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
      .filter(week => !weekNumbers.includes(week));
    
    if (missingWeeks.length > 0) {
      throw new Error(
        `Missing weekly outlines for weeks: ${missingWeeks.join(', ')}. ` +
        `Expected weeks 1-${totalWeeks}.`
      );
    }

    console.log(`✅ Generated ${result.weeklyOutlines.length} weekly outlines`);
    return result.weeklyOutlines;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Strategic Framework Generation
  // -------------------------------------------------------------------------

  /**
   * Generate phase-aware strategic framework for training and nutrition
   * Creates a high-level plan with periodization strategies
   */
  async generatePhaseAwareFramework(
    userProfile: UserProfile, 
    metrics: PlanningMetrics
  ): Promise<any> {
    console.log('🎯 Generating phase-aware strategic framework...');
    
    // Search for relevant training and nutrition research
    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.workoutSplit} ${userProfile.workoutLevel} periodization phases`,
      'training'
    );

    const nutritionKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} nutrition macro cycling phases`,
      'nutrition'
    );

    const prompt = `
Create a phase-aware strategic framework based on scientific research:

USER PROFILE:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.workoutLevel}
- Split: ${userProfile.workoutSplit}
- Training: ${userProfile.trainingDaysPerWeek} days/week
- Timeline: ${userProfile.timelineWeeks} weeks

METRICS:
- BMR: ${metrics.bmr.value} kcal (${metrics.bmr.formula})
- TDEE: ${metrics.tdee.value} kcal (${metrics.tdee.formula})
- Protein: ${metrics.macros.protein}g (${(metrics.macros.protein / userProfile.weightKg).toFixed(2)}g/kg)
- Fat loss: ${metrics.fatLoss.value.toFixed(2)} kg/week
- Training volume: ${metrics.trainingVolume.value} sets/muscle/week

RESEARCH CONTEXT:
${this.formatFacts([...trainingKnowledge, ...nutritionKnowledge])}

REQUIREMENTS:
1. Create a personalized, compelling plan name (3-6 words) that reflects:
   - User's goal: ${userProfile.goal}
   - Training approach: ${userProfile.workoutSplit}
   - Timeline: ${userProfile.timelineWeeks} weeks
   - Must be motivating and specific (NOT generic like "Basic Program")

2. Define 3 distinct training phases:
   - Foundation Phase (weeks 1-${Math.ceil(userProfile.timelineWeeks * PHASE_DISTRIBUTION.FOUNDATION_END)})
   - Progression Phase (weeks ${Math.ceil(userProfile.timelineWeeks * PHASE_DISTRIBUTION.FOUNDATION_END) + 1}-${Math.ceil(userProfile.timelineWeeks * PHASE_DISTRIBUTION.PROGRESSION_END)})
   - Peak Phase (weeks ${Math.ceil(userProfile.timelineWeeks * PHASE_DISTRIBUTION.PROGRESSION_END) + 1}-${userProfile.timelineWeeks})

3. For each phase, specify:
   - Training modifications (volume, intensity)
   - Nutrition adjustments (calorie cycling, macro distribution)
   - Recovery protocols
   - Progression markers

Return structured JSON with planName and phase-specific strategies.
`;

    return this.generateWithFallback(
      StrategicFrameworkSchema,
      prompt,
      'strategic framework'
    );
  }

  // -------------------------------------------------------------------------
  // Phase 4: Exercise Library Generation
  // -------------------------------------------------------------------------

  /**
   * Generate phase-specific exercise libraries with progressions
   * Creates exercises appropriate for each training phase
   */
  async generatePhaseExerciseLibraries(
    userProfile: UserProfile,
    framework: any,
    metrics: PlanningMetrics
  ): Promise<any[]> {
    console.log('💪 Building phase-specific exercise libraries...');
    
    const split = framework?.trainingApproach?.split || userProfile.workoutSplit;
    const equipment = userProfile.equipment;
    
    // Search for relevant exercise research
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${equipment} ${split} exercises progression`,
      'training'
    );

    const prompt = `
Generate phase-specific exercise libraries:

USER PROFILE:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${equipment}
- Split: ${split}
- Weekly sets/muscle: ${metrics.trainingVolume.value}

RESEARCH CONTEXT:
${this.formatFacts(relevantKnowledge)}

Create 15-20 exercises distributed across 3 phases:

FOUNDATION PHASE (5-7 exercises):
- Focus: Movement patterns, form, baseline strength
- Difficulty: Beginner to intermediate
- Exercise IDs: F1, F2, F3, etc.

PROGRESSION PHASE (5-7 exercises):
- Focus: Increased complexity and intensity
- Difficulty: Intermediate to advanced
- Exercise IDs: P1, P2, P3, etc.

PEAK PHASE (5-6 exercises):
- Focus: Advanced techniques, maximum intensity
- Difficulty: Advanced
- Exercise IDs: Pe1, Pe2, Pe3, etc.

Each exercise must include:
- Unique exercise ID (F1-F7, P1-P7, Pe1-Pe6)
- Name, muscle groups, equipment needed
- Difficulty level appropriate for phase
- 3-5 form cues
- 2-3 progression options
- 2-3 regression options
- Contraindications and safety notes

CRITICAL: Cover all major muscle groups: chest, back, legs, shoulders, arms, core.
`;

    const result = await this.generateWithFallback<{ exercises: any[] }>(
      z.object({
        exercises: z.array(ExerciseSchema)
      }),
      prompt,
      'exercise libraries'
    );

    if (!result.exercises || result.exercises.length === 0) {
      throw new Error('Failed to generate exercise libraries. No exercises returned.');
    }

    console.log(`✅ Generated ${result.exercises.length} exercises`);
    return result.exercises;
  }

  // -------------------------------------------------------------------------
  // Phase 5: Session Template Generation
  // -------------------------------------------------------------------------

  /**
   * Generate phase-specific workout session templates
   * Creates structured workout plans for each training phase
   */
  async generatePhaseSessionTemplates(
    userProfile: UserProfile,
    exerciseLibraries: any[],
    framework: any,
    metrics: PlanningMetrics,
    weeklyOutlines?: any[]
  ): Promise<any[]> {
    console.log('📅 Creating phase-specific session templates...');
    
    // Validate we have exercises to work with
    if (!exerciseLibraries || exerciseLibraries.length === 0) {
      throw new Error('Cannot generate session templates without exercise libraries.');
    }

    const split = framework?.trainingApproach?.split || userProfile.workoutSplit;
    const frequency = framework?.trainingApproach?.frequencyPerWeek || userProfile.trainingDaysPerWeek;
    const duration = framework?.trainingApproach?.sessionDurationMinutes || 60;
    
    // Organize exercises by phase based on ID prefixes
    const exercisesByPhase = this.organizeExercisesByPhase(exerciseLibraries);
    
    // Search for session structure research
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${split} session structure volume progression`,
      'training'
    );

    // Calculate sessions needed per phase
    const sessionsPerPhase = this.calculateSessionsForSplit(split, frequency);

    const prompt = `
You are an expert strength coach creating phase-specific workout sessions.

TRAINING PARAMETERS:
- Split: ${split}
- Frequency: ${frequency} days/week
- Duration: ${duration} minutes/session
- Experience: ${userProfile.workoutLevel}
- Weekly sets/muscle: ${metrics.trainingVolume.value}
${userProfile.schedule ? `- Available times: ${userProfile.schedule}` : ''}

AVAILABLE EXERCISES BY PHASE:

FOUNDATION PHASE (${exercisesByPhase.foundation.length} exercises):
${exercisesByPhase.foundation.map(ex => 
  `- ${ex.exerciseId}: ${ex.name} (${ex.muscleGroups?.join(', ')})`
).join('\n')}

PROGRESSION PHASE (${exercisesByPhase.progression.length} exercises):
${exercisesByPhase.progression.map(ex => 
  `- ${ex.exerciseId}: ${ex.name} (${ex.muscleGroups?.join(', ')})`
).join('\n')}

PEAK PHASE (${exercisesByPhase.peak.length} exercises):
${exercisesByPhase.peak.map(ex => 
  `- ${ex.exerciseId}: ${ex.name} (${ex.muscleGroups?.join(', ')})`
).join('\n')}

RESEARCH CONTEXT:
${this.formatFacts(relevantKnowledge)}

${weeklyOutlines ? `WEEKLY SCHEDULES:\n${this.formatWeeklySchedules(weeklyOutlines)}` : ''}

YOUR TASK:
Create ${sessionsPerPhase} session templates PER PHASE (${sessionsPerPhase * 3} total):

1. FOUNDATION PHASE (${sessionsPerPhase} templates):
   - Use ONLY Foundation exercises (F1, F2, etc.)
   - Template IDs: foundation_day1, foundation_day2, etc.
   - Lower intensity (60-70%), higher reps (8-12), longer rest (90-120s)
   - Focus on form and movement patterns

2. PROGRESSION PHASE (${sessionsPerPhase} templates):
   - Use Progression exercises (can include Foundation)
   - Template IDs: progression_day1, progression_day2, etc.
   - Moderate intensity (70-80%), moderate reps (6-10), moderate rest (60-90s)
   - Focus on progressive overload

3. PEAK PHASE (${sessionsPerPhase} templates):
   - Use Peak exercises (can include Progression)
   - Template IDs: peak_day1, peak_day2, etc.
   - High intensity (80-90%), lower reps (4-8), shorter rest (45-60s)
   - Advanced techniques and maximum intensity

Each session must:
- Have unique templateId and descriptive name
- Target appropriate muscles for the split
- Total ~${duration} minutes including rest
- Use valid exercise IDs from the lists above
- Include sets, reps, rest periods, and notes

CRITICAL: Generate ALL ${sessionsPerPhase * 3} session templates.
`;

    const result = await this.generateWithFallback<{ sessions: any[] }>(
      z.object({
        sessions: z.array(SessionTemplateSchema)
      }),
      prompt,
      'session templates'
    );

    // Validate session generation
    if (!result.sessions || result.sessions.length === 0) {
      throw new Error(
        'Failed to generate session templates. The workout plan cannot be completed ' +
        'without session templates.'
      );
    }

    // Log phase distribution for debugging
    const phaseCount = this.countSessionsByPhase(result.sessions);
    console.log(
      `✅ Generated ${result.sessions.length} session templates ` +
      `(Foundation: ${phaseCount.foundation}, Progression: ${phaseCount.progression}, ` +
      `Peak: ${phaseCount.peak})`
    );

    return result.sessions;
  }

  /**
   * Organize exercises by phase based on ID prefixes
   */
  private organizeExercisesByPhase(exercises: any[]): {
    foundation: any[];
    progression: any[];
    peak: any[];
  } {
    const byPhase = {
      foundation: exercises.filter(ex => ex.exerciseId?.startsWith('F')),
      progression: exercises.filter(ex => 
        ex.exerciseId?.startsWith('P') && !ex.exerciseId?.startsWith('Pe')
      ),
      peak: exercises.filter(ex => ex.exerciseId?.startsWith('Pe'))
    };

    // If no phase-specific exercises, distribute evenly
    if (byPhase.foundation.length === 0 && 
        byPhase.progression.length === 0 && 
        byPhase.peak.length === 0) {
      const third = Math.floor(exercises.length / 3);
      byPhase.foundation = exercises.slice(0, third);
      byPhase.progression = exercises.slice(third, third * 2);
      byPhase.peak = exercises.slice(third * 2);
    }

    return byPhase;
  }

  /**
   * Calculate number of sessions needed based on split type and frequency
   */
  private calculateSessionsForSplit(split: string, frequency: number): number {
    const lowerSplit = split.toLowerCase();
    
    // Different splits have different session needs
    if (lowerSplit.includes('full_body') || lowerSplit === 'full_body') {
      return frequency; // Usually 3 sessions
    }
    if (lowerSplit.includes('ppl') || lowerSplit === 'push_pull_legs') {
      return frequency; // Usually 3-6 sessions
    }
    if (lowerSplit.includes('upper_lower')) {
      return frequency; // Usually 4 sessions
    }
    if (lowerSplit.includes('bodypart') || lowerSplit.includes('bro')) {
      return frequency; // Usually 4-6 sessions
    }
    
    return frequency; // Default to frequency
  }

  /**
   * Count sessions by phase for validation
   */
  private countSessionsByPhase(sessions: any[]): {
    foundation: number;
    progression: number;
    peak: number;
  } {
    return {
      foundation: sessions.filter(s => 
        s.templateId?.toLowerCase().includes('foundation') ||
        s.name?.toLowerCase().includes('foundation')
      ).length,
      progression: sessions.filter(s => 
        s.templateId?.toLowerCase().includes('progression') ||
        s.name?.toLowerCase().includes('progression')
      ).length,
      peak: sessions.filter(s => 
        s.templateId?.toLowerCase().includes('peak') ||
        s.name?.toLowerCase().includes('peak')
      ).length
    };
  }

  /**
   * Format weekly schedules for prompt context
   */
  private formatWeeklySchedules(weeklyOutlines: any[]): string {
    return weeklyOutlines.slice(0, 4).map(week => `
Week ${week.weekNumber} (${week.phase}):
- Training: ${week.trainingSchedule?.resistanceDays?.join(', ') || 'N/A'}
- Cardio: ${week.trainingSchedule?.cardioDays?.join(', ') || 'N/A'}
- Focus: ${week.trainingSchedule?.focusAreas?.join(', ') || 'N/A'}
    `.trim()).join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Phase 6: Meal Template Generation
  // -------------------------------------------------------------------------

  /**
   * Generate phase-specific meal templates with macro cycling
   * Creates weekly meal plans that match daily calorie targets
   */
  async generatePhaseMealTemplates(
    userProfile: UserProfile,
    _framework: any,
    metrics: PlanningMetrics,
    weeklyOutlines?: any[]
  ): Promise<any[][]> {
    console.log('🍽️ Designing phase-specific meal templates...');
    
    if (!weeklyOutlines || weeklyOutlines.length === 0) {
      console.warn('⚠️ No weekly outlines provided for meal generation');
      return [];
    }

    // Split weeks into phases to avoid token limits
    const phases = {
      foundation: weeklyOutlines.filter(week => week.phase === 'Foundation'),
      progression: weeklyOutlines.filter(week => week.phase === 'Progression'),
      peak: weeklyOutlines.filter(week => week.phase === 'Peak')
    };

    console.log(
      `📊 Generating meals for phases: ` +
      `Foundation(${phases.foundation.length}w), ` +
      `Progression(${phases.progression.length}w), ` +
      `Peak(${phases.peak.length}w)`
    );

    const allCombinations: any[] = [];

    // Generate meals for each phase separately
    for (const [phaseName, phaseWeeks] of Object.entries(phases)) {
      if (phaseWeeks.length === 0) continue;
      
      const phaseCombinations = await this.generatePhaseMealCombinations(
        userProfile,
        metrics,
        phaseWeeks,
        phaseName
      );
      
      allCombinations.push(...phaseCombinations);
    }

    // Group combinations by week for return format
    const combinationsByWeek: { [key: number]: any[] } = {};
    allCombinations.forEach(combo => {
      if (!combinationsByWeek[combo.weekNumber]) {
        combinationsByWeek[combo.weekNumber] = [];
      }
      combinationsByWeek[combo.weekNumber].push(combo);
    });

    console.log(
      `✅ Generated ${allCombinations.length} total meal combinations ` +
      `across ${Object.keys(combinationsByWeek).length} weeks`
    );
    
    return Object.values(combinationsByWeek);
  }

  /**
   * Generate meal combinations for a specific phase
   * Uses Groq's advanced features if available, otherwise standard generation
   */
  private async generatePhaseMealCombinations(
    userProfile: UserProfile,
    metrics: PlanningMetrics,
    phaseWeeks: any[],
    phaseName: string
  ): Promise<any[]> {
    console.log(`🧠 Generating ${phaseName} phase meals...`);
    
    // Try Groq's advanced meal generation if available
    if (this.mealGenerationService) {
      try {
        return await this.generatePhaseMealCombinationsWithGroq(
          userProfile,
          metrics,
          phaseWeeks,
          phaseName
        );
      } catch (error) {
        console.warn(
          `⚠️ Groq meal generation failed for ${phaseName}, ` +
          `using standard method:`,
          error
        );
        // Fall through to standard generation
      }
    }

    // Standard meal generation (when Groq unavailable)
    return this.generatePhaseMealCombinationsStandard(
      userProfile,
      metrics,
      phaseWeeks,
      phaseName
    );
  }

  /**
   * Generate meals using Groq's advanced reasoning capabilities
   */
  private async generatePhaseMealCombinationsWithGroq(
    userProfile: UserProfile,
    metrics: PlanningMetrics,
    phaseWeeks: any[],
    phaseName: string
  ): Promise<any[]> {
    if (!this.mealGenerationService) {
      throw new Error('Meal generation service not available');
    }

    console.log(`🔬 Using Groq Mixtral for ${phaseName} phase meals...`);
    
    const weeklyTemplates = await this.mealGenerationService.generateMealTemplatesWithGroq({
      userProfile,
      metrics,
      phaseWeeks,
      phaseName,
      onReasoningUpdate: (reasoning, mode) => {
        this.emitProgressWithReasoning(
          'meals',
          mode === 'thinking' ? 40 : mode === 'formatting' ? 60 : 80,
          mode === 'thinking' 
            ? 'Analyzing nutrition requirements...'
            : mode === 'formatting'
            ? 'Creating structured output...'
            : 'Meal generation complete',
          reasoning,
          mode
        );
      }
    });

    // Convert weekly templates to daily combinations format
    const dailyCombinations: any[] = [];
    
    weeklyTemplates.forEach((template: any) => {
      // Create 7 daily combinations (one per day) using same meals
      for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
        dailyCombinations.push({
          weekNumber: template.weekNumber,
          dayNumber: dayNumber,
          totalCalories: template.totalCalories,
          totalProtein: template.totalProtein,
          totalCarbs: template.totalCarbs,
          totalFat: template.totalFat,
          meals: template.meals
        });
      }
    });

    console.log(
      `✅ Generated ${dailyCombinations.length} daily combinations ` +
      `for ${phaseName} phase`
    );
    
    return dailyCombinations;
  }

  /**
   * Standard meal generation method (fallback when Groq unavailable)
   */
  private async generatePhaseMealCombinationsStandard(
    userProfile: UserProfile,
    metrics: PlanningMetrics,
    phaseWeeks: any[],
    phaseName: string
  ): Promise<any[]> {
    console.log(`📝 Using standard generation for ${phaseName} phase meals...`);
    
    // Build comprehensive meal prompt with constraints
    const promptProfile: PromptUserProfile = {
      ...userProfile,
      preferences: userProfile.preferences ?? 'Flexible (no restrictions)',
    };

    const prompt = buildMealPrompt(promptProfile, metrics) + `

${phaseName.toUpperCase()} PHASE - WEEKLY OUTLINES:
${phaseWeeks.map(week => `
Week ${week.weekNumber} (${week.phase}):
- Daily Calories: ${week.dailyTargets.calories} kcal
- Daily Protein: ${week.dailyTargets.protein}g (${week.dailyTargets.proteinPerKg}g/kg)
- Daily Carbs: ${week.dailyTargets.carbs}g
- Daily Fat: ${week.dailyTargets.fat}g
- Focus: ${week.objectives?.join(', ')}
`).join('\n')}

CRITICAL REQUIREMENTS:
Generate weekly meal templates for ALL ${phaseWeeks.length} weeks where meals 
sum to EXACT daily calorie targets.

MEAL FREQUENCY: ${userProfile.mealFrequency} meals/day

For EACH of the ${phaseWeeks.length} weeks:
1. Generate exactly ${userProfile.mealFrequency} unique meals
2. All meals must sum to EXACTLY the daily calorie target (±${VALIDATION_TOLERANCES.CALORIE_PERCENTAGE * 100}%)
3. Protein, carbs, and fat must also match daily targets
4. Each week must have unique weekNumber

CALORIE DISTRIBUTION PER MEAL TYPE:
${this.buildMealDistribution(userProfile.mealFrequency, phaseWeeks[0]?.dailyTargets?.calories || 2000)}

NUTRITIONAL ACCURACY REQUIREMENTS:
- Research ACTUAL data from USDA FoodData Central
- Provide exact weights/volumes (e.g., "100g chicken breast", "150g avocado")
- Calculate precise macros by summing ingredient nutrition
- Use verified databases, not estimates
- Ensure meal macros = sum of ingredient macros

PHASE-SPECIFIC VARIATIONS:
${this.getPhaseNutritionGuidance(phaseName)}

Return structured weekly meal templates with researched nutritional data for 
ALL ${phaseWeeks.length} weeks.
`;

    const result = await this.generateWithFallback<{ weeklyMealTemplates: any[] }>(
      z.object({
        weeklyMealTemplates: z.array(WeeklyMealTemplateSchema)
      }),
      prompt,
      `${phaseName} meal templates`
    );

    // Validate meal generation
    this.validateMealTemplates(result.weeklyMealTemplates, phaseWeeks, userProfile);

    // Validate nutritional accuracy
    this.validateNutritionalAccuracy(result.weeklyMealTemplates);

    // Validate dietary compliance
    this.validateDietaryCompliance(result.weeklyMealTemplates, userProfile, metrics);

    // Convert to daily combinations format
    return this.convertToDailyCombinations(result.weeklyMealTemplates);
  }

  /**
   * Build meal calorie distribution based on meal frequency
   */
  private buildMealDistribution(mealFrequency: number, dailyCalories: number): string {
    const distributions: { [key: number]: { [meal: string]: number } } = {
      3: {
        'Breakfast': 0.35,
        'Lunch': 0.40,
        'Dinner': 0.25
      },
      4: {
        'Breakfast': 0.30,
        'Lunch': 0.35,
        'Dinner': 0.25,
        'Evening Snack': 0.10
      },
      5: {
        'Breakfast': 0.25,
        'Mid-Morning Snack': 0.10,
        'Lunch': 0.30,
        'Mid-Afternoon Snack': 0.10,
        'Dinner': 0.20,
        'Evening Snack': 0.05
      }
    };

    const distribution = distributions[mealFrequency] || distributions[4];
    
    return Object.entries(distribution)
      .map(([meal, percentage]) => 
        `- ${meal}: ${(percentage * 100).toFixed(0)}% (~${Math.round(dailyCalories * percentage)} cal)`
      )
      .join('\n');
  }

  /**
   * Get phase-specific nutrition guidance
   */
  private getPhaseNutritionGuidance(phaseName: string): string {
    const guidance: { [key: string]: string } = {
      foundation: 'Foundation Phase: Establish eating patterns, moderate deficits, focus on compliance',
      progression: 'Progression Phase: Increase deficit gradually, optimize meal timing around training',
      peak: 'Peak Phase: Maximum deficit, strategic carb cycling, precision timing'
    };

    return guidance[phaseName.toLowerCase()] || guidance.foundation;
  }

  /**
   * Validate meal templates match expectations
   */
  private validateMealTemplates(
    templates: any[],
    phaseWeeks: any[],
    userProfile: UserProfile
  ): void {
    // Check we got templates for all weeks
    if (!templates || templates.length === 0) {
      throw new Error('No meal templates generated');
    }

    if (templates.length !== phaseWeeks.length) {
      throw new Error(
        `Generated ${templates.length} meal templates, expected ${phaseWeeks.length}`
      );
    }

    // Validate each week
    templates.forEach(template => {
      const expectedMeals = userProfile.mealFrequency;
      const actualMeals = template.meals?.length || 0;
      
      if (actualMeals !== expectedMeals) {
        throw new Error(
          `Week ${template.weekNumber} has ${actualMeals} meals, ` +
          `expected ${expectedMeals} (mealFrequency: ${userProfile.mealFrequency})`
        );
      }

      // Validate calorie matching
      const weekOutline = phaseWeeks.find(w => w.weekNumber === template.weekNumber);
      if (weekOutline) {
        const totalCalories = template.meals?.reduce(
          (sum: number, meal: any) => sum + (meal.calories || 0),
          0
        ) || 0;
        
        const targetCalories = weekOutline.dailyTargets.calories;
        const caloriesDiff = Math.abs(totalCalories - targetCalories);
        const tolerance = targetCalories * VALIDATION_TOLERANCES.CALORIE_PERCENTAGE;
        
        if (caloriesDiff > tolerance) {
          throw new Error(
            `Week ${template.weekNumber} meals total ${totalCalories} cal, ` +
            `target is ${targetCalories} cal (diff: ${caloriesDiff} cal, ` +
            `tolerance: ${tolerance} cal)`
          );
        }

        // Validate protein matching
        const totalProtein = template.meals?.reduce(
          (sum: number, meal: any) => sum + (meal.protein || 0),
          0
        ) || 0;
        
        const targetProtein = weekOutline.dailyTargets.protein;
        const proteinDiff = Math.abs(totalProtein - targetProtein);
        const proteinTolerance = targetProtein * VALIDATION_TOLERANCES.PROTEIN_PERCENTAGE;
        
        if (proteinDiff > proteinTolerance) {
          throw new Error(
            `Week ${template.weekNumber} meals total ${totalProtein}g protein, ` +
            `target is ${targetProtein}g (diff: ${proteinDiff}g, ` +
            `tolerance: ${proteinTolerance}g)`
          );
        }
      }
    });

    console.log(`✅ All ${templates.length} meal templates validated`);
  }

  /**
   * Validate nutritional accuracy of ingredients
   */
  private validateNutritionalAccuracy(templates: any[]): void {
    console.log('🔬 Validating nutritional accuracy...');
    
    const allMeals = templates.flatMap(template => template.meals || []);
    
    allMeals.forEach(meal => {
      if (meal && meal.recipe?.ingredients) {
        const ingredientValidation = NutritionalResearchService.validateIngredientData(
          meal.recipe.ingredients
        );
        
        if (!ingredientValidation.isValid) {
          console.warn(
            `⚠️ Meal "${meal.recipe.name}" has ingredient issues:`,
            ingredientValidation.issues
          );
        }

        const macroValidation = NutritionalResearchService.validateMealMacros(meal);
        
        if (!macroValidation.isValid) {
          console.warn(
            `⚠️ Meal "${meal.recipe.name}" has macro calculation issues:`,
            macroValidation.discrepancies
          );
        }
      }
    });
  }

  /**
   * Validate dietary compliance (allergies, preferences, restrictions)
   */
  private validateDietaryCompliance(
    templates: any[],
    userProfile: UserProfile,
    metrics: PlanningMetrics
  ): void {
    console.log('✅ Validating dietary compliance...');
    
    const allMeals = templates.flatMap(template => 
      template.meals?.map((meal: any) => meal) || []
    );

    // Skip if no meals to validate
    if (allMeals.length === 0) return;

    const validation = validateMealCompliance(
      allMeals,
      userProfile.preferences,
      metrics
    );

    if (!validation.isCompliant) {
      console.warn('⚠️ Meal compliance violations:', validation.violations);
      
      // Only throw if violations are critical
      if (validation.requiresRegeneration) {
        throw new Error(
          'Critical dietary compliance violations detected: ' +
          validation.violations.join('; ')
        );
      }
    }
  }

  /**
   * Convert weekly meal templates to daily combinations
   */
  private convertToDailyCombinations(weeklyTemplates: any[]): any[] {
    const dailyCombinations: any[] = [];
    
    weeklyTemplates.forEach(template => {
      // Create 7 daily combinations (one for each day) using same meals
      for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
        dailyCombinations.push({
          weekNumber: template.weekNumber,
          dayNumber: dayNumber,
          totalCalories: template.totalCalories,
          totalProtein: template.totalProtein,
          totalCarbs: template.totalCarbs,
          totalFat: template.totalFat,
          meals: template.meals
        });
      }
    });

    return dailyCombinations;
  }

  // -------------------------------------------------------------------------
  // Phase 7: Shopping List Generation
  // -------------------------------------------------------------------------

  /**
   * Generate comprehensive shopping lists with cost estimation
   * Uses Groq's advanced reasoning for accurate Canadian pricing
   */
  async generateShoppingListWithGroq(
    phaseMealTemplates: any[][],
    weeklyOutlines: any[],
    userProfile: UserProfile
  ): Promise<any> {
    if (!this.shoppingListGenerationService) {
      throw new Error(
        'Shopping list generation service not available. ' +
        'Cannot generate shopping lists.'
      );
    }

    try {
      console.log('🛒 Generating shopping lists with Groq cost estimation...');
      
      const result = await this.shoppingListGenerationService.generateShoppingListsWithGroq({
        phaseMealTemplates,
        weeklyOutlines,
        userProfile,
        onReasoningUpdate: (reasoning, mode) => {
          this.emitProgressWithReasoning(
            'shopping',
            mode === 'thinking' ? 80 : mode === 'formatting' ? 85 : 90,
            mode === 'thinking' 
              ? '💰 Analyzing ingredient costs...'
              : mode === 'formatting'
              ? '📋 Creating shopping lists...'
              : '✅ Shopping lists complete',
            reasoning,
            mode
          );
        }
      });
      
      return result;
    } catch (error) {
      console.error('❌ Shopping list generation failed:', error);
      throw new Error(
        `Failed to generate shopping lists: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Main Plan Generation Orchestrator
  // -------------------------------------------------------------------------

  /**
   * Generate complete phase-aware fitness plan
   * Orchestrates all generation steps with progress tracking
   */
  async generatePhaseAwarePlan(
    userProfile: UserProfile,
    progressCallback?: ProgressCallback
  ): Promise<any> {
    console.log('🚀 Starting phase-aware fitness plan generation...');
    console.log('👤 User Profile:', JSON.stringify(userProfile, null, 2));

    // Store progress callback for use in sub-methods
    this.onProgressUpdate = progressCallback;

    try {
      // -----------------------------------------------------------------------
      // Step 1: Feasibility Assessment (0-15%)
      // -----------------------------------------------------------------------
      console.log('📊 Step 1/7: Assessing goal feasibility...');
      this.emitProgress(
        'feasibility',
        15,
        'Assessing goal feasibility with evidence-based limits...',
        [
          'Analyzing user goals against scientific evidence',
          'Checking timeline feasibility',
          'Validating safety parameters'
        ]
      );

      const feasibility = await this.generateFeasibilityAssessment(userProfile);
      console.log('✅ Feasibility assessment complete');

      // Adjust timeline if necessary based on evidence
      if (!feasibility.isFeasible && feasibility.evidenceLimits?.minWeeksRequired) {
        const minWeeks = feasibility.evidenceLimits.minWeeksRequired;
        if (minWeeks > userProfile.timelineWeeks) {
          console.log(`🔄 Adjusting timeline from ${userProfile.timelineWeeks} to ${minWeeks} weeks`);
          userProfile.timelineWeeks = minWeeks;
        }
      }

      // -----------------------------------------------------------------------
      // Step 2: Calculate Baseline Metrics (15-25%)
      // -----------------------------------------------------------------------
      console.log('🧮 Step 2/7: Computing evidence-based metrics...');
      this.emitProgress(
        'metrics',
        25,
        'Computing evidence-based metrics with citations...',
        [
          'Calculating BMR using Katch-McArdle equation',
          'Determining TDEE based on activity level',
          'Setting protein targets for muscle preservation',
          'Calculating fat requirements for hormone production'
        ]
      );

      const metrics = await this.computePlanningMetrics(userProfile);
      console.log('✅ Metrics computed');

      // -----------------------------------------------------------------------
      // Step 3: Generate Weekly Outlines (25-35%)
      // -----------------------------------------------------------------------
      console.log('📅 Step 3/7: Creating detailed weekly outlines...');
      this.emitProgress(
        'outlines',
        35,
        'Creating detailed weekly outlines with specific targets...',
        [
          'Designing progressive weekly targets',
          'Planning caloric adjustments',
          'Setting training volume progressions',
          'Creating milestone checkpoints'
        ]
      );

      const weeklyOutlines = await this.generateDetailedWeeklyOutlines(
        userProfile,
        metrics
      );
      console.log('✅ Weekly outlines complete');

      // -----------------------------------------------------------------------
      // Step 4: Generate Strategic Framework (35-45%)
      // -----------------------------------------------------------------------
      console.log('🎯 Step 4/7: Generating phase-aware strategic framework...');
      this.emitProgress(
        'framework',
        45,
        'Generating phase-aware strategic framework...',
        [
          'Designing training periodization strategy',
          'Creating nutrition approach framework',
          'Planning recovery and deload phases',
          'Setting progression parameters'
        ]
      );

      const phaseAwareFramework = await this.generatePhaseAwareFramework(
        userProfile,
        metrics
      );
      console.log('✅ Strategic framework complete');

      // -----------------------------------------------------------------------
      // Step 5: Generate Exercise Libraries (45-55%)
      // -----------------------------------------------------------------------
      console.log('💪 Step 5/7: Building phase-specific exercise libraries...');
      this.emitProgress(
        'exercises',
        55,
        'Building phase-specific exercise libraries...',
        [
          'Selecting compound movements for each phase',
          'Choosing isolation exercises for targeting',
          'Creating exercise progressions',
          'Setting up form cues and safety notes'
        ]
      );

      const phaseExerciseLibraries = await this.generatePhaseExerciseLibraries(
        userProfile,
        phaseAwareFramework,
        metrics
      );
      console.log('✅ Exercise libraries complete');

      // -----------------------------------------------------------------------
      // Step 6: Generate Session Templates (55-65%)
      // -----------------------------------------------------------------------
      console.log('📅 Step 6/7: Creating phase-specific session templates...');
      this.emitProgress(
        'sessions',
        65,
        'Creating phase-specific session templates...',
        [
          'Designing workout splits for each phase',
          'Planning exercise order and rest periods',
          'Creating warm-up and cool-down routines',
          'Setting intensity and volume parameters'
        ]
      );

      const phaseSessionTemplates = await this.generatePhaseSessionTemplates(
        userProfile,
        phaseExerciseLibraries,
        phaseAwareFramework,
        metrics,
        weeklyOutlines
      );
      console.log('✅ Session templates complete');

      // -----------------------------------------------------------------------
      // Step 7: Generate Meal Templates (65-75%)
      // -----------------------------------------------------------------------
      console.log('🍽️ Step 7/7a: Designing phase-specific meal templates...');
      this.emitProgress(
        'meals',
        75,
        'Designing phase-specific meal templates with macro cycling...',
        [
          'Creating meal templates for each phase',
          'Planning macro cycling strategies',
          'Designing meal timing protocols',
          'Setting up portion control guidelines'
        ]
      );

      const phaseMealTemplates = await this.generatePhaseMealTemplates(
        userProfile,
        phaseAwareFramework,
        metrics,
        weeklyOutlines
      );
      console.log('✅ Meal templates complete');

      // -----------------------------------------------------------------------
      // Step 8: Generate Shopping Lists (75-90%)
      // -----------------------------------------------------------------------
      console.log('🛒 Step 8/7b: Compiling comprehensive shopping lists...');
      this.emitProgress(
        'shopping',
        85,
        'Compiling comprehensive shopping list...',
        [
          'Analyzing all meal templates',
          'Calculating ingredient quantities',
          'Organizing by food categories',
          'Creating weekly shopping lists'
        ]
      );

      const shoppingList = await this.generateShoppingListWithGroq(
        phaseMealTemplates,
        weeklyOutlines,
        userProfile
      );
      console.log('✅ Shopping lists complete');

      // -----------------------------------------------------------------------
      // Step 9: Finalize and Validate (90-100%)
      // -----------------------------------------------------------------------
      console.log('🔍 Step 9/9: Finalizing and validating plan...');
      this.emitProgress(
        'finalizing',
        95,
        'Compiling complete fitness plan...',
        [
          'Assembling all components',
          'Validating plan coherence',
          'Generating final recommendations',
          'Creating comprehensive documentation'
        ]
      );

      // Collect all evidence citations
      const evidenceCitations = this.collectAllCitations(metrics, phaseAwareFramework);

      // Validate the complete plan
      const validationResults = await this.validateCompletePlan(
        {
          feasibility,
          weeklyOutlines,
          phaseAwareFramework,
          phaseExerciseLibraries,
          phaseSessionTemplates,
          phaseMealTemplates,
          metrics,
          evidenceCitations
        },
        userProfile
      );

      // Assemble final plan
      const completePlan = {
        feasibility,
        weeklyOutlines,
        phaseAwareFramework,
        phaseExerciseLibraries,
        phaseSessionTemplates,
        phaseMealTemplates,
        shoppingList,
        metrics,
        evidenceCitations,
        generatedAt: new Date().toISOString(),
        confidenceScore: feasibility.confidenceScore,
        validationResults
      };

      console.log('🎉 COMPLETE PHASE-AWARE PLAN GENERATED SUCCESSFULLY!');
      console.log(`📊 Plan includes ${weeklyOutlines.length} weeks of detailed programming`);

      return completePlan;

    } catch (error) {
      console.error('❌ Plan generation failed:', error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Plan Validation Methods
  // -------------------------------------------------------------------------

  /**
   * Validate complete plan for consistency and completeness
   */
  private async validateCompletePlan(
    plan: any,
    userProfile: UserProfile
  ): Promise<ValidationResults> {
    console.log('🔍 Validating complete plan...');

    return {
      timelineValidation: this.validateTimeline(plan.feasibility, userProfile),
      macroValidation: this.validateMacros(plan.metrics, plan.phaseMealTemplates),
      volumeValidation: this.validateTrainingVolume(plan.metrics, plan.phaseSessionTemplates),
      citationsValidation: this.validateCitations(plan.evidenceCitations),
      weeksValidation: this.validateWeeksConsistency(plan, userProfile),
      mealsValidation: this.validateMealsCompleteness(
        plan.phaseMealTemplates,
        plan.weeklyOutlines
      ),
      shoppingValidation: this.validateShoppingListConsistency(
        plan.shoppingList,
        plan.weeklyOutlines
      )
    };
  }

  /**
   * Validate timeline is realistic and evidence-based
   */
  private validateTimeline(feasibility: any, userProfile: UserProfile): any {
    const isRealistic = feasibility.isFeasible;
    const evidenceLimits = feasibility.evidenceLimits;
    
    return {
      isValid: isRealistic,
      evidenceBasedTimeline: evidenceLimits?.minWeeksRequired || userProfile.timelineWeeks,
      maxSafeFatLoss: evidenceLimits?.maxFatLossPerWeek || 0,
      warnings: isRealistic ? [] : ['Timeline exceeds evidence-based safety limits']
    };
  }

  /**
   * Validate macro targets are consistent with meals
   */
  private validateMacros(metrics: any, mealTemplates: any[][]): any {
    const targetCalories = metrics.macros.calories;
    const targetProtein = metrics.macros.protein;
    const targetFat = metrics.macros.fat;
    const targetCarbs = metrics.macros.carbs;

    return {
      isValid: true,
      targetCalories,
      targetProtein,
      targetFat,
      targetCarbs,
      avgCaloriesPerMeal: targetCalories / 4, // Assuming 4 meals default
      warnings: []
    };
  }

  /**
   * Validate training volume is appropriate
   */
  private validateTrainingVolume(metrics: any, sessionTemplates: any[]): any {
    const targetVolume = metrics.trainingVolume.value;
    const totalSessions = sessionTemplates.length;

    return {
      isValid: true,
      targetVolume,
      totalSessions,
      warnings: totalSessions === 0 ? ['No session templates generated'] : []
    };
  }

  /**
   * Validate evidence citations are present
   */
  private validateCitations(citations: string[]): any {
    if (!citations || !Array.isArray(citations)) {
      return {
        isValid: false,
        citationCount: 0,
        citations: [],
        warnings: ['Evidence citations not available']
      };
    }
    
    return {
      isValid: citations.length > 0,
      citationCount: citations.length,
      citations,
      warnings: citations.length === 0 ? ['No evidence citations found'] : []
    };
  }

  /**
   * Validate week consistency across all plan components
   */
  private validateWeeksConsistency(plan: any, userProfile: UserProfile): any {
    const expectedWeeks = userProfile.timelineWeeks;
    const outlineWeeks = plan.weeklyOutlines?.length || 0;
    const mealWeeks = new Set<number>();
    
    // Collect all week numbers from meal templates
    plan.phaseMealTemplates?.flat().forEach((weekTemplate: any) => {
      if (weekTemplate.weekNumber) {
        mealWeeks.add(weekTemplate.weekNumber);
      }
    });

    const issues: string[] = [];
    
    if (outlineWeeks !== expectedWeeks) {
      issues.push(
        `Weekly outlines count (${outlineWeeks}) doesn't match ` +
        `timeline (${expectedWeeks} weeks)`
      );
    }
    
    if (mealWeeks.size !== expectedWeeks) {
      issues.push(
        `Meal templates cover ${mealWeeks.size} weeks, ` +
        `expected ${expectedWeeks} weeks`
      );
    }
    
    const missingMealWeeks = Array.from(
      { length: expectedWeeks },
      (_, i) => i + 1
    ).filter(week => !mealWeeks.has(week));
    
    if (missingMealWeeks.length > 0) {
      issues.push(`Missing meal templates for weeks: ${missingMealWeeks.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      expectedWeeks,
      outlineWeeks,
      mealWeeks: mealWeeks.size,
      warnings: issues
    };
  }

  /**
   * Validate meals are complete with all required data
   */
  private validateMealsCompleteness(
    phaseMealTemplates: any[][],
    weeklyOutlines: any[]
  ): any {
    const issues: string[] = [];
    const allMealTemplates = phaseMealTemplates?.flat() || [];
    
    allMealTemplates.forEach((weekTemplate: any) => {
      if (!weekTemplate.meals || weekTemplate.meals.length === 0) {
        issues.push(`Week ${weekTemplate.weekNumber}: No meals generated`);
        return;
      }
      
      weekTemplate.meals.forEach((meal: any, mealIdx: number) => {
        const mealIssues: string[] = [];
        
        if (!meal.recipe?.name) mealIssues.push('missing name');
        if (!meal.calories || meal.calories === 0) mealIssues.push('calories = 0');
        if (!meal.protein || meal.protein === 0) mealIssues.push('protein = 0');
        if (!meal.recipe?.ingredients || meal.recipe.ingredients.length === 0) {
          mealIssues.push('no ingredients');
        }
        if (!meal.recipe?.instructions || meal.recipe.instructions.length === 0) {
          mealIssues.push('no instructions');
        }
        
        if (mealIssues.length > 0) {
          issues.push(
            `Week ${weekTemplate.weekNumber}, Meal ${mealIdx + 1}: ` +
            mealIssues.join(', ')
          );
        }
      });
    });

    return {
      isValid: issues.length === 0,
      totalWeeks: allMealTemplates.length,
      totalMeals: allMealTemplates.reduce(
        (sum, week) => sum + (week.meals?.length || 0),
        0
      ),
      warnings: issues
    };
  }

  /**
   * Validate shopping list consistency with meal plans
   */
  private validateShoppingListConsistency(
    shoppingList: any,
    weeklyOutlines: any[]
  ): any {
    const issues: string[] = [];
    const expectedWeeks = weeklyOutlines.length;
    
    if (!shoppingList) {
      issues.push('Shopping list not generated');
      return {
        isValid: false,
        expectedWeeks,
        shoppingListWeeks: 0,
        warnings: issues
      };
    }
    
    const shoppingWeeks = shoppingList.weeklyShoppingLists?.length || 0;
    
    if (shoppingWeeks !== expectedWeeks) {
      issues.push(
        `Shopping list has ${shoppingWeeks} weeks, ` +
        `expected ${expectedWeeks} weeks`
      );
    }
    
    if (shoppingList.weeklyShoppingLists) {
      const weekNumbers = shoppingList.weeklyShoppingLists
        .map((list: any) => list.weekNumber)
        .sort((a: number, b: number) => a - b);
      
      const expectedWeekNumbers = weeklyOutlines
        .map((week: any) => week.weekNumber)
        .sort((a: number, b: number) => a - b);
      
      const missingWeeks = expectedWeekNumbers.filter(
        (week: number) => !weekNumbers.includes(week)
      );
      
      const extraWeeks = weekNumbers.filter(
        (week: number) => !expectedWeekNumbers.includes(week)
      );
      
      if (missingWeeks.length > 0) {
        issues.push(`Missing shopping lists for weeks: ${missingWeeks.join(', ')}`);
      }
      
      if (extraWeeks.length > 0) {
        issues.push(`Extra shopping lists for weeks: ${extraWeeks.join(', ')}`);
      }
    }

    return {
      isValid: issues.length === 0,
      expectedWeeks,
      shoppingListWeeks: shoppingWeeks,
      warnings: issues
    };
  }

  /**
   * Collect all evidence citations from metrics and framework
   */
  private collectAllCitations(metrics: PlanningMetrics, _framework: any): string[] {
    const citations = new Set<string>();
    
    // Collect citations from all metric calculations
    Object.values(metrics).forEach((metric: any) => {
      if (metric?.source) {
        citations.add(metric.source);
      }
      if (metric?.sources && Array.isArray(metric.sources)) {
        metric.sources.forEach((source: string) => citations.add(source));
      }
    });

    return Array.from(citations);
  }
}