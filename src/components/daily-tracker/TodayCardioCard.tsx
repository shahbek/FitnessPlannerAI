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
        'rounded-3xl border-2 transition-all duration-300 overflow-hidden cursor-pointer group relative',
        isCompleted
          ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 via-emerald-100/50 to-teal-50/50 shadow-[0_10px_40px_rgba(16,185,129,0.2),inset_0_3px_6px_rgba(255,255,255,0.4)]'
          : isSkipped
            ? 'border-slate-200 bg-slate-50/50 opacity-70'
            : 'border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5'
      )}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 -ml-2">
              <div className="w-20 h-20 flex items-center justify-center">
                {isCompleted ? (
                  <Check className="h-10 w-10 text-emerald-100 drop-shadow-md" strokeWidth={3} />
                ) : isSkipped ? (
                  <X className="h-10 w-10 text-slate-300" strokeWidth={3} />
                ) : (
                  <img
                    src="/assets/images/3dIcons/cross-trainer.png"
                    alt="Cardio"
                    className="w-20 h-20 object-contain drop-shadow-xl"
                  />
                )}
              </div>
            </div>
            <div className="pt-2">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-widest mb-1',
                  isCompleted ? 'text-emerald-100' : isSkipped ? 'text-slate-400' : colors.text
                )}
              >
                Cardio
              </div>
              <div
                className={cn(
                  'text-2xl font-black leading-none tracking-tight',
                  isCompleted ? 'text-white' : isSkipped ? 'text-slate-500 line-through decoration-2' : 'text-slate-900'
                )}
              >
                {name}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm',
              isCompleted
                ? 'bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                : isSkipped
                  ? 'bg-slate-200 border-slate-300 text-slate-500'
                  : 'bg-white border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50'
            )}
          >
            {isCompleted ? 'Done' : isSkipped ? 'Skipped' : 'Skip'}
          </button>
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-6 mb-6 pb-6 border-b border-slate-100 mx-1">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium">{actualDuration || duration} min</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Activity className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-medium">{type}</span>
          </div>
          {calories && (
            <div className="flex items-center gap-2 text-slate-600">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">{calories} kcal</span>
            </div>
          )}
        </div>

        {/* Intensity & HR Zone */}
        <div className="flex flex-wrap gap-2 px-1">
          <span
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold border',
              isCompleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : isSkipped
                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                  : cn(colors.light, 'border-transparent')
            )}
          >
            {intensity}
          </span>
          {targetHR && (
            <span
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-100',
                isCompleted
                  ? 'bg-emerald-50/50 text-emerald-700'
                  : 'bg-slate-50 text-slate-600'
              )}
            >
              ❤️ {targetHR.min}-{targetHR.max} bpm
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

