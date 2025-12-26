import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChefHat, Clock, Utensils, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

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

interface GroupedMeal {
  name: string;
  meals: ComprehensiveMeal[];
  mealTypes: Set<string>;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
}

export function ComprehensiveMealTable({ data }: ComprehensiveMealTableProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Group meals by name (normalized for case-insensitive matching)
  const groupedMeals = useMemo(() => {
    const groups = new Map<string, GroupedMeal>();

    data.forEach((meal) => {
      const normalizedName = meal.name.toLowerCase().trim();
      const existing = groups.get(normalizedName);

      if (existing) {
        existing.meals.push(meal);
        existing.mealTypes.add(meal.mealType);
        // Recalculate averages
        const total = existing.meals.length;
        existing.avgCalories = existing.meals.reduce((sum, m) => {
          const cal = m?.ingredients?.map((ing) => ing.calories).reduce((acc, curr) => acc + curr, 0) || m.totalCalories || 0;
          return sum + cal;
        }, 0) / total;
        existing.avgProtein = existing.meals.reduce((sum, m) => sum + (m.proteinGrams || 0), 0) / total;
        existing.avgCarbs = existing.meals.reduce((sum, m) => sum + (m.carbsGrams || 0), 0) / total;
        existing.avgFat = existing.meals.reduce((sum, m) => sum + (m.fatGrams || 0), 0) / total;
      } else {
        const totalCalories = meal?.ingredients?.map((ing) => ing.calories).reduce((acc, curr) => acc + curr, 0) || meal.totalCalories || 0;
        groups.set(normalizedName, {
          name: meal.name,
          meals: [meal],
          mealTypes: new Set([meal.mealType]),
          avgCalories: totalCalories,
          avgProtein: meal.proteinGrams || 0,
          avgCarbs: meal.carbsGrams || 0,
          avgFat: meal.fatGrams || 0,
        });
      }
    });

    return Array.from(groups.values());
  }, [data]);

  // Filter groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedMeals;

    const query = searchQuery.toLowerCase();
    return groupedMeals.filter((group) => {
      // Search in meal name
      if (group.name.toLowerCase().includes(query)) return true;

      // Search in meal types
      if (Array.from(group.mealTypes).some(type => type.toLowerCase().includes(query))) return true;

      // Search in ingredients
      return group.meals.some(meal =>
        meal.ingredients.some(ing => ing.name.toLowerCase().includes(query))
      );
    });
  }, [groupedMeals, searchQuery]);

  // Sort groups: meals with multiple versions first, then alphabetically
  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      // Prioritize groups with multiple meals
      if (a.meals.length !== b.meals.length) {
        return b.meals.length - a.meals.length;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filteredGroups]);

  const toggleMealExpansion = (templateId: string) => {
    const newExpanded = new Set(expandedMeals);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedMeals(newExpanded);
  };

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const getMealTypeStyle = () => {
    return 'text-foreground border border-border bg-transparent';
  };

  const getTotalCalories = (meal: ComprehensiveMeal) => {
    return meal?.ingredients?.map((ingredient) => ingredient.calories).reduce((acc, curr) => acc + curr, 0) || meal.totalCalories || 0;
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search meals by name, type, or ingredient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11 w-full"
        />
        {searchQuery && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {filteredGroups.length} {filteredGroups.length === 1 ? 'meal' : 'meals'}
          </div>
        )}
      </div>

      {/* Meal Groups */}
      {sortedGroups.length === 0 ? (
        <div className="py-12 text-muted-foreground">
          <p>No meals found matching "{searchQuery}"</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        sortedGroups.map((group, groupIndex) => {
          const hasMultipleVersions = group.meals.length > 1;
          const isGroupExpanded = expandedGroups.has(group.name);

          return (
            <div
              key={group.name}
              className={`rounded-xl border border-border/60 transition-all hover:shadow-lg hover:border-border ${
                groupIndex % 2 === 0
                  ? 'bg-background shadow-sm'
                  : 'bg-muted/30 shadow-sm'
              }`}
            >
              {/* Group Header - Shows when multiple versions exist */}
              {hasMultipleVersions ? (
                <Collapsible open={isGroupExpanded} onOpenChange={() => toggleGroupExpansion(group.name)}>
                  <CollapsibleTrigger className="w-full hover:bg-muted/50 transition-colors rounded-t-xl">
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-left">{group.name}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {group.meals.length} {group.meals.length === 1 ? 'version' : 'versions'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {Array.from(group.mealTypes).map((type) => (
                                <Badge key={type} variant="outline" className={getMealTypeStyle()}>
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 ml-4">
                          <div className="text-right">
                            <div className="text-xl font-semibold font-mono">
                              {Math.round(group.avgCalories)}
                            </div>
                            <div className="text-xs text-muted-foreground">avg cal</div>
                          </div>
                          <div className="text-sm text-muted-foreground border-l border-border/50 pl-4">
                            <div className="font-mono text-xs">
                              P: {Math.round(group.avgProtein)}g
                            </div>
                            <div className="font-mono text-xs">
                              C: {Math.round(group.avgCarbs)}g
                            </div>
                            <div className="font-mono text-xs">
                              F: {Math.round(group.avgFat)}g
                            </div>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                              isGroupExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-6 pb-4 border-t border-border/50 pt-4 space-y-3">
                      {group.meals.map((meal, mealIndex) => (
                        <div
                          key={meal.templateId}
                          className="bg-background/60 rounded-lg border border-border/40 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {meal.mealType}
                              </Badge>
                              {meal.prepTime || meal.cookTime ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {meal.prepTime && meal.cookTime
                                    ? `${meal.prepTime} prep + ${meal.cookTime} cook`
                                    : meal.prepTime || meal.cookTime || 'Quick meal'}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <div className="text-xl font-semibold font-mono">
                                  {Math.round(getTotalCalories(meal))}
                                </div>
                                <div className="text-xs text-muted-foreground">cal</div>
                              </div>
                              <div className="text-xs text-muted-foreground border-l border-border/50 pl-4">
                                <div className="font-mono">
                                  P: {Math.round(meal.proteinGrams)}g
                                </div>
                                <div className="font-mono">
                                  C: {Math.round(meal.carbsGrams)}g
                                </div>
                                <div className="font-mono">
                                  F: {Math.round(meal.fatGrams)}g
                                </div>
                              </div>
                            </div>
                          </div>
                          <MealDetails meal={meal} isExpanded={expandedMeals.has(meal.templateId)} onToggle={() => toggleMealExpansion(meal.templateId)} />
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                // Single version - show directly without grouping
                <div>
                  <MealCard
                    meal={group.meals[0]}
                    isExpanded={expandedMeals.has(group.meals[0].templateId)}
                    onToggle={() => toggleMealExpansion(group.meals[0].templateId)}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function MealCard({
  meal,
  isExpanded,
  onToggle,
}: {
  meal: ComprehensiveMeal;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const totalCalories = meal?.ingredients?.map((ingredient) => ingredient.calories).reduce((acc, curr) => acc + curr, 0) || meal.totalCalories || 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full hover:bg-muted/50 transition-colors rounded-xl">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0 text-left">
                <h3 className="text-lg font-medium mb-1 text-left">{meal.name}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="text-foreground border border-border bg-transparent">
                    {meal.mealType}
                  </Badge>
                  {meal.prepTime || meal.cookTime ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {meal.prepTime && meal.cookTime
                        ? `${meal.prepTime} prep + ${meal.cookTime} cook`
                        : meal.prepTime || meal.cookTime || 'Quick meal'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 ml-4">
              <div className="text-right">
                <div className="text-xl font-semibold font-mono">{Math.round(totalCalories)}</div>
                <div className="text-xs text-muted-foreground">cal</div>
              </div>
              <div className="text-sm text-muted-foreground border-l border-border/50 pl-4">
                <div className="font-mono text-xs">P: {Math.round(meal.proteinGrams)}g</div>
                <div className="font-mono text-xs">C: {Math.round(meal.carbsGrams)}g</div>
                <div className="font-mono text-xs">F: {Math.round(meal.fatGrams)}g</div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <MealDetails meal={meal} isExpanded={isExpanded} onToggle={onToggle} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function MealDetails({
  meal,
  isExpanded,
  onToggle,
}: {
  meal: ComprehensiveMeal;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="px-6 py-6 border-t border-border/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Ingredients */}
        <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Utensils className="h-4 w-4 text-primary" />
            </div>
            <h4 className="text-sm font-medium uppercase tracking-wide text-foreground">
              Ingredients
            </h4>
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
                <span className="font-mono text-sm text-muted-foreground ml-4">
                  {ingredient.amount}
                </span>
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
            <h4 className="text-sm font-medium uppercase tracking-wide text-foreground">
              Instructions
            </h4>
          </div>
          <ol className="space-y-3">
            {meal.cookingInstructions.map((instruction, index) => (
              <li
                key={index}
                className={`flex gap-3 text-sm ${
                  index < meal.cookingInstructions.length - 1
                    ? 'border-b border-border/50 pb-3'
                    : ''
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
  );
}
