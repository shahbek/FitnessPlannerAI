import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Award,
  CheckCircle2, Sparkles
} from 'lucide-react';
import { extractPlanMetrics } from '@/utils/planMetricsExtractor';
import { generatePlanOverviewExplanations, type PlanOverviewExplanation } from '@/services/PlanOverviewExplanationService';
import { UserProfileSummary } from './UserProfileSummary';
import { EnergyBalanceVisualization } from './EnergyBalanceVisualization';
import { BodyCompositionProjection } from './BodyCompositionProjection';
import { WeeklyProgressionTimeline } from './WeeklyProgressionTimeline';
import { HydrationAndMealTiming } from './HydrationAndMealTiming';
import { DailyMacroTrends } from './DailyMacroTrends';
import type { PhaseProgressionRow } from '@/utils/workoutDataParser';

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
  };
}

export function EnhancedPhasesOverview({ plan, weeklySchedule, userProfile }: EnhancedPhasesOverviewProps) {
  const [explanations, setExplanations] = useState<PlanOverviewExplanation | null>(null);
  const [loadingExplanations, setLoadingExplanations] = useState(false);

  // Extract all metrics using the unified extractor
  const metrics = useMemo(() => extractPlanMetrics(plan), [plan]);

  // Generate AI explanations on mount (single call)
  useEffect(() => {
    if (plan && userProfile && !explanations && !loadingExplanations) {
      setLoadingExplanations(true);
      generatePlanOverviewExplanations(plan, userProfile)
        .then(setExplanations)
        .catch(err => {
          console.error('Failed to generate explanations:', err);
        })
        .finally(() => setLoadingExplanations(false));
    }
  }, [plan, userProfile, explanations, loadingExplanations]);

  return (
    <div className="space-y-6 pb-20">
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">

        {/* Area 1: Hero / Executive Summary (Full Width) */}
        <div className="md:col-span-12">
          <Card className="border-none shadow-sm overflow-hidden relative bg-gradient-to-br from-orange-50/80 via-white to-orange-50/50">
            {/* Subtle decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-100/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-orange-50/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>

            <CardContent className="relative z-10 px-8 py-12 md:px-12 md:py-16">
              {/* Title Section */}
              <div className="max-w-4xl space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/60 border border-orange-200/40">
                  <Sparkles className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-orange-900">Executive Summary</span>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                  Your Personalized Fitness Blueprint
                </h2>
                <p className="text-sm md:text-xl text-gray-600 leading-relaxed font-light max-w-3xl">
                  {explanations?.profileSummary || "Based on your unique profile, we've designed a plan that balances effective training with sustainable nutrition."}
                </p>
              </div>

              {/* Key Metrics Grid */}
              {metrics && metrics.hasValidMetrics && (
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl">
                  {/* Daily Calories */}
                  {metrics.targetCalories > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Daily Calories</div>
                      <div className="text-3xl font-bold text-gray-900">{Math.round(metrics.targetCalories)}</div>
                      <div className="text-xs text-gray-500">kcal</div>
                    </div>
                  )}

                  {/* Protein */}
                  {metrics.protein > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Protein</div>
                      <div className="text-3xl font-bold text-orange-600">{Math.round(metrics.protein)}</div>
                      <div className="text-xs text-gray-500">g/day</div>
                    </div>
                  )}

                  {/* Training Days */}
                  {metrics.trainingFrequency > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Training Days</div>
                      <div className="text-3xl font-bold text-gray-900">{metrics.trainingFrequency}</div>
                      <div className="text-xs text-gray-500">per week</div>
                    </div>
                  )}

                  {/* Plan Duration */}
                  {plan?.weeklyOutlines?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Duration</div>
                      <div className="text-3xl font-bold text-gray-900">{plan.weeklyOutlines.length}</div>
                      <div className="text-xs text-gray-500">weeks</div>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* Area 2: Profile Summary (Left Column) */}
        <div className="md:col-span-4 flex flex-col">
          <Card className="h-full border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardContent className="p-6 h-full">
              <UserProfileSummary userProfile={userProfile || {}} plan={plan} />
            </CardContent>
          </Card>
        </div>

        {/* Area 3: Energy Balance (Center/Right) */}
        <div className="md:col-span-8 flex flex-col">
          <EnergyBalanceVisualization
            plan={plan}
            explanation={explanations?.energyBalanceExplanation}
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
            explanation={explanations?.bodyCompositionExplanation}
            userProfile={userProfile}
          />
        </div>

        {/* Area 6: Weekly Progression Timeline (Full Width) */}
        <div className="md:col-span-12">
          <WeeklyProgressionTimeline
            plan={plan}
            weeklySchedule={weeklySchedule}
          />
        </div>

        {/* Area 7: Hydration & Timing (Half Width) */}
        <div className="md:col-span-6">
          <HydrationAndMealTiming plan={plan} userProfile={userProfile} />
        </div>

        {/* Area 8: Success Factors (Half Width) */}
        <div className="md:col-span-6">
          <Card className="h-full border-none shadow-sm bg-emerald-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <Award className="h-5 w-5" />
                Keys to Success
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {explanations?.successFactors?.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-emerald-900/80">
                    <div className="mt-1 min-w-5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                    {factor}
                  </li>
                )) || (
                    <li className="text-sm text-muted-foreground">Loading success factors...</li>
                  )}
              </ul>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
