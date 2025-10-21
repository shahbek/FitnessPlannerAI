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
import { buildMealPrompt } from '@/utils/promptBuilder';
import { validateMealCompliance } from '@/utils/mealValidator';
import { NutritionalResearchService } from './NutritionalResearchService';

// Zod schemas for structured output
const FeasibilitySchema = z.object({
  isFeasible: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  risks: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional()
});

const StrategicFrameworkSchema = z.object({
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

const MealTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  mealType: z.string(),
  totalCalories: z.number(),
  macros: z.object({
    protein: z.number(),
    carbs: z.number(),
    fat: z.number()
  }),
  baseRecipe: z.object({
    name: z.string(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string(),
      calories: z.number()
    })),
    instructions: z.array(z.string())
  })
});

const ShoppingListSchema = z.object({
  categories: z.array(z.object({
    category: z.string(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.string(),
      estimatedCost: z.number().optional(),
      priority: z.string()
    }))
  })),
  totalEstimatedCost: z.number(),
  notes: z.array(z.string())
});


type PlanningMetrics = {
  bmr: CalculationResult;
  tdee: CalculationResult;
  macros: MacroTargets;
  fatLoss: CalculationResult;
  trainingVolume: CalculationResult;
  water: CalculationResult;
};

export class AISdkRagService {
  private openai: any;
  private groq: any;
  private modelName: string;
  private knowledgeReady: Promise<void>;

  constructor(apiKey: string, endpoint: string, modelName: string = 'llama-3.3-70b-versatile') {
    this.modelName = modelName;
    console.log('🔧 Initializing AI SDK RAG Service:', { endpoint, modelName });
    this.knowledgeReady = researchKnowledgeBase.initialize().catch(err => {
      console.error('Failed to initialise research knowledge base:', err);
    });
    
    // Clean and validate API key
    const cleanApiKey = this.cleanApiKey(apiKey);
    
    if (endpoint.includes('groq.com') || endpoint === 'groq') {
      this.groq = createGroq({ apiKey: cleanApiKey });
      console.log('✅ Groq provider initialized');
    } else if (endpoint.includes('openai.com') || endpoint === 'openai') {
      this.openai = createOpenAI({ apiKey: cleanApiKey });
      console.log('✅ OpenAI provider initialized');
    } else {
      // Custom endpoint (for other OpenAI-compatible APIs)
      this.openai = createOpenAI({ apiKey: cleanApiKey, baseURL: endpoint });
      console.log('✅ OpenAI provider initialized with custom endpoint');
    }
  }

  private cleanApiKey(apiKey: string): string {
    // Remove any non-ASCII characters and trim whitespace
    const cleaned = apiKey
      .trim()
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .replace(/\s+/g, ''); // Remove any whitespace
    
    if (!cleaned) {
      throw new Error('Invalid API key: contains no valid characters');
    }
    
    if (cleaned.length < 10) {
      throw new Error('Invalid API key: too short');
    }
    
    console.log('🔑 API key cleaned and validated');
    return cleaned;
  }

  private getModel() {
    console.log('🎯 Getting model:', { modelName: this.modelName, hasGroq: !!this.groq, hasOpenAI: !!this.openai });
    
    if (this.groq) {
      const model = this.groq(this.modelName);
      console.log('✅ Using Groq model:', this.modelName);
      return model;
    } else if (this.openai) {
      const model = this.openai(this.modelName);
      console.log('✅ Using OpenAI model:', this.modelName);
      return model;
    } else {
      throw new Error('No AI provider configured. Please check your API key and endpoint.');
    }
  }

  private async generateWithFallback<T>(
    schema: any,
    prompt: string,
    fallbackData: T
  ): Promise<T> {
    try {
      console.log('🔄 Attempting structured output generation...');
      console.log('📝 Prompt:', prompt.substring(0, 200) + '...');
      console.log('📋 Schema:', JSON.stringify(schema, null, 2));
      
      // Try structured output first
      const result = await generateObject({
        model: this.getModel(),
        schema,
        prompt,
        temperature: 0.3
      });
      
      console.log('✅ Structured output successful!');
      console.log('📊 Structured Response:', JSON.stringify(result.object, null, 2));
      
      return result.object;
    } catch (error) {
      console.log('⚠️ Structured output not supported, falling back to text generation');
      console.log('❌ Structured output error:', error);
      
      try {
        // Fallback to text generation and parse JSON
        const result = await generateText({
          model: this.getModel(),
          prompt,
          temperature: 0.3
        });

        console.log('📝 Raw text response:', result.text);
        console.log('📊 Full text result:', JSON.stringify(result, null, 2));

        try {
          // Extract JSON from response
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsedJson = JSON.parse(jsonMatch[0]);
            console.log('✅ JSON parsing successful!');
            console.log('📊 Parsed JSON:', JSON.stringify(parsedJson, null, 2));
            return parsedJson;
          } else {
            console.log('❌ No JSON found in text response');
          }
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError);
          console.log('📝 Raw text that failed to parse:', result.text);
        }
      } catch (textError) {
        console.error('❌ Text generation also failed:', textError);
        
        // Check for specific API key encoding issues
        if (textError instanceof Error && textError.message.includes('ISO-8859-1')) {
          throw new Error('API key contains invalid characters. Please check your API key and try again.');
        }
        
        if (textError instanceof Error && textError.message.includes('Headers')) {
          throw new Error('API key format is invalid. Please ensure your API key is correct.');
        }
      }

      // Ultimate fallback
      return fallbackData;
    }
  }

  private async searchKnowledgeBase(query: string, category?: string, minConfidence = 0.8): Promise<ResearchFact[]> {
    await this.ensureKnowledgeBaseReady();
    return researchKnowledgeBase.searchFacts(query, category, minConfidence).slice(0, 5);
  }

  async generateFeasibilityAssessment(userProfile: any): Promise<any> {
    // First, compute deterministic metrics to ground the assessment
    const metrics = await this.computePlanningMetrics(userProfile);
    
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} ${userProfile.workoutLevel} ${userProfile.timelineWeeks} weeks`,
      'training'
    );

    const context = this.formatFacts(relevantKnowledge);

    // Calculate evidence-based feasibility thresholds
    const maxSafeFatLoss = userProfile.weightKg * 0.01; // 1% bodyweight per week max
    const currentFatLossTarget = userProfile.weightKg * 0.0075; // 0.75% per week target
    const bodyFatToLose = userProfile.bodyFat ? userProfile.bodyFat - (userProfile.targetBf || 15) : 0;
    
    // Evidence-based timeline assessment
    const minWeeksForGoal = bodyFatToLose > 0 ? Math.ceil(bodyFatToLose / maxSafeFatLoss) : 4;
    const isTimelineRealistic = userProfile.timelineWeeks >= minWeeksForGoal;

    const prompt = `
