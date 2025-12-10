import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search, X, Loader2, Plus, Star, Save, Trash2, ChevronLeft } from 'lucide-react';
import {
  searchCommonFoods,
  COMMON_FOODS,
  type USDAFoodItem,
} from '@/services/USDAFoodService';

interface FoodSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFood: (food: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fdcId?: string;
    servingSize?: string;
  }) => void;
  mode: 'add' | 'swap';
}

export function FoodSearchSheet({
  isOpen,
  onClose,
  onSelectFood,
  mode,
}: FoodSearchSheetProps) {
  const customMeals = useQuery(api.customMeals.getUserCustomMeals);
  const createCustomMeal = useMutation(api.customMeals.createCustomMeal);

  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<USDAFoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCommon, setShowCommon] = useState(true);
  const [servingMultiplier, setServingMultiplier] = useState<Record<string, number>>({});

  // Builder State
  const [builderIngredients, setBuilderIngredients] = useState<any[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [customMealName, setCustomMealName] = useState('');

  const searchUSDA = useAction(api.usda.searchFoods);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowCommon(true);
      return;
    }

    setShowCommon(false);
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [usdaResults, commonResults] = await Promise.all([
          searchUSDA({ query, pageSize: 15 }),
          Promise.resolve(searchCommonFoods(query)),
        ]);

        const combined = [...commonResults, ...usdaResults.foods];
        const seen = new Set<string>();
        const unique = combined.filter((food) => {
          const key = food.description.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Map back to local USDAFoodItem type if necessary, or ensure types match
        // The action returns objects compatible with USDAFoodItem
        setResults(unique.slice(0, 20) as USDAFoodItem[]);
      } catch (error) {
        console.error('Search failed:', error);
        setResults(searchCommonFoods(query));
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchUSDA]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setShowCommon(true);
      setServingMultiplier({});
      setActiveTab('search');
    }
  }, [isOpen]);

  const handleAddToBuilder = (food: USDAFoodItem) => {
    const multiplier = servingMultiplier[food.fdcId] || 1;
    const ingredient = {
      name: food.description,
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier * 10) / 10,
      carbs: Math.round(food.carbs * multiplier * 10) / 10,
      fat: Math.round(food.fat * multiplier * 10) / 10,
      fdcId: food.fdcId,
      servingSize: food.servingSize
        ? `${Math.round(food.servingSize * multiplier)}${food.servingSizeUnit || 'g'}`
        : '1 serving',
      originalFood: food, // Keep ref for re-editing if needed
      multiplier
    };

    setBuilderIngredients(prev => [...prev, ingredient]);
    // Optional: visual feedback trigger
    // Don't switch view immediately, let user keep searching
  };

  const handleSelectFood = (food: USDAFoodItem) => {


    const multiplier = servingMultiplier[food.fdcId] || 1;
    const servingStr = food.servingSize
      ? `${Math.round(food.servingSize * multiplier)}${food.servingSizeUnit || 'g'}`
      : undefined;

    onSelectFood({
      name: food.description,
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier * 10) / 10,
      carbs: Math.round(food.carbs * multiplier * 10) / 10,
      fat: Math.round(food.fat * multiplier * 10) / 10,
      fdcId: food.fdcId.startsWith('common-') ? undefined : food.fdcId,
      servingSize: servingStr,
    });
  };

  const updateServingMultiplier = (fdcId: string, delta: number) => {
    setServingMultiplier((prev) => {
      const current = prev[fdcId] || 1;
      const newValue = Math.max(0.5, Math.min(5, current + delta));
      return { ...prev, [fdcId]: newValue };
    });
  };

  const handleSaveCustomMeal = async () => {
    if (!customMealName.trim() || builderIngredients.length === 0) return;

    const totalMacros = builderIngredients.reduce((acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    try {
      await createCustomMeal({
        name: customMealName,
        mealType: 'Custom',
        ingredients: builderIngredients.map(({ originalFood, multiplier, ...rest }) => rest), // Strip extra UI fields
        totalMacros: {
          calories: Math.round(totalMacros.calories),
          protein: Math.round(totalMacros.protein * 10) / 10,
          carbs: Math.round(totalMacros.carbs * 10) / 10,
          fat: Math.round(totalMacros.fat * 10) / 10,
        }
      });

      // Also log it immediately
      onSelectFood({
        name: customMealName,
        ...totalMacros,
        servingSize: '1 meal'
      });

      // Reset
      setIsBuilderOpen(false);
      setBuilderIngredients([]);
      setCustomMealName('');
    } catch (err) {
      console.error("Failed to save custom meal:", err);
    }
  };

  const renderFoodItem = (food: USDAFoodItem, isCommon: boolean = false) => {
    const multiplier = servingMultiplier[food.fdcId] || 1;
    const adjustedCalories = Math.round(food.calories * multiplier);
    const adjustedProtein = Math.round(food.protein * multiplier * 10) / 10;
    const adjustedCarbs = Math.round(food.carbs * multiplier * 10) / 10;
    const adjustedFat = Math.round(food.fat * multiplier * 10) / 10;

    return (
      <div
        key={food.fdcId}
        className={cn(
          'p-3 rounded-xl border transition-all',
          'hover:border-orange-300 hover:bg-orange-50/50',
          'border-slate-100 bg-white'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isCommon && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
              )}
              <span className="font-medium text-slate-800 line-clamp-1">
                {food.description}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-mono font-bold text-slate-700">
                {adjustedCalories} kcal
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-emerald-600">{adjustedProtein}g P</span>
              <span className="font-mono text-amber-600">{adjustedCarbs}g C</span>
              <span className="font-mono text-rose-600">{adjustedFat}g F</span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">
                Serving:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateServingMultiplier(food.fdcId, -0.5);
                  }}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  -
                </button>
                <span className="text-xs font-mono min-w-[60px] text-center">
                  {Math.round((food.servingSize || 100) * multiplier)}
                  {food.servingSizeUnit || 'g'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateServingMultiplier(food.fdcId, 0.5);
                  }}
                  className="w-5 h-5 rounded bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button
              onClick={() => handleSelectFood(food)}
              size="sm"
              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs w-full"
            >
              Log
            </Button>
            <Button
              onClick={() => handleAddToBuilder(food)}
              size="sm"
              variant="outline"
              className="h-8 px-3 rounded-lg border-orange-200 text-orange-600 hover:bg-orange-50 text-xs w-full"
            >
              <Plus className="h-3 w-3 mr-1" />
              Build
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl px-0 flex flex-col">
        <SheetHeader className="px-4 pb-3 border-b flex-shrink-0">
          <SheetDescription className="hidden">Search for food or create a custom meal</SheetDescription>
          {isBuilderOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsBuilderOpen(false)} className="h-8 w-8 -ml-2">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <SheetTitle className="text-lg">Build Custom Meal</SheetTitle>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">
                {mode === 'swap' ? 'Swap Meal' : 'Add Food'}
              </SheetTitle>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          )}

          {!isBuilderOpen && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Search</TabsTrigger>
                <TabsTrigger value="my-meals">My Meals</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {!isBuilderOpen && activeTab === 'search' && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients..."
                className="pl-10 h-10 rounded-xl bg-slate-50 border-0 focus:ring-1 focus:ring-orange-500"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-500 animate-spin" />
              )}
            </div>
          )}
        </SheetHeader>

        {isBuilderOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Meal Name</label>
                  <Input
                    placeholder="e.g. My Breakfast Bowl"
                    value={customMealName}
                    onChange={(e) => setCustomMealName(e.target.value)}
                    className="rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Ingredients ({builderIngredients.length})</label>
                    <Button variant="ghost" size="sm" onClick={() => setIsBuilderOpen(false)} className="text-orange-600 h-6 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Add more
                    </Button>
                  </div>
                  {builderIngredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="font-medium text-sm">{ing.name}</p>
                        <p className="text-xs text-slate-500">{ing.servingSize} • {ing.calories} kcal</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => setBuilderIngredients(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-300">Total Macros</span>
                    <span className="text-lg font-bold">
                      {builderIngredients.reduce((acc, i) => acc + i.calories, 0)} kcal
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-emerald-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.protein, 0))}g
                      </span>
                      <span className="text-slate-400">Protein</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-amber-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.carbs, 0))}g
                      </span>
                      <span className="text-slate-400">Carbs</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-rose-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.fat, 0))}g
                      </span>
                      <span className="text-slate-400">Fat</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="p-4 border-t bg-white">
              <Button onClick={handleSaveCustomMeal} className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                disabled={!customMealName || builderIngredients.length === 0}
              >
                Save & Log Meal
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {activeTab === 'search' ? (
                <>
                  {!isBuilderOpen && builderIngredients.length > 0 && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-orange-900">Building Meal...</span>
                        <span className="text-xs text-orange-600 block">{builderIngredients.length} ingredients selected</span>
                      </div>
                      <Button size="sm" onClick={() => setIsBuilderOpen(true)} className="bg-orange-500 text-white h-8">
                        Continue
                      </Button>
                    </div>
                  )}

                  {showCommon && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium text-slate-600">Quick Add Ingredients</span>
                      </div>
                      {COMMON_FOODS.map((food) => renderFoodItem(food, true))}
                    </>
                  )}

                  {!showCommon && results.length > 0 && results.map((food) =>
                    renderFoodItem(food, food.fdcId.startsWith('common-'))
                  )}

                  {!showCommon && !isSearching && results.length === 0 && query && (
                    <div className="text-center py-12 text-slate-500">
                      No foods found for "{query}"
                    </div>
                  )}
                </>
              ) : (
                /* My Meals Tab */
                <div className="space-y-3">
                  {customMeals === undefined ? (
                    <div className="text-center p-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-400" /></div>
                  ) : customMeals.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No saved meals yet.</p>
                      <p className="text-xs mt-1">Create one by selecting ingredients in the Search tab!</p>
                    </div>
                  ) : (
                    customMeals.map(meal => (
                      <div key={meal._id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-orange-200 transition-all cursor-pointer"
                        onClick={() => onSelectFood({
                          name: meal.name,
                          calories: meal.totalMacros.calories,
                          protein: meal.totalMacros.protein,
                          carbs: meal.totalMacros.carbs,
                          fat: meal.totalMacros.fat,
                          servingSize: '1 meal'
                        })}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800">{meal.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{meal.ingredients.length} ingredients</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-8 w-8 text-orange-500">
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="mt-3 flex gap-3 text-xs font-mono">
                          <span className="font-bold text-slate-700">{meal.totalMacros.calories} kcal</span>
                          <span className="text-emerald-600">{meal.totalMacros.protein}g P</span>
                          <span className="text-amber-600">{meal.totalMacros.carbs}g C</span>
                          <span className="text-rose-600">{meal.totalMacros.fat}g F</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

