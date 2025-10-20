import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

// Fitness research knowledge base
const FITNESS_KNOWLEDGE_BASE = [
  {
    id: 'progressive_overload',
    title: 'Progressive Overload Principle',
    content: 'Progressive overload is the gradual increase of stress placed upon the body during exercise training. This can be achieved by increasing weight, reps, sets, or frequency. Research shows this is essential for continued muscle growth and strength gains.',
    source: 'Schoenfeld, B. J. (2010). The mechanisms of muscle hypertrophy and their application to resistance training.',
    category: 'training'
  },
  {
    id: 'protein_timing',
    title: 'Protein Timing and Distribution',
    content: 'Research indicates that consuming 20-40g of high-quality protein every 3-4 hours maximizes muscle protein synthesis. Post-workout protein consumption within 2 hours shows optimal results for muscle recovery and growth.',
    source: 'Areta, J. L. (2013). Timing and distribution of protein ingestion during prolonged recovery from resistance exercise.',
    category: 'nutrition'
  },
  {
    id: 'volume_frequency',
    title: 'Training Volume and Frequency',
    content: 'Optimal training volume for muscle growth is 10-20 sets per muscle group per week. Beginners can achieve results with lower volumes (10-12 sets), while advanced trainees may need 15-20 sets. Training each muscle group 2-3 times per week is optimal.',
    source: 'Schoenfeld, B. J. (2016). Dose-response relationship between weekly resistance training volume and increases in muscle mass.',
    category: 'training'
  },
  {
    id: 'caloric_deficit',
    title: 'Fat Loss Caloric Deficit',
    content: 'A caloric deficit of 500-1000 calories per day results in 1-2 pounds of fat loss per week. This is considered a sustainable and healthy rate. Larger deficits can lead to muscle loss and metabolic adaptation.',
    source: 'Hall, K. D. (2007). What is the required energy deficit per unit weight loss?',
    category: 'nutrition'
  },
  {
    id: 'sleep_recovery',
    title: 'Sleep and Recovery',
    content: 'Sleep is crucial for muscle recovery and growth. 7-9 hours of quality sleep per night is recommended. Poor sleep can reduce protein synthesis by up to 18% and increase cortisol levels, hindering progress.',
    source: 'Dattilo, M. (2011). Sleep and muscle recovery: endocrinological and molecular basis for a new and promising hypothesis.',
    category: 'recovery'
  },
  {
    id: 'periodization',
    title: 'Training Periodization',
    content: 'Periodization involves planned variation in training variables to optimize performance and prevent plateaus. Linear periodization increases intensity while decreasing volume over time, while undulating periodization varies both within and between weeks.',
    source: 'Rhea, M. R. (2002). A comparison of linear and daily undulating periodized programs with equated volume and intensity for strength.',
    category: 'training'
  }
];

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

const PhaseProgressionSchema = z.object({
  phases: z.array(z.object({
    phaseNumber: z.number(),
    name: z.string(),
    durationWeeks: z.number(),
    focus: z.string(),
    trainingModifications: z.array(z.string()),
    nutritionModifications: z.array(z.string()),
    expectedOutcomes: z.array(z.string())
  }))
});

export class AISdkRagService {
  private openai: any;
  private groq: any;
  private modelName: string;

