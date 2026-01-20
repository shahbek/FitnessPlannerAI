import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { TodayWorkoutCardView, WorkoutData } from './TodayWorkoutCardView';

interface TodayWorkoutCardProps {
  workoutPlanId: string;
  date: number;
  workoutData?: WorkoutData;
  status?: string | null;
  isRestDay?: boolean;
  planContext?: any; // Initialization context for lazy creation
}

export function TodayWorkoutCard({
  workoutPlanId,
  date,
  workoutData,
  status,
  isRestDay,
  planContext,
}: TodayWorkoutCardProps) {
  const updateWorkoutStatus = useMutation(api.dailyTracking.updateWorkoutStatus);

  const handleComplete = async () => {
    if (status === 'completed') return;

    try {
      await updateWorkoutStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: 'completed',
        planContext,
      });
    } catch (err) {
      console.error('Failed to update workout status:', err);
    }
  };

  const handleSkip = async () => {
    try {
      await updateWorkoutStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: status === 'skipped' ? 'completed' : 'skipped',
        planContext,
      });
    } catch (err) {
      console.error('Failed to update workout status:', err);
    }
  };

  return (
    <TodayWorkoutCardView
      workoutData={workoutData}
      status={status}
      isRestDay={isRestDay}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}