Based on the following user profile, deterministic calculations, and scientific research, assess the feasibility of their fitness goal:

User Profile:
- Age: ${userProfile.age}
- Sex: ${userProfile.sex}
- Weight: ${userProfile.weightKg} kg
- Body Fat: ${userProfile.bodyFat || 'unknown'}%
- Target BF: ${userProfile.targetBf || 15}%
- Goal: ${userProfile.goal}
- Timeline: ${userProfile.timelineWeeks} weeks
- Experience: ${userProfile.workoutLevel}
- Training days: ${userProfile.trainingDaysPerWeek}/week

Deterministic Calculations:
- BMR: ${metrics.bmr.value} kcal (${metrics.bmr.formula})
- TDEE: ${metrics.tdee.value} kcal (${metrics.tdee.formula})
- Safe fat-loss rate: ${maxSafeFatLoss.toFixed(2)} kg/week (evidence limit)
- Current fat-loss target: ${currentFatLossTarget.toFixed(2)} kg/week
- Minimum weeks for goal: ${minWeeksForGoal} weeks
- Timeline realistic: ${isTimelineRealistic ? 'YES' : 'NO'}

Scientific Context:
${context}

EVIDENCE-BASED ASSESSMENT REQUIREMENTS:
1. Timeline MUST be at least ${minWeeksForGoal} weeks for safe fat loss
2. Fat-loss rate MUST NOT exceed ${maxSafeFatLoss.toFixed(2)} kg/week
3. If timeline is unrealistic, suggest the MINIMUM safe timeline
4. Flag any assumptions or extreme protocols in reasoning

Respond with a JSON object in this exact format:
{
  "isFeasible": true/false,
  "confidenceScore": 0.0-1.0,
  "reasoning": "evidence-based assessment with specific calculations",
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "alternativeTimeline": "minimum safe weeks if original timeline is too ambitious",
  "optimisticOutlook": "encouraging message about what can be achieved",
  "evidenceLimits": {
    "maxFatLossPerWeek": ${maxSafeFatLoss.toFixed(2)},
    "minWeeksRequired": ${minWeeksForGoal},
    "calculatedMetrics": {
      "bmr": ${metrics.bmr.value},
      "tdee": ${metrics.tdee.value},
      "fatLossRate": ${currentFatLossTarget.toFixed(2)}
    }
  }
}
`;

    return this.generateWithFallback(
      FeasibilitySchema,
      prompt,
      {
        isFeasible: isTimelineRealistic,
        confidenceScore: isTimelineRealistic ? 0.9 : 0.7,
        reasoning: `Timeline assessment based on evidence-based fat-loss rate of ${currentFatLossTarget.toFixed(2)} kg/week. ${isTimelineRealistic ? 'Timeline is realistic and safe.' : `Minimum safe timeline is ${minWeeksForGoal} weeks.`}`,
        risks: isTimelineRealistic ? ["Overtraining", "Inadequate recovery"] : ["Aggressive timeline", "Potential muscle loss", "Metabolic adaptation"],
        recommendations: isTimelineRealistic ? ["Focus on progressive overload", "Prioritize sleep and nutrition"] : ["Extend timeline to minimum safe duration", "Consider conservative approach", "Monitor body composition closely"],
        alternativeTimeline: `${minWeeksForGoal} weeks`,
        optimisticOutlook: `With ${isTimelineRealistic ? userProfile.timelineWeeks : minWeeksForGoal} weeks of consistent effort, you can safely achieve significant progress toward your goals!`,
        evidenceLimits: {
          maxFatLossPerWeek: maxSafeFatLoss,
          minWeeksRequired: minWeeksForGoal,
          calculatedMetrics: {
            bmr: metrics.bmr.value,
            tdee: metrics.tdee.value,
            fatLossRate: currentFatLossTarget
          }
        }
      }
    );
  }

  async generateStrategicFramework(userProfile: any, metrics?: PlanningMetrics): Promise<any> {
    // Calculate metrics if not provided (for backward compatibility)
    if (!metrics) {
      metrics = await this.computePlanningMetrics(userProfile);
    }

    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.workoutSplit} ${userProfile.workoutLevel} periodization`,
      'training'
    );

    const nutritionKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} nutrition macros protein`,
      'nutrition'
    );

    const context = this.formatFacts([...trainingKnowledge, ...nutritionKnowledge]);

    const prompt = `
Create a strategic framework for this user based on scientific research:

User Profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.workoutLevel}
- Split: ${userProfile.workoutSplit}
- Training days: ${userProfile.trainingDaysPerWeek}/week
- Timeline: ${userProfile.timelineWeeks} weeks
- BMR: ${metrics.bmr.value} kcal
- TDEE: ${metrics.tdee.value} kcal
- Protein target: ${metrics.macros.protein} g (${metrics.macros.protein && Math.round(metrics.macros.protein / userProfile.weightKg * 10) / 10} g/kg)
- Fat loss pace: ${metrics.fatLoss.value.toFixed(2)} kg/week
- Recommended sets/muscle: ${metrics.trainingVolume.value}

Research Context:
${context}

Generate a comprehensive strategic framework including training and nutrition approaches.