  constructor(apiKey: string, endpoint: string, modelName: string = 'llama-3.3-70b-versatile') {
    this.modelName = modelName;
    console.log('🔧 Initializing AI SDK RAG Service:', { endpoint, modelName });
    
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

  private async searchKnowledgeBase(query: string, category?: string): Promise<any[]> {
    const searchTerms = query.toLowerCase().split(' ');
    
    return FITNESS_KNOWLEDGE_BASE
      .filter(item => {
        if (category && item.category !== category) return false;
        
        const content = (item.title + ' ' + item.content).toLowerCase();
        return searchTerms.some(term => content.includes(term));
      })
      .sort((a, b) => {
        const aScore = searchTerms.reduce((score, term) => 
          score + (a.content.toLowerCase().includes(term) ? 1 : 0), 0);
        const bScore = searchTerms.reduce((score, term) => 
          score + (b.content.toLowerCase().includes(term) ? 1 : 0), 0);
        return bScore - aScore;
      })
      .slice(0, 5); // Return top 5 most relevant
  }

  async generateFeasibilityAssessment(userProfile: any): Promise<any> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} ${userProfile.workoutLevel} ${userProfile.timelineWeeks} weeks`,
      'training'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content} (Source: ${item.source})`
    ).join('\n\n');

    const prompt = `
Based on the following user profile and scientific research, assess the feasibility of their fitness goal and provide optimistic alternatives:

User Profile:
- Age: ${userProfile.age}
- Sex: ${userProfile.sex}
- Goal: ${userProfile.goal}
- Timeline: ${userProfile.timelineWeeks} weeks
- Experience: ${userProfile.workoutLevel}
- Training days: ${userProfile.trainingDaysPerWeek}/week

Scientific Context:
${context}

IMPORTANT: Be optimistic and solution-oriented! If the original timeline seems challenging, suggest the FASTEST realistic timeline to achieve their goal. Always provide a path forward rather than just saying "impossible."

Provide a detailed feasibility assessment considering:
1. Realistic timeline expectations (suggest the quickest achievable timeline if original is too ambitious)
2. Potential risks or challenges
3. Required commitment level
4. Expected outcomes
5. Alternative timeline suggestions if needed

Respond with a JSON object in this exact format:
{
  "isFeasible": true/false,
  "confidenceScore": 0.0-1.0,
  "reasoning": "focused on solutions and fastest achievable timeline",
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "alternativeTimeline": "suggested weeks if original timeline is too ambitious",
  "optimisticOutlook": "encouraging message about what can be achieved"
}
`;

    return this.generateWithFallback(
      FeasibilitySchema,
      prompt,
      {
        isFeasible: true,
        confidenceScore: 0.8,
        reasoning: "Goal appears feasible based on user profile. With proper programming and dedication, significant progress can be achieved.",
        risks: ["Overtraining", "Inadequate recovery"],
        recommendations: ["Focus on progressive overload", "Prioritize sleep and nutrition"],
        alternativeTimeline: `${Math.max(4, userProfile.timelineWeeks)} weeks`,
        optimisticOutlook: "With consistent effort and proper programming, you can make significant progress toward your goals!"
      }
    );
  }

  async generateStrategicFramework(userProfile: any): Promise<any> {
    const trainingKnowledge = await this.searchKnowledgeBase(
      `${userProfile.workoutSplit} ${userProfile.workoutLevel} periodization`,
      'training'
    );

    const nutritionKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} nutrition macros protein`,
      'nutrition'
    );

    const context = [
      ...trainingKnowledge.map(item => `Training: ${item.title}: ${item.content}`),
      ...nutritionKnowledge.map(item => `Nutrition: ${item.title}: ${item.content}`)
    ].join('\n\n');

    const prompt = `
Create a strategic framework for this user based on scientific research:

User Profile:
- Goal: ${userProfile.goal}
- Experience: ${userProfile.workoutLevel}
- Split: ${userProfile.workoutSplit}
- Training days: ${userProfile.trainingDaysPerWeek}/week
- Timeline: ${userProfile.timelineWeeks} weeks

Research Context:
${context}

Generate a comprehensive strategic framework including training and nutrition approaches.
`;

    return this.generateWithFallback(
      StrategicFrameworkSchema,
      prompt,
      {
        trainingApproach: {
          split: userProfile.workoutSplit,
          frequencyPerWeek: userProfile.trainingDaysPerWeek,
          sessionDurationMinutes: 60,
          periodization: "linear",
          volumePerMuscleWeekly: { chest: 12, back: 16, legs: 20, shoulders: 12, arms: 8 }
        },
        nutritionApproach: {
          caloricStrategy: {
            deficitMagnitude: "moderate",
            dailyDeficitCalories: 500,
            weeklyDeficitCalories: 3500
          },
          macroTargets: {
            proteinTotalGrams: 150,
            proteinPerKg: 2.0,
            carbPercentage: 40,
            fatPercentage: 25
          },
          mealFrequency: 4,
          timing: {
            preWorkout: "1-2 hours before",
            postWorkout: "within 2 hours",
            bedtime: "2-3 hours before sleep"
          }
        }
      }
    );
  }

  async generateExerciseLibrary(userProfile: any, strategicFramework: any): Promise<any[]> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.equipment} ${strategicFramework.trainingApproach.split} exercises`,
      'training'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content}`
    ).join('\n\n');

    const prompt = `
Generate a comprehensive exercise library for this user:

User Profile:
- Experience: ${userProfile.workoutLevel}
- Equipment: ${userProfile.equipment}
- Split: ${strategicFramework.trainingApproach.split}
- Target muscles: ${Object.keys(strategicFramework.trainingApproach.volumePerMuscleWeekly).join(', ')}

Research Context:
${context}

