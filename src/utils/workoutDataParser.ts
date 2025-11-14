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

  // Extract daily meal combinations early for use throughout the function
  let dailyMealCombinations: any[] = [];
  if (jsonData.dailyMealCombinations && Array.isArray(jsonData.dailyMealCombinations)) {
    dailyMealCombinations = jsonData.dailyMealCombinations;
    console.log('📊 Using dailyMealCombinations:', dailyMealCombinations.length, 'combinations');
  } else if (jsonData.phaseMealTemplates && Array.isArray(jsonData.phaseMealTemplates)) {
    // Convert phaseMealTemplates (array of arrays) to dailyMealCombinations format
    // phaseMealTemplates is MealTemplate[][] where each inner array is a day's meals
    jsonData.phaseMealTemplates.forEach((dayMeals: any[], dayIndex: number) => {
      if (Array.isArray(dayMeals) && dayMeals.length > 0) {
        // Get week number from weeklyOutlines or default to 1
        const weekNumber = jsonData.weeklyOutlines?.[0]?.weekNumber || 1;
        
        // Convert MealTemplate[] to the meals format expected by parser
        const meals = dayMeals.map((meal: any) => ({
          mealType: meal.mealType || 'Meal',
          calories: meal.totalCalories || 0,
          protein: meal.macros?.protein || 0,
          carbs: meal.macros?.carbs || 0,
          fat: meal.macros?.fat || 0,
          recipe: {
            name: meal.name || meal.baseRecipe?.name || 'Meal',
            ingredients: meal.baseRecipe?.ingredients || [],
            instructions: meal.baseRecipe?.instructions || [],
          },
        }));
        
        dailyMealCombinations.push({
          weekNumber: weekNumber,
          dayNumber: dayIndex + 1,
          meals: meals,
        });
      }
    });
    console.log('📊 Converted phaseMealTemplates to dailyMealCombinations:', dailyMealCombinations.length, 'combinations');
  } else if (jsonData.weeklyMealTemplates && Array.isArray(jsonData.weeklyMealTemplates)) {
    // Convert weekly meal templates to daily combinations
    jsonData.weeklyMealTemplates.forEach((template: any) => {
      for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
        dailyMealCombinations.push({
          weekNumber: template.weekNumber,
          dayNumber: dayNumber,
          totalCalories: template.totalCalories,
          totalProtein: template.totalProtein,
          totalCarbs: template.totalCarbs,
          totalFat: template.totalFat,
          meals: template.meals
        });
      }
    });
    console.log('📊 Using weeklyMealTemplates (converted to daily):', dailyMealCombinations.length, 'combinations');
  } else {
    console.log('⚠️ No daily meal combinations found in data');
  }

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

  // Parse Exercise Library - Support both old and new structures
  let allExercises: any[] = [];
  
  // Handle new phaseExerciseLibraries structure (array of arrays - one per phase)
  if (jsonData.phaseExerciseLibraries && Array.isArray(jsonData.phaseExerciseLibraries)) {
    // Flatten array of arrays to get all exercises
    allExercises = jsonData.phaseExerciseLibraries.flat();
  }
  // Fallback to old exerciseLibrary structure
  else if (jsonData.exerciseLibrary && Array.isArray(jsonData.exerciseLibrary)) {
    allExercises = jsonData.exerciseLibrary;
  }

  // Process all exercises
  if (allExercises.length > 0) {
    allExercises.forEach((exercise: any) => {
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

  // Parse Session Templates - Support both old and new structures
  let allSessionTemplates: any[] = [];
  
  // Handle new phaseSessionTemplates structure (array of arrays - one per phase)
  if (jsonData.phaseSessionTemplates && Array.isArray(jsonData.phaseSessionTemplates)) {
    // Flatten array of arrays to get all session templates
    allSessionTemplates = jsonData.phaseSessionTemplates.flat();
  }
  // Fallback to old sessionTemplates structure
  else if (jsonData.sessionTemplates && Array.isArray(jsonData.sessionTemplates)) {
    allSessionTemplates = jsonData.sessionTemplates;
  }

  // Process all session templates
  if (allSessionTemplates.length > 0) {
    allSessionTemplates.forEach((session: any) => {
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

  // Parse Meal Templates - Support both old and new structures
  let allMealTemplates: any[] = [];
  
  // Handle new phaseMealTemplates structure (array of arrays)
  if (jsonData.phaseMealTemplates && Array.isArray(jsonData.phaseMealTemplates)) {
    allMealTemplates = jsonData.phaseMealTemplates.flat().filter((meal: any) => meal && meal.name);
  }
  // Fallback to old mealTemplates structure
  else if (jsonData.mealTemplates && Array.isArray(jsonData.mealTemplates)) {
    allMealTemplates = jsonData.mealTemplates;
  }

  // Process daily meal combinations (NEW APPROACH)
  if (dailyMealCombinations.length > 0) {
    console.log('🍽️ Processing', dailyMealCombinations.length, 'daily meal combinations');
    
    // Use a Set to track unique meals and avoid duplicates
    const uniqueMeals = new Set<string>();
    
    dailyMealCombinations.forEach((combination: any) => {
      // Safety check: ensure combination has meals array
      if (!combination || !Array.isArray(combination.meals)) {
        console.warn('⚠️ Invalid meal combination structure:', combination);
        return;
      }
      combination.meals.forEach((meal: any) => {
        // Create a unique key based on week + meal type (not day)
        const uniqueKey = `${combination.weekNumber}_${meal.mealType}`;
        
        // Skip if we've already processed this meal for this week
        if (uniqueMeals.has(uniqueKey)) {
          return;
        }
        
        uniqueMeals.add(uniqueKey);
        
        // Calculate calories from ingredients to verify accuracy
        const ingredientCalories = meal.recipe?.ingredients?.reduce((sum: number, ing: any) => sum + (ing.calories || 0), 0) || 0;
        
        console.log(`📋 Comprehensive: ${meal.recipe.name}: AI calories=${meal.calories}, Ingredient sum=${ingredientCalories}`);
        
        // Add to comprehensive meals for display
        comprehensiveMeals.push({
          templateId: uniqueKey,
          name: meal.recipe.name,
          mealType: meal.mealType,
          totalCalories: meal.calories,
          proteinGrams: meal.protein,
          carbsGrams: meal.carbs,
          fatGrams: meal.fat,
          cookingInstructions: meal.recipe.instructions || ['Follow package instructions'],
          ingredients: meal.recipe.ingredients || [],
          prepTime: '15 min',
          cookTime: '30 min'
        });

        // Add to meal templates for consistency
        mealTemplates.push({
          templateId: uniqueKey,
          name: meal.recipe.name,
          mealType: meal.mealType,
          totalCalories: meal.calories,
          proteinGrams: meal.protein,
          carbsGrams: meal.carbs,
          fatGrams: meal.fat
        });

        // Add to recipe ingredients
        if (meal.recipe.ingredients && Array.isArray(meal.recipe.ingredients)) {
          meal.recipe.ingredients.forEach((ingredient: any) => {
            recipeIngredients.push({
              templateId: uniqueKey,
              ingredientName: ingredient.name || '',
              amount: ingredient.amount || '',
              calories: ingredient.calories || 0
            });
          });
        }
      });
    });
    
    console.log(`✅ Processed ${uniqueMeals.size} unique meals from ${dailyMealCombinations.length} daily combinations`);
  }

  // Process all meal templates (LEGACY APPROACH - fallback)
  if (allMealTemplates.length > 0) {
    allMealTemplates.forEach((meal: any) => {
      // Apply the same calorie adjustments as Weekly Schedule for consistency
      let adjustedCalories = meal.baseRecipe?.ingredients?.map((ingredient: any) => ingredient.calories).reduce((acc: number, curr: number) => acc + curr, 0) || meal.totalCalories || 0;
      let adjustedProtein = meal.macros?.protein || 0;
      let adjustedCarbs = meal.macros?.carbs || 0;
      let adjustedFat = meal.macros?.fat || 0;

      // Keep real ingredient-based calories without artificial adjustments

      // Meal Templates (use same adjusted values for consistency)
      mealTemplates.push({
        templateId: meal.templateId || '',
        name: meal.name || '',
        mealType: meal.mealType || '',
        totalCalories: adjustedCalories,
        proteinGrams: adjustedProtein,
        carbsGrams: adjustedCarbs,
        fatGrams: adjustedFat
      });

      comprehensiveMeals.push({
        templateId: meal.templateId || '',
        name: meal.baseRecipe?.name || meal.name || '', // Use baseRecipe.name if available
        mealType: meal.mealType || '',
        totalCalories: adjustedCalories,
        proteinGrams: adjustedProtein,
        carbsGrams: adjustedCarbs,
        fatGrams: adjustedFat,
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

  // Parse Weekly Outlines
  if (jsonData.weeklyOutlines && Array.isArray(jsonData.weeklyOutlines)) {
    // Flatten phaseMealTemplates to get all meal templates
    const allMealTemplates = jsonData.phaseMealTemplates ? 
      jsonData.phaseMealTemplates.flat().filter((meal: any) => meal && meal.name) : 
      jsonData.mealTemplates || [];
    
    // Use the weekly outlines system
    const sessionTemplatesForGeneration = allSessionTemplates;
    const exerciseLibraryForGeneration = allExercises;

    jsonData.weeklyOutlines.forEach((week: any) => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const weeklyScheduleData: WeeklyScheduleRow = {
        weekNumber: week.weekNumber,
        phaseName: week.phase,
        focus: week.objectives?.join(', ') || '',
        days: days.map((day, index) => {
          const dayNumber = index + 1;
          const isWorkoutDay = week.trainingSchedule?.resistanceDays?.includes(day) || dayNumber <= 6;
          
          // Generate workouts for this day using weekly outline context
          // Pass exercise library to resolve exercise names from IDs
          // Pass training schedule to determine if this is a workout day
          const workouts = isWorkoutDay ? generateDayWorkouts(
            dayNumber, 
            sessionTemplatesForGeneration, 
            week.phase, 
            week.weekNumber,
            exerciseLibraryForGeneration,
            week.trainingSchedule
          ) : [];
          
          // Generate meals for this day using daily meal combinations (with fallback)
          const meals = dailyMealCombinations.length > 0
            ? generateDayMealsFromCombinations(dailyMealCombinations, week.weekNumber, dayNumber)
            : generateDayMeals(allMealTemplates, isWorkoutDay, week.weekNumber, jsonData.mealFrequency);
          
          // Calculate daily macros
          const dailyMacros = meals.reduce((totals, meal) => ({
            totalCalories: totals.totalCalories + meal.calories,
            protein: totals.protein + meal.macros.protein,
            carbs: totals.carbs + meal.macros.carbs,
            fat: totals.fat + meal.macros.fat
          }), { totalCalories: 0, protein: 0, carbs: 0, fat: 0 });

          const inferredRestDay = !isWorkoutDay || workouts.length === 0;

          return {
            day,
            dayNumber,
            workouts,
            meals,
            dailyMacros,
            restDay: day.restDay ?? inferredRestDay
          };
        }),
        weeklyTotals: {
          totalCalories: week.dailyTargets?.calories * 7 || 0,
          totalProtein: week.dailyTargets?.protein * 7 || 0,
          totalCarbs: week.dailyTargets?.carbs * 7 || 0,
          totalFat: week.dailyTargets?.fat * 7 || 0,
          totalWorkouts: week.trainingSchedule?.resistanceDays?.length || 0,
          totalWorkoutTime: (week.trainingSchedule?.resistanceDays?.length || 0) * 60
        }
      };

      weeklySchedule.push(weeklyScheduleData);
    });

    // Parse weekly shopping lists (new format from ShoppingListGenerationService)
    if (jsonData.shoppingList?.weeklyShoppingLists && Array.isArray(jsonData.shoppingList.weeklyShoppingLists)) {
      console.log('📋 Using new shopping list format from ShoppingListGenerationService');
      jsonData.shoppingList.weeklyShoppingLists.forEach((weekList: any) => {
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

        // Transform categories from new format to parser format
        weekList.categories?.forEach((category: any) => {
          const categoryItems = category.items?.map((item: any) => ({
            name: item.name || '',
            quantity: item.quantity || '',
            estimatedCost: item.estimatedCost || 0,
            priority: item.priority || 'medium',
            meals: [] // New format doesn't track which meals, can be added later
          })) || [];

          // Calculate category total from items
          const categoryTotal = categoryItems.reduce((sum: number, item: any) => sum + item.estimatedCost, 0);

          if (categoryItems.length > 0) {
            categories.push({
              category: category.category || 'Other',
              items: categoryItems,
              categoryTotal: Math.round(categoryTotal * 100) / 100
            });
          }
        });

        weeklyShopping.push({
          weekNumber: weekList.weekNumber,
          phaseName: weekList.phase || '',
          categories,
          weekTotal: weekList.weekTotal || 0,
          meals: [] // New format doesn't include meal list
        });
      });
    } else if (jsonData.shoppingList) {
      // Fallback: Use old format (generateWeeklyShopping function)
      console.log('📋 Using legacy shopping list format');
      jsonData.weeklyOutlines.forEach((week: any) => {
        const weeklyShoppingData = generateWeeklyShopping(week.weekNumber, week.phase, allMealTemplates, jsonData.shoppingList);
        weeklyShopping.push(weeklyShoppingData);
      });
    }

    // Extract phase information from weekly outlines
    const phases = new Map();
    jsonData.weeklyOutlines.forEach((week: any) => {
      if (!phases.has(week.phase)) {
        phases.set(week.phase, {
          phaseNumber: phases.size + 1,
          name: week.phase,
          durationWeeks: 0,
          focus: week.objectives?.join(', ') || ''
        });
      }
      phases.get(week.phase).durationWeeks++;
    });
    phaseProgression.push(...Array.from(phases.values()));
  }

  console.log('📊 Parser Results:', {
    exerciseLibrary: exerciseLibrary.length,
    sessionTemplates: sessionTemplates.length,
    mealTemplates: mealTemplates.length,
    comprehensiveMeals: comprehensiveMeals.length,
    weeklySchedule: weeklySchedule.length,
    dailyMealCombinations: dailyMealCombinations.length
  });

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
// Uses AI-generated session templates intelligently (NO HARDCODED MAPPINGS)
function generateDayWorkouts(
  dayNumber: number, 
  sessionTemplates: any[], 
  phaseName?: string, 
  weekNumber?: number,
  exerciseLibrary: any[] = [],
  trainingSchedule?: any
): any[] {
  const normalizedSessions = Array.isArray(sessionTemplates)
    ? sessionTemplates.flatMap((session: any) => {
        if (!session) return [];
        return Array.isArray(session) ? session : [session];
      })
    : [];

  if (normalizedSessions.length === 0) return [];

  const normalizedExercises = Array.isArray(exerciseLibrary)
    ? exerciseLibrary.flatMap((exercise: any) => {
        if (!exercise) return [];
        return Array.isArray(exercise) ? exercise : [exercise];
      })
    : [];

  // Create exercise lookup map for fast access
  const exerciseMap = new Map<string, any>();
  normalizedExercises.forEach((exercise: any) => {
    if (exercise.exerciseId) {
      exerciseMap.set(exercise.exerciseId, exercise);
    }
  });
  
  // Map day number to day name
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayName = dayNames[dayNumber - 1];
  
  // Determine if this is a resistance training day based on training schedule
  const isResistanceDay = trainingSchedule?.resistanceDays?.includes(dayName) ?? (dayNumber <= 6);
  
  if (!isResistanceDay) return [];
  
  // Intelligently select session template based on:
  // 1. Phase name (Foundation, Progression, Peak)
  // 2. Week number (for variety/progression)
  // 3. Day number (for split distribution)
  // 4. Available session templates (AI-generated)
  
  // Filter sessions by phase if phase name matches
  let availableSessions = normalizedSessions;
  
  if (phaseName) {
    const phaseLower = phaseName.toLowerCase();
    // Try to match by phase in templateId or name
    const phaseMatched = normalizedSessions.filter(s => 
      s.templateId?.toLowerCase().includes(phaseLower) ||
      s.name?.toLowerCase().includes(phaseLower)
    );
    
    // If we found phase-matched sessions, use those; otherwise use all
    if (phaseMatched.length > 0) {
      availableSessions = phaseMatched;
    }
  }
  
  // If we have multiple sessions, distribute them across the week for variety
  // Use week number and day number to create variety (prevents repetition)
  // This ensures different weeks get different session rotations
  const sessionIndex = ((weekNumber || 1) * 7 + dayNumber - 1) % availableSessions.length;
  const session = availableSessions[sessionIndex];
  
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
  
  // Map exercises with proper names from exercise library
  const exercises = (session.structure || []).map((exercise: any, idx: number) => {
    const exerciseId = exercise.exerciseId || `exercise-${idx + 1}`;
    const exerciseInfo = exerciseMap.get(exerciseId);
    const inferredName = exerciseId
      .split('_')
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const name = exercise.name || exerciseInfo?.name || inferredName;
    const targetMuscles = exercise.targetMuscles || exerciseInfo?.muscleGroups || [];
    
    return {
      exerciseId,
      name,
      sets: exercise.sets || 0,
      reps: exercise.reps || '',
      restSeconds: exercise.restSeconds || 0,
      notes: exercise.notes || '',
      targetMuscles
    };
  });
  
  return [{
    sessionId: `${session.templateId}_week${weekNumber || 1}`,
    sessionName: session.name || 'Workout',
    duration: adjustedDuration,
    targetMuscles: session.targetMuscles || [],
    exercises: exercises
  }];
}

// Helper function to generate meals from daily meal combinations
function generateDayMealsFromCombinations(dailyMealCombinations: any[], weekNumber: number, dayNumber: number): any[] {
  if (!dailyMealCombinations || dailyMealCombinations.length === 0) {
    console.warn('⚠️ No daily meal combinations available');
    return [];
  }
  
  // Find the combination for this specific week and day
  const combination = dailyMealCombinations.find(
    combo => combo.weekNumber === weekNumber && combo.dayNumber === dayNumber
  );
  
  if (!combination) {
    console.warn(`⚠️ No meal combination found for week ${weekNumber}, day ${dayNumber}`);
    return [];
  }
  
  // Return the meals from this combination
  return combination.meals.map((meal: any) => {
    // Calculate calories from ingredients to verify accuracy
    const ingredientCalories = meal.recipe?.ingredients?.reduce((sum: number, ing: any) => sum + (ing.calories || 0), 0) || 0;
    
    console.log(`🍽️ ${meal.recipe.name}: AI calories=${meal.calories}, Ingredient sum=${ingredientCalories}`);
    
    return {
      mealId: `${combination.weekNumber}_${combination.dayNumber}_${meal.mealType}`,
      mealName: meal.recipe.name,
      mealType: meal.mealType,
      timing: meal.timing,
      calories: meal.calories, // Exact calories from AI
      macros: {
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat
      }
    };
  });
}

// Helper function to generate meals for a day using AI-generated meal templates (LEGACY - kept for fallback)
function generateDayMeals(mealTemplates: any[], isTrainingDay: boolean, weekNumber?: number, mealFrequency?: number): any[] {
  if (!mealTemplates || mealTemplates.length === 0) return [];
  
  const frequency = mealFrequency || 4;
  
  // Define meal structure based on frequency preference
  let mealStructure: Array<{type: string, timing: string}>;
  
  if (frequency === 3) {
    mealStructure = [
      { type: 'Breakfast', timing: '7:00 AM' },
      { type: 'Lunch', timing: '1:00 PM' },
      { type: 'Dinner', timing: '7:00 PM' }
    ];
  } else if (frequency === 4) {
    mealStructure = [
      { type: 'Breakfast', timing: '7:00 AM' },
      { type: 'Lunch', timing: '1:00 PM' },
      { type: 'Dinner', timing: '7:00 PM' },
      { type: 'Evening Snack', timing: '9:00 PM' }
    ];
  } else if (frequency === 5) {
    mealStructure = [
      { type: 'Breakfast', timing: '7:00 AM' },
      { type: 'Mid-Morning Snack', timing: '10:00 AM' },
      { type: 'Lunch', timing: '1:00 PM' },
      { type: 'Dinner', timing: '7:00 PM' },
      { type: 'Evening Snack', timing: '9:00 PM' }
    ];
  } else { // 6 or more meals
    mealStructure = [
      { type: 'Breakfast', timing: '7:00 AM' },
      { type: 'Mid-Morning Snack', timing: '10:00 AM' },
      { type: 'Lunch', timing: '1:00 PM' },
      { type: 'Mid-Afternoon Snack', timing: '4:00 PM' },
      { type: 'Dinner', timing: '7:00 PM' },
      { type: 'Evening Snack', timing: '9:00 PM' }
    ];
  }
  
  // Adjust for training days ONLY if we have room in the meal frequency
  if (isTrainingDay && frequency >= 5) {
    // Only add pre/post workout snacks if user wants 5+ meals
    mealStructure.splice(2, 0, { type: 'Pre-Workout Snack', timing: '11:30 AM' });
    mealStructure.splice(4, 0, { type: 'Post-Workout Snack', timing: '3:30 PM' });
  } else if (isTrainingDay && frequency === 4) {
    // For 4 meals, replace one regular meal with pre-workout timing
    const preWorkoutIndex = mealStructure.findIndex(m => m.type === 'Mid-Morning Snack');
    if (preWorkoutIndex !== -1) {
      mealStructure[preWorkoutIndex] = { type: 'Pre-Workout Snack', timing: '11:30 AM' };
    }
  }
  // For 3 meals, keep it simple - no additional snacks, just time the meals around training
  
  return mealStructure.map((mealSlot, index) => {
    // Find a meal that matches the meal type, with variety based on week number
    let availableMeals = mealTemplates.filter(m => m.mealType === mealSlot.type);
    
    // If no exact match, try to find similar meal types
    if (availableMeals.length === 0) {
      if (mealSlot.type.includes('Snack')) {
        availableMeals = mealTemplates.filter(m => m.mealType.includes('Snack'));
      } else if (mealSlot.type === 'Breakfast') {
        availableMeals = mealTemplates.filter(m => m.mealType === 'Breakfast');
      } else if (mealSlot.type === 'Lunch') {
        availableMeals = mealTemplates.filter(m => m.mealType === 'Lunch');
      } else if (mealSlot.type === 'Dinner') {
        availableMeals = mealTemplates.filter(m => m.mealType === 'Dinner');
      }
    }
    
    // If still no matches, use any available meal
    if (availableMeals.length === 0) {
      availableMeals = mealTemplates;
    }
    
    // Select meal with variety based on week and day
    const mealIndex = (weekNumber || 1 + index) % availableMeals.length;
    const meal = availableMeals[mealIndex];
    
    // Keep real ingredient-based calories without artificial adjustments
    let adjustedMacros = meal.macros;
    
    return {
      mealId: meal.templateId,
      mealName: meal.baseRecipe?.name || meal.name,
      mealType: mealSlot.type, // Use the intended meal type, not the template's meal type
      timing: mealSlot.timing,
      calories: meal.baseRecipe?.ingredients?.map((ingredient: any) => ingredient.calories).reduce((acc: number, curr: number) => acc + curr, 0) || meal.totalCalories || 0,
      macros: adjustedMacros || {
        protein: meal.macros?.protein || 0,
        carbs: meal.macros?.carbs || 0,
        fat: meal.macros?.fat || 0
      }
    };
  });
}




// Helper function to generate weekly shopping data
function generateWeeklyShopping(weekNumber: number, phaseName: string, mealTemplates: any[], shoppingList: any): WeeklyShoppingRow {
  // Safety check for mealTemplates
  if (!mealTemplates || !Array.isArray(mealTemplates)) {
    console.warn('⚠️ No meal templates available for weekly shopping generation');
    return {
      weekNumber,
      phaseName,
      categories: [],
      weekTotal: 0,
      meals: []
    };
  }

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
    meals: uniqueMeals.map(meal => ({
      mealName: meal.mealName,
      mealType: meal.mealType,
      ingredients: meal.ingredients
    }))
  };
}
