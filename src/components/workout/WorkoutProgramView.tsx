import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseWorkoutData, ParsedWorkoutData } from '@/utils/workoutDataParser';

// Import all table components
import { ExerciseLibraryTable } from '@/components/tables/ExerciseLibraryTable';
import { ExerciseMuscleGroupsTable } from '@/components/tables/ExerciseMuscleGroupsTable';
import { ExerciseFormCuesTable } from '@/components/tables/ExerciseFormCuesTable';
import { SessionTemplatesTable } from '@/components/tables/SessionTemplatesTable';
import { SessionExercisesTable } from '@/components/tables/SessionExercisesTable';
import { MealTemplatesTable } from '@/components/tables/MealTemplatesTable';
import { RecipeIngredientsTable } from '@/components/tables/RecipeIngredientsTable';
import { ShoppingItemsTable } from '@/components/tables/ShoppingItemsTable';
import { PhaseProgressionTable } from '@/components/tables/PhaseProgressionTable';
import { ComprehensiveMealTable } from '@/components/tables/ComprehensiveMealTable';
import { WeeklyScheduleTable } from '@/components/tables/WeeklyScheduleTable';
import { WeeklyShoppingTable } from '@/components/tables/WeeklyShoppingTable';

interface WorkoutProgramViewProps {
  workoutData: any; // Raw JSON data from AI
  planTitle?: string;
}

export function WorkoutProgramView({ workoutData, planTitle }: WorkoutProgramViewProps) {
  const [parsedData, setParsedData] = useState<ParsedWorkoutData | null>(null);

  // Parse the data when component mounts or data changes
  useEffect(() => {
    if (workoutData) {
      try {
        const parsed = parseWorkoutData(workoutData);
        setParsedData(parsed);
        console.log('✅ Parsed workout data:', parsed);
      } catch (error) {
        console.error('Error parsing workout data:', error);
      }
    }
  }, [workoutData]);

  if (!parsedData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading workout program...</p>
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    {
      value: 'comprehensive-meals',
      label: 'Complete Meals',
      content: <ComprehensiveMealTable data={parsedData.comprehensiveMeals} />
    },
    {
      value: 'weekly-schedule',
      label: 'Weekly Schedule',
      content: <WeeklyScheduleTable data={parsedData.weeklySchedule} />
    },
    {
      value: 'shopping',
      label: 'Weekly Shopping',
      content: <WeeklyShoppingTable data={parsedData.weeklyShopping} />
    },
    {
      value: 'phases',
      label: 'Phase Progression',
      content: <PhaseProgressionTable data={parsedData.phaseProgression} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{planTitle || 'Workout Program'}</CardTitle>
              <p className="text-muted-foreground mt-2">
                Complete fitness program with exercises, nutrition, and progression
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {parsedData.exerciseLibrary.length} Exercises
              </Badge>
              <Badge variant="outline">
                {parsedData.sessionTemplates.length} Sessions
              </Badge>
              <Badge variant="outline">
                {parsedData.mealTemplates.length} Meals
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="comprehensive-meals" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
