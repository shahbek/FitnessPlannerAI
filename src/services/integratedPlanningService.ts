// Integrated Planning Service - Deterministic expansion with RAG-assisted AI blueprints
// Provides feasibility analysis, strategic blueprinting, and high-detail plan synthesis

import { CandidateProfile } from '@/types/candidateProfile';
import { realAIClient } from '@/ai/realAIClient';
import { enhancedRAG } from '@/ai/enhancedRAG';
import { ProfilePromptGenerator } from '@/utils/profilePromptGenerator';

export interface FeasibilityAssessment {
  isFeasible: boolean;
  needsAdjustment: boolean;
  confidenceScore: number;
  reasoning: string;
  physiologicalConcerns: string[];
  adjustedGoal?: Partial<CandidateProfile['goal']>;
  alternatives?: Partial<CandidateProfile['goal']>[];
  researchCitations: string[];
}

export interface WeeklyPlan {
  week: number;
  phase: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  trainingVolume: number;
  cardioMinutes: number;
  confidence: number;
  scientificReferences: string[];
  reasoning: string;
}

export interface DailyPlan {
  day: number;
  week: number;
  isTrainingDay: boolean;
  workoutTime: string;
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    intensity: string;
    restMinutes: number;
  }>;
  focus: string;
  confidence: number;
  reasoning: string;
  citations: string[];
}

export interface MealPlan {
  day: number;
  week: number;
  meals: Array<{
    name: string;
    timing: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foods: Array<{
      name: string;
      amount: string;
      calories: number;
    }>;
    prepTime: number;
    description: string;
  }>;
  shoppingList: string[];
  prepTips: string[];
  confidence: number;
  reasoning: string;
  citations: string[];
}

export interface DebugSnapshot {
  stage: 'feasibility' | 'strategy' | 'weekly_plan' | 'daily_plan' | 'meal_plan' | 'error';
  label?: string;
  raw: string;
  parsed: any;
  timestamp: string;
}

export interface CompletePlan {
  id: string;
  profile: CandidateProfile;
  status: 'success' | 'goal_not_feasible' | 'goal_needs_adjustment';
  feasibility?: FeasibilityAssessment;
  strategy?: StrategicPlan;
  weeklyPlans: WeeklyPlan[];
  dailyPlans: DailyPlan[];
  mealPlans: MealPlan[];
  overallConfidence: number;
  totalReferences: string[];
  createdAt: string;
  reasoning: string;
  debugLog?: DebugSnapshot[];
}

export interface WeeklyGuideline {
  macroAnchors: {
    baseCalories: number;
    baseProtein: number;
    baseFat: number;
    baseCarbs: number;
  };
  adjustmentRules: {
    caloriesPerWeek?: number;
    cardioMinutesPerWeek?: number;
    trainingVolumePercentPerWeek?: number;
  };
  recoveryDirectives: string[];
}

export interface WeeklyProgression {
  calories: number[];
  protein: number[];
  fat: number[];
  carbs: number[];
  trainingVolume: number[];
  cardioMinutes: number[];
  confidence: number[];
  reasoning: string[];
}

export interface PhaseBlueprint {
  name: string;
  startWeek: number;
  durationWeeks: number;
  focus: string;
  weeklyProgression: WeeklyProgression;
  keySessionFocus: string[];
  adaptationNotes: string;
  primaryCitations: string[];
}

export interface TrainingDaySequence {
  name: string;
  focus: string;
  durationMinutes: number;
  intensity: string;
  keyExercises: Array<{
    name: string;
    sets: number;
    reps: string;
    intensity: string;
    restMinutes: number;
  }>;
  notes: string;
}

export interface RecoveryDayTemplate {
  focus: string;
  activities: string[];
  durationMinutes: number;
  notes: string;
}

export interface DailyTemplate {
  targetTrainingDays: number;
  trainingDaySequences: TrainingDaySequence[];
  recoveryDayTemplate: RecoveryDayTemplate;
  schedulingNotes: string;
}

export interface MealBlueprint {
  name: string;
  timing: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  exampleFoods: Array<{
    name: string;
    amount: string;
    calories: number;
  }>;
  prepTips: string[];
}

export interface MealSystemTemplate {
  mealsPerDay: number;
  mealBlueprints: MealBlueprint[];
  shoppingCategories: string[];
  batchingStrategies: string[];
  notes: string;
}

export interface StrategicPlan {
  trainingApproach: {
    style: string;
    frequency: number;
    volumeProgression: string;
    periodization: string;
  };
  nutritionStrategy: {
    calorieApproach: string;
    macroDistribution: string;
    mealTiming: string;
    specialConsiderations: string[];
  };
  recoveryProtocols: {
    sleepOptimization: string;
    deloadSchedule: string;
    stressManagement: string;
  };
  periodization: {
    phases: Array<{
      name: string;
      weeks: [number, number];
      focus: string;
    }>;
    progression: string;
  };
  successFactors: string[];
  obstacles: Array<{
    obstacle: string;
    mitigation: string;
  }>;
  reasoning: string;
  citations: string[];
  phaseBlueprints: PhaseBlueprint[];
  weeklyGuidelines: WeeklyGuideline;
  dailyTemplate: DailyTemplate;
  mealTemplate: MealSystemTemplate;
  coachingNotes: string;
  additionalCitations: string[];
}

export class IntegratedPlanningService {
  private ragSystem: typeof enhancedRAG;
  private aiClient: typeof realAIClient;
  private isInitialized = false;
  private debugLog: DebugSnapshot[] = [];
  private debugCallback?: (snapshot: DebugSnapshot) => void;

  constructor() {
    this.ragSystem = enhancedRAG;
    this.aiClient = realAIClient;
  }

  async initialize(apiKey: string, endpoint: string, model: string): Promise<void> {
    if (this.isInitialized) return;

    await this.ragSystem.initialize();
    await this.aiClient.initialize(apiKey, endpoint, model);

    this.isInitialized = true;
    console.log('✅ Integrated Planning Service initialized.');
  }

