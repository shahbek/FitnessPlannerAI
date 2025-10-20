// Utility to parse AI-generated workout plan JSON into the 9 essential tables

export interface ExerciseLibraryRow {
  exerciseId: string;
  name: string;
  difficulty: string;
}

export interface ExerciseMuscleGroupsRow {
  exerciseId: string;
  muscleGroup: string;
}

export interface ExerciseFormCuesRow {
  exerciseId: string;
  formCue: string;
}

export interface SessionTemplatesRow {
  templateId: string;
  name: string;
  totalDurationMinutes: number;
}

export interface SessionExercisesRow {
  templateId: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  exerciseOrder: number;
}

export interface MealTemplatesRow {
  templateId: string;
  name: string;
  mealType: string;
  totalCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface RecipeIngredientsRow {
  templateId: string;
  ingredientName: string;
  amount: string;
  calories: number;
}

export interface ShoppingItemsRow {
  categoryName: string;
  itemName: string;
  quantity: string;
  estimatedCost: number;
  priority: string;
}

export interface PhaseProgressionRow {
  phaseNumber: number;
  name: string;
  durationWeeks: number;
  focus: string;
}

export interface ComprehensiveMealRow {
  templateId: string;
  name: string;
  mealType: string;
  totalCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  cookingInstructions: string[];
  ingredients: Array<{
    name: string;
    amount: string;
    calories: number;
  }>;
  prepTime?: string;
  cookTime?: string;
}

export interface WeeklyScheduleRow {
  weekNumber: number;
  phaseName: string;
  focus: string;
  days: Array<{
    day: string;
    dayNumber: number;
    workouts: Array<{
      sessionId: string;
      sessionName: string;
      duration: number;
      targetMuscles: string[];
      exercises: Array<{
        exerciseId: string;
        name: string;
        sets: number;
        reps: string;
      }>;
    }>;
    meals: Array<{
      mealId: string;
      mealName: string;
      mealType: string;
      timing: string;
      calories: number;
      macros: {
        protein: number;
        carbs: number;
        fat: number;
      };
    }>;
    dailyMacros: {
      totalCalories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    restDay?: boolean;
  }>;
  weeklyTotals: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    totalWorkouts: number;
    totalWorkoutTime: number;
  };
}

export interface WeeklyShoppingRow {
  weekNumber: number;
  phaseName: string;
  categories: Array<{
    category: string;
    items: Array<{
      name: string;
      quantity: string;
      estimatedCost: number;
      priority: string;
      meals: string[];
    }>;
    categoryTotal: number;
  }>;
  weekTotal: number;
  meals: Array<{
    mealName: string;
    mealType: string;
    ingredients: string[];
  }>;
}

export interface ParsedWorkoutData {
  exerciseLibrary: ExerciseLibraryRow[];
  exerciseMuscleGroups: ExerciseMuscleGroupsRow[];
  exerciseFormCues: ExerciseFormCuesRow[];
  sessionTemplates: SessionTemplatesRow[];
  sessionExercises: SessionExercisesRow[];
  mealTemplates: MealTemplatesRow[];
  recipeIngredients: RecipeIngredientsRow[];
  shoppingItems: ShoppingItemsRow[];
  phaseProgression: PhaseProgressionRow[];
  comprehensiveMeals: ComprehensiveMealRow[];
  weeklySchedule: WeeklyScheduleRow[];
  weeklyShopping: WeeklyShoppingRow[];
}

export function parseWorkoutData(jsonData: any): ParsedWorkoutData {
  const exerciseLibrary: ExerciseLibraryRow[] = [];
  const exerciseMuscleGroups: ExerciseMuscleGroupsRow[] = [];
  const exerciseFormCues: ExerciseFormCuesRow[] = [];
  const sessionTemplates: SessionTemplatesRow[] = [];
  const sessionExercises: SessionExercisesRow[] = [];
  const mealTemplates: MealTemplatesRow[] = [];
  const recipeIngredients: RecipeIngredientsRow[] = [];
  const shoppingItems: ShoppingItemsRow[] = [];
  const phaseProgression: PhaseProgressionRow[] = [];
  const comprehensiveMeals: ComprehensiveMealRow[] = [];
  const weeklySchedule: WeeklyScheduleRow[] = [];
  const weeklyShopping: WeeklyShoppingRow[] = [];

  // Prefer AI-provided weekly schedules if available
  if (Array.isArray(jsonData.weeklySchedule) && jsonData.weeklySchedule.length > 0) {
    jsonData.weeklySchedule.forEach((week: any) => {
      const mappedWeek: WeeklyScheduleRow = {
        weekNumber: week.weekNumber || 1,
        phaseName: week.phaseName || jsonData.currentPhase || '',
        focus: week.focus || '',
        days: (week.days || []).map((day: any, idx: number) => {
          const meals = (day.meals || []).map((m: any, mi: number) => ({
            mealId: m.mealId || `${m.templateId || 'meal'}_${week.weekNumber || 1}_${idx + 1}_${mi + 1}`,
            mealName: m.mealName || m.name || m.baseRecipe?.name || m.mealType || 'Meal',
            mealType: m.mealType || 'Meal',
            timing: m.timing || m.time || '12:00 PM',
            calories: m.calories ?? m.totalCalories ?? 0,
            macros: {
              protein: m.macros?.protein ?? m.protein ?? 0,
              carbs: m.macros?.carbs ?? m.carbs ?? 0,
              fat: m.macros?.fat ?? m.fat ?? 0,
            },
          }));

          const dailyTotals = meals.reduce(
            (totals: { totalCalories: number; protein: number; carbs: number; fat: number }, meal: any) => ({
              totalCalories: totals.totalCalories + (meal.calories || 0),
              protein: totals.protein + (meal.macros.protein || 0),
              carbs: totals.carbs + (meal.macros.carbs || 0),
              fat: totals.fat + (meal.macros.fat || 0),
            }),
            { totalCalories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return {
            day: day.day || day.name || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][idx] || `Day ${idx+1}`,
            dayNumber: day.dayNumber || idx + 1,
            workouts: (day.workouts || day.sessions || []).map((w: any) => ({
              sessionId: w.sessionId || w.templateId || w.name || `session_${idx+1}`,
              sessionName: w.sessionName || w.name || 'Workout',
              duration: w.duration || w.totalDurationMinutes || 60,
              targetMuscles: w.targetMuscles || [],
              exercises: (w.exercises || w.structure || []).map((e: any) => ({
                exerciseId: e.exerciseId || e.name || 'exercise',
                name: e.name || e.exerciseId || 'Exercise',
                sets: e.sets || 0,
                reps: e.reps || '',
              })),
            })),
            meals,
            dailyMacros: dailyTotals,
            restDay: day.restDay ?? (Array.isArray(day.workouts) ? day.workouts.length === 0 : false),
          };
        }),
        weeklyTotals: { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalWorkouts: 0, totalWorkoutTime: 0 },
      };

      // compute weekly totals
      mappedWeek.weeklyTotals = mappedWeek.days.reduce(
        (totals: { totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number; totalWorkouts: number; totalWorkoutTime: number }, d: any) => ({
          totalCalories: totals.totalCalories + d.dailyMacros.totalCalories,
          totalProtein: totals.totalProtein + d.dailyMacros.protein,
          totalCarbs: totals.totalCarbs + d.dailyMacros.carbs,
          totalFat: totals.totalFat + d.dailyMacros.fat,
          totalWorkouts: totals.totalWorkouts + (d.workouts.length > 0 ? 1 : 0),
          totalWorkoutTime: totals.totalWorkoutTime + d.workouts.reduce((t: number, w: any) => t + (w.duration || 0), 0),
        }),
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalWorkouts: 0, totalWorkoutTime: 0 }
      );

      weeklySchedule.push(mappedWeek);
    });
  }

  // Parse Exercise Library
  if (jsonData.exerciseLibrary && Array.isArray(jsonData.exerciseLibrary)) {
    jsonData.exerciseLibrary.forEach((exercise: any) => {
      // Exercise Library
      exerciseLibrary.push({
        exerciseId: exercise.exerciseId || '',
        name: exercise.name || '',
        difficulty: exercise.difficulty || ''
      });

      // Exercise Muscle Groups
      if (exercise.muscleGroups && Array.isArray(exercise.muscleGroups)) {
        exercise.muscleGroups.forEach((muscle: string) => {
          exerciseMuscleGroups.push({
            exerciseId: exercise.exerciseId || '',
            muscleGroup: muscle
          });
        });
      }

      // Exercise Form Cues
      if (exercise.formCues && Array.isArray(exercise.formCues)) {
        exercise.formCues.forEach((cue: string) => {
          exerciseFormCues.push({
            exerciseId: exercise.exerciseId || '',
            formCue: cue
          });
        });
      }
    });
  }

  // Parse Session Templates
  if (jsonData.sessionTemplates && Array.isArray(jsonData.sessionTemplates)) {
    jsonData.sessionTemplates.forEach((session: any) => {
      // Session Templates
      sessionTemplates.push({
        templateId: session.templateId || '',
        name: session.name || '',
        totalDurationMinutes: session.totalDurationMinutes || 0
      });

      // Session Exercises
      if (session.structure && Array.isArray(session.structure)) {
        session.structure.forEach((exercise: any, exerciseIndex: number) => {
          sessionExercises.push({
            templateId: session.templateId || '',
            exerciseId: exercise.exerciseId || exercise.name || '',
            sets: exercise.sets || 0,
            reps: exercise.reps || '',
            restSeconds: exercise.restSeconds || 0,
            notes: exercise.notes || '',
            exerciseOrder: exerciseIndex + 1
          });
        });
      }
    });
  }

  // Parse Meal Templates
  if (jsonData.mealTemplates && Array.isArray(jsonData.mealTemplates)) {
    jsonData.mealTemplates.forEach((meal: any) => {
      // Meal Templates
      mealTemplates.push({
        templateId: meal.templateId || '',
        name: meal.name || '',
        mealType: meal.mealType || '',
        totalCalories: meal.totalCalories || 0,
        proteinGrams: meal.macros?.protein || 0,
        carbsGrams: meal.macros?.carbs || 0,
        fatGrams: meal.macros?.fat || 0
      });

      // Comprehensive Meals (enhanced version with cooking instructions)
      comprehensiveMeals.push({
        templateId: meal.templateId || '',
        name: meal.baseRecipe?.name || meal.name || '', // Use baseRecipe.name if available
        mealType: meal.mealType || '',
        totalCalories: meal.totalCalories || 0,
        proteinGrams: meal.macros?.protein || 0,
        carbsGrams: meal.macros?.carbs || 0,
        fatGrams: meal.macros?.fat || 0,
        cookingInstructions: meal.baseRecipe?.instructions || ['Follow package instructions'],
        ingredients: meal.baseRecipe?.ingredients || [],
        prepTime: meal.prepTime || '15 min',
        cookTime: meal.cookTime || '30 min'
      });

      // Recipe Ingredients
      if (meal.baseRecipe?.ingredients && Array.isArray(meal.baseRecipe.ingredients)) {
        meal.baseRecipe.ingredients.forEach((ingredient: any) => {
          recipeIngredients.push({
            templateId: meal.templateId || '',
            ingredientName: ingredient.name || '',
            amount: ingredient.amount || '',
            calories: ingredient.calories || 0
          });
        });
      }
    });
  }

  // Parse Shopping List
  if (jsonData.shoppingList?.categories && Array.isArray(jsonData.shoppingList.categories)) {
    jsonData.shoppingList.categories.forEach((category: any) => {
      if (category.items && Array.isArray(category.items)) {
        category.items.forEach((item: any) => {
          shoppingItems.push({
            categoryName: category.category || '',
            itemName: item.name || '',
            quantity: item.quantity || '',
            estimatedCost: item.estimatedCost || 0,
            priority: item.priority || ''
          });
        });
      }
    });
  }

  // Parse Phase Progression
  if (jsonData.phaseProgression?.phases && Array.isArray(jsonData.phaseProgression.phases)) {
    jsonData.phaseProgression.phases.forEach((phase: any) => {
      phaseProgression.push({
        phaseNumber: phase.phaseNumber || 0,
        name: phase.name || '',
        durationWeeks: phase.durationWeeks || 0,
        focus: phase.focus || ''
      });

      // If AI did not provide explicit weekly schedules above, synthesize as fallback
      if (weeklySchedule.length > 0) {
        return; // already filled from AI-provided schedule
      }

      for (let weekNum = 1; weekNum <= (phase.durationWeeks || 1); weekNum++) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeklyScheduleData: WeeklyScheduleRow = {
          weekNumber: weekNum,
          phaseName: phase.name || '',
          focus: phase.focus || '',
          days: days.map((day, index) => {
            const dayNumber = index + 1;
            const isWorkoutDay = dayNumber <= 6; // 6 workout days per week based on the data
            
            // Generate workouts for this day
            const workouts = isWorkoutDay ? generateDayWorkouts(dayNumber, jsonData.sessionTemplates, phase.name, weekNum) : [];
            // Debug: workouts mapping
            // console.log(`Week ${weekNum}, Day ${dayNumber}, Workouts:`, workouts);
            
            // Generate meals for this day using AI-generated meal templates
            const meals = generateDayMeals(jsonData.mealTemplates, isWorkoutDay, weekNum);
            
            // Calculate daily macros
            const dailyMacros = meals.reduce((totals, meal) => ({
              totalCalories: totals.totalCalories + meal.calories,
              protein: totals.protein + meal.macros.protein,
              carbs: totals.carbs + meal.macros.carbs,
              fat: totals.fat + meal.macros.fat
            }), { totalCalories: 0, protein: 0, carbs: 0, fat: 0 });

            return {
              day,
              dayNumber,
              workouts,
              meals,
              dailyMacros,
              restDay: !isWorkoutDay
            };
          }),
          weeklyTotals: {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            totalWorkouts: 6, // Based on the data showing 6 days/week
            totalWorkoutTime: 360 // 6 days * 60 minutes
          }
        };

        // Calculate weekly totals
        weeklyScheduleData.weeklyTotals = weeklyScheduleData.days.reduce((totals, day) => ({
          totalCalories: totals.totalCalories + day.dailyMacros.totalCalories,
          totalProtein: totals.totalProtein + day.dailyMacros.protein,
          totalCarbs: totals.totalCarbs + day.dailyMacros.carbs,
          totalFat: totals.totalFat + day.dailyMacros.fat,
          totalWorkouts: totals.totalWorkouts + (day.workouts.length > 0 ? 1 : 0),
          totalWorkoutTime: totals.totalWorkoutTime + day.workouts.reduce((time, workout) => time + workout.duration, 0)
        }), weeklyScheduleData.weeklyTotals);

        weeklySchedule.push(weeklyScheduleData);

        // Generate weekly shopping data
        const weeklyShoppingData = generateWeeklyShopping(weekNum, phase.name, jsonData.mealTemplates, jsonData.shoppingList);
        weeklyShopping.push(weeklyShoppingData);
      }
    });
  }

