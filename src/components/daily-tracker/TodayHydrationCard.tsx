import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Droplet, Plus } from 'lucide-react';

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
  const [isAdding, setIsAdding] = React.useState(false);

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

  const progress = Math.min(100, (currentIntake / target) * 100);
  const currentLiters = (currentIntake / 1000).toFixed(1);
  const targetLiters = (target / 1000).toFixed(1);

  // Get progress color
  const getProgressColor = () => {
    if (progress >= 100) return 'from-emerald-400 to-teal-500';
    if (progress >= 75) return 'from-blue-400 to-cyan-500';
    if (progress >= 50) return 'from-blue-400 to-blue-500';
    return 'from-blue-300 to-blue-400';
  };

  const getStatusText = () => {
    if (progress >= 100) return 'Goal reached! 🎉';
    if (progress >= 75) return 'Almost there!';
    if (progress >= 50) return 'Good progress';
    return 'Keep hydrating';
  };

  return (
    <Card
      className={cn(
        'rounded-3xl border-2 transition-all duration-300 overflow-hidden',
        progress >= 100
          ? 'border-emerald-300/60 bg-gradient-to-br from-emerald-50/80 via-emerald-100/50 to-teal-50/50 backdrop-blur-xl shadow-[0_10px_40px_rgba(16,185,129,0.15),inset_0_3px_6px_rgba(255,255,255,0.4)]'
          : 'border-white/60 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]'
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
                progress >= 100
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                  : 'bg-gradient-to-br from-blue-400 to-cyan-500'
              )}
            >
              <Droplet className="h-6 w-6 text-white" />
            </div>
            <div>
              <div
                className={cn(
                  'text-xs font-bold uppercase tracking-wider',
                  progress >= 100 ? 'text-emerald-600' : 'text-blue-600'
                )}
              >
                Hydration
              </div>
              <div className="text-lg font-bold text-slate-800">
                {currentLiters}
                <span className="text-sm text-slate-500 font-normal"> / {targetLiters}L</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold',
              progress >= 100
                ? 'bg-emerald-100 text-emerald-700'
                : progress >= 50
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
            )}
          >
            {Math.round(progress)}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 bg-gradient-to-r',
                getProgressColor()
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-slate-500 text-center font-medium">
            {getStatusText()}
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleAddWater(250)}
            disabled={isAdding}
            size="sm"
            variant="outline"
            className={cn(
              'flex-1 h-11 rounded-xl border-2 font-bold transition-all',
              'border-blue-200 hover:border-blue-300 hover:bg-blue-50',
              'active:scale-95'
            )}
          >
            <Plus className="h-4 w-4 mr-1" />
            250ml
          </Button>
          <Button
            onClick={() => handleAddWater(500)}
            disabled={isAdding}
            size="sm"
            variant="outline"
            className={cn(
              'flex-1 h-11 rounded-xl border-2 font-bold transition-all',
              'border-blue-200 hover:border-blue-300 hover:bg-blue-50',
              'active:scale-95'
            )}
          >
            <Plus className="h-4 w-4 mr-1" />
            500ml
          </Button>
          <Button
            onClick={() => handleAddWater(1000)}
            disabled={isAdding}
            size="sm"
            variant="outline"
            className={cn(
              'flex-1 h-11 rounded-xl border-2 font-bold transition-all',
              'border-blue-200 hover:border-blue-300 hover:bg-blue-50',
              'active:scale-95'
            )}
          >
            <Plus className="h-4 w-4 mr-1" />
            1L
          </Button>
        </div>

        {/* Recent Logs - Compact View */}
        {logs && logs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Recent logs</span>
              <div className="flex gap-2">
                {logs.slice(-5).map((log, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono"
                  >
                    +{log.amount}ml
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