  async generateCompletePlan(
    profile: CandidateProfile,
    onDebug?: (snapshot: DebugSnapshot) => void
  ): Promise<CompletePlan> {
    if (!this.isInitialized) {
      throw new Error('IntegratedPlanningService must be initialized before use.');
    }

    console.log('🚀 Starting integrated plan generation...');
    this.debugLog = [];
    this.debugCallback = onDebug;

    console.log('📊 Step 1: Analyzing goal feasibility...');
    const feasibility = await this.assessGoalFeasibility(profile);

    const workingProfile: CandidateProfile = JSON.parse(JSON.stringify(profile));

    if (!feasibility.isFeasible) {
      console.log('⚠️ Goal flagged as not feasible. Applying best alternative.');
      if (feasibility.alternatives?.length) {
        Object.assign(workingProfile.goal, feasibility.alternatives[0]);
      } else if (feasibility.adjustedGoal) {
        Object.assign(workingProfile.goal, feasibility.adjustedGoal);
      } else {
        workingProfile.goal.desiredTimelineWeeks = Math.max(
          Math.round(workingProfile.goal.desiredTimelineWeeks * 1.4),
          16
        );
      }
    } else if (feasibility.needsAdjustment && feasibility.adjustedGoal) {
      console.log('🔄 Applying feasibility-driven goal adjustment.');
      Object.assign(workingProfile.goal, feasibility.adjustedGoal);
    }

    console.log('🎯 Step 2: Generating strategic blueprint...');
    const strategy = await this.determineStrategy(workingProfile);

    console.log('📅 Step 3: Building weekly plans from blueprint...');
    const weeklyPlans = await this.generateWeeklyPlans(workingProfile, strategy);

    console.log('🗓️ Step 4: Expanding to daily routines...');
    const dailyPlans = this.generateDailyPlans(workingProfile, weeklyPlans, strategy);

    console.log('🍽️ Step 5: Synthesizing meal plans...');
    const mealPlans = this.generateMealPlans(workingProfile, weeklyPlans, dailyPlans, strategy);

    const overallConfidence = this.computeOverallConfidence([
      feasibility.confidenceScore,
      ...weeklyPlans.map(plan => plan.confidence),
      ...dailyPlans.map(plan => plan.confidence),
      ...mealPlans.map(plan => plan.confidence)
    ]);

    const totalReferences = Array.from(new Set([
      ...feasibility.researchCitations,
      ...strategy.citations,
      ...strategy.additionalCitations,
      ...weeklyPlans.flatMap(plan => plan.scientificReferences),
      ...dailyPlans.flatMap(plan => plan.citations),
      ...mealPlans.flatMap(plan => plan.citations)
    ])).filter(Boolean);

    console.log('✅ Plan generation complete.');

    const debugSnapshot = [...this.debugLog];
    this.debugCallback = undefined;

    return {
      id: `plan_${Date.now()}`,
      profile: workingProfile,
      status: feasibility.isFeasible ? 'success' : feasibility.needsAdjustment ? 'goal_needs_adjustment' : 'goal_not_feasible',
      feasibility,
      strategy,
      weeklyPlans,
      dailyPlans,
      mealPlans,
      overallConfidence,
      totalReferences,
      createdAt: new Date().toISOString(),
      reasoning: `End-to-end plan generated with ${Math.round(overallConfidence * 100)}% confidence using blueprint-guided expansion.`,
      debugLog: debugSnapshot
    };
  }

  private async assessGoalFeasibility(profile: CandidateProfile): Promise<FeasibilityAssessment> {
    const queries = ProfilePromptGenerator.generateRAGQueries(profile);

    const ragResponses = await Promise.all(
      queries.feasibility.map(query =>
        this.ragSystem.query({
          userProfile: ProfilePromptGenerator.toStructuredDict(profile),
          question: query,
          context: ProfilePromptGenerator.generateRAGContext(profile),
          confidenceThreshold: 0.8,
          maxResults: 5
        })
      )
    );

    const ragContext = ragResponses.map(resp => resp.answer).join('\n\n');

    const prompt = ProfilePromptGenerator.generateFeasibilityPrompt(profile, ragContext);

    const response = await this.aiClient.generateStructuredResponse(
      prompt,
      'You are a conservative exercise scientist validating feasibility.',
      `{
  "is_feasible": boolean,
  "needs_adjustment": boolean,
  "confidence_score": number,
  "reasoning": "string",
  "physiological_concerns": ["string"],
  "adjusted_goal": {},
  "alternatives": [{}],
  "research_citations": ["string"]
}`
    );

    try {
      const parsed = this.parseJsonResponse(response.content);

      let adjustedGoal = this.normalizeGoalAdjustment(parsed.adjusted_goal);
      let alternatives = Array.isArray(parsed.alternatives)
        ? parsed.alternatives
            .map((alt: any) => this.normalizeGoalAdjustment(alt))
            .filter((alt): alt is Partial<CandidateProfile['goal']> => Boolean(alt))
        : [];

      const feasibility: FeasibilityAssessment = {
        isFeasible: Boolean(parsed.is_feasible),
        needsAdjustment: Boolean(parsed.needs_adjustment),
        confidenceScore: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0.7,
        reasoning: parsed.reasoning || 'Feasibility analysis returned without explicit reasoning.',
        physiologicalConcerns: Array.isArray(parsed.physiological_concerns) ? parsed.physiological_concerns : [],
        adjustedGoal: adjustedGoal || undefined,
        alternatives,
        researchCitations: Array.isArray(parsed.research_citations) ? parsed.research_citations : []
      };

      this.recordDebug({
        stage: 'feasibility',
        raw: response.content,
        parsed: feasibility
      });

      return feasibility;
    } catch (error) {
      console.error('❌ Failed to parse feasibility response:', error);
      const fallback = {
        isFeasible: this.extractFeasibilityFromText(response.content),
        needsAdjustment: false,
        confidenceScore: 0.5,
        reasoning: this.extractFallbackReasoning(response.content) ?? 'Unable to parse feasibility response - using fallback interpretation.',
        physiologicalConcerns: ['Feasibility parsing failed'],
        researchCitations: []
      };

      this.recordDebug({
        stage: 'feasibility',
        raw: response.content,
        parsed: fallback
      });

      return fallback;
    }
  }

