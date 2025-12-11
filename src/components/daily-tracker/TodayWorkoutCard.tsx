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
    if (status === 'completed') return;

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
          'rounded-3xl border-0 bg-white/60 backdrop-blur-xl',
          'shadow-[0_8px_30px_rgb(0,0,0,0.04)]', // Softer shadow
          'p-6' // Increased padding consistency
        )}
      >
        <CardContent className="p-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
              <Bed className="h-7 w-7 text-slate-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-xl font-bold text-slate-800 tracking-tight">Rest Day</div>
              <div className="text-sm text-slate-500 font-medium">Recovery & Regeneration</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onClick={!isCompleted && !isSkipped ? handleComplete : undefined}
      className={cn(
        'rounded-3xl transition-all duration-300 overflow-hidden cursor-pointer group relative',
        isCompleted
          ? 'border-0 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_35px_60px_-15px_rgba(16,185,129,0.6),inset_0_2px_20px_rgba(255,255,255,0.5)]'
          : isSkipped
            ? 'border-2 border-slate-200 bg-slate-50/50 opacity-70'
            : 'border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5'
      )}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 -ml-2">
              <img
                src="/assets/images/3dIcons/dumbell.png"
                alt="Workout"
                className={cn(
                  "w-20 h-20 object-contain drop-shadow-xl transition-all",
                  isSkipped ? "grayscale opacity-50" : "filter hover:brightness-110"
                )}
              />
            </div>
            <div className="pt-2">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-widest mb-1',
                  isCompleted ? 'text-emerald-100' : isSkipped ? 'text-slate-400' : 'text-indigo-500/80'
                )}
              >
                Today's Workout
              </div>
              <div
                className={cn(
                  'text-2xl font-black leading-none tracking-tight',
                  isCompleted ? 'text-white' : isSkipped ? 'text-slate-500 line-through decoration-2' : 'text-slate-900'
                )}
              >
                {workoutData.sessionName}
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
                ? 'bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-md'
                : isSkipped
                  ? 'bg-slate-200 border-slate-300 text-slate-500'
                  : 'bg-white border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50'
            )}
          >
            {isCompleted ? 'Done' : isSkipped ? 'Skipped' : 'Skip'}
          </button>
        </div>

        {/* Stats Row */}
        <div className={cn(
          "flex items-center gap-6 mb-6 pb-6 border-b mx-1",
          isCompleted ? "border-white/20" : "border-slate-100"
        )}>
          <div className={cn("flex items-center gap-2", isCompleted ? "text-emerald-50" : "text-slate-600")}>
            <Clock className={cn("h-4 w-4", isCompleted ? "text-emerald-100" : "text-indigo-400")} />
            <span className="text-sm font-medium">{workoutData.duration} min</span>
          </div>
          <div className={cn("flex items-center gap-2", isCompleted ? "text-emerald-50" : "text-slate-600")}>
            <Target className={cn("h-4 w-4", isCompleted ? "text-emerald-100" : "text-purple-400")} />
            <span className="text-sm font-medium">{workoutData.exercises?.length || 0} exercises</span>
          </div>
        </div>

        {/* Exercises Preview */}
        {workoutData.exercises && workoutData.exercises.length > 0 && (
          <div className="space-y-2 px-1">
            <div className={cn(
              "text-[10px] font-bold uppercase tracking-widest pl-1 mb-2",
              isCompleted ? "text-emerald-100" : "text-slate-400"
            )}>
              Exercises
            </div>
            {workoutData.exercises.map((exercise, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl transition-all",
                  isCompleted
                    ? "bg-white/10 border border-white/10 hover:bg-white/20 text-white"
                    : "bg-white border border-slate-100 group-hover:border-indigo-100 group-hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                    isCompleted ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                  )}>
                    {idx + 1}
                  </div>
                  <span className={cn(
                    "text-sm font-medium truncate",
                    isCompleted ? "text-white" : "text-slate-700"
                  )}>
                    {exercise.name}
                  </span>
                </div>
                <div className={cn(
                  "font-mono text-xs px-2 py-1 rounded-md border shrink-0",
                  isCompleted ? "text-emerald-100 bg-white/10 border-white/20" : "text-slate-500 bg-slate-50 border-slate-100"
                )}>
                  {exercise.sets} × {exercise.reps}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tap hint */}
        {!isCompleted && !isSkipped && (
          <div className="mt-6 text-center">
            <span className="text-xs font-bold text-indigo-400/60 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">
              Tap to complete
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