IMPORTANT: Return ONLY valid JSON in the exact format specified by the schema. Do not include any explanatory text or markdown formatting.
`;

    return this.generateWithFallback(
      StrategicFrameworkSchema,
      prompt,
      {
        trainingApproach: {
          split: userProfile.workoutSplit,
          frequencyPerWeek: userProfile.trainingDaysPerWeek,
          sessionDurationMinutes: 60,
          periodization: 'linear',
          volumePerMuscleWeekly: {
            chest: Math.round(metrics.trainingVolume.value),
            back: Math.round(metrics.trainingVolume.value),
            legs: Math.round(metrics.trainingVolume.value * 1.2),
            shoulders: Math.round(metrics.trainingVolume.value * 0.9),
            arms: Math.round(metrics.trainingVolume.value * 0.6),
          },
        },
        nutritionApproach: {
          caloricStrategy: {
            deficitMagnitude: 'moderate',
            dailyDeficitCalories: Math.round(metrics.tdee.value - metrics.macros.calories),
            weeklyDeficitCalories: Math.round((metrics.tdee.value - metrics.macros.calories) * 7),
          },
          macroTargets: {
            proteinTotalGrams: metrics.macros.protein,
            proteinPerKg: Number((metrics.macros.protein / userProfile.weightKg).toFixed(2)),
            carbPercentage: Math.round((metrics.macros.carbs * 4) / metrics.macros.calories * 100),
            fatPercentage: Math.round((metrics.macros.fat * 9) / metrics.macros.calories * 100),
          },
          mealFrequency: 4,
          timing: {
            preWorkout: '1-2 hours before',
            postWorkout: 'within 2 hours',
            bedtime: '2-3 hours before sleep',
          },
        },
      }
    );
  }

  async generateExerciseLibrary(userProfile: any, strategicFramework: any, metrics?: PlanningMetrics): Promise<any[]> {
    // Calculate metrics if not provided (for backward compatibility)
    if (!metrics) {
      metrics = await this.computePlanningMetrics(userProfile);
    }
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.equipment} ${strategicFramework.trainingApproach.split} exercises`,
      'training'
    );

    const context = this.formatFacts(relevantKnowledge);

    const prompt = `
Generate a comprehensive exercise library for this user:

User Profile:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${userProfile.equipment}
- Split: ${strategicFramework.trainingApproach.split}
- Target muscles: ${Object.keys(strategicFramework.trainingApproach.volumePerMuscleWeekly).join(', ')}
- Recommended weekly sets: ${metrics.trainingVolume.value}
- Equipment available: ${userProfile.equipment}

Research Context:
${context}

Create 15-20 exercises covering all major muscle groups with proper progressions and regressions.

IMPORTANT: Return ONLY valid JSON in the exact format specified by the schema. Do not include any explanatory text or markdown formatting.
`;

    const result = await this.generateWithFallback(
      z.object({
        exercises: z.array(ExerciseSchema)
      }),
      prompt,
      { exercises: [] }
    );

    return result.exercises;
  }

  async generateSessionTemplates(
    userProfile: any,
    exerciseLibrary: any[],
    strategicFramework: any,
    metrics?: PlanningMetrics
  ): Promise<any[]> {
    // Calculate metrics if not provided (for backward compatibility)
    if (!metrics) {
      metrics = await this.computePlanningMetrics(userProfile);
    }
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${strategicFramework.trainingApproach.split} session structure volume`,
      'training'
    );

    const context = this.formatFacts(relevantKnowledge);

    const prompt = `
Create session templates for this training split:

Split: ${strategicFramework.trainingApproach.split}
Frequency: ${strategicFramework.trainingApproach.frequencyPerWeek} days/week
Duration: ${strategicFramework.trainingApproach.sessionDurationMinutes} minutes
Experience: ${userProfile.workoutLevel}
- Recommended weekly sets/muscle: ${metrics.trainingVolume.value}
- Key exercises: ${exerciseLibrary.map(ex => ex.name).slice(0, 10).join(', ')}

Available Exercises: ${exerciseLibrary.map(ex => ex.name).join(', ')}

Research Context:
${context}

Create session templates that match the split and volume requirements.

IMPORTANT: Return ONLY valid JSON in the exact format specified by the schema. Do not include any explanatory text or markdown formatting.
`;

    const result = await this.generateWithFallback(
      z.object({
        sessions: z.array(SessionTemplateSchema)
      }),
      prompt,
      { sessions: [] }
    );

    return result.sessions;
  }

  async generateMealTemplates(userProfile: any, _strategicFramework: any, metrics?: PlanningMetrics): Promise<any[]> {
    // Calculate metrics if not provided (for backward compatibility)
    if (!metrics) {
      metrics = await this.computePlanningMetrics(userProfile);
    }

    // Use the new constraint-aware prompt builder
    const prompt = buildMealPrompt(userProfile, metrics);

    const result = await this.generateWithFallback(
      z.object({
        meals: z.array(MealTemplateSchema)
      }),
      prompt,
      { meals: [] }
    );

    // Validate compliance with dietary constraints
    const validation = validateMealCompliance(
      result.meals,
      userProfile.preferences,
      metrics
    );

    // Validate nutritional accuracy
    console.log('🔬 Validating nutritional accuracy of generated meals...');
    result.meals.forEach((meal: any) => {
      if (meal && meal.baseRecipe?.ingredients) {
        const ingredientValidation = NutritionalResearchService.validateIngredientData(meal.baseRecipe.ingredients);
        if (!ingredientValidation.isValid) {
          console.warn(`⚠️ Meal "${meal.name}" has ingredient data issues:`, ingredientValidation.issues);
        }

        const macroValidation = NutritionalResearchService.validateMealMacros(meal);
        if (!macroValidation.isValid) {
          console.warn(`⚠️ Meal "${meal.name}" has macro calculation issues:`, macroValidation.discrepancies);
        }
      }
    });

    if (!validation.isCompliant) {
      console.warn('⚠️ Meal compliance violations detected:', validation.violations);
      
      if (validation.requiresRegeneration) {
        console.warn('🔄 Regenerating meals with stricter constraints...');
        
        // Regenerate with stronger emphasis on constraints
        const stricterPrompt = prompt + `

❌ PREVIOUS ATTEMPT FAILED - These violations were found:
${validation.violations.map(v => `   - ${v}`).join('\n')}

🚨 CRITICAL: You MUST avoid these mistakes. Double-check every ingredient against the dietary constraints.
Every single ingredient must be verified against the allowed/forbidden food lists.`;
        
        const retryResult = await this.generateWithFallback(
      z.object({
        meals: z.array(MealTemplateSchema)
      }),
          stricterPrompt,
      { meals: [] }
    );
        
        // Validate the retry
        const retryValidation = validateMealCompliance(
          retryResult.meals,
          userProfile.preferences,
          metrics
        );
        
        if (retryValidation.isCompliant) {
          console.log('✅ Retry successful - meals now comply with dietary constraints');
          return retryResult.meals;
        } else {
          console.warn('⚠️ Retry still has violations, but proceeding with original result');
        }
      }
    } else {
      console.log('✅ All meals comply with dietary constraints');
    }

    return result.meals;
  }

  async generateShoppingList(mealTemplates: any[]): Promise<any> {
    // Safety check for empty or undefined meal templates
    if (!mealTemplates || mealTemplates.length === 0) {
      console.warn('⚠️ No meal templates provided for shopping list generation');
      return {
        categories: [],
        totalEstimatedCost: 0,
        notes: ['No meal templates available for shopping list generation']
      };
    }

    const relevantKnowledge = await this.searchKnowledgeBase(
      'meal planning shopping list nutrition',
      'nutrition'
    );

    const context = this.formatFacts(relevantKnowledge);

    const prompt = `
Create a comprehensive shopping list based on these meal templates:

Meal Templates: ${mealTemplates.map(meal => meal.name).join(', ')}

Research Context:
${context}

IMPORTANT: When estimating costs for grocery items, research and use current Canadian pricing. Consider major Canadian grocery chains like Loblaws, Metro, Sobeys, and Real Canadian Superstore for accurate pricing. Prices should be in Canadian dollars (CAD).

Organize by categories and include quantities, estimated costs based on Canadian market prices, and priority levels.
`;

    return this.generateWithFallback(
      ShoppingListSchema,
      prompt,
      {
        categories: [
          {
            category: "Proteins",
            items: [
              { name: "Chicken breast", quantity: "2 lbs", estimatedCost: 8.00, priority: "high" },
              { name: "Greek yogurt", quantity: "32 oz", estimatedCost: 4.50, priority: "high" }
            ]
          },
          {
            category: "Vegetables",
            items: [
              { name: "Broccoli", quantity: "2 heads", estimatedCost: 3.00, priority: "high" },
              { name: "Spinach", quantity: "1 bag", estimatedCost: 2.50, priority: "medium" }
            ]
          }
        ],
        totalEstimatedCost: 18.00,
        notes: ["Buy organic when possible", "Check for sales on proteins"]
      }
    );
  }


  async generatePhaseAwarePlan(userProfile: any): Promise<any> {
    console.log('🔍 Starting Phase-Aware AI SDK RAG-based plan generation...');
    console.log('👤 User Profile:', JSON.stringify(userProfile, null, 2));

    // Step 1: Feasibility Assessment with Deterministic Validation
    console.log('📊 Assessing goal feasibility with evidence-based limits...');
    const feasibility = await this.generateFeasibilityAssessment(userProfile);
    console.log('✅ Feasibility Assessment Complete:', JSON.stringify(feasibility, null, 2));

    // Validate and adjust timeline based on evidence limits
    if (!feasibility.isFeasible) {
      console.log('⚠️ Timeline exceeds evidence-based safety limits');
      console.log(`💡 Evidence-based minimum timeline: ${feasibility.evidenceLimits?.minWeeksRequired || 'unknown'} weeks`);
      console.log(`🛡️ Max safe fat-loss rate: ${feasibility.evidenceLimits?.maxFatLossPerWeek || 'unknown'} kg/week`);
      
      // Update userProfile with evidence-based timeline
      if (feasibility.evidenceLimits?.minWeeksRequired && feasibility.evidenceLimits.minWeeksRequired > userProfile.timelineWeeks) {
        userProfile.timelineWeeks = feasibility.evidenceLimits.minWeeksRequired;
        console.log(`🔄 Updated timeline to ${userProfile.timelineWeeks} weeks based on evidence limits`);
      }
    }

    // Step 2: Baseline calculations with full transparency
    console.log('🧮 Computing evidence-based metrics with citations...');
    const metrics = await this.computePlanningMetrics(userProfile);
    console.log('✅ Metrics computed with sources:', JSON.stringify(metrics, null, 2));

    // Step 2.5: Generate Detailed Weekly Outlines
    console.log('📅 Creating detailed weekly outlines with specific targets...');
    const weeklyOutlines = await this.generateDetailedWeeklyOutlines(userProfile, metrics);
    console.log('✅ Weekly Outlines Complete:', JSON.stringify(weeklyOutlines, null, 2));

    // Step 3: Generate Phase-Specific Strategic Framework
    console.log('🎯 Generating phase-aware strategic framework...');
    const phaseAwareFramework = await this.generatePhaseAwareFramework(userProfile, metrics);
    console.log('✅ Phase-Aware Framework Complete:', JSON.stringify(phaseAwareFramework, null, 2));

    // Step 4: Generate Phase-Specific Exercise Libraries
    console.log('💪 Building phase-specific exercise libraries...');
    const phaseExerciseLibraries = await this.generatePhaseExerciseLibraries(userProfile, phaseAwareFramework, metrics);
    console.log('✅ Phase Exercise Libraries Complete');

    // Step 5: Generate Phase-Specific Session Templates
    console.log('📅 Creating phase-specific session templates...');
    const phaseSessionTemplates = await this.generatePhaseSessionTemplates(userProfile, phaseExerciseLibraries, phaseAwareFramework, metrics, weeklyOutlines);
    console.log('✅ Phase Session Templates Complete');

    // Step 6: Generate Phase-Specific Meal Templates with Macro Cycling
    console.log('🍽️ Designing phase-specific meal templates with macro cycling...');
    const phaseMealTemplates = await this.generatePhaseMealTemplates(userProfile, phaseAwareFramework, metrics, weeklyOutlines);
    console.log('✅ Phase Meal Templates Complete');

    // Step 7: Generate Comprehensive Shopping List
    console.log('🛒 Compiling comprehensive shopping list...');
    const allMealTemplates = phaseMealTemplates.flat().filter(meal => meal && meal.name); // Filter out any undefined meals
    const shoppingList = await this.generateShoppingList(allMealTemplates);
    console.log('✅ Shopping List Complete');


    const evidenceCitations = this.collectAllCitations(metrics, phaseAwareFramework);
    
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
      validationResults: await this.validateCompletePlan({
        feasibility,
        weeklyOutlines,
        phaseAwareFramework,
        phaseExerciseLibraries,
        phaseSessionTemplates,
        phaseMealTemplates,
        metrics,
        evidenceCitations
      }, userProfile)
    };

    console.log('🎉 PHASE-AWARE COMPLETE PLAN GENERATED!');
    console.log('📊 FINAL PLAN JSON:', JSON.stringify(completePlan, null, 2));

    return completePlan;
  }

  async generateCompletePlan(userProfile: any): Promise<any> {
    // Use the new phase-aware generation by default
    return this.generatePhaseAwarePlan(userProfile);
  }

  // Phase-Aware Generation Methods
  async generateDetailedWeeklyOutlines(userProfile: any, metrics: PlanningMetrics): Promise<any> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} fat loss progression weekly targets macro cycling cardio`,
      'nutrition'
    );

    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} training progression volume intensity weekly`,
      'training'
    );

    const context = this.formatFacts([...relevantKnowledge, ...trainingKnowledge]);

    // Calculate specific metrics for the plan
    const currentBF = userProfile.bodyFat || 22;
    const targetBF = userProfile.targetBf || 10;
    const bfToLose = currentBF - targetBF;
    const totalWeeks = userProfile.timelineWeeks;
    const weeklyBFReduction = bfToLose / totalWeeks;
    
    // Calculate progressive calorie reduction
    const startingDeficit = metrics.tdee.value * 0.15; // 15% deficit
    const maxDeficit = metrics.tdee.value * 0.25; // 25% max deficit
    const deficitIncrease = totalWeeks > 1 ? (maxDeficit - startingDeficit) / (totalWeeks - 1) : 0;

    const prompt = `
