import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Utensils, Check, Plus, RefreshCw, ChevronRight, Trash2 } from 'lucide-react';
import { FoodSearchSheet } from './FoodSearchSheet';

interface Meal {
  mealId: string;
  mealName: string;
  mealType: string;
  isFromPlan: boolean;
  isConsumed: boolean;
  consumedAt?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  usdaFdcId?: string;
  servingSize?: string;
}

interface TargetMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface TodayMealsSectionProps {
  workoutPlanId: string;
  date: number;
  meals: Meal[];
  targetMacros?: TargetMacros;
  consumedMacros: { calories: number; protein: number; carbs: number; fat: number };
}

export function TodayMealsSection({
  workoutPlanId,
  date,
  meals,
  targetMacros,
  consumedMacros,
}: TodayMealsSectionProps) {
  const toggleMealConsumed = useMutation(api.dailyTracking.toggleMealConsumed);
  const addCustomMeal = useMutation(api.dailyTracking.addCustomMeal);
  const swapMeal = useMutation(api.dailyTracking.swapMeal);
  const deleteMeal = useMutation(api.dailyTracking.deleteMeal);

  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const [loadingMealId, setLoadingMealId] = useState<string | null>(null);

  const consumedCount = meals.filter((m) => m.isConsumed).length;
  const totalCount = meals.length;

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMeal({
        workoutPlanId: workoutPlanId as any,
        date,
        mealId,
      });
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  };

  const handleToggleMeal = async (mealId: string) => {
    setLoadingMealId(mealId);
    try {
      await toggleMealConsumed({
        workoutPlanId: workoutPlanId as any,
        date,
        mealId,
      });
    } catch (err) {
      console.error('Failed to toggle meal:', err);
    } finally {
      setLoadingMealId(null);
    }
  };

  const handleSwapMeal = (mealId: string) => {
    setSwappingMealId(mealId);
    setShowFoodSearch(true);
  };

  const handleAddMeal = () => {
    setSwappingMealId(null);
    setShowFoodSearch(true);
  };

  const handleFoodSelected = async (food: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fdcId?: string;
    servingSize?: string;
  }) => {
    try {
      if (swappingMealId) {
        // Swap existing meal
        await swapMeal({
          workoutPlanId: workoutPlanId as any,
          date,
          originalMealId: swappingMealId,
          newMeal: {
            mealName: food.name,
            mealType: 'Custom',
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            usdaFdcId: food.fdcId,
            servingSize: food.servingSize,
          },
        });
      } else {
        // Add new meal
        await addCustomMeal({
          workoutPlanId: workoutPlanId as any,
          date,
          meal: {
            mealName: food.name,
            mealType: 'Custom',
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            usdaFdcId: food.fdcId,
            servingSize: food.servingSize,
          },
        });
      }
    } catch (err) {
      console.error('Failed to add/swap meal:', err);
    }

    setShowFoodSearch(false);
    setSwappingMealId(null);
  };

  // Get meal type emoji
  const getMealEmoji = (mealType: string) => {
    const type = mealType.toLowerCase();
    if (type.includes('breakfast')) return '🍳';
    if (type.includes('lunch')) return '🥗';
    if (type.includes('dinner')) return '🍽️';
    if (type.includes('snack')) return '🍎';
    if (type.includes('pre-workout')) return '⚡';
    if (type.includes('post-workout')) return '💪';
    if (type.includes('custom')) return '✨';
    return '🍴';
  };

  // Get progress status
  const getProgressStatus = (consumed: number, target: number) => {
    const pct = target > 0 ? (consumed / target) * 100 : 0;
    if (pct >= 90 && pct <= 110) return { color: 'text-emerald-600', status: 'on-track' };
    if (pct >= 75 && pct <= 125) return { color: 'text-amber-600', status: 'close' };
    return { color: 'text-slate-500', status: 'off' };
  };

  return (
    <>
      <Card
        className={cn(
          'rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 backdrop-blur-xl',
          'shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]',
          'transition-all duration-300 overflow-hidden'
        )}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
                <Utensils className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-orange-600">
                  Meals
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {consumedCount}
                  <span className="text-sm text-slate-500 font-normal"> / {totalCount} logged</span>
                </div>
              </div>
            </div>

            {/* Add button */}
            <Button
              onClick={handleAddMeal}
              size="sm"
              variant="outline"
              className="rounded-full border-orange-200 hover:bg-orange-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Macro Progress (compact) */}
          {targetMacros && (
            <div className="mb-4 p-3 rounded-xl bg-white/60 border border-orange-100">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { key: 'calories', label: 'Cal', unit: '' },
                  { key: 'protein', label: 'P', unit: 'g' },
                  { key: 'carbs', label: 'C', unit: 'g' },
                  { key: 'fat', label: 'F', unit: 'g' },
                ].map(({ key, label, unit }) => {
                  const consumed = consumedMacros[key as keyof typeof consumedMacros];
                  const target = targetMacros[key as keyof typeof targetMacros];
                  const status = getProgressStatus(consumed, target);

                  return (
                    <div key={key}>
                      <div className={cn('text-sm font-bold font-mono', status.color)}>
                        {Math.round(consumed)}
                        {unit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        / {Math.round(target)}{unit} {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meal List */}
          <div className="space-y-2">
            {meals.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Utensils className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No meals planned</p>
                <Button
                  onClick={handleAddMeal}
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-orange-600 hover:text-orange-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add a meal
                </Button>
              </div>
            ) : (
              meals.map((meal) => (
                <div
                  key={meal.mealId}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl transition-all',
                    meal.isConsumed
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-white/60 border border-orange-100 hover:bg-white'
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleMeal(meal.mealId)}
                    disabled={loadingMealId === meal.mealId}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                      'border-2 flex-shrink-0',
                      meal.isConsumed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-300 hover:border-orange-400'
                    )}
                  >
                    {meal.isConsumed && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                  </button>

                  {/* Meal Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getMealEmoji(meal.mealType)}</span>
                      <span
                        className={cn(
                          'font-medium truncate',
                          meal.isConsumed ? 'text-emerald-800' : 'text-slate-800'
                        )}
                      >
                        {meal.mealName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{meal.calories} kcal</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-600">{meal.protein}g P</span>
                      <span className="font-mono text-amber-600">{meal.carbs}g C</span>
                      <span className="font-mono text-rose-600">{meal.fat}g F</span>
                    </div>
                  </div>

                  {/* Swap Button */}
                  {meal.isFromPlan && !meal.isConsumed && (
                    <button
                      onClick={() => handleSwapMeal(meal.mealId)}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                      )}
                      title="Swap meal"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}

                  {/* Delete Button for Custom Meals */}
                  {!meal.isFromPlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this meal?')) {
                          handleDeleteMeal(meal.mealId);
                        }
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      title="Delete meal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Food Search Sheet */}
      <FoodSearchSheet
        isOpen={showFoodSearch}
        onClose={() => {
          setShowFoodSearch(false);
          setSwappingMealId(null);
        }}
        onSelectFood={handleFoodSelected}
        mode={swappingMealId ? 'swap' : 'add'}
      />
    </>
  );
}

