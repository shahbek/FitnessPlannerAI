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
}

export function TodayCardioCard({
  workoutPlanId,
  date,
  cardioData,
  status,
  actualDuration,
}: TodayCardioCardProps) {
  const updateCardioStatus = useMutation(api.dailyTracking.updateCardioStatus);

  // Extract cardio info from template or direct props
  const cardio = cardioData.cardioTemplate || cardioData;
  const name = cardio.name || 'Cardio Session';
  const type = cardio.type || 'Cardio';
  const intensity = cardio.intensity || 'Moderate';
  const duration = cardio.durationMinutes || 30;
  const targetHR = (cardio as any).targetHeartRate;
  const calories = (cardio as any).caloriesBurned;

  const handleComplete = async () => {
    if (status === 'completed') return;

    try {
      await updateCardioStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: 'completed',
        durationActual: duration,
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
      });
    } catch (err) {
      console.error('Failed to update cardio status:', err);
    }
  };

  const viewData = {
    name,
    type,
    intensity,
    duration,
    targetHeartRate: targetHR,
    caloriesBurned: calories
  };

  return (
    <TodayCardioCardView
      cardioData={viewData}
      status={status}
      actualDuration={actualDuration}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