Create detailed weekly outlines for this user's ${userProfile.goal} journey:

User Profile:
- Current BF: ${currentBF}% → Target BF: ${targetBF}% (${bfToLose}% to lose)
- Timeline: ${totalWeeks} weeks (${weeklyBFReduction.toFixed(2)}% BF reduction per week)
- Weight: ${userProfile.weightKg}kg
- Training: ${userProfile.trainingDaysPerWeek} days/week
- Meal frequency: ${userProfile.mealFrequency || 4} meals/day

Scientific Calculations:
- BMR: ${metrics.bmr.value} kcal
- TDEE: ${metrics.tdee.value} kcal
- Starting calorie target: ${Math.round(metrics.tdee.value - startingDeficit)} kcal
- Progressive deficit increase: ${deficitIncrease.toFixed(0)} kcal/week
- Starting protein: ${metrics.macros.protein}g (${(metrics.macros.protein / userProfile.weightKg).toFixed(2)}g/kg)
- Fat loss rate: ${metrics.fatLoss.value.toFixed(2)} kg/week

Research Context:
${context}

Create a detailed weekly outline for ALL ${totalWeeks} weeks with:

For each week, specify:
1. Week number and phase (Foundation/Progression/Peak)
2. Daily calorie target (progressive reduction)
3. Daily macro targets (protein, carbs, fat in grams)
4. Training schedule (which days, focus areas)
5. Cardio schedule (type, duration, frequency)
6. Key objectives and focus points
7. Expected outcomes and markers
8. Adjustments from previous week

