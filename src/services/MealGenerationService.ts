import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText } from 'ai';
import { z } from 'zod';

const MIN_INGREDIENTS_PER_MEAL = 5;
const MIN_INSTRUCTIONS_PER_MEAL = 4;

export interface GenerateMealParams {
  userProfile: any;
  metrics: any;
  phaseWeeks: any[];
  phaseName: string;
  groqApiKey?: string;
  onReasoningUpdate?: (reasoning: string, mode: 'thinking' | 'formatting' | 'complete') => void;
}

export class MealGenerationService {
  private groq: any;

  constructor(apiKey: string) {
    this.groq = createGroq({ apiKey });
  }

  /**
   * Generate meals using Groq's two-step reasoning approach with batch parallelization:
   * 1. Split weeks into batches of 5-6 weeks
   * 2. Process batches in parallel:
   *    a. GPT-OSS 120B reasons about complex macro balancing (when needed)
   *    b. Llama 3.3 70B selects ingredients and formats to JSON (per batch)
   * 3. Combine all results
   */
  async generateMealTemplatesWithGroq(params: GenerateMealParams): Promise<any[]> {
    const { userProfile, metrics, phaseWeeks, phaseName, onReasoningUpdate } = params;

    try {
      // Split weeks into batches - OPTIMIZED: Larger batches reduce API calls
      // For 24 weeks: 5-6 week batches (4-5 batches) vs 3-4 week batches (6-8 batches)
      // Larger batches = fewer API calls = lower cost
      const BATCH_SIZE = phaseWeeks.length > 18 ? 6 : 5;
      const batches: any[][] = [];
      
      for (let i = 0; i < phaseWeeks.length; i += BATCH_SIZE) {
        batches.push(phaseWeeks.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`🚀 Processing ${phaseWeeks.length} weeks in ${batches.length} parallel batches (${BATCH_SIZE} weeks per batch)...`);
      
      // Process all batches in parallel
      const batchPromises = batches.map((batchWeeks, batchIndex) => 
        this.processBatch(userProfile, metrics, batchWeeks, phaseName, batchIndex + 1, batches.length, onReasoningUpdate)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten and combine all results
      const allTemplates = batchResults.flat();
      
      console.log(`✅ All batches completed! Generated ${allTemplates.length} weekly templates`);
      
      return allTemplates;
    } catch (error) {
      console.error('❌ Groq meal generation failed:', error);
      throw error;
    }
  }

  /**
   * Process a single batch of weeks through the two-step reasoning pipeline
   * Includes retry logic for transient failures
   */
  private async processBatch(
    userProfile: any,
    metrics: any,
    batchWeeks: any[],
    phaseName: string,
    batchNumber: number,
    totalBatches: number,
    onReasoningUpdate?: (reasoning: string, mode: 'thinking' | 'formatting' | 'complete') => void,
    retryCount: number = 0
  ): Promise<any[]> {
    const MAX_RETRIES = 2;
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Processing weeks ${batchWeeks[0].weekNumber}-${batchWeeks[batchWeeks.length - 1].weekNumber}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}...`);
    
    try {
      // STEP 1: Use Llama 3.3 70B for ingredient selection (cheaper than GPT-OSS 120B)
      // Only use GPT-OSS 120B for complex macro balancing when needed
      const needsComplexReasoning = this.needsComplexMacroBalancing(userProfile, metrics, batchWeeks);
      
      let reasoning = '';
      
      if (needsComplexReasoning) {
        // Only use expensive GPT-OSS 120B for complex macro balancing
        console.log(`  🧠 Step 1a: GPT-OSS 120B for complex macro balancing...`);
        const macroModel = this.groq('openai/gpt-oss-120b');
        const macroPrompt = this.buildComplexMacroBalancingPrompt(userProfile, metrics, batchWeeks, phaseName);
        
        const macroStream = await streamText({
          model: macroModel,
          prompt: macroPrompt,
          temperature: 0.6,
          system: this.getReasoningSystemPrompt(),
          providerOptions: {
            groq: {
              reasoningEffort: 'high',
              includeReasoning: true
            }
          }
        });
        
        // Extract macro balancing reasoning
        for await (const chunk of macroStream.fullStream) {
          if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
            reasoning += chunk.text;
          } else if (chunk.type === 'finish' || chunk.type === 'finish-step') {
            const finishData = chunk as any;
            if (finishData.response?.text && !reasoning) {
              reasoning = finishData.response.text;
            }
            if (finishData.experimental_providerMetadata?.groq?.reasoning && !reasoning) {
              reasoning = finishData.experimental_providerMetadata.groq.reasoning;
            }
          }
        }
        
        if (onReasoningUpdate && reasoning.length > 0) {
          onReasoningUpdate(
            `## 🧠 Complex Macro Balancing (Batch ${batchNumber}/${totalBatches})\n\n${reasoning.substring(0, 1000)}...`,
            'thinking'
          );
        }
      }
      
      // STEP 1b: Use Llama 3.3 70B for ingredient selection (CHEAPER than GPT-OSS, still accurate)
      console.log(`  🧠 Step 1b: Llama 3.3 70B ingredient selection (optimized for cost)...`);
      
      if (onReasoningUpdate) {
        onReasoningUpdate(
          `## 🧠 Ingredient Selection (Batch ${batchNumber}/${totalBatches})\n\nSelecting optimal ingredients for meal plans...`,
          'thinking'
        );
      }
      
      const ingredientModel = this.groq('llama-3.3-70b-versatile');
      const ingredientPrompt = this.buildIngredientSelectionPrompt(userProfile, metrics, batchWeeks, phaseName, reasoning);
      
      const ingredientStream = await streamText({
        model: ingredientModel,
        prompt: ingredientPrompt,
        temperature: 0.4, // Slightly higher than formatting for creativity
        system: this.getReasoningSystemPrompt()
      });
      
      // Stream and accumulate ingredient selection reasoning
      let ingredientReasoning = '';
      let lastUpdate = 0;
      const UPDATE_INTERVAL = 150;
      let updateCount = 0;
      
      for await (const chunk of ingredientStream.fullStream) {
        if (chunk.type === 'text-delta') {
          ingredientReasoning += chunk.text;
          
          const now = Date.now();
          if (ingredientReasoning.length > 0 && now - lastUpdate > UPDATE_INTERVAL) {
            updateCount++;
            if (onReasoningUpdate) {
              onReasoningUpdate(
                `## 🧠 Ingredient Selection (Batch ${batchNumber}/${totalBatches})\n\n${ingredientReasoning}`,
                'thinking'
              );
            }
            lastUpdate = now;
          }
        }
      }
      
      // Combine reasoning (macro balancing + ingredient selection)
      const combinedReasoning = needsComplexReasoning 
        ? `${reasoning}\n\n---\n\nINGREDIENT SELECTION:\n\n${ingredientReasoning}`
        : ingredientReasoning;
      
      if (!combinedReasoning || combinedReasoning.length < 100) {
        console.warn(`  ⚠️ No substantial reasoning extracted.`);
        throw new Error('Insufficient reasoning output');
      }
      
      console.log(`  ✅ Reasoning extracted: ${combinedReasoning.length} chars (${needsComplexReasoning ? 'with complex macro balancing' : 'ingredient selection only'})`);
      
      // Always send final reasoning update
      if (onReasoningUpdate && combinedReasoning.length > 0) {
        onReasoningUpdate(
          `## ✅ Reasoning Complete (Batch ${batchNumber}/${totalBatches})\n\n${combinedReasoning}`,
          'thinking'
        );
      }
      
      // STEP 2: Use Llama 3.3 70B to extract ingredient data and create JSON
      console.log(`  🧠 Step 2: Llama 3.3 70B formatting...`);
      
      // Notify UI that we're formatting
      if (onReasoningUpdate) {
        onReasoningUpdate(`## 📋 Llama 3.3 70B Formatting Results\n\nExtracting ingredient data and creating structured meal plans...\n\n*Processing batch ${batchNumber}/${totalBatches}...*`, 'formatting');
      }
      
      const formattingModel = this.groq('llama-3.3-70b-versatile');
      
      const formattingPrompt = this.buildFormattingPrompt(combinedReasoning, userProfile, metrics, batchWeeks, phaseName);
      
      const result = await generateText({
        model: formattingModel,
        prompt: formattingPrompt,
        temperature: 0.1, // Very low temp for precise formatting
        system: this.getFormattingSystemPrompt()
      });

      // Extract text from standard response
      const responseText = result.text || '';
      
      if (!responseText) {
        throw new Error('Llama 3.3 70B returned empty response');
      }
      
      // Extract JSON from the response
      let parsed = this.extractAndParseJSON(responseText);
      
      if (!parsed) {
        throw new Error('Parser returned empty result');
      }
      
      if (!parsed.weeklyMealTemplates) {
        // If it's an array at root level, wrap it
        if (Array.isArray(parsed)) {
          parsed = { weeklyMealTemplates: parsed };
        } else {
          throw new Error('Failed to find weeklyMealTemplates in response');
        }
      }

      // Validate against schema
      const validated = z.object({
        weeklyMealTemplates: z.array(z.any())
      }).parse(parsed);

      // Validate meal data completeness - STRICT VALIDATION (no fallbacks)
      const validationErrors: string[] = [];
      const globalMealNames = new Set<string>();
      validated.weeklyMealTemplates.forEach((week: any) => {
        if (!week.meals || week.meals.length === 0) {
          validationErrors.push(`Week ${week.weekNumber}: No meals generated`);
          return;
        }

        const weekMealNames = new Set<string>();

        week.meals.forEach((meal: any, mealIdx: number) => {
          const issues: string[] = [];
          const normalizedName = meal.recipe?.name?.trim().toLowerCase();
          
          if (!meal.recipe?.name) {
            issues.push('missing name');
          } else if (normalizedName) {
            if (weekMealNames.has(normalizedName)) {
              issues.push('duplicate meal name within week');
            } else {
              weekMealNames.add(normalizedName);
            }

            if (globalMealNames.has(normalizedName)) {
              issues.push('duplicate meal name across plan');
            } else {
              globalMealNames.add(normalizedName);
            }
          }
          if (!meal.calories || meal.calories === 0) issues.push('calories = 0');
          if (!meal.protein || meal.protein === 0) issues.push('protein = 0');
          if (!meal.carbs || meal.carbs === 0) issues.push('carbs = 0');
          if (!meal.fat || meal.fat === 0) issues.push('fat = 0');
          const ingredientCount = meal.recipe?.ingredients?.length || 0;
          if (ingredientCount === 0) {
            issues.push('no ingredients');
          } else if (ingredientCount < MIN_INGREDIENTS_PER_MEAL) {
            issues.push(`needs at least ${MIN_INGREDIENTS_PER_MEAL} ingredients (include oils/seasonings)`);
          }
          const instructionCount = meal.recipe?.instructions?.length || 0;
          if (instructionCount === 0) {
            issues.push('no cooking instructions');
          } else if (instructionCount < MIN_INSTRUCTIONS_PER_MEAL) {
            issues.push(`needs at least ${MIN_INSTRUCTIONS_PER_MEAL} detailed instructions`);
          }
          
          if (issues.length > 0) {
            validationErrors.push(`Week ${week.weekNumber}, Meal ${mealIdx + 1} (${meal.recipe?.name || 'unnamed'}): ${issues.join(', ')}`);
          }
        });
      });
      
      if (validationErrors.length > 0) {
        const errorMessage = `❌ FAILED: Batch ${batchNumber} has invalid meals:\n${validationErrors.join('\n')}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      console.log(`  ✅ Batch ${batchNumber} complete: ${validated.weeklyMealTemplates.length} weeks generated`);
      
      // Notify UI that this batch is complete
      if (onReasoningUpdate) {
        onReasoningUpdate(`## ✅ Batch ${batchNumber}/${totalBatches} Complete\n\nSuccessfully generated ${validated.weeklyMealTemplates.length} weekly meal plans with complete nutrition data.`, 'complete');
      }
      
      return validated.weeklyMealTemplates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Batch ${batchNumber} failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, errorMessage);
      
      // Retry on validation errors or transient failures
      if (retryCount < MAX_RETRIES && (
        errorMessage.includes('invalid meals') ||
        errorMessage.includes('Could not extract JSON') ||
        errorMessage.includes('Insufficient reasoning output') ||
        errorMessage.includes('empty response')
      )) {
        console.log(`  🔄 Retrying batch ${batchNumber} (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        // Wait briefly before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.processBatch(userProfile, metrics, batchWeeks, phaseName, batchNumber, totalBatches, onReasoningUpdate, retryCount + 1);
      }
      
      // No more retries or non-retryable error
      throw new Error(`Batch ${batchNumber} failed after ${retryCount + 1} attempts: ${errorMessage}`);
    }
  }

  /**
   * Extract JSON from text response and parse it
   */
  private extractAndParseJSON(text: string): any {
    console.log('📋 Response length:', text.length);
    console.log('📋 First 200 chars:', text.substring(0, 200));
    
    // Try to find JSON object in the response
    console.log('\n🔍 STRATEGY 1: Direct JSON object parsing');
    // Find the first { and then find where the JSON actually ends (not just last })
    const firstBrace = text.indexOf('{');
    if (firstBrace !== -1) {
      console.log('✅ Found opening brace at position:', firstBrace);
      
      // Try to find the end of the JSON by counting braces
      let braceCount = 0;
      let jsonEnd = firstBrace;
      let inString = false;
      let escapeNext = false;
      
      for (let i = firstBrace; i < text.length; i++) {
        const char = text[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
      }
      
      if (braceCount === 0) {
        const jsonString = text.substring(firstBrace, jsonEnd + 1);
        console.log('✅ Extracted JSON (length:', jsonString.length, ')');
        try {
          return JSON.parse(jsonString);
        } catch (error) {
          console.warn('⚠️ Top-level JSON parse failed, attempting fixes...');
          const fixed = this.fixCommonJSONIssues(jsonString);
          try {
            return JSON.parse(fixed);
          } catch (e) {
            console.error('Failed to parse fixed JSON:', e);
          }
        }
      }
    } else {
      console.warn('❌ STRATEGY 1 failed - no opening brace found');
    }
    
    console.log('\n🔍 STRATEGY 2: Markdown code block extraction');
    // Try to reconstruct JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      console.log('✅ Found markdown code block');
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.error('Failed to parse code block JSON:', e);
      }
    } else {
      console.warn('❌ STRATEGY 2 failed - no markdown code block');
    }
    
    console.log('\n🔍 STRATEGY 3: JSON array extraction');
    // Try extracting JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      console.log('✅ Found JSON array');
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return { weeklyMealTemplates: parsed };
        }
      } catch (e) {
        console.error('Failed to parse array JSON:', e);
      }
    } else {
      console.warn('❌ STRATEGY 3 failed - no JSON array');
    }
    
    console.log('\n🔍 STRATEGY 4: Specific key searching');
    // Try finding "weeklyMealTemplates" key specifically
    const wmtMatch = text.match(/"weeklyMealTemplates"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (wmtMatch) {
      console.log('✅ Found weeklyMealTemplates structure');
      try {
        return JSON.parse('{' + wmtMatch[0]);
      } catch (e) {
        console.error('Failed to parse weeklyMealTemplates:', e);
      }
    } else {
      console.warn('❌ STRATEGY 4 failed - no weeklyMealTemplates key');
    }
    
    console.log('\n🔍 STRATEGY 5: Flexible boundary detection');
    // Try line-by-line extraction for nested structures
    
    // Find first { and last }
    const firstBrace5 = text.indexOf('{');
    const lastBrace5 = text.lastIndexOf('}');
    
    console.log('📊 First brace at:', firstBrace5);
    console.log('📊 Last brace at:', lastBrace5);
    
    if (firstBrace5 !== -1 && lastBrace5 !== -1 && lastBrace5 > firstBrace5) {
      const extracted = text.substring(firstBrace5, lastBrace5 + 1);
      console.log('✅ Extracted region found');
      console.log('📋 Extracted region length:', extracted.length);
      console.log('📋 Extracted region (first 200):', extracted.substring(0, 200));
      
      try {
        const fixed = this.fixCommonJSONIssues(extracted);
        console.log('✅ Applied basic JSON fixes');
        return JSON.parse(fixed);
      } catch (e) {
        console.error('Failed to parse extracted region:', e);
        // Try more aggressive fixes
        console.log('🔍 Attempting aggressive fixes...');
        const aggressive = this.aggressiveJSONFix(extracted);
        try {
          console.log('✅ Applied aggressive fixes');
          return JSON.parse(aggressive);
        } catch (e2) {
          console.error('Aggressive fix also failed:', e2);
          console.error('Failed extract (first 500):', aggressive.substring(0, 500));
        }
      }
    } else {
      console.warn('❌ STRATEGY 5 failed - no braces found');
    }
    
    console.log('\n❌ ALL STRATEGIES FAILED');
    throw new Error('Could not extract JSON from response');
  }

  /**
   * Fix common JSON formatting issues
   */
  private fixCommonJSONIssues(jsonString: string): string {
    let fixed = jsonString;
    
    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix single quotes to double quotes (be careful with contractions)
    fixed = fixed.replace(/'([^']*)'(?=\s*[,}\]])/g, '"$1"');
    
    // Fix unquoted property names
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
    
    return fixed;
  }

  /**
   * More aggressive JSON fixing for stubborn cases
   */
  private aggressiveJSONFix(jsonString: string): string {
    let fixed = this.fixCommonJSONIssues(jsonString);
    
    // Remove any leading/trailing whitespace or non-JSON characters
    fixed = fixed.trim();
    
    // Handle common text before JSON (remove "Here is the JSON:" type stuff)
    fixed = fixed.replace(/^[^{]*/, '');
    
    // Handle common text after JSON
    fixed = fixed.replace(/[^}]*$/, '');
    
    // Fix newlines that might be breaking strings
    fixed = fixed.replace(/\n(?=\s*")/g, ' ');
    
    // Fix single line breaks inside strings
    fixed = fixed.replace(/: "([^"]*)\n([^"]*)"/, ': "$1 $2"');
    
    // Remove any BOM characters
    fixed = fixed.replace(/^\uFEFF/, '');
    
    // Handle escaped quotes properly
    fixed = fixed.replace(/\\"/g, '\\"');
    
    // Handle infinity and NaN (replace with strings or numbers)
    fixed = fixed.replace(/:\s*Infinity/g, ': null');
    fixed = fixed.replace(/:\s*NaN/g, ': 0');
    
    return fixed;
  }

  /**
   * Build comprehensive prompt for meal generation
   */
  /**
   * Determine if complex macro balancing is needed (use GPT-OSS 120B)
   * Complex scenarios: extreme deficits, multiple dietary restrictions, macro cycling
   */
  private needsComplexMacroBalancing(userProfile: any, metrics: any, batchWeeks: any[]): boolean {
    // Check for extreme calorie deficits (>25%)
    const firstWeek = batchWeeks[0];
    const dailyCalories = firstWeek?.dailyTargets?.calories || metrics.macros.calories;
    const tdee = metrics.tdee?.value || 2000;
    const deficitPercent = ((tdee - dailyCalories) / tdee) * 100;
    
    if (deficitPercent > 25) {
      console.log(`  ⚠️ Extreme deficit detected (${deficitPercent.toFixed(1)}%) - using GPT-OSS for macro balancing`);
      return true;
    }
    
    // Check for multiple dietary restrictions
    const restrictions = [
      userProfile.excluded_foods?.length > 5,
      userProfile.allergies?.length > 2,
      userProfile.preferences?.toLowerCase().includes('vegan') || userProfile.preferences?.toLowerCase().includes('vegetarian'),
      userProfile.preferences?.toLowerCase().includes('keto') || userProfile.preferences?.toLowerCase().includes('low carb')
    ].filter(Boolean).length;
    
    if (restrictions >= 2) {
      console.log(`  ⚠️ Multiple dietary restrictions detected (${restrictions}) - using GPT-OSS for macro balancing`);
      return true;
    }
    
    // Check for macro cycling requirements
    const hasMacroCycling = batchWeeks.some(week => 
      week.dailyTargets?.carbs !== firstWeek?.dailyTargets?.carbs ||
      week.dailyTargets?.fat !== firstWeek?.dailyTargets?.fat
    );
    
    if (hasMacroCycling && batchWeeks.length > 3) {
      console.log(`  ⚠️ Complex macro cycling detected - using GPT-OSS for macro balancing`);
      return true;
    }
    
    // Default: use cheaper model for simple cases
    return false;
  }

  /**
   * Build prompt for complex macro balancing (GPT-OSS 120B)
   * Only used when needsComplexMacroBalancing() returns true
   */
  private buildComplexMacroBalancingPrompt(
    userProfile: any,
    _metrics: any,
    phaseWeeks: any[],
    phaseName: string
  ): string {
    return `You are an expert sports nutritionist. Your task is to balance complex macronutrient requirements across multiple weeks.

USER PROFILE:
- Goal: ${userProfile.goal}
- Preferences: ${userProfile.preferences}
- Excluded foods: ${userProfile.excluded_foods?.join(', ') || 'None'}
- Allergies: ${userProfile.allergies?.join(', ') || 'None'}

PHASE: ${phaseName}
WEEKS: ${phaseWeeks.length} weeks

MACRO TARGETS BY WEEK:
${phaseWeeks.map(week => `
Week ${week.weekNumber}:
- Calories: ${week.dailyTargets.calories} kcal/day
- Protein: ${week.dailyTargets.protein}g (${week.dailyTargets.proteinPerKg}g/kg)
- Carbs: ${week.dailyTargets.carbs}g
- Fat: ${week.dailyTargets.fat}g
`).join('')}

YOUR TASK:
Analyze the macro distribution across these weeks and provide strategic recommendations for:
1. How to distribute macros across meals to maintain energy and recovery
2. When to adjust carb cycling for training days vs rest days
3. How to manage protein distribution for muscle preservation
4. Fat intake strategies for hormone production and satiety

Provide a detailed reasoning analysis that will guide ingredient selection.
`;
  }

  /**
   * Build prompt for ingredient selection (Llama 3.3 70B - CHEAPER than GPT-OSS)
   * This is the default approach for most cases
   */
  private buildIngredientSelectionPrompt(
    userProfile: any,
    metrics: any,
    phaseWeeks: any[],
    phaseName: string,
    macroBalancingContext: string = ''
  ): string {
    const firstWeek = phaseWeeks[0];
    const dailyCalories = firstWeek?.dailyTargets?.calories || metrics.macros.calories;
    const mealFrequency = userProfile?.mealFrequency || 3;
    
    const mealDistributions: { [key: number]: { breakfast: number, lunch: number, dinner: number, snacks?: number[] } } = {
      3: {
        breakfast: Math.round(dailyCalories * 0.35),
        lunch: Math.round(dailyCalories * 0.40),
        dinner: Math.round(dailyCalories * 0.25)
      },
      4: {
        breakfast: Math.round(dailyCalories * 0.30),
        lunch: Math.round(dailyCalories * 0.35),
        dinner: Math.round(dailyCalories * 0.25),
        snacks: [Math.round(dailyCalories * 0.10)]
      },
      5: {
        breakfast: Math.round(dailyCalories * 0.25),
        lunch: Math.round(dailyCalories * 0.30),
        dinner: Math.round(dailyCalories * 0.25),
        snacks: [Math.round(dailyCalories * 0.10), Math.round(dailyCalories * 0.10)]
      }
    };
    
    const distribution = mealDistributions[mealFrequency] || mealDistributions[3];

    return `${macroBalancingContext ? `MACRO BALANCING CONTEXT:\n${macroBalancingContext}\n\n` : ''}You are a sports nutritionist. Select ingredients that hit EXACT calorie targets for each meal while keeping meals realistic and restaurant-quality.

USER:
- Goal: ${userProfile.goal}
- Preferences: ${userProfile.preferences}  
- Excluded: ${userProfile.excluded_foods?.join(', ') || 'None'}

${phaseName.toUpperCase()} PHASE - ${phaseWeeks.length} WEEKS:
${phaseWeeks.map(week => `Week ${week.weekNumber}: ${week.dailyTargets.calories} kcal/day (${week.dailyTargets.protein}g protein, ${week.dailyTargets.carbs}g carbs, ${week.dailyTargets.fat}g fat)`).join('\n')}

MEAL CALORIE TARGETS PER DAY:
- Breakfast: ${distribution.breakfast} cal
- Lunch: ${distribution.lunch} cal
- Dinner: ${distribution.dinner} cal
${distribution.snacks ? distribution.snacks.map((cal, i) => `- Snack ${i+1}: ${cal} cal`).join('\n') : ''}

YOUR TASK:
For EACH WEEK listed above, provide ${mealFrequency} meals per day with EXACT calorie matching.

REALISM & INGREDIENT RULES:
- Each meal must list **at least ${MIN_INGREDIENTS_PER_MEAL} ingredients** (optimal range 5-8) including cooking fats, aromatics, seasonings, and garnishes.
- Always specify the oil/butter/other fat used for cooking plus key spices (e.g., salt, pepper, paprika, garlic, herbs, citrus, sauces).
- List amounts for every ingredient in grams or milliliters. Include pantry staples if they materially affect flavor/calories.
- Rotate proteins, carb sources, vegetables, and flavor profiles across the entire phase to avoid repetition. Meal names must be unique across all weeks.
- Ensure meals reflect the user's dietary preferences/restrictions while still feeling complete and appetizing.

Format your response like this:

${phaseWeeks.map((week, idx) => `=== WEEK ${week.weekNumber} ===

BREAKFAST (${Math.round(week.dailyTargets.calories * 0.35)} cal):
Meal Name: [Simple descriptive name]
Ingredients:
- Ingredient 1 (protein): [amount]g = [calories] cal
- Ingredient 2 (carb): [amount]g = [calories] cal
- Ingredient 3 (vegetable): [amount]g = [calories] cal
- Ingredient 4 (cooking fat, e.g., olive oil): [amount]g = [calories] cal
- Ingredient 5 (seasoning/garnish, e.g., garlic, herbs, salsa): [amount]g = [calories] cal
Total: [sum] cal (must match target ±10 cal)
Macros: [protein]g protein, [carbs]g carbs, [fat]g fat
Instructions:
1. [Detailed preparation step including seasoning]
2. [Cooking step with time/temperature]
3. [Add vegetables/secondary ingredients]
4. [Finishing/plating instructions]

LUNCH (${Math.round(week.dailyTargets.calories * 0.40)} cal):
[Same format with detailed instructions]

DINNER (${Math.round(week.dailyTargets.calories * 0.25)} cal):
[Same format with detailed instructions]
${idx < phaseWeeks.length - 1 ? '\n' : ''}`).join('')}

CRITICAL:
- Create ${phaseWeeks.length} UNIQUE weekly meal plans
- Each week should have DIFFERENT meals for variety
- Ingredients MUST sum to the exact meal calorie target (±10 cal tolerance)
- Use accurate calorie values from standard nutrition databases
- **EVERY meal MUST include ${MIN_INSTRUCTIONS_PER_MEAL}+ detailed cooking instructions (prep, cooking, finishing, plating)** 
- Instructions should be clear, specific, and actionable (temperatures, times, seasonings)
- **No duplicate meal names anywhere in the plan**
- Keep it simple and easy to extract`;
  }

  /**
   * Build reasoning-focused prompt (asks for ingredient recommendations with rationale)
   * GPT-OSS reasons about WHAT ingredients to use and WHY to hit EXACT calorie targets
   * NOTE: Kept for backward compatibility, but buildIngredientSelectionPrompt is preferred
   */
  private buildReasoningPrompt(
    userProfile: any,
    metrics: any,
    phaseWeeks: any[],
    phaseName: string
  ): string {
    const firstWeek = phaseWeeks[0];
    const dailyCalories = firstWeek?.dailyTargets?.calories || metrics.macros.calories;
    const mealFrequency = userProfile?.mealFrequency || 3;
    
    // Calculate meal calorie distribution
    const mealDistributions: { [key: number]: { breakfast: number, lunch: number, dinner: number, snacks?: number[] } } = {
      3: {
        breakfast: Math.round(dailyCalories * 0.35),
        lunch: Math.round(dailyCalories * 0.40),
        dinner: Math.round(dailyCalories * 0.25)
      },
      4: {
        breakfast: Math.round(dailyCalories * 0.30),
        lunch: Math.round(dailyCalories * 0.35),
        dinner: Math.round(dailyCalories * 0.25),
        snacks: [Math.round(dailyCalories * 0.10)]
      },
      5: {
        breakfast: Math.round(dailyCalories * 0.25),
        lunch: Math.round(dailyCalories * 0.30),
        dinner: Math.round(dailyCalories * 0.25),
        snacks: [Math.round(dailyCalories * 0.10), Math.round(dailyCalories * 0.10)]
      }
    };
    
    const distribution = mealDistributions[mealFrequency] || mealDistributions[3];

    return `You are a sports nutritionist. Your task is to select ingredients that hit EXACT calorie targets for each meal while keeping meals realistic, varied, and flavorful.

USER:
- Goal: ${userProfile.goal}
- Preferences: ${userProfile.preferences}  
- Excluded: ${userProfile.excluded_foods?.join(', ') || 'None'}

${phaseName.toUpperCase()} PHASE - ${phaseWeeks.length} WEEKS:
${phaseWeeks.map(week => `Week ${week.weekNumber}: ${week.dailyTargets.calories} kcal/day (${week.dailyTargets.protein}g protein, ${week.dailyTargets.carbs}g carbs, ${week.dailyTargets.fat}g fat)`).join('\n')}

MEAL CALORIE TARGETS PER DAY:
- Breakfast: ${distribution.breakfast} cal
- Lunch: ${distribution.lunch} cal
- Dinner: ${distribution.dinner} cal
${distribution.snacks ? distribution.snacks.map((cal, i) => `- Snack ${i+1}: ${cal} cal`).join('\n') : ''}

YOUR TASK:
Create ${phaseWeeks.length} UNIQUE weekly meal plans. Each week should have DIFFERENT meals for variety.

For EACH WEEK listed above, provide ${mealFrequency} meals per day.

REALISM & INGREDIENT RULES:
- Minimum ${MIN_INGREDIENTS_PER_MEAL} ingredients per meal (include cooking fats, aromatics, spices, sauces, garnishes).
- Call out oils/butters, salt, pepper, garlic, herbs, citrus, or condiments when they are used.
- Provide gram/ml amounts for every ingredient and ensure totals include these staples.
- Vary proteins, carb bases, vegetables, and flavor profiles across days. Meal names must be unique across all weeks (no repeats).
- Reflect user dietary constraints at all times.

Format your response like this:

${phaseWeeks.map((week, idx) => `=== WEEK ${week.weekNumber} ===

BREAKFAST (${Math.round(week.dailyTargets.calories * 0.35)} cal):
Meal Name: [Simple descriptive name]
Ingredients:
- Ingredient 1 (protein): [amount]g = [calories] cal
- Ingredient 2 (carb): [amount]g = [calories] cal
- Ingredient 3 (vegetable/fruit): [amount]g = [calories] cal
- Ingredient 4 (cooking fat, e.g., avocado oil): [amount]g = [calories] cal
- Ingredient 5 (seasoning or garnish): [amount]g = [calories] cal
Total: [sum] cal
Macros: [protein]g protein, [carbs]g carbs, [fat]g fat
Instructions:
1. [Detailed preparation step with seasoning detail]
2. [Cooking step with time/temperature]
3. [Secondary cooking/assembly step]
4. [Finishing/plating step]

LUNCH (${Math.round(week.dailyTargets.calories * 0.40)} cal):
[Same format with detailed instructions]

DINNER (${Math.round(week.dailyTargets.calories * 0.25)} cal):
[Same format with detailed instructions]
${idx < phaseWeeks.length - 1 ? '\n' : ''}`).join('')}

CRITICAL:
- Create ${phaseWeeks.length} UNIQUE weekly meal plans
- Each week should have DIFFERENT meals for variety
- Ingredients MUST sum to the exact meal calorie target
- Use accurate calorie values
- **EVERY meal MUST include ${MIN_INSTRUCTIONS_PER_MEAL}+ detailed cooking instructions** covering prep, cooking, finishing, and plating
- Instructions should be clear, specific, and actionable (e.g., "Heat pan over medium heat", "Cook for 5 minutes until golden", "Season with salt and pepper")
- Instructions must be numbered step-by-step
- Keep it simple and easy to extract
- **Do NOT create meals without cooking instructions or with duplicate names**`;
  }

  /**
   * Build prompt for Llama 3.3 70B to format reasoning into JSON
   */
  private buildFormattingPrompt(
    reasoning: string,
    _userProfile: any,
    metrics: any,
    phaseWeeks: any[],
    _phaseName: string
  ): string {
    const firstWeek = phaseWeeks[0];
    const dailyCalories = firstWeek?.dailyCalories || metrics.dailyCalories || 2000;

    return `Extract ingredient data from meal recommendations and format as JSON.

MEAL RECOMMENDATIONS:
${reasoning}

YOUR TASK:
Extract ALL weeks from the meal recommendations. The recommendations are organized by week number like:

=== WEEK X ===
BREAKFAST (700 cal):
Meal Name: Oatmeal with Eggs
Ingredients:
- Oats: 80g = 303 cal
- Eggs: 100g = 143 cal
Total: 553 cal
Macros: 25g protein, 68g carbs, 16g fat
Instructions:
1. Cook oats
2. Scramble eggs

LUNCH (800 cal):
[meal data]

DINNER (500 cal):
[meal data]

Extract ALL weeks and ALL meals into the JSON array.

CRITICAL EXTRACTION RULES:
1. Extract ALL weeks found (use exact week numbers from "=== WEEK X ===")
2. For EACH meal, you MUST extract:
   - Meal Name (from "Meal Name:" line)
   - Total calories (number after "Total:")
   - Macros from "Macros:" line:
     * protein = number before "g protein"
     * carbs = number before "g carbs"
     * fat = number before "g fat"
   - Every ingredient with amounts and calories (include oils, seasonings, garnishes)
   - **ALL instruction steps from the "Instructions:" section (REQUIRED - if missing, meal is INVALID)**
3. EVERY meal MUST have:
   - Valid numbers for: calories, protein, carbs, fat (all > 0)
   - **At least ${MIN_INGREDIENTS_PER_MEAL} ingredients**
   - **At least ${MIN_INSTRUCTIONS_PER_MEAL} instruction steps** in recipe.instructions array
4. NO meal should have 0 calories, missing macros, or empty instructions array
5. **If a meal has missing ingredients, missing instructions, or duplicates of another meal name, DO NOT include it**

EXAMPLE - If you see this:
"BREAKFAST (700 cal):
Meal Name: Oatmeal with Eggs
Ingredients:
- Oats: 80g = 303 cal
- Eggs: 100g = 143 cal
Total: 446 cal
Macros: 25g protein, 68g carbs, 16g fat
Instructions:
1. Bring water to boil and cook oats for 5 minutes
2. Scramble eggs in a pan with a pinch of salt
3. Serve oats in a bowl topped with scrambled eggs"

You MUST extract:
{
  "mealType": "Breakfast",
  "calories": 446,
  "protein": 25,
  "carbs": 68,
  "fat": 16,
  "recipe": {
    "name": "Oatmeal with Eggs",
    "ingredients": [
      {"name": "Oats", "amount": "80g", "calories": 303},
      {"name": "Eggs", "amount": "100g", "calories": 143}
    ],
    "instructions": [
      "Bring water to boil and cook oats for 5 minutes",
      "Scramble eggs in a pan with a pinch of salt",
      "Serve oats in a bowl topped with scrambled eggs"
    ]
  }
}

Return ONLY valid JSON (no text, no markdown):

{
  "weeklyMealTemplates": [
    {
      "weekNumber": 1,
      "totalCalories": ${dailyCalories},
      "totalProtein": ${metrics.proteinTarget || 150},
      "totalCarbs": ${metrics.carbTarget || 200},
      "totalFat": ${metrics.fatTarget || 67},
      "meals": [
        {
          "mealType": "Breakfast",
          "timing": "Post-Wake",
          "calories": 700,
          "protein": 45,
          "carbs": 85,
          "fat": 20,
          "recipe": {
            "name": "Protein Oatmeal",
            "ingredients": [
              {
                "name": "Oats",
                "amount": "80g",
                "calories": 303
              }
            ],
            "instructions": ["Cook oats"]
          }
        }
      ]
    },
    {
      "weekNumber": 2,
      "totalCalories": ${dailyCalories},
      "totalProtein": ${metrics.proteinTarget || 150},
      "totalCarbs": ${metrics.carbTarget || 200},
      "totalFat": ${metrics.fatTarget || 67},
      "meals": [
      ]
    }
    // ... continue for all weeks in the recommendations
  ]
}`;
  }

  /**
   * System prompt for GPT-OSS reasoning model
   * Note: GPT-OSS works best with instructions in user messages, not system prompts
   * This provides context only
   */
  private getReasoningSystemPrompt(): string {
    return `You are a sports nutritionist. Select ingredients with exact amounts that sum to precise calorie targets. Provide detailed, step-by-step cooking instructions for every meal. Format responses in a simple, structured format for easy data extraction.`;
  }

  /**
   * System prompt for Llama 4 Scout (formatting phase)
   */
  private getFormattingSystemPrompt(): string {
    return `You are a data extraction assistant. Extract meal data from structured text and format as JSON.

CRITICAL RULES:
1. Output ONLY valid JSON - no text before or after, no explanations, no markdown
2. NO markdown code blocks (no \`\`\`json)
3. For EACH meal, you MUST extract:
   - Meal name from "Meal Name:" line
   - Total calories from "Total:" line
   - Protein, carbs, fat from "Macros:" line (e.g., "25g protein, 68g carbs, 16g fat" → protein: 25, carbs: 68, fat: 16)
   - All ingredients with amounts and calories
   - **ALL instruction steps from "Instructions:" section (REQUIRED - if missing, DO NOT include that meal)**
4. EVERY meal MUST have non-zero values for: calories, protein, carbs, fat
5. **EVERY meal MUST have at least ${MIN_INSTRUCTIONS_PER_MEAL} instruction steps and at least ${MIN_INGREDIENTS_PER_MEAL} ingredients** - if instructions or ingredient counts are missing, exclude that meal entirely
6. Extract ingredients exactly as listed with amounts and calories, including oils, seasonings, and garnishes
7. Extract ALL instructions exactly as numbered/listed (look for "1.", "2.", "3." etc. after "Instructions:")
8. If a meal has no "Instructions:" section or empty instructions, DO NOT include it in the JSON
9. Enforce unique meal names across the entire JSON (exclude duplicates or rename is NOT allowed)
10. No trailing commas
11. Proper bracket/brace matching

**VALIDATION CHECK**: Before outputting JSON, verify every meal has:
- recipe.name (non-empty string)
- recipe.ingredients (array with at least ${MIN_INGREDIENTS_PER_MEAL} items)
- recipe.instructions (array with at least ${MIN_INSTRUCTIONS_PER_MEAL} items)
- calories > 0, protein > 0

If any meal fails validation, exclude it from the output. Only include complete meals with full instructions.

Your job is pure data extraction - read the structured meal data carefully and extract ALL values including macros and ALL cooking instructions. Incomplete meals without instructions should be excluded.`;
  }
}
