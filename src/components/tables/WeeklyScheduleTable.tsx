import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dumbbell, Utensils, Clock, Calendar, Target, ChevronDown } from 'lucide-react';
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
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // First week expanded by default

  const toggleWeekExpansion = (weekNumber: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekNumber)) {
      newExpanded.delete(weekNumber);
    } else {
      newExpanded.add(weekNumber);
    }
    setExpandedWeeks(newExpanded);
  };

  const getMealTypeColor = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return 'bg-orange-100 text-orange-800';
      case 'lunch':
        return 'bg-blue-100 text-blue-800';
      case 'dinner':
        return 'bg-purple-100 text-purple-800';
      case 'snack':
        return 'bg-green-100 text-green-800';
      case 'pre-workout':
        return 'bg-yellow-100 text-yellow-800';
      case 'post-workout':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMuscleGroupColor = (muscle: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ];
    const index = muscle.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-4">
      {data.map((week) => (
        <Card key={week.weekNumber} className="overflow-hidden">
          <Collapsible>
            <CollapsibleTrigger 
              className="w-full"
              onClick={() => toggleWeekExpansion(week.weekNumber)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Week {week.weekNumber} - {week.phaseName}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">{week.focus}</p>
                  </div>
              
                  {/* Weekly Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">{week.weeklyTotals.totalWorkouts}</div>
                      <div className="text-xs text-muted-foreground">Workouts</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{week.weeklyTotals.totalWorkoutTime}h</div>
                      <div className="text-xs text-muted-foreground">Total Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{Math.round(week.weeklyTotals.totalCalories / 7)}</div>
                      <div className="text-xs text-muted-foreground">Avg Cal/Day</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{Math.round(week.weeklyTotals.totalProtein / 7)}g</div>
                      <div className="text-xs text-muted-foreground">Avg Protein/Day</div>
                    </div>
                  </div>
                  
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform ${
                      expandedWeeks.has(week.weekNumber) ? 'rotate-180' : ''
                    }`} 
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>

          <CardContent>
            <Tabs defaultValue="day-1" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                {week.days.map((day) => (
                  <TabsTrigger 
                    key={`day-${day.dayNumber}`} 
                    value={`day-${day.dayNumber}`}
                    className="text-xs"
                  >
                    {day.day}
                  </TabsTrigger>
                ))}
              </TabsList>

              {week.days.map((day) => (
                <TabsContent key={`day-${day.dayNumber}`} value={`day-${day.dayNumber}`} className="mt-6">
                  {day.restDay ? (
                    <div className="text-center py-12">
                      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Rest Day</h3>
                      <p className="text-muted-foreground">Active recovery and nutrition focus</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Workouts Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Dumbbell className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">Workouts</h3>
                        </div>
                        
                        {day.workouts.length > 0 ? (
                          <div className="space-y-4">
                            {day.workouts.map((workout) => (
                              <Card key={workout.sessionId} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold">{workout.sessionName}</h4>
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {workout.duration} min
                                  </Badge>
                                </div>
                                
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {workout.targetMuscles.map((muscle) => (
                                    <Badge key={muscle} className={getMuscleGroupColor(muscle)}>
                                      {muscle}
                                    </Badge>
                                  ))}
                                </div>

                                <div className="space-y-2">
                                  <h5 className="text-sm font-medium text-muted-foreground">Exercises:</h5>
                                  <div className="space-y-1">
                                    {workout.exercises.map((exercise) => (
                                      <div key={exercise.exerciseId} className="flex justify-between text-sm">
                                        <span>{exercise.name}</span>
                                        <span className="font-mono text-muted-foreground">
                                          {exercise.sets} x {exercise.reps}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Dumbbell className="h-8 w-8 mx-auto mb-2" />
                            <p>No workouts scheduled</p>
                          </div>
                        )}
                      </div>

                      {/* Meals Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Utensils className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">Meals</h3>
                        </div>

                        {day.meals.length > 0 ? (
                          <div className="space-y-3">
                            {day.meals.map((meal) => {
                              const actualMealName = meal.mealName || 'Meal';
                              return (
                                <Card key={meal.mealId} className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge className={getMealTypeColor(meal.mealType)}>
                                        {meal.mealType}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">{meal.timing}</span>
                                    </div>
                                    <span className="font-mono font-semibold">{meal.calories} cal</span>
                                  </div>
                                  <h4 className="font-medium mb-2">{actualMealName}</h4>
                                  <div className="flex gap-4 text-xs text-muted-foreground">
                                    <span>P: {meal.macros.protein}g</span>
                                    <span>C: {meal.macros.carbs}g</span>
                                    <span>F: {meal.macros.fat}g</span>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Utensils className="h-8 w-8 mx-auto mb-2" />
                            <p>No meals scheduled</p>
                          </div>
                        )}

                        {/* Daily Macros Summary */}
                        <Card className="mt-4 p-4 bg-muted/50">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Daily Totals
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-lg font-bold">{day.dailyMacros.totalCalories}</div>
                              <div className="text-muted-foreground">Total Calories</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold">{day.dailyMacros.protein}g</div>
                              <div className="text-muted-foreground">Protein</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold">{day.dailyMacros.carbs}g</div>
                              <div className="text-muted-foreground">Carbs</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold">{day.dailyMacros.fat}g</div>
                              <div className="text-muted-foreground">Fat</div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
