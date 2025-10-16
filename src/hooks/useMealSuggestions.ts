import { useState, useCallback } from 'react';
import { FormState, WeeklyCheckpoint, ProgressionPhase } from '@/types';

interface MealSuggestion {
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
  }>;
  timing: string;
  prepTime: number;
  description: string;
  instructions: string[];
  tips: string[];
  variations: string[];
}

interface WeeklyMealPlan {
  day: string;
  meals: MealSuggestion[];
}

interface UseMealSuggestionsProps {
  form: FormState;
  checkpoint: WeeklyCheckpoint;
  phase: ProgressionPhase;
  userPreferences: string[];
}

export function useMealSuggestions({ form, checkpoint, phase, userPreferences }: UseMealSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan[]>([]);

  const generateMealSuggestions = useCallback(async () => {
    setLoading(true);
    setError('');

    // Validate API key and endpoint
    if (!form.apiKey || !form.endpoint) {
      setError('API key and endpoint are required');
      setLoading(false);
      return;
    }

    // Validate API key format (should be alphanumeric)
    if (!/^[a-zA-Z0-9_-]+$/.test(form.apiKey)) {
      setError('Invalid API key format');
      setLoading(false);
      return;
    }

    try {
      const mealPrompt = `You are an expert nutritionist and chef specializing in bodybuilding and fitness nutrition. Create 6 detailed, personalized meals for EVERY DAY OF THE WEEK for this specific week.

CRITICAL: The user's goal is to reach ${form.targetBf || 12}% body fat. This is the ONLY target that matters. Every meal must contribute to this goal.

USER PROFILE:
- Age: ${form.age}, Sex: ${form.sex}, Weight: ${form.weightKg}kg
- Current Body Fat: ${checkpoint.predictedBodyFat}% (Week ${checkpoint.week})
- TARGET BODY FAT: ${form.targetBf || 12}% (NON-NEGOTIABLE GOAL)
- Training Experience: ${form.trainingAge}
- Food Preferences: ${userPreferences.join(', ')}
- Dietary Restrictions: ${form.avoid || 'None'}
- Equipment: ${form.equipment || 'Basic kitchen'}
- Schedule: ${form.schedule || 'Not specified'}

CURRENT PHASE: ${phase.name} (${phase.type}) - ${phase.description}
TARGET DEFICIT: ${phase.targetDeficit}% | Protein: ${phase.proteinMultiplier}g/kg

DAILY MACROS TO DISTRIBUTE ACROSS 6 MEALS:
- Total Calories: ${checkpoint.dailyCalories}
- Total Protein: ${checkpoint.proteinGrams}g
- Total Fat: ${checkpoint.fatGrams}g  
- Total Carbs: ${checkpoint.carbGrams}g

WEEKLY MEAL PLAN REQUIREMENTS:
1. Create 6 meals for EACH DAY (Monday-Sunday) = 42 total meals
2. Each meal must feature the user's preferred foods: ${userPreferences.join(', ')}
3. Provide exact ingredient amounts and detailed cooking instructions
4. Include prep time, difficulty level, and optimal meal timing
5. Add cooking tips, storage advice, and 2-3 variations per meal
6. Make meals appropriate for ${phase.name} phase
7. Ensure each meal is satisfying and the user will look forward to eating it
8. EVERY MEAL MUST CONTRIBUTE TO THE ${form.targetBf || 12}% BODY FAT GOAL

MEAL DISTRIBUTION PER DAY:
- Meal 1 (Pre-Workout): 15% of daily calories, higher carbs
- Meal 2 (Post-Workout): 20% of daily calories, highest protein
- Meal 3 (Lunch): 20% of daily calories, balanced macros
- Meal 4 (Snack): 15% of daily calories, protein-focused
- Meal 5 (Dinner): 20% of daily calories, protein + vegetables
- Meal 6 (Evening): 10% of daily calories, protein + healthy fats

CRITICAL: You MUST return ONLY valid JSON. No explanations, no markdown, no code blocks. Just pure JSON.

OUTPUT FORMAT - Return ONLY valid JSON array with this exact structure:
[
  {
    "day": "Monday",
    "meals": [
      {
        "name": "Creative Meal Name",
        "phase": "${phase.name}",
        "calories": 450,
        "protein": 35,
        "carbs": 25,
        "fat": 20,
        "foods": [
          {
            "name": "Specific Ingredient Name",
            "amount": "150g",
            "calories": 200,
            "protein": 25,
            "carbs": 10,
            "fat": 8
          }
        ],
        "timing": "7:00 AM",
        "prepTime": 15,
        "description": "Appealing description of why this meal is perfect",
        "instructions": [
          "Step 1: Detailed cooking instruction",
          "Step 2: Next step with technique",
          "Step 3: Final preparation step"
        ],
        "tips": [
          "Meal prep tip",
          "Storage advice",
          "Cooking technique"
        ],
        "variations": [
          "Variation 1 with different ingredient",
          "Variation 2 with different cooking method",
          "Variation 3 for different time of day"
        ]
      }
    ]
  }
]

Generate 7 days (Monday-Sunday) with 6 meals each. Make each meal feel personally crafted for this user's preferences and their ${form.targetBf || 12}% body fat goal.

IMPORTANT: Start your response with [ and end with ]. Do not include any text before or after the JSON array.`;

      const request = {
        model: form.model,
        messages: [
          { role: 'system', content: 'You are an expert nutritionist and chef specializing in bodybuilding and contest prep nutrition. Generate detailed, personalized meal suggestions.' },
          { role: 'user', content: mealPrompt },
        ],
        temperature: 0.7, // Higher creativity for meal suggestions
      };

      console.log('Sending meal planning request:', {
        endpoint: form.endpoint,
        model: form.model,
        hasApiKey: !!form.apiKey
      });

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

      console.log('API Response status:', res.status, res.statusText);

      if (!res.ok) {
        const text = await res.text();
        console.error('API Error:', res.status, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log('API Response data:', data);
      
      const content = data?.choices?.[0]?.message?.content || '';
      
      console.log('AI Response received:', {
        status: res.status,
        contentLength: content.length,
        firstChars: content.substring(0, 200),
        hasChoices: !!data?.choices,
        choicesLength: data?.choices?.length
      });
      
      try {
        console.log('Raw AI response:', content);
        
        // Try multiple JSON extraction methods
        let jsonStr = '';
        
        // Method 1: Look for ```json code blocks
        const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
        if (jsonBlockMatch) {
          jsonStr = jsonBlockMatch[1].trim();
          console.log('Found JSON in code block');
        } else {
          // Method 2: Look for array pattern
          const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (arrayMatch) {
            jsonStr = arrayMatch[0];
            console.log('Found JSON array pattern');
          } else {
            // Method 3: Try to find any JSON-like structure
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
              console.log('Found JSON object pattern');
            } else {
              // Method 4: Use the entire content if it looks like JSON
              if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
                jsonStr = content.trim();
                console.log('Using entire content as JSON');
              } else {
                throw new Error('No valid JSON found in response');
              }
            }
          }
        }
        
        console.log('Extracted JSON string (first 1000 chars):', jsonStr.substring(0, 1000));
        
        const parsedWeeklyPlan = JSON.parse(jsonStr) as WeeklyMealPlan[];
        
        // Validate the weekly plan structure
        if (Array.isArray(parsedWeeklyPlan) && parsedWeeklyPlan.length > 0) {
          const validWeeklyPlan = parsedWeeklyPlan.filter(day => 
            day.day && 
            day.meals && 
            Array.isArray(day.meals) &&
            day.meals.length === 6
          );
          
          if (validWeeklyPlan.length > 0) {
            setWeeklyPlan(validWeeklyPlan);
            // Flatten all meals for backward compatibility
            const allMeals = validWeeklyPlan.flatMap(day => day.meals);
            setSuggestions(allMeals);
            console.log('Successfully generated weekly meal plan:', validWeeklyPlan.length, 'days');
            setError(''); // Clear any previous errors
          } else {
            throw new Error('Invalid weekly plan structure - no valid days found');
          }
        } else {
          throw new Error('Invalid response format - not an array');
        }
      } catch (parseError) {
        console.error('Failed to parse AI meal suggestions:', parseError);
        console.log('Raw response (first 2000 chars):', content.substring(0, 2000));
        
        // Create a comprehensive fallback weekly plan
        const fallbackWeeklyPlan = generateFallbackWeeklyPlan(checkpoint, phase, userPreferences);
        setWeeklyPlan(fallbackWeeklyPlan);
        setSuggestions(fallbackWeeklyPlan.flatMap(day => day.meals));
        setError('AI meal generation failed. Using fallback meal plan. Please try again.');
      }
    } catch (e: any) {
      console.error('Meal suggestion generation failed:', e);
      
      // If API call failed completely, use fallback
      if (e.message.includes('Network error') || e.message.includes('HTTP')) {
        console.log('API call failed, using fallback meal plan');
        const fallbackWeeklyPlan = generateFallbackWeeklyPlan(checkpoint, phase, userPreferences);
        setWeeklyPlan(fallbackWeeklyPlan);
        setSuggestions(fallbackWeeklyPlan.flatMap(day => day.meals));
        setError('API connection failed. Using fallback meal plan. Please check your API key and try again.');
      } else {
        setError(e.message || 'Failed to generate meal suggestions');
      }
    } finally {
      setLoading(false);
    }
  }, [form, checkpoint, phase, userPreferences]);

  const regenerateSuggestions = useCallback(() => {
    generateMealSuggestions();
  }, [generateMealSuggestions]);

  return {
    suggestions,
    weeklyPlan,
    loading,
    error,
    generateMealSuggestions,
    regenerateSuggestions,
    clearError: () => setError('')
  };
}

