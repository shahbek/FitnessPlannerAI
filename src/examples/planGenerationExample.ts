// Example of how to use the Integrated Planning Service
import { integratedPlanningService } from '@/services/integratedPlanningService';
import { CandidateProfile, CandidateProfileBuilder } from '@/types/candidateProfile';

export async function generateFitnessPlan() {
  try {
    // Initialize the service with your API credentials
    await integratedPlanningService.initialize(
      'your-api-key-here',
      'https://api.openai.com/v1/chat/completions',
      'gpt-4'
    );

    // Create a candidate profile
    const profile: CandidateProfile = {
      profileId: 'user-001',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completenessScore: 100,
      missingFields: [],
      physicalStats: {
        age: 28,
        sex: 'male',
        heightCm: 175,
        weightKg: 85,
        bodyFatPercentage: 18,
        bmi: 27.8,
        leanBodyMassKg: 69.7
      },
      trainingHistory: {
        yearsTraining: 2,
        currentTrainingDaysPerWeek: 3,
        trainingStyle: ['strength'],
        experienceLevel: 'intermediate',
        preferredSplit: 'full_body',
        canDoPushups: true,
        canDoPullups: false,
        hasGymAccess: true,
        hasEquipment: ['barbell', 'dumbbells', 'bench', 'squat_rack'],
        injuriesOrLimitations: []
      },
      lifestyle: {
        activityLevel: 'moderate' as any,
        averageSleepHours: 7,
        stressLevel: 6,
        availableTrainingTimeMinutes: 45,
        availableMealPrepTimeMinutes: 45,
        jobType: 'sedentary',
        shiftWork: false
      },
      dietaryPreferences: {
        dietaryRestrictions: ['none'],
        foodAllergies: [],
        foodsToAvoid: ['processed_foods'],
        preferredMealCount: 3,
        preferredCuisines: ['mediterranean', 'asian'],
        cookingSkill: 'intermediate',
        budgetLevel: 'medium'
      },
      goal: {
        goalType: 'fat_loss' as any,
        targetBodyFatPercentage: 12,
        desiredTimelineWeeks: 16,
        motivation: 'Get lean and build muscle',
        previousAttempts: ['tried various diets'],
        biggestChallenge: 'staying consistent with nutrition'
      },
      medicalHistory: {
        injuries: [],
        chronicConditions: [],
        medications: [],
        supplements: ['protein_powder']
      }
    };

    // Generate the complete fitness plan
    const plan = await integratedPlanningService.generatePlan(profile, (snapshot) => {
      console.log(`[${snapshot.stage}] ${snapshot.label}:`, snapshot.parsed);
    });

    // Display the results
    console.log('🎯 FEASIBILITY ASSESSMENT:');
    console.log(`- Feasible: ${plan.feasibility.isFeasible}`);
    console.log(`- Confidence: ${plan.feasibility.confidenceScore}`);
    console.log(`- Reasoning: ${plan.feasibility.reasoning}`);

    console.log('\n🏋️ STRATEGIC FRAMEWORK:');
    console.log(`- Training Split: ${plan.strategicFramework.trainingApproach.split}`);
    console.log(`- Frequency: ${plan.strategicFramework.trainingApproach.frequencyPerWeek} days/week`);
    console.log(`- Session Duration: ${plan.strategicFramework.trainingApproach.sessionDurationMinutes} minutes`);

    console.log('\n🍽️ NUTRITION STRATEGY:');
    console.log(`- Daily Calories: ${plan.strategicFramework.nutritionApproach.macroTargets.proteinTotalGrams}g protein`);
    console.log(`- Protein Target: ${plan.strategicFramework.nutritionApproach.macroTargets.proteinTotalGrams}g`);
    console.log(`- Fat Target: ${plan.strategicFramework.nutritionApproach.macroTargets.fatTotalGrams}g`);
    console.log(`- Carb Target: ${plan.strategicFramework.nutritionApproach.macroTargets.carbsTotalGrams}g`);

    console.log('\n📚 EXERCISE LIBRARY:');
    console.log(`- Total Exercises: ${plan.exerciseLibrary.length}`);
    plan.exerciseLibrary.slice(0, 3).forEach(exercise => {
      console.log(`  - ${exercise.name} (${exercise.difficulty})`);
    });

    console.log('\n📅 SESSION TEMPLATES:');
    console.log(`- Total Templates: ${plan.sessionTemplates.length}`);
    plan.sessionTemplates.forEach(template => {
      console.log(`  - ${template.name} (${template.totalDurationMinutes} min)`);
    });

    console.log('\n🍽️ MEAL TEMPLATES:');
    console.log(`- Total Templates: ${plan.mealTemplates.length}`);
    plan.mealTemplates.forEach(template => {
      console.log(`  - ${template.templateId} (${template.totalDailyCalories} cal/day)`);
    });

    console.log('\n🛒 SHOPPING LIST:');
    console.log(`- Proteins: ${plan.shoppingList.proteins.length} items`);
    console.log(`- Carbs: ${plan.shoppingList.carbs.length} items`);
    console.log(`- Vegetables: ${plan.shoppingList.vegetables.length} items`);

    console.log('\n📈 PHASE PROGRESSION:');
    console.log(`- Total Phases: ${plan.phaseProgression.length}`);
    plan.phaseProgression.forEach(phase => {
      console.log(`  - ${phase.phaseName} (Weeks ${phase.weekRange.start}-${phase.weekRange.end})`);
    });

    console.log('\n✅ Plan generation completed successfully!');
    return plan;

  } catch (error) {
    console.error('❌ Error generating plan:', error);
    throw error;
  }
}

// Example usage
if (require.main === module) {
  generateFitnessPlan()
    .then(plan => {
      console.log('Plan generated successfully!');
    })
    .catch(error => {
      console.error('Failed to generate plan:', error);
    });
}