  private async determineStrategy(profile: CandidateProfile): Promise<StrategicPlan> {
    const queries = ProfilePromptGenerator.generateRAGQueries(profile);

    const ragResponses = await Promise.all(
      queries.strategy.map(query =>
        this.ragSystem.query({
          userProfile: ProfilePromptGenerator.toStructuredDict(profile),
          question: query,
          context: ProfilePromptGenerator.generateRAGContext(profile),
          confidenceThreshold: 0.8,
          maxResults: 5
        })
      )
    );

    const ragContext = ragResponses.map(resp => resp.answer).join('\n\n');
    const prompt = ProfilePromptGenerator.generateStrategyPrompt(profile, ragContext);

    const expectedFormat = `{
  "training_approach": {
    "style": "string",
    "frequency": number,
    "volume_progression": "string",
    "periodization": "string"
  },
  "nutrition_strategy": {
    "calorie_approach": "string",
    "macro_distribution": "string",
    "meal_timing": "string",
    "special_considerations": ["string"]
  },
  "recovery_protocols": {
    "sleep_optimization": "string",
    "deload_schedule": "string",
    "stress_management": "string"
  },
  "periodization": {
    "phases": [{"name": "string", "weeks": [number, number], "focus": "string"}],
    "progression": "string"
  },
  "success_factors": ["string"],
  "obstacles": [{"obstacle": "string", "mitigation": "string"}],
  "reasoning": "string",
  "citations": ["string"],
  "phase_blueprints": [
    {
      "name": "string",
      "start_week": number,
      "duration_weeks": number,
      "focus": "string",
      "weekly_progression": {
        "calories": [number],
        "protein": [number],
        "fat": [number],
        "carbs": [number],
        "training_volume": [number],
        "cardio_minutes": [number],
        "confidence": [number],
        "reasoning": ["string"]
      },
      "key_session_focus": ["string"],
      "adaptation_notes": "string",
      "primary_citations": ["string"]
    }
  ],
  "weekly_guidelines": {
    "macro_anchors": {
      "base_calories": number,
      "base_protein": number,
      "base_fat": number,
      "base_carbs": number
    },
    "adjustment_rules": {
      "calories_per_week": number,
      "cardio_minutes_per_week": number,
      "training_volume_percent_per_week": number
    },
    "recovery_directives": ["string"]
  },
  "daily_template": {
    "target_training_days": number,
    "training_day_sequences": [
      {
        "name": "string",
        "focus": "string",
        "duration_minutes": number,
        "intensity": "string",
        "key_exercises": [
          {"name": "string", "sets": number, "reps": "string", "intensity": "string", "rest_minutes": number}
        ],
        "notes": "string"
      }
    ],
    "recovery_day_template": {
      "focus": "string",
      "activities": ["string"],
      "duration_minutes": number,
      "notes": "string"
    },
    "scheduling_notes": "string"
  },
  "meal_template": {
    "meals_per_day": number,
    "meal_blueprints": [
      {
        "name": "string",
        "timing": "string",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "example_foods": [{"name": "string", "amount": "string", "calories": number}],
        "prep_tips": ["string"]
      }
    ],
    "shopping_categories": ["string"],
    "batching_strategies": ["string"],
    "notes": "string"
  },
  "coaching_notes": "string",
  "additional_citations": ["string"]
}`;

    const response = await this.aiClient.generateStructuredResponse(
      prompt,
      'You are a fitness strategy architect producing a deterministic JSON blueprint.',
      expectedFormat,
      { maxTokens: 5200 }
    );

    try {
      const parsed = this.parseJsonResponse(response.content);
      const weeklyGuidelines = this.normalizeWeeklyGuidelines(parsed.weekly_guidelines, profile);
      const phaseBlueprints = this.normalizePhaseBlueprints(parsed.phase_blueprints, profile.goal.desiredTimelineWeeks, weeklyGuidelines);
      const dailyTemplate = this.normalizeDailyTemplate(parsed.daily_template, profile);
      const mealTemplate = this.normalizeMealTemplate(parsed.meal_template, profile);

      const strategy: StrategicPlan = {
        trainingApproach: parsed.training_approach,
        nutritionStrategy: parsed.nutrition_strategy,
        recoveryProtocols: parsed.recovery_protocols,
        periodization: parsed.periodization,
        successFactors: Array.isArray(parsed.success_factors) ? parsed.success_factors : [],
        obstacles: Array.isArray(parsed.obstacles) ? parsed.obstacles : [],
        reasoning: parsed.reasoning ?? 'Strategy generated without explicit reasoning.',
        citations: Array.isArray(parsed.citations) ? parsed.citations : [],
        phaseBlueprints,
        weeklyGuidelines,
        dailyTemplate,
        mealTemplate,
        coachingNotes: parsed.coaching_notes ?? 'Monitor recovery, stress, and adherence closely.',
        additionalCitations: Array.isArray(parsed.additional_citations) ? parsed.additional_citations : []
      };

      this.recordDebug({
        stage: 'strategy',
        raw: response.content,
        parsed: strategy
      });

      return strategy;
    } catch (error) {
      console.error('Failed to parse strategy blueprint:', error);
      this.recordDebug({
        stage: 'strategy',
        raw: response.content,
        parsed: { error: error instanceof Error ? error.message : String(error) }
      });

      throw new Error('Failed to generate strategy blueprint.');
    }
  }