Create 15-20 exercises covering all major muscle groups with proper progressions and regressions.
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

  async generateSessionTemplates(userProfile: any, exerciseLibrary: any[], strategicFramework: any): Promise<any[]> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${strategicFramework.trainingApproach.split} session structure volume`,
      'training'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content}`
    ).join('\n\n');

    const prompt = `
Create session templates for this training split:

Split: ${strategicFramework.trainingApproach.split}
Frequency: ${strategicFramework.trainingApproach.frequencyPerWeek} days/week
Duration: ${strategicFramework.trainingApproach.sessionDurationMinutes} minutes
Experience: ${userProfile.workoutLevel}

Available Exercises: ${exerciseLibrary.map(ex => ex.name).join(', ')}

Research Context:
${context}

Create session templates that match the split and volume requirements.
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

  async generateMealTemplates(userProfile: any, strategicFramework: any): Promise<any[]> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      `${userProfile.goal} nutrition meal planning protein timing macro cycling training rest days`,
      'nutrition'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content}`
    ).join('\n\n');

    const prompt = `
Create meal templates for this user based on scientific research:

User Profile:
- Goal: ${userProfile.goal}
- Timeline: ${userProfile.timelineWeeks} weeks
- Target BF: ${userProfile.targetBf}%
- Experience: ${userProfile.experienceLevel || 'intermediate'}
- Training frequency: ${strategicFramework.trainingApproach.frequencyPerWeek} days/week
- Dietary restrictions: ${userProfile.dietaryPreferences?.dietaryRestrictions?.join(', ') || 'none'}
- Foods to avoid: ${userProfile.dietaryPreferences?.foodsToAvoid?.join(', ') || 'none'}
- Preferred cuisines: ${userProfile.dietaryPreferences?.preferredCuisines?.join(', ') || 'flexible'}
- Cooking skill: ${userProfile.dietaryPreferences?.cookingSkill || 'intermediate'}
- Budget level: ${userProfile.dietaryPreferences?.budgetLevel || 'moderate'}

Nutrition Strategy:
- Daily deficit: ${strategicFramework.nutritionApproach.caloricStrategy.dailyDeficitCalories} calories
- Protein: ${strategicFramework.nutritionApproach.macroTargets.proteinTotalGrams}g
- Meal frequency: ${strategicFramework.nutritionApproach.mealFrequency || 4} meals/day

Research Context:
${context}

CRITICAL REQUIREMENTS:
1. MUST respect dietary restrictions: ${userProfile.dietaryPreferences?.dietaryRestrictions?.join(', ') || 'none'}
2. MUST avoid foods: ${userProfile.dietaryPreferences?.foodsToAvoid?.join(', ') || 'none'}
3. Create ${userProfile.timelineWeeks} weeks worth of meal variety to prevent diet fatigue
4. Optimize protein timing (every 3-4 hours)
5. Include pre/post workout nutrition
6. Vary macros between training and rest days
7. Are practical for meal prep with ${userProfile.dietaryPreferences?.cookingSkill || 'intermediate'} skill level
8. Fit ${userProfile.dietaryPreferences?.budgetLevel || 'moderate'} budget

Create 12-16 meal templates with variety based on program length:
- ${Math.ceil(userProfile.timelineWeeks / 2)} different breakfast options
- ${Math.ceil(userProfile.timelineWeeks / 2)} different lunch options  
- ${Math.ceil(userProfile.timelineWeeks / 2)} different dinner options
- 4-6 snack options for different times
- 2-3 pre-workout options
- 2-3 post-workout options

Include different meal types: Breakfast, Lunch, Dinner, Pre-Workout Snack, Post-Workout Snack, Mid-Morning Snack, Evening Snack.

Return ONLY valid JSON with meal templates array.
`;

    const result = await this.generateWithFallback(
      z.object({
        meals: z.array(MealTemplateSchema)
      }),
      prompt,
      { meals: [] }
    );

    return result.meals;
  }

  async generateShoppingList(mealTemplates: any[]): Promise<any> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      'meal planning shopping list nutrition',
      'nutrition'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content}`
    ).join('\n\n');

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

  async generatePhaseProgression(userProfile: any, strategicFramework: any): Promise<any> {
    const relevantKnowledge = await this.searchKnowledgeBase(
      'periodization phases progression training',
      'training'
    );

    const context = relevantKnowledge.map(item => 
      `${item.title}: ${item.content}`
    ).join('\n\n');

    const prompt = `
Create a phase progression plan for this user:

User Profile:
- Goal: ${userProfile.goal}
- Timeline: ${userProfile.timelineWeeks} weeks
- Experience: ${userProfile.workoutLevel}

Strategic Framework:
- Split: ${strategicFramework.trainingApproach.split}
- Periodization: ${strategicFramework.trainingApproach.periodization}

Research Context:
${context}

