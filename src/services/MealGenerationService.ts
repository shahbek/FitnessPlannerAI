import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';

export interface GenerateMealParams {
  userProfile: any;
  metrics: any;
  phaseWeeks: any[];
  phaseName: string;
  groqApiKey?: string;
}

export class MealGenerationService {
  private groq: any;

  constructor(apiKey: string) {
    this.groq = createGroq({ apiKey });
  }

  /**
   * Generate meals using Groq's two-step reasoning approach with batch parallelization:
   * 1. Split weeks into batches of 3-4 weeks
   * 2. Process batches in parallel:
   *    a. GPT-OSS 120B reasons about WHICH INGREDIENTS to use (per batch)
   *    b. Llama 4 Scout extracts and formats to JSON (per batch)
   * 3. Combine all results
   */
  async generateMealTemplatesWithGroq(params: GenerateMealParams): Promise<any[]> {
    const { userProfile, metrics, phaseWeeks, phaseName } = params;

    try {
      // Split weeks into batches of 3 for optimal performance
      const BATCH_SIZE = 3;
      const batches: any[][] = [];
      
      for (let i = 0; i < phaseWeeks.length; i += BATCH_SIZE) {
        batches.push(phaseWeeks.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`🚀 Processing ${phaseWeeks.length} weeks in ${batches.length} parallel batches (${BATCH_SIZE} weeks per batch)...`);
      
      // Process all batches in parallel
      const batchPromises = batches.map((batchWeeks, batchIndex) => 
        this.processBatch(userProfile, metrics, batchWeeks, phaseName, batchIndex + 1, batches.length)
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
   */
  private async processBatch(
    userProfile: any,
    metrics: any,
    batchWeeks: any[],
    phaseName: string,
    batchNumber: number,
    totalBatches: number
  ): Promise<any[]> {
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Processing weeks ${batchWeeks[0].weekNumber}-${batchWeeks[batchWeeks.length - 1].weekNumber}...`);
    
    try {
      // STEP 1: Use OpenAI GPT-OSS 120B reasoning model for ingredient selection
      console.log(`  🧠 Step 1: GPT-OSS 120B reasoning...`);
      
      const reasoningModel = this.groq('openai/gpt-oss-120b');
      
      // Build reasoning-focused prompt (no JSON request)
      const reasoningPrompt = this.buildReasoningPrompt(userProfile, metrics, batchWeeks, phaseName);
      
      const reasoningResult = await generateText({
        model: reasoningModel,
        prompt: reasoningPrompt,
        temperature: 0.6,
        system: this.getReasoningSystemPrompt(),
        providerOptions: {
          groq: {
            reasoningEffort: 'high', // Use high reasoning effort for complex nutrition science
            includeReasoning: true    // Include reasoning in response
          }
        }
      });

      // Extract reasoning from GPT-OSS response
      let reasoning = this.extractReasoning(reasoningResult);
      
      if (!reasoning || reasoning.length < 100) {
        console.warn(`  ⚠️ Batch ${batchNumber}: No substantial reasoning extracted`);
        throw new Error('Insufficient reasoning output');
      }
      
      console.log(`  ✅ Reasoning extracted: ${reasoning.length} chars`);
      
      // STEP 2: Use Llama 4 Scout to extract ingredient data and create JSON
      console.log(`  🧠 Step 2: Llama 4 Scout formatting...`);
      
      const formattingModel = this.groq('meta-llama/llama-4-scout-17b-16e-instruct');
      
      const formattingPrompt = this.buildFormattingPrompt(reasoning, userProfile, metrics, batchWeeks, phaseName);
      
      const result = await generateText({
        model: formattingModel,
        prompt: formattingPrompt,
        temperature: 0.1, // Very low temp for precise formatting
        system: this.getFormattingSystemPrompt()
      });

      // Extract text from standard response
      const responseText = result.text || '';
      
      if (!responseText) {
        throw new Error('Llama 4 Scout returned empty response');
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

      // Validate meal data completeness
      let hasIssues = false;
      validated.weeklyMealTemplates.forEach((week: any) => {
        week.meals?.forEach((meal: any, mealIdx: number) => {
          const issues: string[] = [];
          
          if (!meal.recipe?.name) issues.push('missing name');
          if (!meal.calories || meal.calories === 0) issues.push('calories = 0');
          if (!meal.protein || meal.protein === 0) issues.push('protein = 0');
          if (!meal.carbs || meal.carbs === 0) issues.push('carbs = 0');
          if (!meal.fat || meal.fat === 0) issues.push('fat = 0');
          
          if (issues.length > 0) {
            console.warn(`  ⚠️ Week ${week.weekNumber}, Meal ${mealIdx + 1}: ${issues.join(', ')}`);
            hasIssues = true;
          }
        });
      });
      
      if (hasIssues) {
        console.warn(`  ⚠️ Batch ${batchNumber} has meals with missing data. Consider regenerating.`);
      }

      console.log(`  ✅ Batch ${batchNumber} complete: ${validated.weeklyMealTemplates.length} weeks generated`);
      return validated.weeklyMealTemplates;
    } catch (error) {
      console.error(`  ❌ Batch ${batchNumber} failed:`, error);
      throw error;
    }
  }

  /**
   * Extract reasoning from GPT-OSS response
   */
  private extractReasoning(reasoningResult: any): string {
    let reasoning = '';
    
    // Strategy 1: Check experimental_providerMetadata for reasoning
    if (reasoningResult.experimental_providerMetadata?.groq?.reasoning) {
      reasoning = reasoningResult.experimental_providerMetadata.groq.reasoning;
    } 
    // Strategy 2: Check steps array (from our earlier tests)
    else if (reasoningResult.steps && Array.isArray(reasoningResult.steps)) {
      for (const step of reasoningResult.steps) {
        // Check response body for reasoning
        if (step.response?.body?.choices?.[0]?.message?.reasoning) {
          reasoning = step.response.body.choices[0].message.reasoning;
          break;
        }
        // Check for content
        if (step.response?.body?.choices?.[0]?.message?.content) {
          reasoning = step.response.body.choices[0].message.content;
          break;
        }
      }
    }
    // Strategy 3: Check response directly for reasoning field
    else if (reasoningResult.reasoning) {
      reasoning = reasoningResult.reasoning;
    }
    // Strategy 4: Fallback to text
    else {
      reasoning = reasoningResult.text || '';
    }
    
    return reasoning;
  }

  /**
   * Extract JSON from text response and parse it
   */
  private extractAndParseJSON(text: string): any {
    console.log('📋 Response length:', text.length);
    console.log('📋 First 200 chars:', text.substring(0, 200));
    
    // Try to find JSON object in the response
    console.log('\n🔍 STRATEGY 1: Direct JSON object parsing');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('✅ Found JSON object at top level');
      console.log('📊 Match length:', jsonMatch[0].length);
      console.log('📊 Match starts:', jsonMatch[0].substring(0, 100));
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.warn('⚠️ Top-level JSON parse failed, attempting fixes...');
        const fixed = this.fixCommonJSONIssues(jsonMatch[0]);
        try {
          return JSON.parse(fixed);
        } catch (e) {
          console.error('Failed to parse fixed JSON:', e);
        }
      }
    } else {
      console.warn('❌ STRATEGY 1 failed - no JSON object found');
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
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    console.log('📊 First brace at:', firstBrace);
    console.log('📊 Last brace at:', lastBrace);
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = text.substring(firstBrace, lastBrace + 1);
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
   * Build reasoning-focused prompt (asks for ingredient recommendations with rationale)
   * GPT-OSS reasons about WHAT ingredients to use and WHY to hit EXACT calorie targets
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

    return `You are a sports nutritionist. Your task is to select ingredients that hit EXACT calorie targets for each meal.

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

Format your response like this:

${phaseWeeks.map((week, idx) => `=== WEEK ${week.weekNumber} ===

BREAKFAST (${Math.round(week.dailyTargets.calories * 0.35)} cal):
Meal Name: [Simple descriptive name]
Ingredients:
- Ingredient 1: [amount]g = [calories] cal
- Ingredient 2: [amount]g = [calories] cal
Total: [sum] cal
Macros: [protein]g protein, [carbs]g carbs, [fat]g fat
Instructions:
1. [Step 1]
2. [Step 2]

LUNCH (${Math.round(week.dailyTargets.calories * 0.40)} cal):
[Same format]

DINNER (${Math.round(week.dailyTargets.calories * 0.25)} cal):
[Same format]
${idx < phaseWeeks.length - 1 ? '\n' : ''}`).join('')}

CRITICAL:
- Create ${phaseWeeks.length} UNIQUE weekly meal plans
- Each week should have DIFFERENT meals for variety
- Ingredients MUST sum to the exact meal calorie target
- Use accurate calorie values
- Keep it simple and easy to extract`;
  }

  /**
   * Build prompt for Llama 4 Scout to format reasoning into JSON
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
   - All ingredients with amounts and calories
   - All instruction steps
3. EVERY meal MUST have valid numbers for: calories, protein, carbs, fat
4. NO meal should have 0 calories or missing macros

EXAMPLE - If you see this:
"BREAKFAST (700 cal):
Meal Name: Oatmeal with Eggs
Ingredients:
- Oats: 80g = 303 cal
- Eggs: 100g = 143 cal
Total: 446 cal
Macros: 25g protein, 68g carbs, 16g fat
Instructions:
1. Cook oats"

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
    "instructions": ["Cook oats"]
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
    return `You are a sports nutritionist. Select ingredients with exact amounts that sum to precise calorie targets. Format responses in a simple, structured format for easy data extraction.`;
  }

  /**
   * System prompt for Llama 4 Scout (formatting phase)
   */
  private getFormattingSystemPrompt(): string {
    return `You are a data extraction assistant. Extract meal data from structured text and format as JSON.

CRITICAL RULES:
1. Output ONLY valid JSON - no text before or after
2. NO markdown code blocks (no \`\`\`json)
3. For EACH meal, you MUST extract:
   - Meal name from "Meal Name:" line
   - Total calories from "Total:" line
   - Protein, carbs, fat from "Macros:" line (e.g., "25g protein, 68g carbs, 16g fat" → protein: 25, carbs: 68, fat: 16)
   - All ingredients with amounts and calories
   - All instruction steps
4. EVERY meal MUST have non-zero values for: calories, protein, carbs, fat
5. Extract ingredients exactly as listed
6. Extract instructions exactly as listed
7. No trailing commas
8. Proper bracket/brace matching

Your job is pure data extraction - read the structured meal data carefully and extract ALL values including macros.`;
  }
}