  private async generateWeeklyPlans(profile: CandidateProfile, strategy: StrategicPlan): Promise<WeeklyPlan[]> {
    const totalWeeks = Math.max(1, profile.goal.desiredTimelineWeeks);
    const phases = [...strategy.phaseBlueprints].sort((a, b) => a.startWeek - b.startWeek);
    const globalCitations = new Set([
      ...strategy.citations,
      ...strategy.additionalCitations
    ]);

    const weeklyPlans: WeeklyPlan[] = [];

    for (let week = 1; week <= totalWeeks; week++) {
      const phase = this.locatePhase(phases, week) ?? phases[phases.length - 1];
      const indexWithinPhase = Math.min(Math.max(0, week - phase.startWeek), phase.weeklyProgression.calories.length - 1);

      const calories = this.getProgressionValue(phase.weeklyProgression.calories, indexWithinPhase, strategy.weeklyGuidelines.macroAnchors.baseCalories);
      const protein = this.getProgressionValue(phase.weeklyProgression.protein, indexWithinPhase, strategy.weeklyGuidelines.macroAnchors.baseProtein);
      const fat = this.getProgressionValue(phase.weeklyProgression.fat, indexWithinPhase, strategy.weeklyGuidelines.macroAnchors.baseFat);
      const carbs = this.getProgressionValue(phase.weeklyProgression.carbs, indexWithinPhase, strategy.weeklyGuidelines.macroAnchors.baseCarbs);
      const trainingVolume = this.getProgressionValue(phase.weeklyProgression.trainingVolume, indexWithinPhase, 45);
      const cardioMinutes = this.getProgressionValue(phase.weeklyProgression.cardioMinutes, indexWithinPhase, 75);
      const confidence = this.clampConfidence(this.getProgressionValue(phase.weeklyProgression.confidence, indexWithinPhase, 0.78));
      const reasoning = this.getProgressionReason(phase.weeklyProgression.reasoning, indexWithinPhase, phase.adaptationNotes);

      const references = Array.from(new Set([
        ...phase.primaryCitations,
        ...globalCitations
      ])).filter(Boolean);

      weeklyPlans.push({
        week,
        phase: `${phase.name} – ${phase.focus}`,
        calories: Math.round(calories),
        protein: Math.round(protein),
        fat: Math.round(fat),
        carbs: Math.round(carbs),
        trainingVolume: Math.round(trainingVolume),
        cardioMinutes: Math.round(cardioMinutes),
        confidence,
        scientificReferences: references,
        reasoning
      });
    }

    this.recordDebug({
      stage: 'weekly_plan',
      raw: 'Deterministic weekly expansion',
      parsed: weeklyPlans
    });

    return weeklyPlans;
  }

  private generateDailyPlans(profile: CandidateProfile, weeklyPlans: WeeklyPlan[], strategy: StrategicPlan): DailyPlan[] {
    if (!weeklyPlans.length) {
      return [];
    }

    const plans: DailyPlan[] = [];
    const template = strategy.dailyTemplate;
    const sequences = template.trainingDaySequences.length
      ? template.trainingDaySequences
      : [this.createDefaultTrainingSequence(profile)];

    for (const weeklyPlan of weeklyPlans) {
      const desiredTrainingDays = Math.min(
        6,
        Math.max(
          3,
          template.targetTrainingDays || profile.trainingHistory.currentTrainingDaysPerWeek || 4
        )
      );
      const trainingDays = this.buildFallbackTrainingSchedule(desiredTrainingDays);
      const restMacros = this.buildRestDayMacros(weeklyPlan);
      const references = Array.from(new Set([
        ...weeklyPlan.scientificReferences,
        ...strategy.citations,
        ...strategy.additionalCitations
      ])).filter(Boolean);

      let trainingIndex = 0;
      const weekEntries: DailyPlan[] = [];

      for (let day = 1; day <= 7; day++) {
        const isTrainingDay = trainingDays.includes(day);

        if (isTrainingDay) {
          const sequence = sequences[trainingIndex % sequences.length];
          weekEntries.push({
            day,
            week: weeklyPlan.week,
            isTrainingDay: true,
            workoutTime: `${sequence.durationMinutes} min`,
            calorieTarget: weeklyPlan.calories,
            proteinGrams: weeklyPlan.protein,
            carbGrams: weeklyPlan.carbs,
            fatGrams: weeklyPlan.fat,
            exercises: sequence.keyExercises,
            focus: `${sequence.focus} – ${weeklyPlan.phase}`,
            confidence: this.clampConfidence(weeklyPlan.confidence + 0.05),
            reasoning: `${sequence.notes || 'Emphasize controlled tempo and progressive overload'} continuing the ${weeklyPlan.phase.toLowerCase()} emphasis.`,
            citations: references
          });
          trainingIndex += 1;
        } else {
          const recovery = template.recoveryDayTemplate;
          const recoveryExercises = recovery.activities.map(activity => ({
            name: activity,
            sets: 1,
            reps: '10-20 min',
            intensity: 'light',
            restMinutes: 0
          }));

          weekEntries.push({
            day,
            week: weeklyPlan.week,
            isTrainingDay: false,
            workoutTime: `${recovery.durationMinutes} min`,
            calorieTarget: restMacros.calories,
            proteinGrams: restMacros.protein,
            carbGrams: restMacros.carbs,
            fatGrams: restMacros.fat,
            exercises: recoveryExercises,
            focus: `${recovery.focus} – ${weeklyPlan.phase}`,
            confidence: this.clampConfidence(weeklyPlan.confidence - 0.05),
            reasoning: `${recovery.notes || 'Focused recovery work'} to absorb training stress before the next stimulus.`,
            citations: references
          });
        }
      }

      plans.push(...weekEntries);
      this.recordDebug({
        stage: 'daily_plan',
        label: `week_${weeklyPlan.week}`,
        raw: 'Deterministic daily expansion',
        parsed: weekEntries
      });
    }

    return plans;
  }

