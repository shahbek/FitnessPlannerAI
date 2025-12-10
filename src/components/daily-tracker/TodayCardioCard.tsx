import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, Check, X, Clock, Zap, Activity } from 'lucide-react';

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

  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';

  // Get intensity color
  const getIntensityColor = () => {
    const intensityLower = intensity.toLowerCase();
    if (intensityLower.includes('high') || intensityLower.includes('hiit')) {
      return {
        bg: 'from-rose-400 to-red-600',
        light: 'bg-rose-100 text-rose-700',
        text: 'text-rose-600',
      };
    }
    if (intensityLower.includes('low') || intensityLower.includes('zone 1')) {
      return {
        bg: 'from-teal-400 to-cyan-600',
        light: 'bg-teal-100 text-teal-700',
        text: 'text-teal-600',
      };
    }
    return {
      bg: 'from-rose-400 to-pink-600',
      light: 'bg-rose-100 text-rose-700',
      text: 'text-rose-600',
    };
  };

  const colors = getIntensityColor();

  return (
    <Card
      onClick={!isCompleted && !isSkipped ? handleComplete : undefined}
      className={cn(
        'rounded-3xl border-2 transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98]',
        isCompleted
          ? 'border-emerald-300/60 bg-gradient-to-br from-emerald-50/80 via-emerald-100/50 to-teal-50/50 backdrop-blur-xl shadow-[0_10px_40px_rgba(16,185,129,0.15),inset_0_3px_6px_rgba(255,255,255,0.4)]'
          : isSkipped
            ? 'border-slate-200/60 bg-slate-50/50 opacity-60 backdrop-blur-sm shadow-none'
            : 'border-white/60 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]'
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg',
                isCompleted
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                  : isSkipped
                    ? 'bg-gradient-to-br from-slate-300 to-slate-400'
                    : `bg-gradient-to-br ${colors.bg}`
              )}
            >
              {isCompleted ? (
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              ) : isSkipped ? (
                <X className="h-6 w-6 text-white" strokeWidth={2} />
              ) : (
                <Heart className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <div
                className={cn(
                  'text-xs font-bold uppercase tracking-wider',
                  isCompleted ? 'text-emerald-600' : isSkipped ? 'text-slate-500' : colors.text
                )}
              >
                Cardio
              </div>
              <div
                className={cn(
                  'text-lg font-bold',
                  isCompleted ? 'text-emerald-800' : isSkipped ? 'text-slate-600 line-through' : 'text-slate-800'
                )}
              >
                {name}
              </div>
            </div>
          </div>

          {/* Status indicator / Skip button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
              isCompleted
                ? 'bg-emerald-200 text-emerald-700'
                : isSkipped
                  ? 'bg-slate-300 text-slate-600'
                  : 'bg-rose-100 text-rose-600 hover:bg-rose-200'
            )}
          >
            {isCompleted ? '✓ Done' : isSkipped ? 'Skipped' : 'Skip'}
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="font-mono">
              {actualDuration || duration} min
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Activity className="h-4 w-4" />
            <span>{type}</span>
          </div>
          {calories && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Zap className="h-4 w-4" />
              <span className="font-mono">{calories} kcal</span>
            </div>
          )}
        </div>

        {/* Intensity & HR Zone */}
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-bold',
              isCompleted
                ? 'bg-emerald-200/50 text-emerald-700'
                : isSkipped
                  ? 'bg-slate-200 text-slate-500'
                  : colors.light
            )}
          >
            {intensity}
          </span>
          {targetHR && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium',
                'bg-slate-100 text-slate-600'
              )}
            >
              ❤️ {targetHR.min}-{targetHR.max} bpm
            </span>
          )}
        </div>

        {/* Tap hint */}
        {!isCompleted && !isSkipped && (
          <div className="mt-3 pt-3 border-t border-rose-100 text-center">
            <span className="text-xs text-rose-400 font-medium">Tap to mark complete</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

