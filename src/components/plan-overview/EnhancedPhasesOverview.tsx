import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { extractPlanMetrics } from '@/utils/planMetricsExtractor';
import {
  calculateAdvancedBodyCompositionProjection,
  getTDEE,
  calculateWeeklyExerciseCalories,
  calculateDailyDeficit
} from '@/utils/planCalculations';
import { UserProfileSummary } from './UserProfileSummary';
import { EnergyBalanceVisualization } from './EnergyBalanceVisualization';
import { BodyCompositionProjection } from './BodyCompositionProjection';
import { WeeklyProgressionTimeline } from './WeeklyProgressionTimeline';
import { HydrationAndMealTiming } from './HydrationAndMealTiming';
import { CardioOverview } from './CardioOverview';
import { DailyMacroTrends } from './DailyMacroTrends';
import { BMRAndMetabolicAge } from './BMRAndMetabolicAge';
import { WeighingTiming } from './WeighingTiming';
import type { PhaseProgressionRow } from '@/utils/workoutDataParser';
import { kgToLbs } from '@/utils/unitConversion';

interface EnhancedPhasesOverviewProps {
  plan: any;
  weeklySchedule?: any[];
  progression: PhaseProgressionRow[];
  userProfile?: {
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    primaryGoal?: string;
    experienceLevel?: string;
    workoutDaysPerWeek?: number;
    sessionDuration?: number;
    equipmentAccess?: string[];
    dietaryRestrictions?: string[];
    bodyFat?: number;
    targetBodyFat?: number;
    units?: string;
  };
  workoutPlanId?: string; // Convex ID for the workout plan
}