  private generateMealPlans(
    profile: CandidateProfile,
    weeklyPlans: WeeklyPlan[],
    dailyPlans: DailyPlan[],
    strategy: StrategicPlan
  ): MealPlan[] {
    if (!dailyPlans.length) {
      return [];
    }

    const results: MealPlan[] = [];
    const groupedDailyPlans = this.groupDailyPlansByWeek(dailyPlans);
    const mealTemplate = strategy.mealTemplate;
    const blueprintMeals = mealTemplate.mealBlueprints.length
      ? mealTemplate.mealBlueprints
      : this.createDefaultMealBlueprints(profile);

    for (const weeklyPlan of weeklyPlans) {
      const weekDayPlans = groupedDailyPlans.get(weeklyPlan.week) ?? [];
      const references = Array.from(new Set([
        ...weeklyPlan.scientificReferences,
        ...strategy.citations,
        ...strategy.additionalCitations
      ])).filter(Boolean);

      for (const dayPlan of weekDayPlans) {
        const meals = this.buildMealsForDay(dayPlan, blueprintMeals);
        const shopping = new Set<string>([
          ...mealTemplate.shoppingCategories,
          ...meals.flatMap(meal => meal.foods.map(food => food.name.split(' ')[0]))
        ]);

        const prepTips = [
          ...mealTemplate.batchingStrategies,
          ...blueprintMeals.flatMap(meal => meal.prepTips)
        ].filter(Boolean);

        results.push({
          day: dayPlan.day,
          week: dayPlan.week,
          meals,
          shoppingList: Array.from(shopping),
          prepTips: Array.from(new Set(prepTips)),
          confidence: this.clampConfidence(dayPlan.confidence - 0.05),
          reasoning: `${mealTemplate.notes || 'Template-guided meal construction'} adjusted for a ${dayPlan.isTrainingDay ? 'training' : 'recovery'} day.`,
          citations: references
        });
      }
    }

    this.recordDebug({
      stage: 'meal_plan',
      raw: 'Deterministic meal expansion',
      parsed: results
    });

    return results;
  }

  private normalizeWeeklyGuidelines(raw: any, profile: CandidateProfile): WeeklyGuideline {
    const anchors = raw?.macro_anchors ?? {};
    const adjustments = raw?.adjustment_rules ?? {};

    const fallbackCalories = profile.goal.goalType === 'fat_loss'
      ? profile.physicalStats.weightKg * 30
      : profile.physicalStats.weightKg * 35;

    return {
      macroAnchors: {
        baseCalories: this.toNumber(anchors.base_calories, fallbackCalories),
        baseProtein: this.toNumber(anchors.base_protein, profile.physicalStats.weightKg * 2),
        baseFat: this.toNumber(anchors.base_fat, profile.physicalStats.weightKg * 0.9),
        baseCarbs: this.toNumber(anchors.base_carbs, profile.physicalStats.weightKg * 3)
      },
      adjustmentRules: {
        caloriesPerWeek: this.toNumber(adjustments.calories_per_week, profile.goal.goalType === 'fat_loss' ? -50 : 40),
        cardioMinutesPerWeek: this.toNumber(adjustments.cardio_minutes_per_week, 10),
        trainingVolumePercentPerWeek: this.toNumber(adjustments.training_volume_percent_per_week, 3)
      },
      recoveryDirectives: this.ensureStringArray(raw?.recovery_directives, [
        'Prioritise 7-9h sleep',
        'Maintain hydration >35ml/kg',
        'Monitor HRV/resting HR for fatigue'
      ])
    };
  }

  private normalizePhaseBlueprints(
    raw: any,
    totalWeeks: number,
    weeklyGuidelines: WeeklyGuideline
  ): PhaseBlueprint[] {
    if (!Array.isArray(raw) || !raw.length) {
      return [
        {
          name: 'Foundational Capacity',
          startWeek: 1,
          durationWeeks: totalWeeks,
          focus: 'Build adherence, technique, and recovery capacity',
          weeklyProgression: this.normalizeWeeklyProgression({}, totalWeeks, weeklyGuidelines),
          keySessionFocus: ['Full-body strength', 'Aerobic conditioning', 'Mobility'],
          adaptationNotes: 'Prioritise quality movement and progressive overload while monitoring fatigue.',
          primaryCitations: []
        }
      ];
    }

    const phases: PhaseBlueprint[] = [];
    let cursor = 1;

    for (const entry of raw) {
      const startWeek = this.toNumber(entry.start_week, cursor);
      const duration = Math.max(1, Math.round(this.toNumber(entry.duration_weeks, Math.ceil(totalWeeks / raw.length))));
      const focus = entry.focus ?? 'Progressive development';

      const phase: PhaseBlueprint = {
        name: entry.name ?? `Phase ${phases.length + 1}`,
        startWeek,
        durationWeeks: duration,
        focus,
        weeklyProgression: this.normalizeWeeklyProgression(entry.weekly_progression, duration, weeklyGuidelines),
        keySessionFocus: this.ensureStringArray(entry.key_session_focus, ['Strength quality', 'Conditioning', 'Recovery']),
        adaptationNotes: entry.adaptation_notes ?? 'Balance overload with recovery, monitor fatigue markers.',
        primaryCitations: this.ensureStringArray(entry.primary_citations, [])
      };

      phases.push(phase);
      cursor = startWeek + duration;
      if (cursor > totalWeeks) {
        break;
      }
    }

    if (cursor <= totalWeeks) {
      const remaining = totalWeeks - cursor + 1;
      const last = phases[phases.length - 1];
      phases.push({
        name: 'Consolidation & Peak',
        startWeek: cursor,
        durationWeeks: remaining,
        focus: 'Stabilise progress and peak for goal fulfilment',
        weeklyProgression: this.normalizeWeeklyProgression({}, remaining, weeklyGuidelines, last),
        keySessionFocus: last?.keySessionFocus ?? ['Performance refinement'],
        adaptationNotes: 'Taper volume slightly while keeping intensity to express adaptations safely.',
        primaryCitations: last?.primaryCitations ?? []
      });
    }

    return phases;
  }

