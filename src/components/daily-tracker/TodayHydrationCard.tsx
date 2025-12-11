import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Droplet, Plus, RotateCcw } from 'lucide-react';

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

  const BOTTLE_SIZE = 500; // ml

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

  const progress = Math.min(100, (currentIntake / target) * 100);
  const currentLiters = (currentIntake / 1000).toFixed(1);
  const targetLiters = (target / 1000).toFixed(1);

  // Calculate bottles
  const totalBottles = Math.ceil(target / BOTTLE_SIZE);
  // We want to show at least totalBottles, but if user exceeds, show more
  const bottlesToShow = Math.max(totalBottles, Math.ceil(currentIntake / BOTTLE_SIZE));

  // Calculate fill for each bottle
  const getBottleFill = (index: number) => {
    const bottleStart = index * BOTTLE_SIZE;
    const bottleEnd = bottleStart + BOTTLE_SIZE;

    if (currentIntake >= bottleEnd) return 100;
    if (currentIntake <= bottleStart) return 0;

    return ((currentIntake - bottleStart) / BOTTLE_SIZE) * 100;
  };

  const statusText = progress >= 100
    ? "Goal Reached! 🎉"
    : progress >= 50
      ? "Halfway there!"
      : "Keep drinking!";

  return (
    <Card
      className={cn(
        'rounded-3xl transition-all duration-300 overflow-hidden group',
        progress >= 100
          ? 'border-0 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_35px_60px_-15px_rgba(6,182,212,0.6),inset_0_2px_20px_rgba(255,255,255,0.5)]' // No borders, heavy 3D shadow + inner glow
          : 'border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]'
      )}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 -ml-2">
              <div className={cn("w-20 h-20 flex items-center justify-center transition-transform duration-500", progress >= 100 && "scale-110")}>
                {progress >= 100 ? (
                  <img
                    src="/assets/images/3dIcons/bottle-of-water.png"
                    alt="Water"
                    className="w-20 h-20 object-contain drop-shadow-2xl"
                  />
                ) : (
                  <img
                    src="/assets/images/3dIcons/bottle-of-water.png"
                    alt="Water"
                    className="w-20 h-20 object-contain drop-shadow-xl"
                  />
                )}
              </div>
            </div>
            <div className="pt-2">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-widest mb-1',
                  progress >= 100 ? 'text-cyan-100' : 'text-cyan-600/60'
                )}
              >
                Hydration
              </div>
              <div
                className={cn(
                  'text-2xl font-black leading-none tracking-tight',
                  progress >= 100 ? 'text-white' : 'text-slate-900'
                )}
              >
                {currentLiters} <span className={cn("text-base font-medium opacity-60", progress >= 100 ? "text-cyan-100" : "text-slate-400")}>/ {targetLiters}L</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className={cn(
              "text-xl font-black tracking-tight",
              progress >= 100 ? "text-cyan-50" : "text-cyan-600"
            )}>
              {Math.round(progress)}%
            </div>
            <div className={cn(
              "text-[10px] font-bold uppercase tracking-wider opacity-70",
              progress >= 100 ? "text-cyan-100" : "text-slate-400"
            )}>
              {progress >= 100 ? 'Goal Reached' : 'Daily Goal'}
            </div>
          </div>
        </div>

        {/* Bottle Visualization */}
        <div className="flex flex-wrap justify-between gap-2.5 mb-8 px-2">
          {Array.from({ length: bottlesToShow }).map((_, idx) => {
            const fillPct = getBottleFill(idx);

            return (
              <div key={idx} className="relative w-8 h-12 flex items-center justify-center">
                {/* Bottle Silhouette / Background */}
                <div className={cn(
                  "absolute inset-x-0 bottom-0 top-0 rounded-b-lg rounded-t-[10px] border overflow-hidden",
                  progress >= 100 ? "bg-white/10 border-white/20" : "bg-slate-50 border-slate-200"
                )}>
                  {/* Liquid */}
                  <div
                    className={cn(
                      "absolute bottom-0 inset-x-0 transition-all duration-700 ease-out",
                      fillPct >= 100 ? "rounded-t-[8px]" : ""
                    )}
                    style={{
                      height: `${fillPct}%`,
                      background: progress >= 100
                        ? 'linear-gradient(to top, rgba(255,255,255,0.4), rgba(255,255,255,0.8))'
                        : 'linear-gradient(to top, #38bdf8, #0ea5e9)'
                    }}
                  />
                </div>
                {/* Cap */}
                <div className={cn(
                  "absolute -top-[3px] w-3 h-[3px] rounded-t-sm",
                  progress >= 100 ? "bg-white/40" : "bg-slate-300"
                )} />
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleAddWater(250)}
            disabled={isAdding}
            size="sm"
            className={cn(
              "flex-1 h-11 rounded-xl font-bold shadow-sm transition-all hover:-translate-y-0.5",
              progress >= 100
                ? "bg-white/20 hover:bg-white/30 text-white border-0"
                : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-0"
            )}
          >
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
            250ml
          </Button>
          <Button
            onClick={() => handleAddWater(500)}
            disabled={isAdding}
            size="sm"
            className={cn(
              "flex-1 h-11 rounded-xl font-bold shadow-sm transition-all hover:-translate-y-0.5",
              progress >= 100
                ? "bg-white/20 hover:bg-white/30 text-white border-0"
                : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-0"
            )}
          >
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
            500ml
          </Button>
          <Button
            onClick={handleUndo}
            disabled={isRemoving || logs.length === 0}
            size="icon"
            variant="ghost"
            className={cn(
              "h-11 w-11 rounded-xl transition-colors",
              progress >= 100 ? "text-cyan-100 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            )}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

