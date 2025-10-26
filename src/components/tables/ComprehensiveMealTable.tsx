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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChefHat, Clock, Utensils } from 'lucide-react';
import { useState } from 'react';

interface ComprehensiveMeal {
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

interface ComprehensiveMealTableProps {
  data: ComprehensiveMeal[];
}

export function ComprehensiveMealTable({ data }: ComprehensiveMealTableProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  // Sort meals by meal type order, then by name
  const mealTypeOrder = ['Breakfast', 'Snack', 'Lunch', 'Pre-Workout', 'Post-Workout', 'Dinner'];
  const sortedData = [...data].sort((a, b) => {
    const aIndex = mealTypeOrder.indexOf(a.mealType);
    const bIndex = mealTypeOrder.indexOf(b.mealType);
    
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    
    return a.name.localeCompare(b.name);
  });

  const toggleMealExpansion = (templateId: string) => {
    const newExpanded = new Set(expandedMeals);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedMeals(newExpanded);
  };

  const getMealTypeColor = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'lunch':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dinner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'snack':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pre-workout':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'post-workout':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMealTypeIcon = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return '🌅';
      case 'lunch':
        return '☀️';
      case 'dinner':
        return '🌙';
      case 'snack':
        return '🍎';
      case 'pre-workout':
        return '⚡';
      case 'post-workout':
        return '💪';
      default:
        return '🍽️';
    }
  };


  return (
    <div className="space-y-4">
      {sortedData.map((meal) => {
        const totalCalories = meal?.ingredients?.map((ingredient) => ingredient.calories).reduce((acc, curr) => acc + curr, 0) || 0;

        return (
        <Card key={meal.templateId} className="overflow-hidden">
          <Collapsible>
            <CollapsibleTrigger 
              className="w-full"
              onClick={() => toggleMealExpansion(meal.templateId)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMealTypeIcon(meal.mealType)}</span>
                    <div>
                      <CardTitle className="text-lg">{meal.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getMealTypeColor(meal.mealType)}>
                          {meal.mealType}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {meal.prepTime && meal.cookTime 
                            ? `${meal.prepTime} prep + ${meal.cookTime} cook`
                            : meal.prepTime || meal.cookTime || 'Quick meal'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold">{totalCalories} cal</div>
                      <div className="text-xs text-muted-foreground">
                        P: {meal.proteinGrams}g | C: {meal.carbsGrams}g | F: {meal.fatGrams}g
                      </div>
                    </div>
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${
                        expandedMeals.has(meal.templateId) ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ingredients */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Utensils className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">Ingredients</h4>
                    </div>
                    <div className="space-y-2">
                      {meal.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="flex-1">{ingredient.name}</span>
                          <span className="font-mono text-muted-foreground">{ingredient.amount}</span>
                          <span className="font-mono text-muted-foreground w-12 text-right">
                            {ingredient.calories} cal
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cooking Instructions */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ChefHat className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">Cooking Instructions</h4>
                    </div>
                    <ol className="space-y-2">
                      {meal.cookingInstructions.map((instruction, index) => (
                        <li key={index} className="flex gap-2 text-sm">
                          <span className="font-semibold text-primary min-w-[20px]">
                            {index + 1}.
                          </span>
                          <span>{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        );
      })}
    </div>
  );
}