  private normalizeDailyTemplate(raw: any, profile: CandidateProfile): DailyTemplate {
    const fallbackRecovery: RecoveryDayTemplate = {
      focus: 'Active recovery & mobility',
      activities: ['Outdoor walk', 'Mobility flow', 'Breathing drills'],
      durationMinutes: 30,
      notes: 'Keep RPE <4, prioritise parasympathetic activation.'
    };

    const targetTrainingDays = Math.min(
      6,
      Math.max(
        3,
        Math.round(this.toNumber(raw?.target_training_days, profile.trainingHistory.currentTrainingDaysPerWeek || 4))
      )
    );

    const trainingSequences = Array.isArray(raw?.training_day_sequences)
      ? raw.training_day_sequences.map((sequence: any, index: number): TrainingDaySequence => ({
          name: sequence.name ?? `Training Day ${index + 1}`,
          focus: sequence.focus ?? 'Strength & conditioning',
          durationMinutes: Math.round(this.toNumber(sequence.duration_minutes, 65)),
          intensity: sequence.intensity ?? 'moderate',
          keyExercises: Array.isArray(sequence.key_exercises)
            ? sequence.key_exercises.map((exercise: any) => ({
                name: exercise.name ?? 'Compound lift',
                sets: Math.max(1, Math.round(this.toNumber(exercise.sets, 4))),
                reps: exercise.reps ?? '6-10',
                intensity: exercise.intensity ?? 'RIR 2',
                restMinutes: Math.max(0, this.toNumber(exercise.rest_minutes, 2))
              }))
            : this.createDefaultTrainingSequence(profile).keyExercises,
          notes: sequence.notes ?? 'Prioritise compound lifts, control tempo, log performance.'
        }))
      : [this.createDefaultTrainingSequence(profile)];

    const recoveryDayTemplate: RecoveryDayTemplate = raw?.recovery_day_template
      ? {
          focus: raw.recovery_day_template.focus ?? fallbackRecovery.focus,
          activities: this.ensureStringArray(raw.recovery_day_template.activities, fallbackRecovery.activities),
          durationMinutes: Math.round(this.toNumber(raw.recovery_day_template.duration_minutes, fallbackRecovery.durationMinutes)),
          notes: raw.recovery_day_template.notes ?? fallbackRecovery.notes
        }
      : fallbackRecovery;

    return {
      targetTrainingDays,
      trainingDaySequences: trainingSequences,
      recoveryDayTemplate,
      schedulingNotes: raw?.scheduling_notes ?? 'Avoid >2 consecutive intense sessions; schedule recovery strategically.'
    };
  }

  private normalizeMealTemplate(raw: any, profile: CandidateProfile): MealSystemTemplate {
    const mealsPerDay = Math.max(3, Math.round(this.toNumber(raw?.meals_per_day, profile.dietaryPreferences.preferredMealCount || 4)));

    const mealBlueprints: MealBlueprint[] = Array.isArray(raw?.meal_blueprints) && raw.meal_blueprints.length
      ? raw.meal_blueprints.map((meal: any, index: number): MealBlueprint => ({
          name: meal.name ?? `Meal ${index + 1}`,
          timing: meal.timing ?? 'Scheduled to suit lifestyle',
          calories: Math.round(this.toNumber(meal.calories, 500)),
          protein: Math.round(this.toNumber(meal.protein, 30)),
          carbs: Math.round(this.toNumber(meal.carbs, 40)),
          fat: Math.round(this.toNumber(meal.fat, 15)),
          exampleFoods: Array.isArray(meal.example_foods)
            ? meal.example_foods.map((food: any) => ({
                name: food.name ?? 'High-quality protein',
                amount: food.amount ?? '1 serving',
                calories: Math.round(this.toNumber(food.calories, 150))
              }))
            : this.createDefaultMealBlueprints(profile)[0].exampleFoods,
          prepTips: this.ensureStringArray(meal.prep_tips, ['Batch cook proteins', 'Pre-wash produce'])
        }))
      : this.createDefaultMealBlueprints(profile);

    return {
      mealsPerDay,
      mealBlueprints,
      shoppingCategories: this.ensureStringArray(raw?.shopping_categories, ['Protein', 'Produce', 'Whole grains', 'Healthy fats']),
      batchingStrategies: this.ensureStringArray(raw?.batching_strategies, ['Sunday meal prep', 'Cook once eat twice']),
      notes: raw?.notes ?? 'Rotate staples weekly, emphasise minimally processed foods and satiety.'
    };
  }

  private normalizeWeeklyProgression(
    raw: any,
    duration: number,
    weeklyGuidelines: WeeklyGuideline,
    referencePhase?: PhaseBlueprint
  ): WeeklyProgression {
    const anchors = weeklyGuidelines.macroAnchors;
    const fallbackCalories = referencePhase ? referencePhase.weeklyProgression.calories.slice(-1)[0] : anchors.baseCalories;

    return {
      calories: this.ensureNumericArray(raw?.calories, duration, fallbackCalories),
      protein: this.ensureNumericArray(raw?.protein, duration, anchors.baseProtein),
      fat: this.ensureNumericArray(raw?.fat, duration, anchors.baseFat),
      carbs: this.ensureNumericArray(raw?.carbs, duration, anchors.baseCarbs),
      trainingVolume: this.ensureNumericArray(raw?.training_volume, duration, referencePhase ? referencePhase.weeklyProgression.trainingVolume.slice(-1)[0] : 50),
      cardioMinutes: this.ensureNumericArray(raw?.cardio_minutes, duration, referencePhase ? referencePhase.weeklyProgression.cardioMinutes.slice(-1)[0] : 75),
      confidence: this.ensureNumericArray(raw?.confidence, duration, referencePhase ? referencePhase.weeklyProgression.confidence.slice(-1)[0] : 0.78),
      reasoning: this.ensureStringArray(raw?.reasoning, Array(duration).fill(
        referencePhase?.adaptationNotes ?? 'Follow periodised progression with attention to recovery markers.'
      ))
    };
  }

