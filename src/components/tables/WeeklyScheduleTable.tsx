import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dumbbell, Utensils, Clock, Target, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface DailySchedule {
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
}

interface WeeklySchedule {
  weekNumber: number;
  phaseName: string;
  focus: string;
  days: DailySchedule[];
  weeklyTotals: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    totalWorkouts: number;
    totalWorkoutTime: number;
  };
}

interface WeeklyScheduleTableProps {
  data: WeeklySchedule[];
}

export function WeeklyScheduleTable({ data }: WeeklyScheduleTableProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set()); // All collapsed by default

  const toggleWeekExpansion = (weekNumber: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekNumber)) {
      newExpanded.delete(weekNumber);
    } else {
      newExpanded.add(weekNumber);
    }
    setExpandedWeeks(newExpanded);
  };

  // Unified color scheme - subtle monochrome with accent
  const getMealTypeStyle = () => {
    // Use subtle text color variations instead of colored backgrounds
    return 'text-foreground border border-border bg-transparent';
  };

  const getMuscleGroupStyle = () => {
    // Unified subtle style for all muscle groups
    return 'text-muted-foreground border border-border bg-transparent';
  };

  return (
    <div className="space-y-6">
      {data.map((week, weekIndex) => {
        // Alternating backgrounds with subtle elevation for visual separation
        const isEven = weekIndex % 2 === 0;
        
        return (
          <div 
            key={week.weekNumber} 
            className={`rounded-lg border border-border/60 transition-all hover:shadow-md hover:border-border ${
              isEven 
                ? 'bg-background shadow-sm' 
                : 'bg-muted/40 shadow-sm'
            }`}
          >
            <Collapsible>
              <CollapsibleTrigger 
                className="w-full hover:bg-muted/50 transition-colors rounded-t-lg"
                onClick={() => toggleWeekExpansion(week.weekNumber)}
              >
                <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  {/* Left: Week title and description */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-editorial font-light">
                        Week {week.weekNumber}
                      </h3>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm font-medium">{week.phaseName}</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">{week.focus}</p>
                  </div>

                  {/* Right: Weekly Summary */}
                  <div className="hidden md:flex items-center gap-8 mr-8">
                    <div className="text-center">
                      <div className="text-lg font-semibold font-mono">{week.weeklyTotals.totalWorkouts}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Workouts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold font-mono">{week.weeklyTotals.totalWorkoutTime}h</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold font-mono">{Math.round(week.weeklyTotals.totalCalories / 7)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Cal/Day</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold font-mono">{Math.round(week.weeklyTotals.totalProtein / 7)}g</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Protein</div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                      expandedWeeks.has(week.weekNumber) ? 'rotate-180' : ''
                    }`} 
                  />
                </div>
              </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 py-6 border-t border-border/50">
                <Tabs defaultValue={`day-${String(week.days[0]?.dayNumber || 1)}`} className="w-full">
                  <TabsList className="w-full justify-start mb-6">
                    {week.days.map((day) => (
                      <TabsTrigger 
                        key={`day-${day.dayNumber}`} 
                        value={`day-${String(day.dayNumber)}`}
                        className="text-xs"
                      >
                        {day.day}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {week.days.map((day) => (
                    <TabsContent key={`day-${day.dayNumber}`} value={`day-${String(day.dayNumber)}`} className="mt-0">
                      {day.restDay ? (
                        <div className="text-center py-16">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                            <Target className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-xl font-editorial font-light mb-2">Rest Day</h3>
                          <p className="text-sm text-muted-foreground">Active recovery and nutrition focus</p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* Workouts Section */}
                          <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                            <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Dumbbell className="h-4 w-4 text-primary" />
                              </div>
                              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Workouts</h3>
                            </div>
                            
                            {day.workouts.length > 0 ? (
                              <div className="space-y-5">
                                {day.workouts.map((workout, workoutIndex) => (
                                  <div 
                                    key={workout.sessionId} 
                                    className={`pb-5 last:pb-0 ${workoutIndex < day.workouts.length - 1 ? 'border-b border-border/50 mb-5' : ''}`}
                                  >
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <h4 className="text-base font-medium mb-1">{workout.sessionName}</h4>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {workout.duration} min
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {workout.targetMuscles.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mb-4">
                                        {workout.targetMuscles.map((muscle) => (
                                          <Badge 
                                            key={muscle} 
                                            variant="outline" 
                                            className={getMuscleGroupStyle()}
                                          >
                                            {muscle}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}

                                    <div className="space-y-3">
                                      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exercises</h5>
                                      <div className="space-y-2">
                                        {workout.exercises.map((exercise) => (
                                          <div 
                                            key={exercise.exerciseId} 
                                            className="flex justify-between items-center py-2 border-b border-border/50"
                                          >
                                            <span className="text-sm">{exercise.name}</span>
                                            <span className="font-mono text-xs text-muted-foreground">
                                              {exercise.sets} × {exercise.reps}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12 text-muted-foreground">
                                <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No workouts scheduled</p>
                              </div>
                            )}
                          </div>

                          {/* Meals Section */}
                          <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                            <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Utensils className="h-4 w-4 text-primary" />
                              </div>
                              <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Meals</h3>
                            </div>

                            {day.meals.length > 0 ? (
                              <div className="space-y-4">
                                {day.meals.map((meal, mealIndex) => {
                                  const actualMealName = meal.mealName || 'Meal';
                                  
                                  return (
                                    <div 
                                      key={meal.mealId}
                                      className={`pb-4 last:pb-0 ${mealIndex < day.meals.length - 1 ? 'border-b border-border/50 mb-4' : ''}`}
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 text-left">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className={getMealTypeStyle()}>
                                              {meal.mealType}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{meal.timing}</span>
                                          </div>
                                          <h4 className="text-sm font-medium mt-2 text-left">{actualMealName}</h4>
                                        </div>
                                        <span className="font-mono text-sm font-semibold ml-4">{Math.round(meal.calories)} cal</span>
                                      </div>
                                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                        <span>P: {Math.round(meal.macros.protein)}g</span>
                                        <span>C: {Math.round(meal.macros.carbs)}g</span>
                                        <span>F: {Math.round(meal.macros.fat)}g</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-12 text-muted-foreground">
                                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No meals scheduled</p>
                              </div>
                            )}

                            {/* Daily Macros Summary */}
                            <div className="mt-6 pt-5 border-t border-border/50">
                              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                                <Target className="h-3 w-3" />
                                Daily Totals
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <div className="text-xl font-semibold font-mono">{Math.round(day.dailyMacros.totalCalories)}</div>
                                  <div className="text-xs text-muted-foreground mt-1">Calories</div>
                                </div>
                                <div>
                                  <div className="text-xl font-semibold font-mono">{Math.round(day.dailyMacros.protein)}g</div>
                                  <div className="text-xs text-muted-foreground mt-1">Protein</div>
                                </div>
                                <div>
                                  <div className="text-xl font-semibold font-mono">{Math.round(day.dailyMacros.carbs)}g</div>
                                  <div className="text-xs text-muted-foreground mt-1">Carbs</div>
                                </div>
                                <div>
                                  <div className="text-xl font-semibold font-mono">{Math.round(day.dailyMacros.fat)}g</div>
                                  <div className="text-xs text-muted-foreground mt-1">Fat</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
