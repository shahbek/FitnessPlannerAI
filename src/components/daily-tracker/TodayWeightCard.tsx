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
        'rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl',
        'shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]',
        'hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]',
        'transition-all duration-300 overflow-hidden'
      )}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 -ml-2">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src="/assets/images/3dIcons/scale.png"
                  alt="Scale"
                  className="w-20 h-20 object-contain drop-shadow-xl"
                />
              </div>
            </div>
            <div className="pt-2">
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-widest mb-1',
                  hasLogged ? 'text-indigo-600/60' : 'text-slate-400'
                )}
              >
                Weight
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {hasLogged ? 'Tracked' : 'Not Logged'}
              </div>
            </div>
          </div>

          {/* Trend Badge */}
          {trend && (
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl', trend.bg)}>
              <trend.icon className={cn('h-4 w-4', trend.color)} strokeWidth={2.5} />
              <span className={cn('text-xs font-bold leading-none', trend.color)}>{trend.text}</span>
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
                    'h-14 text-2xl font-bold text-center font-mono rounded-2xl',
                    'border-2 border-indigo-100 focus:border-indigo-400 focus:ring-0 bg-white',
                    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                  )}
                  autoFocus
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg text-slate-300 font-bold">
                  kg
                </span>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="lg"
                className={cn(
                  'h-14 px-6 rounded-2xl font-bold shadow-sm',
                  'bg-indigo-500 hover:bg-indigo-600'
                )}
              >
                {isSaving ? '...' : 'Save'}
              </Button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={cn(
                'w-full h-14 rounded-2xl border transition-all duration-300',
                'flex items-center justify-center gap-3 group',
                hasLogged
                  ? 'border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50'
                  : 'border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
              )}
            >
              {hasLogged ? (
                <>
                  <span className="text-3xl font-bold text-indigo-900 font-mono tracking-tight">
                    {currentWeight?.toFixed(1)}
                  </span>
                  <span className="text-lg text-indigo-400 font-medium">kg</span>
                </>
              ) : (
                <span className="text-slate-400 font-medium group-hover:text-slate-500 transition-colors">Tap to log weight</span>
              )}
            </button>
          )}
        </div>

        {/* Previous Weight Reference */}
        {previousWeight && !isEditing && (
          <div className="mt-4 text-center">
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
              Yesterday: <span className="font-mono text-slate-600">{previousWeight.toFixed(1)}kg</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