  private getProgressionValue(values: number[], index: number, fallback: number): number {
    if (!values.length) {
      return fallback;
    }
    const value = values[Math.min(index, values.length - 1)];
    return Number.isFinite(value) ? value : fallback;
  }

  private getProgressionReason(reasons: string[], index: number, fallback: string): string {
    if (!reasons.length) {
      return fallback;
    }
    const reasoning = reasons[Math.min(index, reasons.length - 1)];
    return reasoning || fallback;
  }

  private locatePhase(phases: PhaseBlueprint[], week: number): PhaseBlueprint | undefined {
    return phases.find(phase => week >= phase.startWeek && week < phase.startWeek + phase.durationWeeks);
  }

  private clampConfidence(value: number, min = 0.4, max = 0.98): number {
    if (!Number.isFinite(value)) {
      return 0.75;
    }
    return Math.min(max, Math.max(min, value));
  }

  private computeOverallConfidence(values: number[]): number {
    if (!values.length) {
      return 0.75;
    }
    const sum = values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
    return this.clampConfidence(sum / values.length);
  }

  private buildFallbackTrainingSchedule(targetTrainingDays: number): number[] {
    const schedule: number[] = [];
    let day = 1;

    while (schedule.length < targetTrainingDays && day <= 7) {
      schedule.push(day);
      day += 2;
    }

    day = 2;
    while (schedule.length < targetTrainingDays && day <= 7) {
      if (!schedule.includes(day)) {
        schedule.push(day);
      }
      day += 2;
    }

    schedule.sort((a, b) => a - b);
    return schedule.slice(0, Math.min(targetTrainingDays, 7));
  }

  private createDefaultTrainingSequence(profile: CandidateProfile): TrainingDaySequence {
    return {
      name: 'Strength & Conditioning',
      focus: profile.goal.goalType === 'fat_loss' ? 'Metabolic resistance training' : 'Strength progression',
      durationMinutes: profile.lifestyle.availableTrainingTimeMinutes || 60,
      intensity: 'moderate',
      keyExercises: [
        { name: 'Compound lift (e.g., squat/hinge)', sets: 4, reps: '6-10', intensity: 'RIR 1-2', restMinutes: 2 },
        { name: 'Upper push/pull superset', sets: 3, reps: '10-12', intensity: 'RIR 1-2', restMinutes: 1.5 },
        { name: 'Accessory circuit', sets: 2, reps: '12-15', intensity: 'RIR 2', restMinutes: 1 },
        { name: 'Conditioning finisher', sets: 1, reps: '8-10 min', intensity: 'RPE 7', restMinutes: 0 }
      ],
      notes: 'Prioritise technique, track loads, and maintain 1-2 reps in reserve.'
    };
  }

  private buildRestDayMacros(weeklyPlan: WeeklyPlan): { calories: number; protein: number; carbs: number; fat: number } {
    return {
      calories: Math.round(weeklyPlan.calories * 0.95),
      protein: Math.round(weeklyPlan.protein * 0.98),
      carbs: Math.round(weeklyPlan.carbs * 0.9),
      fat: Math.round(weeklyPlan.fat * 1.05)
    };
  }

  private buildMealsForDay(dayPlan: DailyPlan, blueprintMeals: MealBlueprint[]): MealPlan['meals'] {
    const totalBlueprintCalories = blueprintMeals.reduce((acc, meal) => acc + meal.calories, 0) || 1;
    const calorieScale = dayPlan.calorieTarget / totalBlueprintCalories;

    return blueprintMeals.map(meal => {
      const scale = calorieScale || 1;

      const foods = meal.exampleFoods.map(food => ({
        name: food.name,
        amount: `${(scale).toFixed(1)}× ${food.amount}`,
        calories: Math.round(food.calories * scale)
      }));

      return {
        name: meal.name,
        timing: meal.timing,
        calories: Math.round(meal.calories * scale),
        protein: Math.round(meal.protein * scale),
        carbs: Math.round(meal.carbs * scale),
        fat: Math.round(meal.fat * scale),
        foods,
        prepTime: meal.prepTips.length ? 15 : 10,
        description: `${meal.name} scaled for a ${dayPlan.isTrainingDay ? 'training' : 'recovery'} day; emphasise ${dayPlan.isTrainingDay ? 'pre/post-workout fueling' : 'satiety and micronutrients'}.`
      };
    });
  }

  private createDefaultMealBlueprints(profile: CandidateProfile): MealBlueprint[] {
    return [
      {
        name: 'Protein-rich Breakfast',
        timing: 'Morning (within 2h of waking)',
        calories: 450,
        protein: 30,
        carbs: 45,
        fat: 15,
        exampleFoods: [
          { name: 'Egg white scramble with spinach', amount: '1.5 cups', calories: 180 },
          { name: 'Oats with berries', amount: '1 cup cooked', calories: 160 },
          { name: 'Greek yogurt', amount: '150 g', calories: 110 }
        ],
        prepTips: ['Batch cook oats', 'Pre-portion berries']
      },
      {
        name: 'Balanced Lunch',
        timing: 'Midday',
        calories: 550,
        protein: 40,
        carbs: 55,
        fat: 18,
        exampleFoods: [
          { name: 'Grilled chicken breast', amount: '150 g', calories: 230 },
          { name: 'Quinoa', amount: '1 cup cooked', calories: 220 },
          { name: 'Mixed vegetables', amount: '1.5 cups', calories: 100 }
        ],
        prepTips: ['Use sheet-pan roasting', 'Pre-portion grain servings']
      },
      {
        name: 'Evening Meal',
        timing: 'Dinner',
        calories: 500,
        protein: 35,
        carbs: 45,
        fat: 18,
        exampleFoods: [
          { name: 'Salmon filet', amount: '140 g', calories: 280 },
          { name: 'Roasted sweet potato', amount: '180 g', calories: 160 },
          { name: 'Steamed greens', amount: '1 cup', calories: 60 }
        ],
        prepTips: ['Batch roast vegetables', 'Prepare proteins for two days']
      },
      {
        name: 'Training Support Snack',
        timing: 'Pre/Post-workout',
        calories: 300,
        protein: 25,
        carbs: 40,
        fat: 8,
        exampleFoods: [
          { name: 'Whey protein shake', amount: '1 scoop', calories: 120 },
          { name: 'Banana', amount: '1 medium', calories: 105 },
          { name: 'Rice cakes with nut butter', amount: '2 cakes', calories: 80 }
        ],
        prepTips: ['Keep shake ingredients ready', 'Carry portable carbs']
      }
    ];
  }

