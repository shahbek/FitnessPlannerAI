import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { TodayCardioCardView } from './TodayCardioCardView';

interface CardioData {
  templateId?: string;
  name?: string;
  type?: string;
  intensity?: string;
  durationMinutes?: number;
  cardioTemplate?: {
    name: string;
    type: string;
    intensity: string;
    durationMinutes: number;
    targetHeartRate?: {
      min: number;
      max: number;
      zone: string;
    };
    caloriesBurned?: number;
  };
}

interface TodayCardioCardProps {
  workoutPlanId: string;
  date: number;
  cardioData: CardioData;
  status?: string | null;
  actualDuration?: number | null;
  planContext?: any; // Initialization context
}

export function TodayCardioCard({
  workoutPlanId,
  date,
  cardioData,
  status,
  actualDuration,
  planContext,
}: TodayCardioCardProps) {
  const updateCardioStatus = useMutation(api.dailyTracking.updateCardioStatus);

  const handleComplete = async () => {
    if (status === 'completed') return;

    try {
      await updateCardioStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: 'completed',
        durationActual: cardioData?.cardioTemplate?.durationMinutes || 30, // Default if not set
        planContext,
      });
    } catch (err) {
      console.error('Failed to update cardio status:', err);
    }
  };

  const handleSkip = async () => {
    try {
      await updateCardioStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: status === 'skipped' ? 'completed' : 'skipped',
        planContext,
      });
    } catch (err) {
      console.error('Failed to update cardio status:', err);
    }
  };

  return (
    <TodayCardioCardView
      cardioData={{
        name: cardioData.cardioTemplate?.name || cardioData.name || 'Cardio',
        type: cardioData.cardioTemplate?.type || cardioData.type || 'General',
        intensity: cardioData.cardioTemplate?.intensity || cardioData.intensity || 'Moderate',
        duration: cardioData.cardioTemplate?.durationMinutes || cardioData.durationMinutes || 30,
        targetHeartRate: cardioData.cardioTemplate?.targetHeartRate,
        caloriesBurned: cardioData.cardioTemplate?.caloriesBurned,
      }}
      status={status}
      actualDuration={actualDuration}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
