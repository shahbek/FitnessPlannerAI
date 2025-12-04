/**
 * Plan Overview Explanation Service
 * 
 * Generates unified, personalized explanations for the plan overview
 * using a single AI call to avoid repetitive generic responses.
 */

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export interface PlanOverviewExplanation {
  // Executive Summary
  executiveSummary: string;

  // Section-specific explanations
  profileSummary: string;
  energyBalanceExplanation: string;
  bodyCompositionExplanation: string;
  trainingApproachExplanation: string;
  nutritionStrategyExplanation: string;

  // Key insights
  keyInsights: string[];
  potentialChallenges: string[];
  successFactors: string[];

  // Personalized recommendations
  recommendations: string[];
}

interface PlanData {
  metrics?: any;
  phaseAwareFramework?: any;
  weeklyOutlines?: any[];
  userProfile?: any;
}

/**
 * Generate comprehensive plan overview explanations in a single AI call
 */
export async function generatePlanOverviewExplanations(
  plan: PlanData,
  userProfile: any,
  apiKey?: string
): Promise<PlanOverviewExplanation> {
  const metrics = plan?.metrics || {};
  const framework = plan?.phaseAwareFramework || {};
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Extract key data points
  const tdee = metrics?.tdee?.value || 0;
  const targetCalories = metrics?.macros?.calories || weeklyOutlines[0]?.dailyTargets?.calories || 0;
  const protein = metrics?.macros?.protein || 0;
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg || 0;
  const trainingFrequency = framework?.trainingApproach?.frequencyPerWeek || 0;
  const periodization = framework?.trainingApproach?.periodization || 'Progressive';
  const goal = userProfile?.primaryGoal || 'general fitness';
  const experienceLevel = userProfile?.experienceLevel || 'intermediate';
  const weight = userProfile?.weight || 0;
  const height = userProfile?.height || 0;
  const age = userProfile?.age || 0;

  const prompt = `You are a fitness and nutrition expert providing personalized explanations for a fitness plan overview.

USER PROFILE:
- Age: ${age}
- Weight: ${weight} kg
- Height: ${height} cm
- Goal: ${goal}
- Experience Level: ${experienceLevel}
- Training Frequency: ${trainingFrequency} days/week

PLAN METRICS:
- TDEE: ${tdee} kcal/day
- Target Calories: ${targetCalories} kcal/day
- Daily Deficit: ${tdee - targetCalories} kcal
- Protein: ${protein}g/day (${proteinPerKg.toFixed(1)}g/kg)
- Periodization: ${periodization}

Generate a comprehensive, personalized explanation covering:

1. EXECUTIVE SUMMARY (2-3 sentences): High-level overview of why this plan is designed for this specific user
2. PROFILE SUMMARY (2-3 sentences): How the user's profile (age, experience, goals) influences the plan design
3. ENERGY BALANCE EXPLANATION (3-4 sentences): Explain the caloric strategy, deficit magnitude, and expected results
4. BODY COMPOSITION EXPLANATION (3-4 sentences): Expected fat loss vs muscle preservation based on protein intake and training
5. TRAINING APPROACH EXPLANATION (3-4 sentences): Why this training frequency, split, and periodization fits the user
6. NUTRITION STRATEGY EXPLANATION (3-4 sentences): Macro distribution rationale and meal timing strategy
7. KEY INSIGHTS (3-5 bullet points): Most important things the user should know
8. POTENTIAL CHALLENGES (2-3 bullet points): What might be difficult and how to overcome
9. SUCCESS FACTORS (3-4 bullet points): What will make this plan successful
10. RECOMMENDATIONS (3-4 bullet points): Personalized actionable recommendations

Be specific, evidence-based, and avoid generic statements. Reference actual numbers from the plan.
Return ONLY valid JSON with these exact keys: executiveSummary, profileSummary, energyBalanceExplanation, bodyCompositionExplanation, trainingApproachExplanation, nutritionStrategyExplanation, keyInsights, potentialChallenges, successFactors, recommendations.`;

  try {
    // Use the provided API key or fall back to the environment variable
    const effectiveApiKey = apiKey || import.meta.env.VITE_GROQ_API_KEY;

    if (!effectiveApiKey) {
      console.warn('No Groq API key found for plan overview explanations');
      return createFallbackExplanations(plan, userProfile);
    }

    const groq = createGroq({ apiKey: effectiveApiKey });

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
    });

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          executiveSummary: parsed.executiveSummary || '',
          profileSummary: parsed.profileSummary || '',
          energyBalanceExplanation: parsed.energyBalanceExplanation || '',
          bodyCompositionExplanation: parsed.bodyCompositionExplanation || '',
          trainingApproachExplanation: parsed.trainingApproachExplanation || '',
          nutritionStrategyExplanation: parsed.nutritionStrategyExplanation || '',
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
          potentialChallenges: Array.isArray(parsed.potentialChallenges) ? parsed.potentialChallenges : [],
          successFactors: Array.isArray(parsed.successFactors) ? parsed.successFactors : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
      } catch (parseError) {
        console.error('Error parsing AI response JSON:', parseError, text);
        return createFallbackExplanations(plan, userProfile);
      }
    }

    console.warn('No JSON found in AI response:', text);
    return createFallbackExplanations(plan, userProfile);
  } catch (error) {
    console.error('Error generating plan overview explanations:', error);
    return createFallbackExplanations(plan, userProfile);
  }
}

/**
 * Create fallback explanations when AI is unavailable
 */
function createFallbackExplanations(plan: PlanData, userProfile: any): PlanOverviewExplanation {
  const metrics = plan?.metrics || {};
  const framework = plan?.phaseAwareFramework || {};
  const tdee = metrics?.tdee?.value || 0;
  const targetCalories = metrics?.macros?.calories || 0;
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg || 0;
  const trainingFrequency = framework?.trainingApproach?.frequencyPerWeek || 0;

  return {
    executiveSummary: `This plan is designed for ${userProfile?.primaryGoal || 'your fitness goals'} with a ${trainingFrequency}-day training schedule and ${proteinPerKg.toFixed(1)}g/kg protein intake.`,
    profileSummary: `Based on your profile, this plan is tailored to your experience level and goals.`,
    energyBalanceExplanation: `Your daily target of ${targetCalories} kcal creates a ${tdee - targetCalories} kcal deficit from your TDEE of ${tdee} kcal, supporting sustainable progress.`,
    bodyCompositionExplanation: `With ${proteinPerKg.toFixed(1)}g/kg protein and resistance training, you can expect approximately 75% fat loss and 25% lean mass loss.`,
    trainingApproachExplanation: `The ${trainingFrequency}-day training schedule is designed to optimize recovery while maintaining progressive overload.`,
    nutritionStrategyExplanation: `Macronutrient distribution is optimized for your goals, with high protein for muscle preservation and balanced carbs and fats for energy and hormonal health.`,
    keyInsights: [
      'High protein intake preserves muscle during fat loss',
      'Progressive training ensures continuous adaptation',
      'Strategic rest days support recovery and performance',
    ],
    potentialChallenges: [
      'Maintaining consistency with meal prep',
      'Managing energy levels during deficit',
    ],
    successFactors: [
      'Adherence to caloric targets',
      'Consistent training attendance',
      'Adequate sleep and recovery',
    ],
    recommendations: [
      'Track your progress weekly',
      'Adjust calories if weight loss stalls',
      'Prioritize protein at every meal',
    ],
  };
}