Create 3-4 phases with clear progression, modifications, and expected outcomes.
`;

    return this.generateWithFallback(
      PhaseProgressionSchema,
      prompt,
      {
        phases: [
          {
            phaseNumber: 1,
            name: "Foundation",
            durationWeeks: 4,
            focus: "Building base strength and technique",
            trainingModifications: ["Focus on form", "Lower intensity"],
            nutritionModifications: ["Establish eating patterns", "Track macros"],
            expectedOutcomes: ["Improved technique", "Consistent routine"]
          },
          {
            phaseNumber: 2,
            name: "Progression",
            durationWeeks: 6,
            focus: "Increasing volume and intensity",
            trainingModifications: ["Add weight", "Increase sets"],
            nutritionModifications: ["Optimize timing", "Adjust calories"],
            expectedOutcomes: ["Strength gains", "Body composition changes"]
          },
          {
            phaseNumber: 3,
            name: "Peak",
            durationWeeks: 4,
            focus: "Maximizing results",
            trainingModifications: ["Peak intensity", "Advanced techniques"],
            nutritionModifications: ["Fine-tune macros", "Precision timing"],
            expectedOutcomes: ["Peak performance", "Goal achievement"]
          }
        ]
      }
    );
  }

  async generateCompletePlan(userProfile: any): Promise<any> {
    console.log('🔍 Starting AI SDK RAG-based plan generation...');
    console.log('👤 User Profile:', JSON.stringify(userProfile, null, 2));

    // Step 1: Feasibility Assessment
    console.log('📊 Assessing goal feasibility...');
    const feasibility = await this.generateFeasibilityAssessment(userProfile);
    console.log('✅ Feasibility Assessment Complete:', JSON.stringify(feasibility, null, 2));

    // If not feasible with original timeline, suggest alternative timeline but still proceed
    if (!feasibility.isFeasible) {
      console.log('⚠️ Original timeline may be challenging, but proceeding with optimistic approach');
      console.log(`💡 Suggested alternative timeline: ${feasibility.alternativeTimeline}`);
      console.log(`🌟 Optimistic outlook: ${feasibility.optimisticOutlook}`);
      
      // Update userProfile with alternative timeline if suggested
      if (feasibility.alternativeTimeline) {
        const suggestedWeeks = parseInt(feasibility.alternativeTimeline.replace(/\D/g, ''));
        if (suggestedWeeks > 0) {
          userProfile.timelineWeeks = suggestedWeeks;
          console.log(`🔄 Updated timeline to ${suggestedWeeks} weeks based on feasibility assessment`);
        }
      }
    }

    // Step 2: Strategic Framework
    console.log('🎯 Generating strategic framework...');
    const strategicFramework = await this.generateStrategicFramework(userProfile);
    console.log('✅ Strategic Framework Complete:', JSON.stringify(strategicFramework, null, 2));

    // Step 3: Exercise Library
    console.log('💪 Building exercise library...');
    const exerciseLibrary = await this.generateExerciseLibrary(userProfile, strategicFramework);
    console.log('✅ Exercise Library Complete:', JSON.stringify(exerciseLibrary, null, 2));

    // Step 4: Session Templates
    console.log('📅 Creating session templates...');
    const sessionTemplates = await this.generateSessionTemplates(userProfile, exerciseLibrary, strategicFramework);
    console.log('✅ Session Templates Complete:', JSON.stringify(sessionTemplates, null, 2));

    // Step 5: Meal Templates
    console.log('🍽️ Designing meal templates...');
    const mealTemplates = await this.generateMealTemplates(userProfile, strategicFramework);
    console.log('✅ Meal Templates Complete:', JSON.stringify(mealTemplates, null, 2));

    // Step 6: Shopping List
    console.log('🛒 Compiling shopping list...');
    const shoppingList = await this.generateShoppingList(mealTemplates);
    console.log('✅ Shopping List Complete:', JSON.stringify(shoppingList, null, 2));

    // Step 7: Phase Progression
    console.log('📈 Defining phase progression...');
    const phaseProgression = await this.generatePhaseProgression(userProfile, strategicFramework);
    console.log('✅ Phase Progression Complete:', JSON.stringify(phaseProgression, null, 2));

    const completePlan = {
      feasibility,
      strategicFramework,
      exerciseLibrary,
      sessionTemplates,
      mealTemplates,
      shoppingList,
      phaseProgression,
      generatedAt: new Date().toISOString(),
      confidenceScore: feasibility.confidenceScore
    };

    console.log('🎉 COMPLETE PLAN GENERATED!');
    console.log('📊 FINAL PLAN JSON:', JSON.stringify(completePlan, null, 2));

    return completePlan;
  }
}
