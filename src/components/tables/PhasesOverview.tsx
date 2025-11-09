import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PhaseProgressionTable } from '@/components/tables/PhaseProgressionTable';
import type { PhaseProgressionRow } from '@/utils/workoutDataParser';

interface PhasesOverviewProps {
  plan: any; // Complete plan JSON
  progression: PhaseProgressionRow[];
}

export function PhasesOverview({ plan, progression }: PhasesOverviewProps) {
  // Safely extract plan parts
  const feasibility = plan?.feasibility;
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework;
  const weeklyOutlines: Array<any> = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];
  const metrics = plan?.metrics;

  // Derived summaries
  const totalWeeks = weeklyOutlines.length || 0;
  const trainingDaysPerWeek = weeklyOutlines[0]?.trainingSchedule?.resistanceDays?.length || framework?.trainingApproach?.frequencyPerWeek || 0;
  const mealFrequency = useMemo(() => {
    // Try to infer from meals structure if not explicitly given
    const phaseMeals = plan?.phaseMealTemplates;
    if (Array.isArray(phaseMeals) && phaseMeals.length > 0 && Array.isArray(phaseMeals[0])) {
      const dayMeals = phaseMeals[0] as any[];
      return Array.isArray(dayMeals) ? dayMeals.length : undefined;
    }
    return undefined;
  }, [plan]);

  const weightProjection = useMemo(() => {
    const tdee = metrics?.tdee?.value;
    if (!tdee || !Array.isArray(weeklyOutlines)) return [] as Array<{ week: number; estKg: number }>;
    return weeklyOutlines.map((w: any) => {
      const cals = w?.dailyTargets?.calories || 0;
      const dailyDef = Math.max(0, tdee - cals);
      const estKg = Math.round(((dailyDef * 7) / 7700) * 100) / 100; // ~7700 kcal/kg
      return { week: w?.weekNumber || 0, estKg };
    });
  }, [weeklyOutlines, metrics]);

  const cardioSummary = useMemo(() => {
    const perWeek = weeklyOutlines.map((w: any) => ({
      week: w?.weekNumber || 0,
      sessions: w?.cardioSchedule?.sessions || 0,
      duration: w?.cardioSchedule?.duration || 0,
      intensity: w?.cardioSchedule?.intensity || '—',
      type: w?.cardioSchedule?.type || '—',
      days: (w?.trainingSchedule?.cardioDays || []) as string[],
    }));
    return perWeek;
  }, [weeklyOutlines]);

  return (
    <div className="space-y-6">
      {/* Profile & Feasibility */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-lg font-medium">User & Plan Profile</div>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-3">
            <div>
              <div className="text-muted-foreground">Timeline</div>
              <div>{totalWeeks || '—'} weeks</div>
            </div>
            <div>
              <div className="text-muted-foreground">Training days / wk</div>
              <div>{trainingDaysPerWeek || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Meal frequency</div>
              <div>{mealFrequency || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">TDEE (est.)</div>
              <div>{metrics?.tdee?.value ? `${metrics.tdee.value} kcal` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Protein target</div>
              <div>{metrics?.macros?.protein ? `${metrics.macros.protein} g/day` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">BMR (est.)</div>
              <div>{metrics?.bmr?.value ? `${metrics.bmr.value} kcal` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">BMI</div>
              <div>
                {metrics?.bmi?.value ?? '—'}
                {metrics?.bmi?.value ? (
                  <span className="text-muted-foreground"> {(() => {
                    const v = metrics?.bmi?.value || 0;
                    if (v < 18.5) return '(Underweight)';
                    if (v < 25) return '(Normal)';
                    if (v < 30) return '(Overweight)';
                    return '(Obese)';
                  })()}</span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-lg font-medium">Feasibility & Recommendation</div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{feasibility?.isFeasible ? 'Feasible' : 'Adjusted'}</Badge>
              <div className="text-muted-foreground">Confidence: {Math.round((feasibility?.confidenceScore || 0) * 100)}%</div>
            </div>
            <div className="text-muted-foreground">{feasibility?.reasoning || '—'}</div>
            {Array.isArray(feasibility?.recommendations) && feasibility.recommendations.length > 0 && (
              <div>
                <div className="font-medium mb-1">Recommendations</div>
                <ul className="list-disc pl-5 space-y-1">
                  {feasibility.recommendations.slice(0, 4).map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approach */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-lg font-medium">Training Approach</div>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-3">
            <div>
              <div className="text-muted-foreground">Split</div>
              <div>{framework?.trainingApproach?.split || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Frequency</div>
              <div>{framework?.trainingApproach?.frequencyPerWeek ? `${framework.trainingApproach.frequencyPerWeek}/wk` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Session duration</div>
              <div>{framework?.trainingApproach?.sessionDurationMinutes ? `${framework.trainingApproach.sessionDurationMinutes} min` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Periodization</div>
              <div>{framework?.trainingApproach?.periodization || '—'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-lg font-medium">Nutrition Approach</div>
          </CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-3">
            <div>
              <div className="text-muted-foreground">Deficit magnitude</div>
              <div>{framework?.nutritionApproach?.caloricStrategy?.deficitMagnitude || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Daily deficit</div>
              <div>{framework?.nutritionApproach?.caloricStrategy?.dailyDeficitCalories ? `${framework.nutritionApproach.caloricStrategy.dailyDeficitCalories} kcal` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Protein (g/kg)</div>
              <div>{framework?.nutritionApproach?.macroTargets?.proteinPerKg || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Carb/Fat %</div>
              <div>
                {framework?.nutritionApproach?.macroTargets?.carbPercentage ?? '—'}% / {framework?.nutritionApproach?.macroTargets?.fatPercentage ?? '—'}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Why this works */}
      <Card>
        <CardHeader>
          <div className="text-lg font-medium">Why This Plan Works</div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Progressive energy targets across weeks align with sustainable change.</li>
            <li>High protein intake preserves lean mass during a deficit.</li>
            <li>Day-type macro cycling supports training performance and recovery.</li>
            <li>Structured training (periodization + weekly frequency) drives adaptation.</li>
            <li>Cardio sessions complement energy balance without overtaxing recovery.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Expected weight change */}
      <Card>
        <CardHeader>
          <div className="text-lg font-medium">Expected Weight Change</div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Daily Calories</TableHead>
                <TableHead>Est. kg/week</TableHead>
                <TableHead>Cardio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyOutlines.map((w: any, idx: number) => (
                <TableRow key={w?.weekNumber || idx}>
                  <TableCell>Week {w?.weekNumber || idx + 1}</TableCell>
                  <TableCell>{w?.dailyTargets?.calories || '—'}</TableCell>
                  <TableCell>{weightProjection[idx]?.estKg?.toFixed?.(2) ?? '—'}</TableCell>
                  <TableCell>
                    {(cardioSummary[idx]?.sessions || 0)}x / {cardioSummary[idx]?.duration || 0} min {cardioSummary[idx]?.intensity ? `(${cardioSummary[idx]?.intensity})` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cardio details per week */}
      <Card>
        <CardHeader>
          <div className="text-lg font-medium">Cardio Plan</div>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cardioSummary.map((c) => (
              <div key={c.week} className="rounded border p-3">
                <div className="font-medium mb-1">Week {c.week}</div>
                <div>Sessions: {c.sessions}</div>
                <div>Duration: {c.duration} min</div>
                <div>Intensity: {c.intensity}</div>
                <div>Days: {(c.days || []).join(', ') || '—'}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing phase progression table */}
      <div>
        <div className="text-lg font-medium mb-2">Phases</div>
        <PhaseProgressionTable data={progression} />
      </div>
    </div>
  );
}
