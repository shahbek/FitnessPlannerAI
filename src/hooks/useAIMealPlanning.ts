import { useState, useCallback } from 'react';
import { FormState, WeeklyCheckpoint, ProgressionPhase } from '@/types';

interface AIMealPlan {
  day: string;
  meals: Array<{
    name: string;
    phase: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foods: Array<{
      name: string;
      amount: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      preparation: string;
      cookingMethod: string;
    }>;
    timing: string;
    prepTime: number;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    description: string;
    instructions: string[];
    tips: string[];
    variations: string[];
    scientificRationale: string;
    confidence: number;
    references: string[];
  }>;
}

interface WeeklyMealPlan {
  week: number;
  phase: string;
  dailyPlans: AIMealPlan[];
  weeklyNutritionSummary: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    averagePrepTime: number;
    adherenceScore: number;
  };
  scientificBasis: string[];
  confidence: number;
}

export function useAIMealPlanning(form: FormState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);

  const generateAIMealPlan = useCallback(async (checkpoint: WeeklyCheckpoint, phase: ProgressionPhase, userPreferences: string[]) => {
    setLoading(true);
    setError('');

    // Validate API key and endpoint
    if (!form.apiKey || !form.endpoint) {
      setError('API key and endpoint are required');
      setLoading(false);
      return;
    }

    try {
      const mealPlanningPrompt = `You are a world-class sports nutritionist and culinary expert specializing in contest preparation and bodybuilding. Your task is to create a comprehensive, scientifically-backed meal plan for every day of the week.

CRITICAL REQUIREMENTS:
1. You must provide scientific references for ALL nutritional recommendations
2. Your confidence level must be 90%+ for all meal plans
3. Use only peer-reviewed research from reputable nutrition journals
4. Cite specific studies with authors, year, and key findings
5. Explain the physiological mechanisms behind each meal choice
6. Consider contest prep protocols, meal timing, and nutrient bioavailability

USER PROFILE:
- Age: ${form.age} years
- Sex: ${form.sex}
- Weight: ${checkpoint.predictedWeight}kg
- Current Body Fat: ${checkpoint.predictedBodyFat}%
- Target Body Fat: ${form.targetBf || 12}%
- Training Experience: ${form.trainingAge}
- Food Preferences: ${userPreferences.join(', ')}
- Dietary Restrictions: ${form.avoid || 'None'}
- Equipment: ${form.equipment || 'Basic kitchen'}
- Schedule: ${form.schedule || 'Not specified'}

CURRENT PHASE: ${phase.name} (${phase.type})
- Phase Description: ${phase.description}
- Target Deficit: ${phase.targetDeficit}%
- Protein Multiplier: ${phase.proteinMultiplier}g/kg bodyweight

NUTRITIONAL TARGETS (MUST HIT EXACTLY):
- Daily Calories: ${checkpoint.dailyCalories}
- Protein: ${checkpoint.proteinGrams}g
- Fat: ${checkpoint.fatGrams}g
- Carbs: ${checkpoint.carbGrams}g

SCIENTIFIC REQUIREMENTS:

1. MEAL TIMING OPTIMIZATION:
- Reference Aragon & Schoenfeld (2013) for meal timing around training
- Consider protein synthesis windows (Morton et al., 2018)
- Plan pre/post workout nutrition based on phase goals

2. NUTRIENT BIOAVAILABILITY:
- Optimize protein sources for amino acid profiles
- Reference Phillips & Van Loon (2011) for protein quality
- Consider cooking methods that preserve nutrients

3. CONTEST PREP PROTOCOLS:
- Reference Helms et al. (2014) for contest prep nutrition
- Plan for water manipulation and sodium cycling
- Consider psychological factors and adherence

4. MACRO DISTRIBUTION:
- Distribute macros optimally across 6 meals
- Reference Helms et al. (2018) for contest prep macro timing
- Ensure adequate fiber and micronutrients

5. CULINARY EXCELLENCE:
- Create meals that are both nutritious and enjoyable
- Consider food psychology and adherence factors
- Provide detailed cooking instructions and techniques

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{
  "week": ${checkpoint.week},
  "phase": "${phase.name}",
  "dailyPlans": [
    {
      "day": "Monday",
      "meals": [
        {
          "name": "High-Protein Oatmeal Power Bowl",
          "phase": "${phase.name}",
          "calories": 450,
          "protein": 35,
          "carbs": 45,
          "fat": 12,
          "foods": [
            {
              "name": "Rolled Oats",
              "amount": "60g",
              "calories": 200,
              "protein": 8,
              "carbs": 35,
              "fat": 4,
              "preparation": "Soaked overnight for better digestibility",
              "cookingMethod": "Simmered with water and protein powder"
            }
          ],
          "timing": "7:00 AM",
          "prepTime": 15,
          "difficulty": "Beginner",
          "description": "Nutrient-dense breakfast optimized for muscle protein synthesis",
          "instructions": [
            "Soak oats overnight in water",
            "Heat in saucepan with protein powder",
            "Top with berries and nuts"
          ],
          "tips": [
            "Meal prep friendly - can be prepared in batches",
            "Add cinnamon for flavor without calories",
            "Store in fridge for up to 3 days"
          ],
          "variations": [
            "Substitute quinoa for oats",
            "Add Greek yogurt for extra protein",
            "Use different berries for variety"
          ],
          "scientificRationale": "High protein content supports muscle protein synthesis during caloric restriction",
          "confidence": 0.95,
          "references": [
            "Morton et al. (2018) - Protein timing and muscle protein synthesis",
            "Aragon & Schoenfeld (2013) - Nutrient timing around training"
          ]
        }
      ]
    }
  ],
  "weeklyNutritionSummary": {
    "totalCalories": 11200,
    "totalProtein": 1400,
    "totalCarbs": 800,
    "totalFat": 350,
    "averagePrepTime": 20,
    "adherenceScore": 0.92
  },
  "scientificBasis": [
    "Helms et al. (2014) - Contest prep nutrition guidelines",
    "Phillips & Van Loon (2011) - Protein recommendations for athletes"
  ],
  "confidence": 0.93
}

Generate a complete 7-day meal plan with 6 meals per day (42 total meals) that are scientifically optimized for contest preparation.`;

      const request = {
        model: form.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a world-class sports nutritionist and culinary expert. Create scientifically-backed meal plans with high confidence and proper citations.' 
          },
          { role: 'user', content: mealPlanningPrompt },
        ],
        temperature: 0.4, // Slightly higher for creativity in meal planning
      };

      const res = await fetch(form.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${form.apiKey}`,
        },
        body: JSON.stringify(request),
      }).catch(fetchError => {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('API Error:', res.status, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      
      console.log('AI Meal Plan received:', {
        status: res.status,
        contentLength: content.length,
        firstChars: content.substring(0, 200)
      });
      
      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/```json([\s\S]*?)```/i) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        console.log('Extracted JSON string:', jsonStr.substring(0, 500));
        
        const parsedPlan = JSON.parse(jsonStr) as WeeklyMealPlan;
        
        // Validate the plan structure
        if (parsedPlan.week && parsedPlan.phase && parsedPlan.dailyPlans && parsedPlan.weeklyNutritionSummary) {
          setWeeklyPlan(parsedPlan);
          console.log('Successfully generated AI meal plan with confidence:', parsedPlan.confidence);
          setError(''); // Clear any previous errors
        } else {
          throw new Error('Invalid meal plan structure - missing required fields');
        }
      } catch (parseError) {
        console.error('Failed to parse AI meal plan:', parseError);
        console.log('Raw response:', content);
        
        setError('AI meal planning failed. Please try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate meal plan');
      console.error('Meal plan generation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [form]);

  return {
    weeklyPlan,
    loading,
    error,
    generateAIMealPlan,
    clearError: () => setError('')
  };
}
