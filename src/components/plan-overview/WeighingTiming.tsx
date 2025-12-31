import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Scale, Sun, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import scaleIcon from '@/assets/images/3dicons/scale.png';

interface WeighingTimingProps {
  plan: any;
  userProfile?: {
    weight?: number;
    primaryGoal?: string;
  };
}

export function WeighingTiming({ plan, userProfile }: WeighingTimingProps) {
  const primaryGoal = userProfile?.primaryGoal || 'general_fitness';
  const isWeightLoss = primaryGoal.toLowerCase().includes('fat') || primaryGoal.toLowerCase().includes('loss');

  // Best weighing practices
  const bestTime = {
    time: '7:00 AM',
    description: 'First thing in the morning',
    reason: 'Most consistent baseline (after overnight fast, before food/water)'
  };

  const weighingFrequency = isWeightLoss ? 'Daily' : 'Weekly';
  const frequencyReason = isWeightLoss
    ? 'Daily tracking helps identify trends and maintain accountability during fat loss phases'
    : 'Weekly tracking reduces daily fluctuation noise and focuses on long-term progress';

  const bestDays = [
    { day: 'Monday', icon: Sun, description: 'Start of week baseline' },
    { day: 'Friday', icon: TrendingUp, description: 'End of week check' },
  ];

  const bestPractices = [
    {
      icon: Scale,
      title: 'Same Scale',
      description: 'Use the same scale in the same location for consistency'
    },
    {
      icon: Sun,
      title: 'Same Conditions',
      description: 'After bathroom, before eating or drinking, minimal clothing'
    },
    {
      icon: TrendingUp,
      title: 'Track Trends',
      description: 'Focus on weekly averages, not daily fluctuations'
    },
    {
      icon: Calendar,
      title: 'Consistent Timing',
      description: 'Same time each day for accurate comparisons'
    }
  ];

  return (
    <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-purple-50 to-purple-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(147,51,234,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(147,51,234,0.15),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-[0_4px_12px_rgba(147,51,234,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center">
            <Scale className="h-5 w-5 text-white drop-shadow-md" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-800 tracking-tight">Weighing Strategy</div>
            <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">Optimal Timing & Routine</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Timing Display - Compact */}
        <div className="flex items-center justify-between relative overflow-hidden rounded-xl bg-white/60 p-4 border border-white/50 shadow-sm">
          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sun className="h-4 w-4 text-purple-600" />
              <span className="text-2xl font-black text-purple-600 drop-shadow-sm tracking-tighter">{bestTime.time}</span>
              <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{weighingFrequency}</span>
            </div>
            <div className="text-xs text-slate-600 leading-tight">{bestTime.description} • {bestTime.reason}</div>
          </div>

          {/* Scale Visualization - Large & Prominent */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 ml-4 relative z-10">
            <div className="relative h-32 w-auto drop-shadow-2xl filter hover:brightness-110 transition-all duration-300 transform hover:scale-110">
              <img
                src={scaleIcon}
                alt="Scale"
                className="h-full w-auto object-contain"
              />
              <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white">
                {weighingFrequency}
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-white/50">
              Best Time
            </div>
          </div>

          {/* Background Decorative Elements */}
          <div className="absolute right-0 top-0 w-40 h-40 bg-purple-400/15 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        </div>

        {/* Combined Info Section - Compact Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Best Practices - Condensed */}
          <div className="bg-white/50 rounded-xl p-2.5 border border-white/60 shadow-sm">
            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-1.5">Best Practices</div>
            <div className="space-y-1">
              {bestPractices.map((practice, idx) => {
                const Icon = practice.icon;
                return (
                  <div key={idx} className="flex items-start gap-1.5">
                    <Icon className="h-3 w-3 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-[10px] font-semibold text-slate-700">{practice.title}:</span>
                      <span className="text-[10px] text-slate-600 ml-1">{practice.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Frequency & Important Note - Combined */}
          <div className="space-y-2">
            {/* Frequency */}
            <div className="bg-purple-100/50 rounded-xl p-2.5 border border-purple-200/50">
              <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wide mb-1">Frequency</div>
              <div className="text-[10px] text-slate-700 leading-tight">
                <span className="font-bold text-purple-700">{weighingFrequency}</span> recommended for{' '}
                <span className="font-semibold">{primaryGoal.replace(/_/g, ' ')}</span> goals.
                {!isWeightLoss && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-purple-600" />
                    <span className="text-[10px] text-slate-600">Best: Mon & Fri</span>
                  </div>
                )}
              </div>
            </div>

            {/* Important Note - Compact */}
            <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/50">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">Note</div>
                  <div className="text-[10px] text-amber-900 leading-tight">
                    Daily fluctuations 0.5-2kg normal. Focus on <span className="font-bold">weekly trends</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

