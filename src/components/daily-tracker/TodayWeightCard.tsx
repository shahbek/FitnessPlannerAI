import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Scale, TrendingUp, TrendingDown, Minus, Check } from 'lucide-react';

interface TodayWeightCardProps {
  workoutPlanId: string;
  date: number;
  currentWeight?: number | null;
  previousWeight?: number | null;
  userWeight?: number; // Default weight from user profile
}

export function TodayWeightCard({
  workoutPlanId,
  date,
  currentWeight,
  previousWeight,
  userWeight,
}: TodayWeightCardProps) {
  const updateBodyWeight = useMutation(api.dailyTracking.updateBodyWeight);

  const [weight, setWeight] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize weight from current or default
  useEffect(() => {
    if (currentWeight) {
      setWeight(currentWeight.toFixed(1));
    } else if (userWeight) {
      setWeight(userWeight.toFixed(1));
    }
  }, [currentWeight, userWeight]);

  const handleSave = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return;

    setIsSaving(true);
    try {
      await updateBodyWeight({
        workoutPlanId: workoutPlanId as any,
        date,
        weight: weightNum,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update weight:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate trend
  const getTrend = () => {
    if (!currentWeight || !previousWeight) return null;
    const diff = currentWeight - previousWeight;
    const diffAbs = Math.abs(diff).toFixed(1);

    if (Math.abs(diff) < 0.1) {
      return { icon: Minus, text: 'Stable', color: 'text-slate-500', bg: 'bg-slate-100' };
    }
    if (diff > 0) {
      return { icon: TrendingUp, text: `+${diffAbs}kg`, color: 'text-amber-600', bg: 'bg-amber-100' };
    }
    return { icon: TrendingDown, text: `-${diffAbs}kg`, color: 'text-emerald-600', bg: 'bg-emerald-100' };
  };

  const trend = getTrend();
  const hasLogged = currentWeight !== undefined && currentWeight !== null;

  return (
    <Card
      className={cn(
        'rounded-3xl border-2 transition-all duration-300 overflow-hidden',
        hasLogged
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
                hasLogged
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
              )}
            >
              {hasLogged ? (
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              ) : (
                <Scale className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <div
                className={cn(
                  'text-xs font-bold uppercase tracking-wider',
                  hasLogged ? 'text-emerald-600' : 'text-slate-500'
                )}
              >
                Weight
              </div>
              <div className="text-sm text-slate-500">
                {hasLogged ? 'Logged today' : 'Not logged yet'}
              </div>
            </div>
          </div>

          {/* Trend Badge */}
          {trend && (
            <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full', trend.bg)}>
              <trend.icon className={cn('h-4 w-4', trend.color)} />
              <span className={cn('text-xs font-bold', trend.color)}>{trend.text}</span>
            </div>
          )}
        </div>

        {/* Weight Input */}
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <div className="relative flex-1">
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Enter weight"
                  step="0.1"
                  min="20"
                  max="500"
                  className={cn(
                    'h-14 text-2xl font-bold text-center font-mono rounded-xl',
                    'border-2 border-slate-200 focus:border-emerald-400',
                    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                  )}
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-medium">
                  kg
                </span>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="lg"
                className={cn(
                  'h-14 px-6 rounded-xl font-bold',
                  'bg-emerald-500 hover:bg-emerald-600'
                )}
              >
                {isSaving ? '...' : 'Save'}
              </Button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={cn(
                'w-full h-14 rounded-xl border-2 transition-all',
                'flex items-center justify-center gap-2',
                hasLogged
                  ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100'
                  : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'
              )}
            >
              {hasLogged ? (
                <>
                  <span className="text-3xl font-bold text-slate-800 font-mono">
                    {currentWeight?.toFixed(1)}
                  </span>
                  <span className="text-lg text-slate-500 font-medium">kg</span>
                </>
              ) : (
                <span className="text-slate-400 font-medium">Tap to log weight</span>
              )}
            </button>
          )}
        </div>

        {/* Previous Weight Reference */}
        {previousWeight && !isEditing && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-400">
              Yesterday: <span className="font-mono font-medium">{previousWeight.toFixed(1)}kg</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

