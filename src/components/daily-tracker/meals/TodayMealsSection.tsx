import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { FoodSearchSheet } from '../FoodSearchSheet';
import { TodayMealsSectionView } from './TodayMealsSectionView';

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

  return (
    <>
      <TodayMealsSectionView
        meals={meals}
        targetMacros={targetMacros}
        consumedMacros={consumedMacros}
        onToggleMeal={handleToggleMeal}
        onAddMeal={handleAddMeal}
        onSwapMeal={handleSwapMeal}
        onDeleteMeal={handleDeleteMeal}
        loadingMealId={loadingMealId}
        isDemo={false}
      />

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
