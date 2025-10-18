import { FitnessPlan, ProgressivePlan, WeeklyCheckpoint } from '@/types';
import { resolveEvidence } from '@/data/research';

interface DailyMeal {
  slot: string;
  timing: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  focus: string;
  guidance: string;
}

// Generate sample daily meal plan for a specific week
function generateDailyMealPlan(checkpoint: WeeklyCheckpoint, week: number): DailyMeal[] {
  // Base meal distribution
  const mealDistribution = [
    { slot: 'Meal 1 • Pre-Workout', timing: '07:00', calPct: 0.15, proteinPct: 0.18, carbPct: 0.22, fatPct: 0.1, focus: 'Prime performance with easy-to-digest carbs & lean protein.' },
    { slot: 'Meal 2 • Post-Workout', timing: '09:30', calPct: 0.2, proteinPct: 0.28, carbPct: 0.28, fatPct: 0.08, focus: 'Fast-digesting protein/carbs to refuel glycogen and recovery.' },
    { slot: 'Meal 3 • Mid-Morning', timing: '12:00', calPct: 0.15, proteinPct: 0.18, carbPct: 0.2, fatPct: 0.15, focus: 'Satiating meal with fibre to stabilise blood sugar.' },
    { slot: 'Meal 4 • Lunch', timing: '14:30', calPct: 0.2, proteinPct: 0.2, carbPct: 0.2, fatPct: 0.2, focus: 'Balanced meal prioritising micronutrients and lean protein.' },
    { slot: 'Meal 5 • Pre-Evening Training', timing: '17:00', calPct: 0.15, proteinPct: 0.1, carbPct: 0.15, fatPct: 0.2, focus: 'Light meal to fuel second session/cardio without heaviness.' },
    { slot: 'Meal 6 • Evening Recovery', timing: '20:00', calPct: 0.15, proteinPct: 0.16, carbPct: 0.15, fatPct: 0.27, focus: 'Slow-digesting protein & fats to support overnight recovery.' }
  ];

  return mealDistribution.map((meal, index) => {
    return {
      slot: meal.slot,
      timing: meal.timing,
      calories: Math.round(checkpoint.dailyCalories * meal.calPct),
      protein: Math.round(checkpoint.proteinGrams * meal.proteinPct),
      carbs: Math.round(checkpoint.carbGrams * meal.carbPct),
      fat: Math.round(checkpoint.fatGrams * meal.fatPct),
      focus: meal.focus,
      guidance: week % 2 === 0
        ? 'Prioritise lean protein, colourful vegetables, and the carb source you digest best around training.'
        : 'Rotate protein sources and adjust carbs ±10% based on training load and morning weigh-ins.'
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
  if (plan.strategy.timelineNote) {
    doc.setFontSize(10);
    doc.text(`Timeline Note: ${plan.strategy.timelineNote}`, margin, 130, { maxWidth: 520 });
    doc.setFontSize(12);
  }

  // Current vs Goal State
  doc.setFontSize(14);
  const goalStateTitleY = plan.strategy.timelineNote ? 160 : 140;
  doc.text('Current vs Goal State', margin, goalStateTitleY);

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
    startY: goalStateTitleY + 20,
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

  // Coaching Notes & Adaptations
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Weekly Coaching Notes', margin, 40);

  const notesRows = plan.timeline.checkpoints.map(cp => {
    const evidenceList = resolveEvidence(cp.evidence || []).map(source => {
      const primaryAuthor = source.authors.split(',')[0] || source.authors;
      return `${primaryAuthor.trim()} ${source.publicationYear}`;
    });

    return [
      `Week ${cp.week}`,
      cp.phase,
      cp.notes || '—',
      cp.adaptations.join('; ') || '—',
      evidenceList.join('; ') || '—'
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [['Week', 'Phase', 'Focus Notes', 'Metabolic Adaptations', 'Evidence']],
    body: notesRows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20, 20, 20] },
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // Daily Meal Macro Guidance
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Daily Meal Macro Guidance', margin, 40);
  
  const sampleWeeks = [1, 4, 8, 12, 16, 20, 24].filter(w => w <= plan.timeline.totalWeeks);
  
  for (const week of sampleWeeks) {
    const checkpoint = plan.timeline.checkpoints.find(cp => cp.week === week);
    if (!checkpoint) continue;

    doc.addPage();
    doc.setFontSize(14);
    doc.text(`Week ${week} • ${checkpoint.phase}`, margin, 40);
    doc.setFontSize(10);
    doc.text(
      `Daily Targets: ${checkpoint.dailyCalories} kcal • ${checkpoint.proteinGrams}g protein • ${checkpoint.carbGrams}g carbs • ${checkpoint.fatGrams}g fat`,
      margin,
      60,
      { maxWidth: 520 }
    );

    const dailyMeals = generateDailyMealPlan(checkpoint, week);
    const mealRows = dailyMeals.map(meal => [
      meal.slot,
      meal.timing,
      `${meal.calories} kcal`,
      `${meal.protein}g P`,
      `${meal.carbs}g C`,
      `${meal.fat}g F`,
      meal.focus,
      meal.guidance
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Meal', 'Time', 'Calories', 'Protein', 'Carbs', 'Fat', 'Focus', 'Execution Guidance']],
      body: mealRows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [20, 20, 20] },
      columnStyles: {
        0: { cellWidth: 90 },
        6: { cellWidth: 120 },
        7: { cellWidth: 170 }
      },
      theme: 'grid',
      margin: { left: margin, right: margin }
    });
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