  return {
    exerciseLibrary,
    exerciseMuscleGroups,
    exerciseFormCues,
    sessionTemplates,
    sessionExercises,
    mealTemplates,
    recipeIngredients,
    shoppingItems,
    phaseProgression,
    comprehensiveMeals,
    weeklySchedule,
    weeklyShopping
  };
}

// Helper function to generate workouts for a specific day
function generateDayWorkouts(dayNumber: number, sessionTemplates: any[], phaseName?: string, weekNumber?: number): any[] {
  if (!sessionTemplates || sessionTemplates.length === 0) return [];
  
  // Map day numbers to workout types based on the data structure
  const workoutMapping = [
    { type: 'push_day_1', name: 'Chest and Triceps' },
    { type: 'pull_day_1', name: 'Back and Biceps' },
    { type: 'legs_day_1', name: 'Legs' },
    { type: 'push_day_2', name: 'Chest and Triceps' },
    { type: 'pull_day_2', name: 'Back and Biceps' },
    { type: 'legs_day_2', name: 'Legs' }
  ];
  
  const dayWorkout = workoutMapping[dayNumber - 1];
  if (!dayWorkout) return [];
  
  const session = sessionTemplates.find(s => s.templateId === dayWorkout.type);
  if (!session) return [];
  
  // Apply phase-based modifications to workout intensity
  const getPhaseIntensityMultiplier = (phaseName?: string) => {
    if (!phaseName) return 1;
    
    switch (phaseName.toLowerCase()) {
      case 'high-volume foundation':
        return 1.0; // Baseline
      case 'hypertrophy and strength':
        return 1.1; // Slightly higher intensity
      case 'strength and power':
        return 1.2; // Higher intensity for strength
      case 'taper and definition':
        return 0.9; // Lower intensity for definition
      default:
        return 1.0;
    }
  };
  
  const intensityMultiplier = getPhaseIntensityMultiplier(phaseName);
  const adjustedDuration = Math.round((session.totalDurationMinutes || 60) * intensityMultiplier);
  
  return [{
    sessionId: `${session.templateId}_week${weekNumber || 1}`,
    sessionName: session.name,
    duration: adjustedDuration,
    targetMuscles: session.targetMuscles || [],
    exercises: (session.structure || []).slice(0, 5).map((exercise: any) => ({
      exerciseId: exercise.exerciseId || exercise.name,
      name: exercise.exerciseId || exercise.name,
      sets: exercise.sets || 0,
      reps: exercise.reps || ''
    }))
  }];
}

