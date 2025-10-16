import { FitnessPlan, ProgressivePlan, WeeklyCheckpoint } from '@/types';

interface DailyMeal {
  name: string;
  timing: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: number;
  foods: Array<{
    name: string;
    amount: string;
  }>;
  instructions: string[];
  tips: string[];
}

// Generate sample daily meal plan for a specific week
function generateDailyMealPlan(checkpoint: WeeklyCheckpoint, week: number): DailyMeal[] {
  const phase = checkpoint.phase.toLowerCase();
  const isCutting = phase.includes('cut');
  const isDietBreak = phase.includes('break');
  
  // Base meal distribution
  const mealDistribution = [
    { name: 'Pre-Workout Breakfast', timing: '7:00 AM', calories: Math.round(checkpoint.dailyCalories * 0.15), protein: Math.round(checkpoint.proteinGrams * 0.15), carbs: Math.round(checkpoint.carbGrams * 0.20), fat: Math.round(checkpoint.fatGrams * 0.10) },
    { name: 'Post-Workout Shake', timing: '9:00 AM', calories: Math.round(checkpoint.dailyCalories * 0.20), protein: Math.round(checkpoint.proteinGrams * 0.25), carbs: Math.round(checkpoint.carbGrams * 0.25), fat: Math.round(checkpoint.fatGrams * 0.10) },
    { name: 'Mid-Morning Snack', timing: '11:00 AM', calories: Math.round(checkpoint.dailyCalories * 0.10), protein: Math.round(checkpoint.proteinGrams * 0.10), carbs: Math.round(checkpoint.carbGrams * 0.10), fat: Math.round(checkpoint.fatGrams * 0.15) },
    { name: 'Lunch', timing: '1:00 PM', calories: Math.round(checkpoint.dailyCalories * 0.25), protein: Math.round(checkpoint.proteinGrams * 0.25), carbs: Math.round(checkpoint.carbGrams * 0.25), fat: Math.round(checkpoint.fatGrams * 0.25) },
    { name: 'Afternoon Snack', timing: '4:00 PM', calories: Math.round(checkpoint.dailyCalories * 0.10), protein: Math.round(checkpoint.proteinGrams * 0.10), carbs: Math.round(checkpoint.carbGrams * 0.10), fat: Math.round(checkpoint.fatGrams * 0.15) },
    { name: 'Dinner', timing: '7:00 PM', calories: Math.round(checkpoint.dailyCalories * 0.20), protein: Math.round(checkpoint.proteinGrams * 0.15), carbs: Math.round(checkpoint.carbGrams * 0.10), fat: Math.round(checkpoint.fatGrams * 0.25) }
  ];

  return mealDistribution.map((meal, index) => {
    const mealNames = [
      ['Protein Pancakes', 'Greek Yogurt Bowl', 'Oatmeal Power Bowl'],
      ['Whey Protein Shake', 'Recovery Smoothie', 'Post-Workout Shake'],
      ['Hard-Boiled Eggs', 'Cottage Cheese', 'Protein Bar'],
      ['Grilled Chicken Salad', 'Turkey Wrap', 'Salmon Bowl'],
      ['Almonds & Berries', 'Protein Pudding', 'Veggie Sticks'],
      ['Grilled Steak & Veggies', 'Baked Fish', 'Chicken Stir-Fry']
    ];

    const ingredients = [
      ['Oats (50g)', 'Whey Protein (30g)', 'Banana (1 medium)', 'Almond Butter (15g)'],
      ['Whey Protein (40g)', 'Banana (1 large)', 'Oats (30g)', 'Almond Milk (200ml)'],
      ['Hard-Boiled Eggs (2 large)', 'Salt & Pepper', 'Hot Sauce (optional)'],
      ['Chicken Breast (150g)', 'Mixed Greens (100g)', 'Cherry Tomatoes (50g)', 'Olive Oil (10ml)'],
      ['Almonds (20g)', 'Blueberries (50g)', 'Greek Yogurt (100g)'],
      ['Beef Sirloin (120g)', 'Broccoli (100g)', 'Sweet Potato (80g)', 'Olive Oil (15ml)']
    ];

    const instructions = [
      ['Mix oats with protein powder', 'Add mashed banana and almond butter', 'Cook in non-stick pan for 3-4 minutes per side'],
      ['Blend protein powder with banana', 'Add oats and almond milk', 'Blend until smooth'],
      ['Boil eggs for 8-10 minutes', 'Cool in ice water', 'Peel and season'],
      ['Season and grill chicken breast', 'Toss greens with tomatoes', 'Drizzle with olive oil'],
      ['Mix almonds with berries', 'Serve with Greek yogurt', 'Store in airtight container'],
      ['Season and grill steak to medium-rare', 'Steam broccoli until tender', 'Roast sweet potato until soft']
    ];

    const tips = [
      ['Meal prep friendly - can be made in batches', 'Store in fridge for 3-4 days', 'Reheat in microwave'],
      ['Best consumed within 30 minutes post-workout', 'Can add ice for colder temperature', 'Adjust liquid for desired consistency'],
      ['Can be prepared in advance', 'Store in fridge for up to 5 days', 'Great for on-the-go'],
      ['Perfect for meal prep', 'Store components separately', 'Assemble just before eating'],
      ['Portable snack option', 'Can be pre-portioned', 'Great for busy schedules'],
      ['Cook steak to your preferred doneness', 'Meal prep the vegetables', 'Store in separate containers']
    ];

    return {
      name: mealNames[index][week % mealNames[index].length],
      timing: meal.timing,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      prepTime: [15, 5, 10, 20, 5, 25][index],
      foods: ingredients[index].map(ing => ({
        name: ing.split(' (')[0],
        amount: ing.split(' (')[1]?.replace(')', '') || '1 serving'
      })),
      instructions: instructions[index],
      tips: tips[index]
    };
  });
}

