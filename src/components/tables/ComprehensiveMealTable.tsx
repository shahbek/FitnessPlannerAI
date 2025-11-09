import { Badge } from '@/components/ui/badge';
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

  // Unified color scheme - subtle monochrome
  const getMealTypeStyle = () => {
    return 'text-foreground border border-border bg-transparent';
  };


  return (
    <div className="space-y-6">
      {sortedData.map((meal, mealIndex) => {
        const totalCalories = meal?.ingredients?.map((ingredient) => ingredient.calories).reduce((acc, curr) => acc + curr, 0) || 0;
        const isEven = mealIndex % 2 === 0;

        return (
          <div 
            key={meal.templateId} 
            className={`rounded-lg border border-border/60 transition-all hover:shadow-md hover:border-border ${
              isEven 
                ? 'bg-background shadow-sm' 
                : 'bg-muted/40 shadow-sm'
            }`}
          >
            <Collapsible>
              <CollapsibleTrigger 
                className="w-full hover:bg-muted/50 transition-colors rounded-t-lg"
                onClick={() => toggleMealExpansion(meal.templateId)}
              >
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-lg font-medium mb-1 text-left">{meal.name}</h3>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className={getMealTypeStyle()}>
                            {meal.mealType}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {meal.prepTime && meal.cookTime 
                              ? `${meal.prepTime} prep + ${meal.cookTime} cook`
                              : meal.prepTime || meal.cookTime || 'Quick meal'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-right">
                        <div className="text-xl font-semibold font-mono">{Math.round(totalCalories)}</div>
                        <div className="text-xs text-muted-foreground">cal</div>
                      </div>
                      <div className="text-sm text-muted-foreground border-l border-border/50 pl-4">
                        <div className="font-mono text-xs">
                          P: {Math.round(meal.proteinGrams)}g
                        </div>
                        <div className="font-mono text-xs">
                          C: {Math.round(meal.carbsGrams)}g
                        </div>
                        <div className="font-mono text-xs">
                          F: {Math.round(meal.fatGrams)}g
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                          expandedMeals.has(meal.templateId) ? 'rotate-180' : ''
                        }`} 
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 py-6 border-t border-border/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Ingredients */}
                    <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                          <Utensils className="h-4 w-4 text-primary" />
                        </div>
                        <h4 className="text-sm font-medium uppercase tracking-wide text-foreground">Ingredients</h4>
                      </div>
                      <div className="space-y-3">
                        {meal.ingredients.map((ingredient, index) => (
                          <div 
                            key={index} 
                            className={`flex justify-between items-center text-sm py-2 ${
                              index < meal.ingredients.length - 1 ? 'border-b border-border/50' : ''
                            }`}
                          >
                            <span className="flex-1">{ingredient.name}</span>
                            <span className="font-mono text-sm text-muted-foreground ml-4">{ingredient.amount}</span>
                            <span className="font-mono text-sm text-muted-foreground ml-4 w-16 text-right">
                              {Math.round(ingredient.calories)} cal
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cooking Instructions */}
                    <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                          <ChefHat className="h-4 w-4 text-primary" />
                        </div>
                        <h4 className="text-sm font-medium uppercase tracking-wide text-foreground">Instructions</h4>
                      </div>
                      <ol className="space-y-3">
                        {meal.cookingInstructions.map((instruction, index) => (
                          <li 
                            key={index} 
                            className={`flex gap-3 text-sm ${
                              index < meal.cookingInstructions.length - 1 ? 'border-b border-border/50 pb-3' : ''
                            }`}
                          >
                            <span className="font-semibold text-primary min-w-[24px] font-mono">
                              {index + 1}.
                            </span>
                            <span className="flex-1">{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
