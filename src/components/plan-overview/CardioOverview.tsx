import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Heart, Zap } from 'lucide-react';

interface CardioOverviewProps {
  plan: any;
  userProfile?: {
    weight?: number;
    goal?: string;
  };
}

export function CardioOverview({ plan, userProfile }: CardioOverviewProps) {
  // Try multiple possible data paths
  const weeklyCardioSchedules =
    Array.isArray(plan?.weeklyCardioSchedules) ? plan.weeklyCardioSchedules :
      Array.isArray(plan?.fullPlanData?.weeklyCardioSchedules) ? plan.fullPlanData.weeklyCardioSchedules :
        [];

  const phaseCardioTemplates =
    Array.isArray(plan?.phaseCardioTemplates) ? plan.phaseCardioTemplates :
      Array.isArray(plan?.fullPlanData?.phaseCardioTemplates) ? plan.fullPlanData.phaseCardioTemplates :
        [];

  // No cardio data available
  if (weeklyCardioSchedules.length === 0 && phaseCardioTemplates.flat().length === 0) {
    return (
      <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-red-50 to-red-100 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 tracking-tight">Cardio Training</div>
              <div className="text-xs font-medium text-red-600 uppercase tracking-wide">No Cardio Scheduled</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Cardio sessions will be generated for your plan.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate PLAN-WIDE averages (not just Week 1)
  const planStats = React.useMemo(() => {
    let totalSessions = 0;
    let totalMinutes = 0;
    let totalCalories = 0;
    let weeksWithData = 0;

    weeklyCardioSchedules.forEach((week: any) => {
      if (week.sessions && week.sessions.length > 0) {
        weeksWithData++;
        totalSessions += week.sessions.length;

        week.sessions.forEach((session: any) => {
          const template = session.cardioTemplate || session;
          totalMinutes += template.durationMinutes || 0;
          totalCalories += template.caloriesBurned || 0;
        });
      } else if (week.totalWeeklyVolume) {
        weeksWithData++;
        totalSessions += week.totalWeeklyVolume.sessions || 0;
        totalMinutes += week.totalWeeklyVolume.totalMinutes || 0;
        totalCalories += week.totalWeeklyVolume.totalCalories || 0;
      }
    });

    const avgSessionsPerWeek = weeksWithData > 0 ? Math.round(totalSessions / weeksWithData) : 0;
    const avgMinutesPerWeek = weeksWithData > 0 ? Math.round(totalMinutes / weeksWithData) : 0;
    const avgCaloriesPerWeek = weeksWithData > 0 ? Math.round(totalCalories / weeksWithData) : 0;
    const avgCaloriesPerSession = totalSessions > 0 ? Math.round(totalCalories / totalSessions) : 0;
    const avgDurationPerSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 30;

    return {
      totalWeeks: weeksWithData,
      avgSessionsPerWeek,
      avgMinutesPerWeek,
      avgCaloriesPerWeek,
      avgCaloriesPerSession,
      avgDurationPerSession,
      totalPlanCalories: totalCalories,
    };
  }, [weeklyCardioSchedules]);

  // Get ALL unique cardio types across the entire plan
  const allCardioTypes = React.useMemo(() => {
    const types = new Set<string>();

    // From weekly schedules
    weeklyCardioSchedules.forEach((week: any) => {
      (week.sessions || []).forEach((session: any) => {
        const template = session.cardioTemplate || session;
        if (template.type) types.add(template.type);
      });
    });

    // From phase templates
    phaseCardioTemplates.flat().forEach((template: any) => {
      if (template.type) types.add(template.type);
    });

    return Array.from(types);
  }, [weeklyCardioSchedules, phaseCardioTemplates]);

  // Get primary cardio info (most common type/intensity)
  const primaryCardio = React.useMemo(() => {
    const typeCount: Record<string, number> = {};
    const intensityCount: Record<string, number> = {};

    weeklyCardioSchedules.forEach((week: any) => {
      (week.sessions || []).forEach((session: any) => {
        const template = session.cardioTemplate || session;
        if (template.type) {
          typeCount[template.type] = (typeCount[template.type] || 0) + 1;
        }
        if (template.intensity) {
          intensityCount[template.intensity] = (intensityCount[template.intensity] || 0) + 1;
        }
      });
    });

    const mostCommonType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Cardio';
    const mostCommonIntensity = Object.entries(intensityCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Moderate';

    return {
      type: mostCommonType,
      intensity: mostCommonIntensity,
      duration: planStats.avgDurationPerSession,
    };
  }, [weeklyCardioSchedules, planStats]);

  // Get phase progression info
  const phaseProgression = React.useMemo(() => {
    const phases: Record<string, { sessions: number; minutes: number; calories: number; weeks: number }> = {};

    weeklyCardioSchedules.forEach((week: any) => {
      const phase = week.phase?.toLowerCase() || 'foundation';
      if (!phases[phase]) {
        phases[phase] = { sessions: 0, minutes: 0, calories: 0, weeks: 0 };
      }
      phases[phase].weeks++;

      (week.sessions || []).forEach((session: any) => {
        const template = session.cardioTemplate || session;
        phases[phase].sessions++;
        phases[phase].minutes += template.durationMinutes || 0;
        phases[phase].calories += template.caloriesBurned || 0;
      });
    });

    return Object.entries(phases).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      avgSessions: data.weeks > 0 ? Math.round(data.sessions / data.weeks) : 0,
      avgMinutes: data.weeks > 0 ? Math.round(data.minutes / data.weeks) : 0,
      avgCalories: data.weeks > 0 ? Math.round(data.calories / data.weeks) : 0,
    }));
  }, [weeklyCardioSchedules]);

  return (
    <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-red-50 to-red-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(239,68,68,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(239,68,68,0.15),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center">
            <Activity className="h-5 w-5 text-white drop-shadow-md" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-800 tracking-tight">Cardio Training</div>
            <div className="text-xs font-medium text-red-600 uppercase tracking-wide">
              {planStats.totalWeeks}-Week Plan • {planStats.avgSessionsPerWeek} Sessions/Week
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats Display */}
        <div className="flex items-center justify-between relative overflow-hidden rounded-2xl bg-white/60 p-4 border border-white/50 shadow-sm">
          <div className="relative z-10">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-red-600 drop-shadow-sm tracking-tighter">
                {planStats.avgMinutesPerWeek}
              </span>
              <span className="text-xl font-bold text-red-400">min</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">
              Avg. Weekly Volume
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-red-100/80 px-2 py-1 rounded-full">
                <Zap className="h-3 w-3 text-red-600" />
                <span className="text-xs font-bold text-red-700">{primaryCardio.intensity}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-red-100/80 px-2 py-1 rounded-full">
                <Heart className="h-3 w-3 text-red-600" />
                <span className="text-xs font-bold text-red-700">{primaryCardio.type}</span>
              </div>
            </div>
          </div>

          {/* Cross-Trainer Visualization */}
          <div className="flex flex-col items-center gap-1 relative z-10">
            <div className="relative h-20 w-auto drop-shadow-xl filter hover:brightness-110 transition-all duration-300 transform hover:scale-105">
              <img
                src="/assets/images/3dIcons/cross-trainer.png"
                alt="Cross Trainer"
                className="h-full w-auto object-contain"
              />
              <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white">
                {planStats.avgDurationPerSession}min
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm border border-white/50">
              ~{planStats.avgCaloriesPerSession} cal/session
            </div>
          </div>

          {/* Background Decorative Elements */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-red-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-3">
          {/* Protocol Summary */}
          <div className="bg-white/50 rounded-xl p-3 border border-white/60 shadow-sm">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Protocol</span>
            <div className="text-xs text-slate-600 leading-relaxed mt-1.5">
              <span className="font-bold text-red-700">{primaryCardio.type}</span> at{' '}
              <span className="font-bold text-red-600">{primaryCardio.intensity}</span> intensity,{' '}
              <span className="font-bold text-slate-800">{planStats.avgDurationPerSession} min</span> per session.
              {allCardioTypes.length > 1 && (
                <div className="mt-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold">Types:</span> {allCardioTypes.join(', ')}
                </div>
              )}
              <div className="mt-2 font-mono text-[10px] text-red-600/80 bg-red-50/50 inline-block px-1.5 py-0.5 rounded border border-red-100/50">
                {planStats.avgSessionsPerWeek} sessions × ~{planStats.avgDurationPerSession}min = {planStats.avgMinutesPerWeek}min/week
              </div>
            </div>
          </div>

          {/* Calorie Burn */}
          {planStats.avgCaloriesPerWeek > 0 && (
            <div className="bg-red-100/50 rounded-xl p-3 border border-red-200/50">
              <span className="text-xs font-bold text-red-800 uppercase tracking-wide">
                Calorie Burn
              </span>
              <div className="flex items-baseline gap-3 mt-1.5">
                <div>
                  <span className="font-bold text-red-700 text-lg">{planStats.avgCaloriesPerWeek}</span>
                  <span className="text-xs text-slate-500 ml-1">cal/week</span>
                </div>
                <span className="text-slate-300">|</span>
                <div>
                  <span className="font-semibold text-slate-700">{Math.round(planStats.avgCaloriesPerWeek / 7)}</span>
                  <span className="text-xs text-slate-500 ml-1">cal/day</span>
                </div>
                <span className="text-slate-300">|</span>
                <div>
                  <span className="font-semibold text-slate-700">{planStats.totalPlanCalories}</span>
                  <span className="text-xs text-slate-500 ml-1">total</span>
                </div>
              </div>
            </div>
          )}

          {/* Phase Progression - Shows how cardio changes across phases */}
          {phaseProgression.length > 1 && (
            <div className="bg-white/50 rounded-xl p-3 border border-white/60 shadow-sm">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Phase Progression
              </span>
              <div className="flex gap-2 mt-2">
                {phaseProgression.map((phase) => (
                  <div
                    key={phase.name}
                    className="flex-1 text-center p-2 rounded-lg border bg-slate-50/50 border-slate-200/50"
                  >
                    <div className="text-[10px] font-bold text-slate-600 uppercase">{phase.name}</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{phase.avgMinutes} min</div>
                    <div className="text-[10px] text-slate-500">{phase.avgSessions} sessions</div>
                    {phase.avgCalories > 0 && (
                      <div className="text-[10px] text-red-600 font-medium">{phase.avgCalories} cal</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

