import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplet, Clock, Coffee, Sun, Sunset, Moon } from 'lucide-react';
import { calculateWaterIntake } from '@/utils/planCalculations';

interface HydrationAndMealTimingProps {
  plan: any;
  userProfile?: {
    weight?: number;
  };
}

export function HydrationAndMealTiming({ plan, userProfile }: HydrationAndMealTimingProps) {
  const metrics = plan?.metrics || {};
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const weight = userProfile?.weight || 88;

  // Water intake
  const waterIntake = metrics?.water?.value || calculateWaterIntake(weight, 'moderate');
  const waterFormula = metrics?.water?.formula || '33ml × body weight (kg)';

  // Calculate bottles (500ml = 0.5L)
  const bottleSize = 0.5;
  const numBottles = (waterIntake / bottleSize).toFixed(1);

  // Meal timing
  const mealFrequency = framework?.nutritionApproach?.mealFrequency || 3;
  const timing = framework?.nutritionApproach?.timing || {};

  // Generate meal schedule based on frequency
  const generateMealSchedule = () => {
    const schedules = {
      3: [
        { time: '7:00 AM', meal: 'Breakfast', icon: Coffee, description: 'Break overnight fast' },
        { time: '1:00 PM', meal: 'Lunch', icon: Sun, description: 'Midday refuel' },
        { time: '7:00 PM', meal: 'Dinner', icon: Sunset, description: timing?.bedtime || '2-3 hours before sleep' },
      ],
      4: [
        { time: '7:00 AM', meal: 'Breakfast', icon: Coffee, description: 'Break overnight fast' },
        { time: '12:00 PM', meal: 'Lunch', icon: Sun, description: 'Midday refuel' },
        { time: '3:00 PM', meal: 'Snack', icon: Sun, description: 'Pre-dinner energy' },
        { time: '7:00 PM', meal: 'Dinner', icon: Sunset, description: timing?.bedtime || '2-3 hours before sleep' },
      ],
      5: [
        { time: '7:00 AM', meal: 'Breakfast', icon: Coffee, description: 'Break overnight fast' },
        { time: '10:00 AM', meal: 'Snack', icon: Coffee, description: 'Mid-morning fuel' },
        { time: '1:00 PM', meal: 'Lunch', icon: Sun, description: timing?.postWorkout || 'Post-workout (if training)' },
        { time: '4:00 PM', meal: 'Snack', icon: Sunset, description: 'Afternoon energy' },
        { time: '7:00 PM', meal: 'Dinner', icon: Moon, description: timing?.bedtime || '2-3 hours before sleep' },
      ],
    };

    return schedules[mealFrequency as keyof typeof schedules] || schedules[3];
  };

  const mealSchedule = generateMealSchedule();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Hydration Card */}
      <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-blue-50 to-blue-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(59,130,246,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(59,130,246,0.15),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_4px_12px_rgba(59,130,246,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Droplet className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 tracking-tight">Daily Hydration</div>
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Water Intake Goal</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Target Display */}
          <div className="flex items-center justify-between relative overflow-hidden rounded-2xl bg-white/60 p-4 border border-white/50 shadow-sm">
            <div className="relative z-10">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-blue-600 drop-shadow-sm tracking-tighter">{waterIntake}</span>
                <span className="text-xl font-bold text-blue-400">L</span>
              </div>
              <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">Daily Target</div>
            </div>

            {/* Bottle Visualization */}
            <div className="flex flex-col items-center gap-1 relative z-10">
              <div className="relative h-24 w-auto drop-shadow-xl filter hover:brightness-110 transition-all duration-300 transform hover:scale-105">
                <img
                  src="/assets/images/3dIcons/bottle-of-water.png"
                  alt="Water Bottle"
                  className="h-full w-auto object-contain"
                />
                <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white">
                  500ml
                </div>
              </div>
              <div className="text-xs font-bold text-slate-600 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-white/50">
                x {numBottles} bottles
              </div>
            </div>

            {/* Background Decorative Elements */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white/50 rounded-xl p-3 border border-white/60 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Calculation</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Based on your body weight of <span className="font-bold text-slate-800">{weight}kg</span>.
                <div className="mt-1 font-mono text-[10px] text-blue-600/80 bg-blue-50/50 inline-block px-1.5 py-0.5 rounded border border-blue-100/50">
                  {waterFormula}
                </div>
              </div>
            </div>

            <div className="bg-white/50 rounded-xl p-3 border border-white/60 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Strategy</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Drink <span className="font-bold text-blue-700">~250ml every 1-2 hours</span>. Add 500-1000ml during workouts.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meal Timing Card - Updated to match style */}
      <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-orange-50 to-orange-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(249,115,22,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(249,115,22,0.15),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_4px_12px_rgba(249,115,22,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Clock className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 tracking-tight">Meal Timing</div>
              <div className="text-xs font-medium text-orange-600 uppercase tracking-wide">{mealFrequency} Meals / Day</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Daily Timeline */}
          <div className="space-y-2.5">
            {mealSchedule.map((meal, idx) => {
              const Icon = meal.icon;
              return (
                <div key={idx} className="group flex items-center gap-3 bg-white/60 hover:bg-white/80 rounded-xl p-2.5 border border-white/50 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 group-hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-800">{meal.meal}</span>
                      <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{meal.time}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {meal.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timing Rationale */}
          <div className="bg-orange-100/50 rounded-xl p-3 border border-orange-200/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Timing Benefits</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <span className="text-orange-500 font-bold">•</span>
                <span><strong>Pre-workout:</strong> {timing?.preWorkout || '30-60 mins before'}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <span className="text-orange-500 font-bold">•</span>
                <span><strong>Post-workout:</strong> {timing?.postWorkout || 'Within 30 mins'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
