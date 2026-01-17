import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { TodayHydrationCardView } from './TodayHydrationCardView';

interface WaterLog {
  amount: number;
  timestamp: number;
}

interface TodayHydrationCardProps {
  workoutPlanId: string;
  date: number;
  currentIntake: number; // ml
  target: number; // ml
  logs: WaterLog[];
}

export function TodayHydrationCard({
  workoutPlanId,
  date,
  currentIntake,
  target,
  logs,
}: TodayHydrationCardProps) {
  const addWaterLog = useMutation(api.dailyTracking.addWaterLog);
  const removeLastWaterLog = useMutation(api.dailyTracking.removeLastWaterLog);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const handleAddWater = async (amount: number) => {
    if (isAdding) return;

    setIsAdding(true);
    try {
      await addWaterLog({
        workoutPlanId: workoutPlanId as any,
        date,
        amount,
      });
    } catch (err) {
      console.error('Failed to add water log:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUndo = async () => {
    if (isRemoving || logs.length === 0) return;
    setIsRemoving(true);
    try {
      await removeLastWaterLog({
        workoutPlanId: workoutPlanId as any,
        date,
      });
    } catch (err) {
      console.error('Failed to remove water log:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <TodayHydrationCardView
      currentIntake={currentIntake}
      target={target}
      onAddWater={handleAddWater}
      onUndo={handleUndo}
      isAdding={isAdding}
      isRemoving={isRemoving}
      canUndo={logs.length > 0}
    />
  );
}
