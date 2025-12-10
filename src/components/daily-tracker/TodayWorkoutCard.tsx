import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Dumbbell, Check, X, Clock, Target, Bed } from 'lucide-react';

interface WorkoutData {
  sessionId: string;
  sessionName: string;
  duration: number;
  targetMuscles: string[];
  exercises: Array<{
    exerciseId: string;
    name: string;
    sets: number;
    reps: string;
  }>;
}

interface TodayWorkoutCardProps {
  workoutPlanId: string;
  date: number;
  workoutData?: WorkoutData;
  status?: string | null;
  isRestDay?: boolean;
}

export function TodayWorkoutCard({
  workoutPlanId,
  date,
  workoutData,
  status,
  isRestDay,
}: TodayWorkoutCardProps) {
  const updateWorkoutStatus = useMutation(api.dailyTracking.updateWorkoutStatus);

  const handleComplete = async () => {
    if (status === 'completed') return; // Already completed

    try {
      await updateWorkoutStatus({
        workoutPlanId: workoutPlanId as any,
        date,
        status: 'completed',
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
      });
    } catch (err) {
      console.error('Failed to update workout status:', err);
    }
  };

  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';

  // Rest day display
  if (isRestDay || !workoutData) {
    return (
      <Card
        className={cn(
          'rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 backdrop-blur-xl',
          'shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]'
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <Bed className="h-6 w-6 text-slate-600" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-slate-700">Rest Day</div>
              <div className="text-sm text-slate-500">Recovery & Regeneration</div>
            </div>
            <div className="text-2xl">😴</div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                'w-12 h-12 rounded-2xl flex items-center justify-center transition-all',
                isCompleted
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg'
                  : isSkipped
                    ? 'bg-gradient-to-br from-slate-300 to-slate-400'
                    : 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg'
              )}
            >
              {isCompleted ? (
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              ) : isSkipped ? (
                <X className="h-6 w-6 text-white" strokeWidth={2} />
              ) : (
                <Dumbbell className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <div
                className={cn(
                  'text-xs font-bold uppercase tracking-wider',
                  isCompleted ? 'text-emerald-600' : isSkipped ? 'text-slate-500' : 'text-indigo-600'
                )}
              >
                Workout
              </div>
              <div
                className={cn(
                  'text-lg font-bold',
                  isCompleted ? 'text-emerald-800' : isSkipped ? 'text-slate-600 line-through' : 'text-slate-800'
                )}
              >
                {workoutData.sessionName}
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
                  : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
            )}
          >
            {isCompleted ? '✓ Done' : isSkipped ? 'Skipped' : 'Skip'}
          </button>
        </div>

        {/* Details */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="font-mono">{workoutData.duration} min</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Target className="h-4 w-4" />
            <span>{workoutData.exercises?.length || 0} exercises</span>
          </div>
        </div>

        {/* Target Muscles */}
        {workoutData.targetMuscles && workoutData.targetMuscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workoutData.targetMuscles.slice(0, 4).map((muscle) => (
              <span
                key={muscle}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  isCompleted
                    ? 'bg-emerald-200/50 text-emerald-700'
                    : isSkipped
                      ? 'bg-slate-200 text-slate-500'
                      : 'bg-indigo-100 text-indigo-700'
                )}
              >
                {muscle}
              </span>
            ))}
            {workoutData.targetMuscles.length > 4 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                +{workoutData.targetMuscles.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Tap hint */}
        {!isCompleted && !isSkipped && (
          <div className="mt-3 pt-3 border-t border-indigo-100 text-center">
            <span className="text-xs text-indigo-400 font-medium">Tap to mark complete</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