// Generate comprehensive fallback weekly plan
function generateFallbackWeeklyPlan(
  checkpoint: WeeklyCheckpoint, 
  phase: ProgressionPhase, 
  userPreferences: string[]
): WeeklyMealPlan[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealNames = [
    ['Protein Pancakes', 'Greek Yogurt Bowl', 'Oatmeal Power Bowl'],
    ['Whey Protein Shake', 'Recovery Smoothie', 'Post-Workout Shake'],
    ['Hard-Boiled Eggs', 'Cottage Cheese', 'Protein Bar'],
    ['Grilled Chicken Salad', 'Turkey Wrap', 'Salmon Bowl'],
    ['Almonds & Berries', 'Protein Pudding', 'Veggie Sticks'],
    ['Grilled Steak & Veggies', 'Baked Fish', 'Chicken Stir-Fry']
  ];

  const mealTimings = ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '4:00 PM', '7:00 PM'];
  const mealPercentages = [0.15, 0.20, 0.10, 0.25, 0.10, 0.20];

  return days.map((day, dayIndex) => ({
    day,
    meals: mealNames.map((mealGroup, mealIndex) => {
      const calories = Math.round(checkpoint.dailyCalories * mealPercentages[mealIndex]);
      const protein = Math.round(checkpoint.proteinGrams * mealPercentages[mealIndex]);
      const carbs = Math.round(checkpoint.carbGrams * mealPercentages[mealIndex]);
      const fat = Math.round(checkpoint.fatGrams * mealPercentages[mealIndex]);

      // Create realistic meal combinations based on meal type
      let foods;
      if (mealIndex === 0) { // Breakfast
        foods = [
          {
            name: 'Oats',
            amount: '50g',
            calories: Math.round(calories * 0.4),
            protein: Math.round(protein * 0.2),
            carbs: Math.round(carbs * 0.7),
            fat: Math.round(fat * 0.2)
          },
          {
            name: 'Whey Protein',
            amount: '30g',
            calories: Math.round(calories * 0.4),
            protein: Math.round(protein * 0.7),
            carbs: Math.round(carbs * 0.2),
            fat: Math.round(fat * 0.1)
          },
          {
            name: 'Banana',
            amount: '1 medium',
            calories: Math.round(calories * 0.2),
            protein: Math.round(protein * 0.1),
            carbs: Math.round(carbs * 0.1),
            fat: Math.round(fat * 0.7)
          }
        ];
      } else if (mealIndex === 1) { // Post-workout
        foods = [
          {
            name: 'Whey Protein',
            amount: '40g',
            calories: Math.round(calories * 0.5),
            protein: Math.round(protein * 0.8),
            carbs: Math.round(carbs * 0.1),
            fat: Math.round(fat * 0.1)
          },
          {
            name: 'Banana',
            amount: '1 large',
            calories: Math.round(calories * 0.3),
            protein: Math.round(protein * 0.1),
            carbs: Math.round(carbs * 0.8),
            fat: Math.round(fat * 0.1)
          },
          {
            name: 'Almond Milk',
            amount: '200ml',
            calories: Math.round(calories * 0.2),
            protein: Math.round(protein * 0.1),
            carbs: Math.round(carbs * 0.1),
            fat: Math.round(fat * 0.8)
          }
        ];
      } else { // Other meals
        foods = [
          {
            name: userPreferences[0] || 'Chicken Breast',
            amount: '150g',
            calories: Math.round(calories * 0.6),
            protein: Math.round(protein * 0.8),
            carbs: Math.round(carbs * 0.1),
            fat: Math.round(fat * 0.3)
          },
          {
            name: userPreferences[1] || 'Brown Rice',
            amount: '80g',
            calories: Math.round(calories * 0.3),
            protein: Math.round(protein * 0.1),
            carbs: Math.round(carbs * 0.8),
            fat: Math.round(fat * 0.1)
          },
          {
            name: userPreferences[2] || 'Broccoli',
            amount: '100g',
            calories: Math.round(calories * 0.1),
            protein: Math.round(protein * 0.1),
            carbs: Math.round(carbs * 0.1),
            fat: Math.round(fat * 0.6)
          }
        ];
      }

      return {
        name: mealGroup[dayIndex % mealGroup.length],
        phase: phase.name,
        calories,
        protein,
        carbs,
        fat,
        foods,
        timing: mealTimings[mealIndex],
        prepTime: [15, 5, 10, 20, 5, 25][mealIndex],
        description: `Fallback ${mealGroup[dayIndex % mealGroup.length]} for ${day} - designed to help reach ${checkpoint.predictedBodyFat}% body fat`,
        instructions: [
          'Prepare ingredients according to measurements',
          'Cook using preferred method',
          'Season to taste and serve'
        ],
        tips: [
          'Meal prep friendly - can be prepared in advance',
          'Store in airtight containers for 3-4 days',
          'Reheat gently to maintain texture'
        ],
        variations: [
          'Try different seasonings for variety',
          'Substitute with similar macro foods',
          'Adjust portion sizes based on hunger levels'
        ]
      };
    })
  }));
}