export function EnhancedPhasesOverview({ plan, weeklySchedule, userProfile, workoutPlanId }: EnhancedPhasesOverviewProps) {
  // Extract all metrics using the unified extractor
  const metrics = useMemo(() => extractPlanMetrics(plan), [plan]);

  // Generate smart summary from actual plan data (no AI call)
  const planSummary = useMemo(() => {
    const weeklyOutlines = plan?.weeklyOutlines || [];
    const totalWeeks = weeklyOutlines.length;
    const goal = userProfile?.primaryGoal?.replace(/_/g, ' ') || 'fitness';

    // 1. Calculate TRUE Energy Balance (TDEE + Exercise - Intake)
    const tdee = getTDEE(plan, userProfile) || 2200;
    const targetCalories = metrics.targetCalories || 0;

    // Calculate average daily exercise burn across the plan
    let totalExerciseBurn = 0;
    weeklyOutlines.forEach((week: any) => {
      const exercise = calculateWeeklyExerciseCalories(week, userProfile?.weight || 70, plan);
      totalExerciseBurn += exercise.total; // Weekly total
    });
    const avgDailyExerciseBurn = totalWeeks > 0 ? Math.round((totalExerciseBurn / totalWeeks) / 7) : 0;

    // Positive = Deficit (Weight Loss), Negative = Surplus (Weight Gain)
    const dailyBalanceROI = (tdee + avgDailyExerciseBurn) - targetCalories;
    const isDeficit = dailyBalanceROI >= 0;
    const dailySurplusOrDeficit = Math.abs(Math.round(dailyBalanceROI));

    // 2. Get Projections using SHARED UTILITY
    const projections = calculateAdvancedBodyCompositionProjection(plan, weeklySchedule || [], userProfile);
    const finalProjection = projections[projections.length - 1];

    const totalWeightChange = finalProjection ? (finalProjection.weight - (userProfile?.weight || finalProjection.weight + finalProjection.cumulativeWeightChange)) : 0;
    const weeklyWeightChange = totalWeeks > 0 ? totalWeightChange / totalWeeks : 0;

    const proteinPerKg = userProfile?.weight && metrics.protein > 0 ? (metrics.protein / userProfile.weight).toFixed(1) : '1.8';

    // Unit Conversion
    const units = userProfile?.units || 'metric';
    const displayWeeklyChange = units === 'imperial' ? kgToLbs(Math.abs(weeklyWeightChange)).toFixed(2) : Math.abs(weeklyWeightChange).toFixed(2);
    const displayTotalChange = units === 'imperial' ? kgToLbs(Math.abs(totalWeightChange)).toFixed(1) : Math.abs(totalWeightChange).toFixed(1);
    const weightUnit = units === 'imperial' ? 'lbs' : 'kg';
    // Protein is standardly g/kg even in imperial (sometimes g/lb but g/kg is science standard, leaving as is or converting display only if requested. Usually macros stay metric).

    return {
      totalWeeks,
      goal,
      dailySurplusOrDeficit,
      isDeficit,
      weeklyWeightChange: displayWeeklyChange,
      totalWeightChange: displayTotalChange,
      weightUnit,
      proteinPerKg,
      trainingDays: metrics.trainingFrequency || userProfile?.workoutDaysPerWeek || 0,
      targetCalories: Math.round(targetCalories),
    };
  }, [plan, userProfile, metrics, weeklySchedule]);

  return (
    <div className="space-y-6 pb-20">
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">

        {/* Area 1: Executive Summary (Full Width) - Research Paper Style */}
        <div className="md:col-span-12">
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-8 md:p-10">
              {/* Title */}
              <h1 className="font-editorial text-2xl md:text-3xl font-light text-slate-900 tracking-tight mb-6">
                Executive Summary
              </h1>

              {/* Abstract-style paragraph with key facts in bold */}
              <div className="prose prose-slate max-w-none">
                <p className="text-base md:text-lg leading-relaxed text-slate-700 font-light">
                  This <strong className="font-semibold text-slate-900">{planSummary.totalWeeks}-week</strong> personalized
                  fitness program is designed to support your <strong className="font-semibold text-slate-900 capitalize">{planSummary.goal}</strong> goals
                  through a structured approach combining nutrition and resistance training.
                  The plan prescribes a daily caloric intake of <strong className="font-semibold text-slate-900">{Math.round(planSummary.targetCalories)} kcal</strong>
                  , creating a <strong className="font-semibold text-slate-900">{planSummary.dailySurplusOrDeficit} kcal</strong> daily {planSummary.isDeficit ? 'deficit' : 'surplus'}
                  , with protein set at <strong className="font-semibold text-slate-900">{planSummary.proteinPerKg}g/kg</strong> body weight
                  to optimize muscle protein synthesis and preserve lean mass.
                  Training frequency is established at <strong className="font-semibold text-slate-900">{planSummary.trainingDays} sessions per week</strong>,
                  utilizing progressive overload principles across three distinct phases: Foundation, Progression, and Peak.
                  {planSummary.totalWeeks > 0 && (
                    <> Based on the prescribed energy balance, projected outcomes include approximately <strong className="font-semibold text-slate-900">{planSummary.weeklyWeightChange} {planSummary.weightUnit}</strong> of
                      weekly weight {planSummary.isDeficit ? 'reduction' : 'gain'}, yielding an estimated total {planSummary.isDeficit ? 'loss' : 'gain'} of <strong className="font-semibold text-slate-900">{planSummary.totalWeightChange} {planSummary.weightUnit}</strong> over
                      the program duration.</>
                  )}
                </p>
              </div>

              {/* Key metrics in a subtle table format */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Duration</div>
                    <div className="text-2xl font-semibold text-slate-900">{planSummary.totalWeeks} <span className="text-base font-normal text-slate-500">weeks</span></div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Daily Intake</div>
                    <div className="text-2xl font-semibold text-slate-900">{Math.round(planSummary.targetCalories)} <span className="text-base font-normal text-slate-500">kcal</span></div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Training</div>
                    <div className="text-2xl font-semibold text-slate-900">{planSummary.trainingDays} <span className="text-base font-normal text-slate-500">days/week</span></div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Protein Target</div>
                    <div className="text-2xl font-semibold text-slate-900">{planSummary.proteinPerKg} <span className="text-base font-normal text-slate-500">g/kg</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Area 2: Profile Summary (Left Column, spans 2 rows) */}
        <div className="md:col-span-4 md:row-span-2 flex flex-col">
          <Card className="h-full border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardContent className="p-6 h-full">
              <UserProfileSummary userProfile={userProfile || {}} plan={plan} />
            </CardContent>
          </Card>
        </div>

        {/* Area 2.5: BMR & Metabolic Age (Side by side with User Profile) */}
        <BMRAndMetabolicAge plan={plan} userProfile={userProfile} />

        {/* Area 3: Energy Balance (Below BMR & Metabolic Age, spanning 8 cols) */}
        <div className="md:col-span-8 flex flex-col">
          <EnergyBalanceVisualization
            plan={plan}
            userProfile={userProfile}
          />
        </div>

        {/* Area 4: Daily Macro Trends (Full Width) */}
        {weeklySchedule && weeklySchedule.length > 0 && (
          <div className="md:col-span-12">
            <DailyMacroTrends weeklySchedule={weeklySchedule} />
          </div>
        )}

        {/* Area 5: Body Composition (Full Width) */}
        <div className="md:col-span-12">
          <BodyCompositionProjection
            plan={plan}
            weeklySchedule={weeklySchedule}
            userProfile={userProfile}
          />
        </div>

        {/* Area 6: Weekly Progression Timeline (Full Width) */}
        <div className="md:col-span-12">
          <WeeklyProgressionTimeline
            plan={plan}
            weeklySchedule={weeklySchedule}
            userProfile={userProfile}
          />
        </div>

        {/* Area 7: Hydration & Timing (Half Width) */}
        <div className="md:col-span-6">
          <HydrationAndMealTiming plan={plan} userProfile={userProfile} />
        </div>

        {/* Area 8: Cardio Overview (Half Width) */}
        <div className="md:col-span-6">
          <CardioOverview plan={plan} userProfile={userProfile} />
        </div>

        {/* Area 9: Weighing Timing (Half Width) */}
        <div className="md:col-span-6">
          <WeighingTiming plan={plan} userProfile={userProfile} />
        </div>

      </div>
    </div>
  );
}