export async function exportPdf(parsed: FitnessPlan | ProgressivePlan): Promise<void> {
  if (!parsed) throw new Error('Nothing to export. Generate or load a plan first.');
  
  try {
    const { jsPDF } = await import('jspdf');
    // @ts-ignore: runtime ESM/CJS interop
    const autoTableModule: any = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;

    // Check if it's a progressive plan
    if ('timeline' in parsed) {
      await exportProgressivePlan(doc, parsed, autoTable, margin);
    } else {
      await exportSingleWeekPlan(doc, parsed, autoTable, margin);
    }

    doc.save('plan.pdf');
  } catch (err: any) {
    console.error('PDF export failed', err);
    throw err;
  }
}

async function exportProgressivePlan(
  doc: any, 
  plan: ProgressivePlan, 
  autoTable: any, 
  margin: number
): Promise<void> {
  // Title Page
  doc.setFontSize(20);
  doc.text('Multi-Week Progressive Fitness Plan', margin, 40);
  
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date(plan.createdAt).toLocaleDateString()}`, margin, 70);
  doc.text(`Timeline: ${plan.timeline.totalWeeks} weeks`, margin, 90);
  doc.text(`Approach: ${plan.strategy.approach}`, margin, 110);
  
  // Current vs Goal State
  doc.setFontSize(14);
  doc.text('Current vs Goal State', margin, 140);
  
  const stateData = [
    ['Metric', 'Current', 'Goal', 'Change'],
    ['Weight (kg)', plan.currentState.weight.toFixed(1), plan.goalState.targetWeight.toFixed(1), 
     (plan.goalState.targetWeight - plan.currentState.weight).toFixed(1)],
    ['Body Fat %', plan.currentState.bodyFat.toFixed(1), plan.goalState.targetBodyFat.toFixed(1), 
     (plan.goalState.targetBodyFat - plan.currentState.bodyFat).toFixed(1)],
    ['Lean Mass (kg)', plan.currentState.leanMass.toFixed(1), plan.goalState.targetLeanMass.toFixed(1), 
     (plan.goalState.targetLeanMass - plan.currentState.leanMass).toFixed(1)],
    ['TDEE (kcal)', plan.currentState.tdee.toFixed(0), 'N/A', 'N/A']
  ];
  
  autoTable(doc, {
    startY: 160,
    head: [stateData[0]],
    body: stateData.slice(1),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Phase Overview
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Phase Overview', margin, 40);
  
  const phaseData = plan.timeline.phases.map(phase => [
    phase.name,
    `Weeks ${phase.startWeek + 1}-${phase.endWeek + 1}`,
    phase.type.replace('_', ' '),
    `${phase.targetDeficit}%`,
    `${phase.proteinMultiplier}g/kg`,
    `${Math.round(phase.volumeAdjustment * 100)}%`
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Phase', 'Duration', 'Type', 'Deficit', 'Protein', 'Volume']],
    body: phaseData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Weekly Checkpoints - All Weeks
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Complete Weekly Progression', margin, 40);
  
  const checkpointData = plan.timeline.checkpoints.map(cp => [
    cp.week,
    cp.predictedWeight.toFixed(1),
    cp.predictedBodyFat.toFixed(1),
    cp.predictedLeanMass.toFixed(1),
    cp.dailyCalories,
    cp.proteinGrams,
    cp.fatGrams,
    cp.carbGrams,
    cp.trainingVolume,
    cp.cardioMinutes
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Week', 'Weight', 'BF%', 'Lean Mass', 'Calories', 'Protein', 'Fat', 'Carbs', 'Volume', 'Cardio']],
    body: checkpointData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Progress Tracking Tables
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Progress Tracking Tables', margin, 40);
  
  // Body Composition Tracking
  doc.setFontSize(14);
  doc.text('Body Composition Tracking', margin, 70);
  
  const trackingData = plan.timeline.checkpoints.map(cp => [
    `Week ${cp.week}`,
    cp.predictedWeight.toFixed(1),
    cp.predictedBodyFat.toFixed(1),
    cp.predictedLeanMass.toFixed(1),
    '', // Actual Weight (to be filled by user)
    '', // Actual BF% (to be filled by user)
    '', // Actual Lean Mass (to be filled by user)
    '', // Notes
  ]);
  
  autoTable(doc, {
    startY: 90,
    head: [['Week', 'Pred Weight', 'Pred BF%', 'Pred Lean', 'Actual Weight', 'Actual BF%', 'Actual Lean', 'Notes']],
    body: trackingData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Nutrition Tracking
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Nutrition Tracking', margin, 40);
  
  const nutritionData = plan.timeline.checkpoints.map(cp => [
    `Week ${cp.week}`,
    cp.dailyCalories,
    cp.proteinGrams,
    cp.fatGrams,
    cp.carbGrams,
    '', // Actual Calories
    '', // Actual Protein
    '', // Actual Fat
    '', // Actual Carbs
    '', // Adherence Score
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Week', 'Pred Calories', 'Pred Protein', 'Pred Fat', 'Pred Carbs', 'Actual Calories', 'Actual Protein', 'Actual Fat', 'Actual Carbs', 'Adherence']],
    body: nutritionData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Training Tracking
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Training Tracking', margin, 40);
  
  const trainingData = plan.timeline.checkpoints.map(cp => [
    `Week ${cp.week}`,
    cp.trainingVolume,
    cp.cardioMinutes,
    '', // Actual Volume
    '', // Actual Cardio
    '', // Energy Level (1-10)
    '', // Performance (1-10)
    '', // Notes
  ]);
  
  autoTable(doc, {
    startY: 70,
    head: [['Week', 'Pred Volume', 'Pred Cardio', 'Actual Volume', 'Actual Cardio', 'Energy (1-10)', 'Performance (1-10)', 'Notes']],
    body: trainingData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Daily Meal Plans - Sample Weeks
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Daily Meal Plans - Sample Weeks', margin, 40);
  
  // Show meal plans for weeks 1, 4, 8, 12, 16, 20, 24
  const sampleWeeks = [1, 4, 8, 12, 16, 20, 24].filter(w => w <= plan.timeline.totalWeeks);
  
  for (const week of sampleWeeks) {
    const checkpoint = plan.timeline.checkpoints.find(cp => cp.week === week);
    if (!checkpoint) continue;
    
    doc.addPage();
    doc.setFontSize(14);
    doc.text(`Week ${week} - ${checkpoint.phase}`, margin, 40);
    
    doc.setFontSize(10);
    doc.text(`Daily Macros: ${checkpoint.dailyCalories} cal | ${checkpoint.proteinGrams}g protein | ${checkpoint.fatGrams}g fat | ${checkpoint.carbGrams}g carbs`, margin, 60);
    
    // Generate sample daily meal plan for this week
    const dailyMeals = generateDailyMealPlan(checkpoint, week);
    
    let yPos = 90;
    for (const meal of dailyMeals) {
      doc.setFontSize(12);
      doc.text(`${meal.name} (${meal.timing})`, margin, yPos);
      
      doc.setFontSize(9);
      doc.text(`Macros: ${meal.calories} cal | ${meal.protein}g protein | ${meal.carbs}g carbs | ${meal.fat}g fat`, margin, yPos + 15);
      
      doc.text(`Prep Time: ${meal.prepTime} minutes`, margin, yPos + 30);
      
      // Ingredients
      doc.text('Ingredients:', margin, yPos + 45);
      let ingredientY = yPos + 60;
      for (const food of meal.foods) {
        doc.text(`• ${food.name}: ${food.amount}`, margin + 10, ingredientY);
        ingredientY += 12;
      }
      
      // Instructions
      doc.text('Instructions:', margin, ingredientY + 5);
      let instructionY = ingredientY + 20;
      for (const instruction of meal.instructions) {
        doc.text(`• ${instruction}`, margin + 10, instructionY);
        instructionY += 12;
      }
      
      // Tips
      if (meal.tips.length > 0) {
        doc.text('Tips:', margin, instructionY + 5);
        let tipY = instructionY + 20;
        for (const tip of meal.tips) {
          doc.text(`• ${tip}`, margin + 10, tipY);
          tipY += 12;
        }
        instructionY = tipY;
      }
      
      yPos = instructionY + 20;
      
      // Add page break if needed
      if (yPos > 700) {
        doc.addPage();
        yPos = 40;
      }
    }
  }

  // Strategy Summary
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Strategy Summary', margin, 40);
  
  doc.setFontSize(12);
  doc.text(`Approach: ${plan.strategy.approach}`, margin, 70);
  doc.text(`Diet Break Frequency: Every ${plan.strategy.dietBreakFrequency} weeks`, margin, 90);
  doc.text(`Refeed Frequency: Every ${plan.strategy.refeedFrequency} days`, margin, 110);
  doc.text(`Deload Frequency: Every ${plan.strategy.deloadFrequency} weeks`, margin, 130);
  
  doc.setFontSize(14);
  doc.text('Rationale', margin, 160);
  doc.setFontSize(10);
  doc.text(plan.rationale, margin, 180, { maxWidth: 520 });

  // References
  if (plan.references?.length) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Scientific References', margin, 40);
    doc.setFontSize(10);
    plan.references.forEach((ref, idx) => {
      doc.text(`• ${ref}`, margin, 70 + idx * 16, { maxWidth: 520 });
    });
  }
}

async function exportSingleWeekPlan(
  doc: any, 
  plan: FitnessPlan, 
  autoTable: any, 
  margin: number
): Promise<void> {
  doc.setFontSize(16);
  doc.text('Personalized Weekly Plan', margin, 40);

  if (plan.feasibility) {
    doc.setFontSize(11);
    const feas = `Feasibility: ${plan.feasibility.status}${
      plan.feasibility.proposed_timeline_weeks ? ` (timeline ~${plan.feasibility.proposed_timeline_weeks} wks)` : ''
    }`;
    doc.text(feas, margin, 64);
    if (plan.rationale) {
      doc.text(`Rationale: ${plan.rationale}`.slice(0, 900), margin, 80, { maxWidth: 520 });
    }
  }

  if (plan.calories) {
    autoTable(doc, {
      startY: 110,
      head: [['Daily kcal', 'Protein (g)', 'Fat (g)', 'Carb (g)']],
      body: [[plan.calories.daily_kcal, plan.calories.protein_g, plan.calories.fat_g, plan.calories.carb_g]],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [20, 20, 20] },
      theme: 'grid',
      margin: { left: margin, right: margin },
    });
  }

  if (plan.week_plan?.length) {
    const rows = plan.week_plan.map((d) => [
      d.day,
      `${d.session_minutes}m ${d.focus}`,
      (d.blocks || [])
        .map((b) => `${b.name}: ${b.sets} x ${b.reps_or_time}${b.rir_or_rpe ? ` (${b.rir_or_rpe})` : ''}`)
        .join('\n'),
    ]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 18 : 180,
      head: [['Day', 'Session', 'Blocks']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [20, 20, 20] },
      theme: 'grid',
      margin: { left: margin, right: margin },
    });
  }

  if (plan.meals?.length) {
    const mealRows = plan.meals.map((m) => [
      m.name,
      m.kcal,
      (m.items || []).map((i) => `${i.food} (${i.grams}g)`).join(', '),
    ]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 18 : 180,
      head: [['Meal', 'kcal', 'Items']],
      body: mealRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [20, 20, 20] },
      theme: 'grid',
      margin: { left: margin, right: margin },
    });
  }

  if (plan.references?.length) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text('References', margin, 40);
    doc.setFontSize(10);
    plan.references.forEach((r, idx) => {
      doc.text(`• ${r}`, margin, 64 + idx * 16, { maxWidth: 520 });
    });
  }
}