  private groupDailyPlansByWeek(dailyPlans: DailyPlan[]): Map<number, DailyPlan[]> {
    const map = new Map<number, DailyPlan[]>();

    for (const plan of dailyPlans) {
      const existing = map.get(plan.week) ?? [];
      existing.push(plan);
      map.set(plan.week, existing);
    }

    for (const [week, plans] of map.entries()) {
      plans.sort((a, b) => a.day - b.day);
      map.set(week, plans);
    }

    return map;
  }

  private parseJsonResponse(content: string): any {
    const match = content.match(/\{[\s\S]*\}/);
    const jsonContent = match ? match[0] : content;

    try {
      return JSON.parse(jsonContent);
    } catch {
      const sanitized = this.sanitizeJsonString(jsonContent);
      return JSON.parse(sanitized);
    }
  }

  private sanitizeJsonString(json: string): string {
    let sanitized = json;
    sanitized = sanitized.replace(/:\s*([\d.+-]+)%/g, ': "$1%"');
    sanitized = sanitized.replace(/:\s*([\d.+-]+)\s*(weeks?|week|months?|month|days?|day)\b/gi, ': "$1 $2"');
    sanitized = sanitized.replace(/:\s*([\d.+-]+)\s*(minutes?|minute|hours?|hour|mins?|sec|seconds)\b/gi, ': "$1 $2"');
    sanitized = sanitized.replace(/:\s*([\d.+-]+)\s*(kg|lbs|g|grams|mg|ml|oz|ounces|kcal|calories)\b/gi, ': "$1 $2"');
    sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');
    sanitized = sanitized.replace(/(^|[,{\s])(?!\s*\")(?!true|false|null)([A-Za-z_][A-Za-z0-9_]*)\s*:/gm, '$1"$2":');
    sanitized = sanitized.replace(/:\s*'([^']*)'/g, ': "$1"');
    return sanitized;
  }

  private recordDebug(snapshot: Omit<DebugSnapshot, 'timestamp'>): void {
    const enriched: DebugSnapshot = {
      ...snapshot,
      timestamp: new Date().toISOString()
    };
    this.debugLog.push(enriched);
    if (this.debugCallback) {
      try {
        this.debugCallback(enriched);
      } catch (error) {
        console.warn('Debug callback failed:', error);
      }
    }
  }

  private normalizeGoalAdjustment(raw: any): Partial<CandidateProfile['goal']> | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const normalized: Partial<CandidateProfile['goal']> = {};

    if (raw.goal_type) {
      normalized.goalType = raw.goal_type;
    }

    const targetBodyFat =
      raw.target_body_fat_percentage ??
      raw.target_body_fat ??
      raw.target_bf ??
      raw.targetBodyFatPercentage ??
      raw.targetBodyFat;

    const targetWeight =
      raw.target_weight ??
      raw.target_weight_kg ??
      raw.targetWeight ??
      raw.targetWeightKg;

    const timeline =
      raw.timeline ??
      raw.timeline_weeks ??
      raw.desired_timeline ??
      raw.desired_timeline_weeks ??
      raw.weeks;

    const numericBodyFat = this.extractNumericValue(targetBodyFat);
    if (numericBodyFat !== undefined) {
      normalized.targetBodyFatPercentage = numericBodyFat;
    }

    const numericWeight = this.extractNumericValue(targetWeight);
    if (numericWeight !== undefined) {
      normalized.targetWeightKg = numericWeight;
    }

    const numericTimeline = this.extractNumericValue(timeline);
    if (numericTimeline !== undefined) {
      normalized.desiredTimelineWeeks = numericTimeline;
    }

    return Object.keys(normalized).length ? normalized : null;
  }

  private ensureNumericArray(value: any, length: number, fallback: number): number[] {
    if (Array.isArray(value) && value.length) {
      const arr = value.map((val: any) => this.toNumber(val, fallback));
      while (arr.length < length) {
        arr.push(arr[arr.length - 1] ?? fallback);
      }
      return arr.slice(0, length);
    }
    return Array(length).fill(fallback);
  }

  private ensureStringArray(value: any, fallback: string[]): string[] {
    if (Array.isArray(value) && value.length) {
      return value.map(item => (typeof item === 'string' ? item : String(item))).filter(Boolean);
    }
    return fallback;
  }

  private toNumber(value: any, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private extractNumericValue(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const match = String(value).match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }

  private extractFeasibilityFromText(text: string): boolean {
    const lower = text.toLowerCase();
    const positive = ['feasible', 'achievable', 'realistic', 'possible', 'safe', 'can be achieved'];
    const negative = ['not feasible', 'unsafe', 'impossible', 'cannot be achieved', 'unlikely'];

    const hasPositive = positive.some(token => lower.includes(token));
    const hasNegative = negative.some(token => lower.includes(token));

    if (hasPositive && !hasNegative) return true;
    if (hasNegative && !hasPositive) return false;
    return true;
  }

  private extractFallbackReasoning(text: string): string | undefined {
    const match = text.match(/reasoning[:\s-]+([\s\S]+)/i);
    return match ? match[1].trim() : undefined;
  }
}

export const integratedPlanningService = new IntegratedPlanningService();