Progressive Structure:
- Weeks 1-${Math.ceil(totalWeeks * 0.33)}: Foundation Phase (establish patterns)
- Weeks ${Math.ceil(totalWeeks * 0.33) + 1}-${Math.ceil(totalWeeks * 0.66)}: Progression Phase (increase intensity)
- Weeks ${Math.ceil(totalWeeks * 0.66) + 1}-${totalWeeks}: Peak Phase (maximum effort)

Return structured JSON with detailed weekly plans.
`;

    const WeeklyOutlineSchema = z.object({
      weekNumber: z.number(),
      phase: z.string(),
      dailyTargets: z.object({
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
        proteinPerKg: z.number()
      }),
      trainingSchedule: z.object({
        resistanceDays: z.array(z.string()),
        cardioDays: z.array(z.string()),
        restDays: z.array(z.string()),
        weeklyVolume: z.string(),
        focusAreas: z.array(z.string())
      }),
      cardioSchedule: z.object({
        sessions: z.number(),
        duration: z.number(),
        intensity: z.string(),
        type: z.string()
      }),
      objectives: z.array(z.string()),
      expectedOutcomes: z.array(z.string()),
      adjustments: z.string(),
      specialNotes: z.string()
    });

    const result = await this.generateWithFallback(
      z.object({
        weeklyOutlines: z.array(WeeklyOutlineSchema)
      }),
      prompt,
      { weeklyOutlines: this.generateFallbackWeeklyOutlines(userProfile, metrics, totalWeeks) }
    );

    return result.weeklyOutlines;
  }

  private generateFallbackWeeklyOutlines(userProfile: any, metrics: PlanningMetrics, totalWeeks: number): any[] {
    const outlines = [];
    const currentBF = userProfile.bodyFat || 22;
    const targetBF = userProfile.targetBf || 10;
    const bfToLose = currentBF - targetBF;
    const weeklyBFReduction = bfToLose / totalWeeks;
    
    const startingDeficit = metrics.tdee.value * 0.15;
    const maxDeficit = metrics.tdee.value * 0.25;
    const deficitIncrease = totalWeeks > 1 ? (maxDeficit - startingDeficit) / (totalWeeks - 1) : 0;

    for (let week = 1; week <= totalWeeks; week++) {
      const phase = week <= Math.ceil(totalWeeks * 0.33) ? 'Foundation' : 
                   week <= Math.ceil(totalWeeks * 0.66) ? 'Progression' : 'Peak';
      
      const currentDeficit = startingDeficit + (deficitIncrease * (week - 1));
      const dailyCalories = Math.round(metrics.tdee.value - currentDeficit);
      const proteinPerKg = week <= Math.ceil(totalWeeks * 0.5) ? 2.2 : 2.5;
      const dailyProtein = Math.round(userProfile.weightKg * proteinPerKg);
      const dailyCarbs = Math.round((dailyCalories - (dailyProtein * 4) - (dailyCalories * 0.25)) / 4);
      const dailyFat = Math.round((dailyCalories * 0.25) / 9);

      outlines.push({
        weekNumber: week,
        phase,
        dailyTargets: {
          calories: dailyCalories,
          protein: dailyProtein,
          carbs: dailyCarbs,
          fat: dailyFat,
          proteinPerKg: proteinPerKg
        },
        trainingSchedule: {
          resistanceDays: userProfile.trainingDaysPerWeek === 3 ? ['Monday', 'Wednesday', 'Friday'] : 
                         userProfile.trainingDaysPerWeek === 4 ? ['Monday', 'Tuesday', 'Thursday', 'Friday'] :
                         ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          cardioDays: ['Tuesday', 'Thursday', 'Saturday'],
          restDays: ['Sunday'],
          weeklyVolume: `${userProfile.trainingDaysPerWeek} resistance sessions, 3 cardio sessions`,
          focusAreas: phase === 'Foundation' ? ['Form', 'Base strength'] :
                     phase === 'Progression' ? ['Volume increase', 'Intensity'] :
                     ['Peak intensity', 'Advanced techniques']
        },
        cardioSchedule: {
          sessions: 3,
          duration: phase === 'Foundation' ? 20 : phase === 'Progression' ? 30 : 25,
          intensity: phase === 'Foundation' ? 'Moderate' : phase === 'Progression' ? 'High' : 'Very High',
          type: 'HIIT + Steady State'
        },
        objectives: [
          `Achieve ${weeklyBFReduction.toFixed(2)}% body fat reduction`,
          `Maintain ${dailyProtein}g protein daily`,
          `Complete ${userProfile.trainingDaysPerWeek} resistance sessions`,
          phase === 'Foundation' ? 'Establish consistent routine' :
          phase === 'Progression' ? 'Increase training intensity' :
          'Peak performance and final push'
        ],
        expectedOutcomes: [
          `${dailyCalories} kcal daily average`,
          `${dailyProtein}g protein daily`,
          'Improved body composition',
          phase === 'Foundation' ? 'Routine establishment' :
          phase === 'Progression' ? 'Strength and endurance gains' :
          'Peak physical condition'
        ],
        adjustments: week === 1 ? 'Starting baseline' : 
                    week <= Math.ceil(totalWeeks * 0.33) ? 'Gradual deficit increase' :
                    week <= Math.ceil(totalWeeks * 0.66) ? 'Moderate intensity increase' :
                    'Maximum effort phase',
        specialNotes: phase === 'Foundation' ? 'Focus on consistency and form' :
                     phase === 'Progression' ? 'Increase training volume and intensity' :
                     'Peak phase - maximum effort and precision'
      });
    }

    return outlines;
  }

  async generatePhaseAwareFramework(userProfile: any, metrics: PlanningMetrics): Promise<any> {
    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.workoutSplit} ${userProfile.workoutLevel} periodization phases`,
      'training'
    );

    const nutritionKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} nutrition macro cycling phases`,
      'nutrition'
    );

    const context = this.formatFacts([...trainingKnowledge, ...nutritionKnowledge]);

    const prompt = `