// Helper function to generate meals for a day using AI-generated meal templates
function generateDayMeals(mealTemplates: any[], isTrainingDay: boolean, weekNumber?: number): any[] {
  if (!mealTemplates || mealTemplates.length === 0) return [];
  
  const mealTypes = ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner', 'Snack'];
  const timings = ['7:00 AM', '10:00 AM', '1:00 PM', '4:00 PM', '7:00 PM', '9:00 PM'];
  
  return mealTypes.map((mealType, index) => {
    const meal = mealTemplates.find(m => m.mealType === mealType) || mealTemplates[0];
    return {
      mealId: meal.templateId,
      mealName: meal.name,
      mealType: meal.mealType,
      timing: timings[index],
      calories: meal.totalCalories,
      macros: {
        protein: meal.macros?.protein || 0,
        carbs: meal.macros?.carbs || 0,
        fat: meal.macros?.fat || 0
      }
    };
  });
}

// Helper function to get optimal meal timing based on AI knowledge
function getOptimalTiming(mealType: string, isTrainingDay: boolean): string {
  const timings = {
    'Breakfast': '7:00 AM',
    'Mid-Morning Snack': '10:00 AM',
    'Pre-Workout Snack': isTrainingDay ? '11:30 AM' : '10:30 AM',
    'Lunch': '1:00 PM',
    'Post-Workout Snack': isTrainingDay ? '3:30 PM' : '2:30 PM',
    'Mid-Afternoon Snack': '4:00 PM',
    'Dinner': '7:00 PM',
    'Evening Snack': '9:00 PM'
  };
  
  return timings[mealType as keyof typeof timings] || '12:00 PM';
}



