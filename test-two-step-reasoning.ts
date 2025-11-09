import { MealGenerationService } from './src/services/MealGenerationService';
import { config } from 'dotenv';

// Load environment variables
config();

async function testTwoStepReasoning() {
  console.log('🧪 Testing Two-Step Reasoning Approach');
  console.log('=====================================\n');

  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No GROQ_API_KEY found! Set it with: export GROQ_API_KEY=gsk_your_key_here');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...\n');

  // Minimal test data
  const testUserProfile = {
    goal: 'lose fat',
    preferences: 'balanced diet',
    mealFrequency: 3,
    excluded_foods: [],
    preferred_foods: []
  };

  const testMetrics = {
    macros: {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 67
    }
  };

  const testPhaseWeeks = [
    {
      weekNumber: 1,
      phase: 'Foundation',
      dailyTargets: {
        calories: 2000,
        protein: 150,
        proteinPerKg: 2.0,
        carbs: 200,
        fat: 67
      },
      objectives: ['Establish habits', 'Track macros']
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      dailyTargets: {
        calories: 2050,
        protein: 155,
        proteinPerKg: 2.0,
        carbs: 205,
        fat: 68
      },
      objectives: ['Increase volume', 'Refine technique']
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      dailyTargets: {
        calories: 2100,
        protein: 160,
        proteinPerKg: 2.1,
        carbs: 210,
        fat: 70
      },
      objectives: ['Progressive overload', 'Monitor recovery']
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      dailyTargets: {
        calories: 2150,
        protein: 165,
        proteinPerKg: 2.1,
        carbs: 215,
        fat: 72
      },
      objectives: ['Consolidate gains', 'Assess readiness']
    },
    {
      weekNumber: 5,
      phase: 'Progression',
      dailyTargets: {
        calories: 2200,
        protein: 170,
        proteinPerKg: 2.2,
        carbs: 220,
        fat: 73
      },
      objectives: ['Increase intensity', 'Build strength']
    },
    {
      weekNumber: 6,
      phase: 'Progression',
      dailyTargets: {
        calories: 2250,
        protein: 175,
        proteinPerKg: 2.2,
        carbs: 225,
        fat: 75
      },
      objectives: ['Progressive overload', 'Maintain form']
    },
    {
      weekNumber: 7,
      phase: 'Progression',
      dailyTargets: {
        calories: 2300,
        protein: 180,
        proteinPerKg: 2.3,
        carbs: 230,
        fat: 77
      },
      objectives: ['Peak volume', 'Recovery focus']
    }
  ];

  const testPhaseName = 'Multi-Phase (Foundation + Progression)';

  console.log('🚀 Starting BATCHED two-step meal generation (7 weeks)...\n');
  console.log('📊 Expected: 3 batches (weeks 1-3, 4-6, 7)\n');

  try {
    const service = new MealGenerationService(apiKey);
    
    const result = await service.generateMealTemplatesWithGroq({
      userProfile: testUserProfile,
      metrics: testMetrics,
      phaseWeeks: testPhaseWeeks,
      phaseName: testPhaseName
    });

    console.log('\n✅ SUCCESS! Meals generated:');
    console.log('Number of templates:', result.length);
    
    console.log('\n📊 Week Summary:');
    result.forEach(week => {
      const firstMeal = week.meals?.[0];
      console.log(`  Week ${week.weekNumber}: ${week.totalCalories} cal - ${firstMeal?.recipe?.name || 'N/A'}`);
    });
    
    console.log('\n🔍 Sample Week 1 (Full):');
    console.log(JSON.stringify(result[0], null, 2).substring(0, 800), '...\n');
    
    if (result.length >= 4) {
      console.log('🔍 Sample Week 4 (from 2nd batch):');
      console.log(JSON.stringify(result[3], null, 2).substring(0, 400), '...\n');
    }
    
    if (result.length >= 7) {
      console.log('🔍 Sample Week 7 (from 3rd batch):');
      console.log(JSON.stringify(result[6], null, 2).substring(0, 400), '...\n');
    }
  } catch (error) {
    console.error('\n❌ FAILED:', error);
    process.exit(1);
  }
}

testTwoStepReasoning();