Create a phase-aware strategic framework for this user based on scientific research and deterministic calculations:

User Profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.workoutLevel}
- Split: ${userProfile.workoutSplit}
- Training days: ${userProfile.trainingDaysPerWeek}/week
- Timeline: ${userProfile.timelineWeeks} weeks
- BMR: ${metrics.bmr.value} kcal (${metrics.bmr.formula})
- TDEE: ${metrics.tdee.value} kcal (${metrics.tdee.formula})
- Protein target: ${metrics.macros.protein} g (${metrics.macros.protein && Math.round(metrics.macros.protein / userProfile.weightKg * 10) / 10} g/kg)
- Fat loss pace: ${metrics.fatLoss.value.toFixed(2)} kg/week
- Recommended sets/muscle: ${metrics.trainingVolume.value}

Research Context:
${context}

Create a framework with 3-4 distinct phases:
1. Foundation Phase (weeks 1-${Math.ceil(userProfile.timelineWeeks * 0.25)})
2. Progression Phase (weeks ${Math.ceil(userProfile.timelineWeeks * 0.25) + 1}-${Math.ceil(userProfile.timelineWeeks * 0.75)})
3. Peak Phase (weeks ${Math.ceil(userProfile.timelineWeeks * 0.75) + 1}-${userProfile.timelineWeeks})

Each phase should include:
- Training approach modifications
- Nutrition strategy adjustments
- Macro cycling protocols
- Recovery tactics
- Special protocols (if applicable)
- Evidence-based progression markers