// Helper function to generate weekly shopping data
function generateWeeklyShopping(weekNumber: number, phaseName: string, mealTemplates: any[], shoppingList: any): WeeklyShoppingRow {
  // Get phase-specific meals for the week
  const uniqueMeals: Array<{
    mealName: string;
    mealType: string;
    ingredients: string[];
  }> = [];
  
  // Create a map to track unique meals
  const mealMap = new Map();
  
  // Apply phase-based meal selection
  const getPhaseMealFilter = (phaseName: string) => {
    switch (phaseName.toLowerCase()) {
      case 'high-volume foundation':
        return (meal: any) => meal.mealType === 'Breakfast' || meal.mealType === 'Lunch' || meal.mealType === 'Dinner';
      case 'hypertrophy and strength':
        return (meal: any) => meal.mealType === 'Breakfast' || meal.mealType === 'Lunch' || meal.mealType === 'Dinner' || meal.mealType === 'Post-Workout Snack';
      case 'strength and power':
        return (meal: any) => meal.mealType === 'Breakfast' || meal.mealType === 'Lunch' || meal.mealType === 'Dinner' || meal.mealType === 'Pre-Workout Snack' || meal.mealType === 'Post-Workout Snack';
      case 'taper and definition':
        return (meal: any) => meal.mealType === 'Breakfast' || meal.mealType === 'Lunch' || meal.mealType === 'Dinner' || meal.mealType === 'Mid-Morning Snack' || meal.mealType === 'Evening Snack';
      default:
        return () => true;
    }
  };
  
  const phaseMealFilter = getPhaseMealFilter(phaseName);
  
  mealTemplates.filter(phaseMealFilter).forEach(meal => {
    if (meal && !mealMap.has(meal.templateId)) {
      const ingredients = meal.baseRecipe?.ingredients?.map((ing: any) => ing.name) || [];
      const mealName = meal.baseRecipe?.mealName;
      
      uniqueMeals.push({
        mealName: mealName,
        mealType: meal.mealType,
        ingredients: ingredients
      });
      
      mealMap.set(meal.templateId, true);
    }
  });

  // Generate shopping categories based on the shopping list with phase-specific adjustments
  const categories: Array<{
    category: string;
    items: Array<{
      name: string;
      quantity: string;
      estimatedCost: number;
      priority: string;
      meals: string[];
    }>;
    categoryTotal: number;
  }> = [];
  
  // Apply phase-based quantity adjustments
  const getPhaseQuantityMultiplier = (phaseName: string, categoryName: string) => {
    switch (phaseName.toLowerCase()) {
      case 'high-volume foundation':
        return categoryName.toLowerCase().includes('protein') ? 1.0 : 1.0;
      case 'hypertrophy and strength':
        return categoryName.toLowerCase().includes('protein') ? 1.2 : 1.1;
      case 'strength and power':
        return categoryName.toLowerCase().includes('protein') ? 1.3 : 1.2;
      case 'taper and definition':
        return categoryName.toLowerCase().includes('protein') ? 1.1 : 0.8;
      default:
        return 1.0;
    }
  };
  
  if (shoppingList?.categories && Array.isArray(shoppingList.categories)) {
    shoppingList.categories.forEach((category: any) => {
      if (category.items && Array.isArray(category.items)) {
        const quantityMultiplier = getPhaseQuantityMultiplier(phaseName, category.category);
        
        const categoryItems = category.items.map((item: any) => {
          const adjustedCost = (item.estimatedCost || 0) * quantityMultiplier;
          return {
            name: item.name,
            quantity: item.quantity,
            estimatedCost: Math.round(adjustedCost * 100) / 100,
            priority: item.priority || 'Medium',
            meals: [] // Could be populated with which meals use this ingredient
          };
        });
        
        const categoryTotal = categoryItems.reduce((sum: number, item: any) => sum + item.estimatedCost, 0);
        
        categories.push({
          category: category.category,
          items: categoryItems,
          categoryTotal: Math.round(categoryTotal * 100) / 100
        });
      }
    });
  }

  const weekTotal = categories.reduce((sum: number, category: any) => sum + category.categoryTotal, 0);

  return {
    weekNumber,
    phaseName,
    categories,
    weekTotal,
    meals: uniqueMeals
  };
}