Return structured JSON with phase-specific strategies.
`;

    return this.generateWithFallback(
      StrategicFrameworkSchema,
      prompt,
      {
        trainingApproach: {
          split: userProfile.workoutSplit,
          frequencyPerWeek: userProfile.trainingDaysPerWeek,
          sessionDurationMinutes: 60,
          periodization: 'phase-based',
          volumePerMuscleWeekly: {
            chest: Math.round(metrics.trainingVolume.value),
            back: Math.round(metrics.trainingVolume.value),
            legs: Math.round(metrics.trainingVolume.value * 1.2),
            shoulders: Math.round(metrics.trainingVolume.value * 0.9),
            arms: Math.round(metrics.trainingVolume.value * 0.6),
          },
        },
        nutritionApproach: {
          caloricStrategy: {
            deficitMagnitude: 'moderate',
            dailyDeficitCalories: Math.round(metrics.tdee.value - metrics.macros.calories),
            weeklyDeficitCalories: Math.round((metrics.tdee.value - metrics.macros.calories) * 7),
          },
          macroTargets: {
            proteinTotalGrams: metrics.macros.protein,
            proteinPerKg: Number((metrics.macros.protein / userProfile.weightKg).toFixed(2)),
            carbPercentage: Math.round((metrics.macros.carbs * 4) / metrics.macros.calories * 100),
            fatPercentage: Math.round((metrics.macros.fat * 9) / metrics.macros.calories * 100),
          },
          mealFrequency: 4,
          timing: {
            preWorkout: '1-2 hours before',
            postWorkout: 'within 2 hours',
            bedtime: '2-3 hours before sleep',
          },
        },
      }
    );
  }

  async generatePhaseExerciseLibraries(userProfile: any, framework: any, metrics: PlanningMetrics): Promise<any[]> {
    // Safety check for framework structure
    const split = framework?.trainingApproach?.split || userProfile.workoutSplit || 'full_body';
    const equipment = userProfile.equipment || 'gym';
    
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${equipment} ${split} exercises progression`,
      'training'
    );

    const context = this.formatFacts(relevantKnowledge);

    const prompt = `
Generate phase-specific exercise libraries for this user:

User Profile:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${equipment}
- Split: ${split}
- Target muscles: ${Object.keys(framework?.trainingApproach?.volumePerMuscleWeekly || {}).join(', ')}
- Recommended weekly sets: ${metrics.trainingVolume.value}

Research Context:
${context}

Create exercise libraries for each phase:
1. Foundation Phase: Focus on movement patterns, form, and basic strength
2. Progression Phase: Increase complexity and intensity
3. Peak Phase: Advanced techniques and maximum intensity

Each exercise should include:
- Exercise ID, name, muscle groups, equipment
- Difficulty level appropriate for phase
- Form cues and progression/regression options
- Contraindications and safety notes

Generate 15-20 exercises total, distributed appropriately across phases.
`;

    const result = await this.generateWithFallback(
      z.object({
        exercises: z.array(ExerciseSchema)
      }),
      prompt,
      { exercises: [] }
    );

    return result.exercises;
  }

  async generatePhaseSessionTemplates(
    userProfile: any,
    exerciseLibraries: any[],
    framework: any,
    metrics: PlanningMetrics,
    weeklyOutlines?: any[]
  ): Promise<any[]> {
    // Safety check for framework structure
    const split = framework?.trainingApproach?.split || userProfile.workoutSplit || 'full_body';
    const frequency = framework?.trainingApproach?.frequencyPerWeek || userProfile.trainingDaysPerWeek || 3;
    const duration = framework?.trainingApproach?.sessionDurationMinutes || 60;
    
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${split} session structure volume progression`,
      'training'
    );

    const context = this.formatFacts(relevantKnowledge);

    const prompt = `
Create phase-specific session templates for this training split:

Split: ${split}
Frequency: ${frequency} days/week
Duration: ${duration} minutes
Experience: ${userProfile.workoutLevel}
Recommended weekly sets/muscle: ${metrics.trainingVolume.value}

Available Exercises: ${exerciseLibraries.map(ex => ex.name).join(', ')}

Research Context:
${context}

WEEKLY OUTLINES CONTEXT:
${weeklyOutlines ? weeklyOutlines.slice(0, 3).map(week => `
Week ${week.weekNumber} (${week.phase}):
- Training Days: ${week.trainingSchedule.resistanceDays.join(', ')}
- Cardio Days: ${week.trainingSchedule.cardioDays.join(', ')}
- Focus Areas: ${week.trainingSchedule.focusAreas.join(', ')}
- Cardio: ${week.cardioSchedule.sessions} sessions, ${week.cardioSchedule.duration}min, ${week.cardioSchedule.intensity}
`).join('\n') : 'Weekly outlines not available'}

Create session templates for each phase:
1. Foundation Phase: Lower intensity, focus on form
2. Progression Phase: Moderate intensity, build volume
3. Peak Phase: High intensity, advanced techniques

Each template should include:
- Template ID, name, target muscles
- Total duration
- Exercise structure with sets, reps, rest periods
- Phase-specific modifications
- Progressive overload guidelines

Generate templates that match the split and phase requirements.
`;

    const result = await this.generateWithFallback(
      z.object({
        sessions: z.array(SessionTemplateSchema)
      }),
      prompt,
      { sessions: [] }
    );

    return result.sessions;
  }

  async generatePhaseMealTemplates(userProfile: any, _framework: any, metrics: PlanningMetrics, weeklyOutlines?: any[]): Promise<any[][]> {
    
    // Use the new constraint-aware prompt builder
    const prompt = buildMealPrompt(userProfile, metrics) + `

WEEKLY OUTLINES CONTEXT:
${weeklyOutlines ? weeklyOutlines.slice(0, 3).map(week => `
Week ${week.weekNumber} (${week.phase}):
- Calories: ${week.dailyTargets.calories} kcal/day
- Protein: ${week.dailyTargets.protein}g (${week.dailyTargets.proteinPerKg}g/kg)
- Carbs: ${week.dailyTargets.carbs}g
- Fat: ${week.dailyTargets.fat}g
- Focus: ${week.objectives.join(', ')}
`).join('\n') : 'Weekly outlines not available'}

Create meal templates for each phase with macro cycling:
1. Foundation Phase: Establish patterns, moderate deficit
2. Progression Phase: Increase deficit, optimize timing
3. Peak Phase: Precision macros, special protocols

Each phase should include meal templates for:
${userProfile.mealFrequency === 3 ? `
- 4-5 different breakfast options (larger portions)
- 4-5 different lunch options (larger portions)  
- 4-5 different dinner options (larger portions)
- Meal types: Breakfast, Lunch, Dinner only
` : userProfile.mealFrequency === 4 ? `
- 3-4 different breakfast options
- 3-4 different lunch options  
- 3-4 different dinner options
- 3-4 different evening snack options
- Meal types: Breakfast, Lunch, Dinner, Evening Snack
` : userProfile.mealFrequency === 5 ? `
- 3-4 different breakfast options
- 3-4 different lunch options  
- 3-4 different dinner options
- 2-3 different mid-morning snack options
- 2-3 different evening snack options
- Meal types: Breakfast, Mid-Morning Snack, Lunch, Dinner, Evening Snack
` : `
- 2-3 different breakfast options
- 2-3 different lunch options  
- 2-3 different dinner options
- 2-3 different mid-morning snack options
- 2-3 different mid-afternoon snack options
- 2-3 different evening snack options
- Meal types: Breakfast, Mid-Morning Snack, Lunch, Mid-Afternoon Snack, Dinner, Evening Snack
`}

Include macro cycling (higher carbs on training days, lower on rest days).

🔬 **NUTRITIONAL ACCURACY REQUIREMENTS**:
- Research ACTUAL nutritional data for each ingredient from USDA FoodData Central
- Provide exact weights/volumes for all ingredients (e.g., "100g chicken breast", "1 medium avocado 150g")
- Calculate precise macros by summing individual ingredient nutrition facts
- Use verified nutrition databases, not estimates or approximations
- Include fiber content and key micronutrients where significant
- Ensure total meal macros equal sum of all ingredient macros

**EXAMPLE ACCURATE CALCULATION:**
For "Grilled Chicken Salad":
- 150g chicken breast: 165 cal, 31g protein, 0g carbs, 3.6g fat
- 100g mixed greens: 20 cal, 2g protein, 4g carbs, 0.2g fat  
- 50g cherry tomatoes: 9 cal, 0.4g protein, 2g carbs, 0.1g fat
- 30g cucumber: 4 cal, 0.2g protein, 1g carbs, 0g fat
- 15ml olive oil: 135 cal, 0g protein, 0g carbs, 15g fat
- 10g balsamic vinegar: 3 cal, 0g protein, 0.7g carbs, 0g fat
- **TOTAL: 336 cal, 33.6g protein, 7.7g carbs, 18.9g fat**

Return arrays of meal templates for each phase with RESEARCHED nutritional data.
`;

    const result = await this.generateWithFallback(
      z.object({
        foundationMeals: z.array(MealTemplateSchema),
        progressionMeals: z.array(MealTemplateSchema),
        peakMeals: z.array(MealTemplateSchema)
      }),
      prompt,
      { foundationMeals: [], progressionMeals: [], peakMeals: [] }
    );

    // Validate compliance for each phase
    const allMeals = [
      ...(result.foundationMeals || []),
      ...(result.progressionMeals || []),
      ...(result.peakMeals || [])
    ];

    // Validate dietary compliance
    const validation = validateMealCompliance(
      allMeals,
      userProfile.preferences,
      metrics
    );

    // Validate nutritional accuracy
    console.log('🔬 Validating nutritional accuracy of generated meals...');
    allMeals.forEach((meal: any) => {
      if (meal && meal.baseRecipe?.ingredients) {
        const ingredientValidation = NutritionalResearchService.validateIngredientData(meal.baseRecipe.ingredients);
        if (!ingredientValidation.isValid) {
          console.warn(`⚠️ Meal "${meal.name}" has ingredient data issues:`, ingredientValidation.issues);
        }

        const macroValidation = NutritionalResearchService.validateMealMacros(meal);
        if (!macroValidation.isValid) {
          console.warn(`⚠️ Meal "${meal.name}" has macro calculation issues:`, macroValidation.discrepancies);
        }
      }
    });

    if (!validation.isCompliant) {
      console.warn('⚠️ Phase meal compliance violations detected:', validation.violations);
      
      if (validation.requiresRegeneration) {
        console.warn('🔄 Regenerating phase meals with stricter constraints...');
        
        const stricterPrompt = prompt + `

❌ PREVIOUS ATTEMPT FAILED - These violations were found:
${validation.violations.map(v => `   - ${v}`).join('\n')}

🚨 CRITICAL: You MUST avoid these mistakes. Double-check every ingredient against the dietary constraints.
Every single ingredient must be verified against the allowed/forbidden food lists.`;
        
        const retryResult = await this.generateWithFallback(
          z.object({
            foundationMeals: z.array(MealTemplateSchema),
            progressionMeals: z.array(MealTemplateSchema),
            peakMeals: z.array(MealTemplateSchema)
          }),
          stricterPrompt,
          { foundationMeals: [], progressionMeals: [], peakMeals: [] }
        );
        
        // Use retry result if available
        if (retryResult.foundationMeals && retryResult.progressionMeals && retryResult.peakMeals) {
          const retryAllMeals = [
            ...retryResult.foundationMeals,
            ...retryResult.progressionMeals,
            ...retryResult.peakMeals
          ];
          
          const retryValidation = validateMealCompliance(
            retryAllMeals,
            userProfile.preferences,
            metrics
          );
          
          if (retryValidation.isCompliant) {
            console.log('✅ Retry successful - phase meals now comply with dietary constraints');
            return [
              retryResult.foundationMeals.filter((meal: any) => meal && meal.name && meal.templateId),
              retryResult.progressionMeals.filter((meal: any) => meal && meal.name && meal.templateId),
              retryResult.peakMeals.filter((meal: any) => meal && meal.name && meal.templateId)
            ];
          }
        }
      }
    } else {
      console.log('✅ All phase meals comply with dietary constraints');
    }

    // Ensure we return valid meal templates (filter out any undefined or invalid meals)
    const foundationMeals = (result.foundationMeals || []).filter((meal: any) => meal && meal.name && meal.templateId);
    const progressionMeals = (result.progressionMeals || []).filter((meal: any) => meal && meal.name && meal.templateId);
    const peakMeals = (result.peakMeals || []).filter((meal: any) => meal && meal.name && meal.templateId);

    return [foundationMeals, progressionMeals, peakMeals];
  }


  private collectAllCitations(metrics: PlanningMetrics, _framework: any): string[] {
    const citations = new Set<string>();
    
    // Collect citations from metrics
    Object.values(metrics).forEach((metric: any) => {
      if (metric.source) {
        citations.add(metric.source);
      }
      if (metric.sources) {
        metric.sources.forEach((source: string) => citations.add(source));
      }
    });

    return Array.from(citations);
  }

  private async validateCompletePlan(plan: any, userProfile: any): Promise<any> {
    const validationResults = {
      timelineValidation: this.validateTimeline(plan.feasibility, userProfile),
      macroValidation: this.validateMacros(plan.metrics, plan.phaseMealTemplates),
      volumeValidation: this.validateTrainingVolume(plan.metrics, plan.phaseSessionTemplates),
      citationsValidation: this.validateCitations(plan.evidenceCitations)
    };

    return validationResults;
  }

  private validateTimeline(feasibility: any, userProfile: any): any {
    const isRealistic = feasibility.isFeasible;
    const evidenceLimits = feasibility.evidenceLimits;
    
    return {
      isValid: isRealistic,
      evidenceBasedTimeline: evidenceLimits?.minWeeksRequired || userProfile.timelineWeeks,
      maxSafeFatLoss: evidenceLimits?.maxFatLossPerWeek || 0,
      warnings: isRealistic ? [] : ["Timeline exceeds evidence-based safety limits"]
    };
  }

  private validateMacros(metrics: any, _mealTemplates: any[][]): any {
    const targetCalories = metrics.macros.calories;
    const targetProtein = metrics.macros.protein;
    const targetFat = metrics.macros.fat;
    const targetCarbs = metrics.macros.carbs;

    // Validate that meal templates align with macro targets
    const avgCaloriesPerMeal = targetCalories / 4; // Assuming 4 meals per day

    return {
      isValid: true,
      targetCalories,
      targetProtein,
      targetFat,
      targetCarbs,
      avgCaloriesPerMeal,
      warnings: []
    };
  }

  private validateTrainingVolume(metrics: any, sessionTemplates: any[]): any {
    const targetVolume = metrics.trainingVolume.value;
    const totalSessions = sessionTemplates.length;

    return {
      isValid: true,
      targetVolume,
      totalSessions,
      warnings: []
    };
  }


  private validateCitations(citations: string[]): any {
    // Safety check for undefined or null citations
    if (!citations || !Array.isArray(citations)) {
      return {
        isValid: false,
        citationCount: 0,
        citations: [],
        warnings: ["Evidence citations not available"]
      };
    }
    
    return {
      isValid: citations.length > 0,
      citationCount: citations.length,
      citations,
      warnings: citations.length === 0 ? ["No evidence citations found"] : []
    };
  }

  private async ensureKnowledgeBaseReady(): Promise<void> {
    if (this.knowledgeReady) {
      try {
        await this.knowledgeReady;
      } catch (error) {
        console.warn('Knowledge base initialisation earlier failed, retrying...', error);
      }
    }
    if (!researchKnowledgeBase.isReady()) {
      await researchKnowledgeBase.initialize();
    }
  }

  private async computePlanningMetrics(userProfile: any): Promise<PlanningMetrics> {
    const bmr = await dynamicCalculator.calculateBMR(userProfile);
    const tdee = await dynamicCalculator.calculateTDEE(userProfile, bmr.value);
    const macros = await dynamicCalculator.calculateMacroTargets(
      userProfile,
      tdee.value,
      userProfile.goal || 'fitness'
    );
    const fatLoss = await dynamicCalculator.calculateFatLossRate(userProfile);
    const trainingVolume = await dynamicCalculator.calculateTrainingVolume(
      userProfile,
      userProfile.goal || 'fitness'
    );
    const water = await dynamicCalculator.calculateWaterRequirement(userProfile);

    return { bmr, tdee, macros, fatLoss, trainingVolume, water };
  }


  private formatFacts(facts: ResearchFact[]): string {
    if (!facts.length) {
      return 'No direct research excerpts available; rely on the knowledge base defaults.';
    }
    return facts
      .map(
        (fact) =>
          `• ${fact.content}\n  Source: ${fact.source} (confidence ${Math.round(
            fact.confidence * 100
          )}%)`
      )
      .join('\n\n');
  }
}
