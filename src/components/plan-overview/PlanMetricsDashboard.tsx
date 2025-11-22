import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Flame, Apple, Dumbbell, TrendingDown, Info, ChevronDown, ChevronUp, Droplet } from 'lucide-react';
import { calculateWaterIntake } from '@/utils/planCalculations';
import { extractPlanMetrics } from '@/utils/planMetricsExtractor';

interface PlanMetricsDashboardProps {
  plan: any;
  userProfile?: {
    weight?: number;
    workoutDaysPerWeek?: number;
  };
}

export function PlanMetricsDashboard({ plan, userProfile }: PlanMetricsDashboardProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Use unified metrics extractor
  const metrics = extractPlanMetrics(plan, userProfile);
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const feasibility = plan?.feasibility || {};
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Use extracted metrics
  const bmr = metrics.bmr;
  const tdee = metrics.tdee;
  const targetCalories = metrics.targetCalories;
  const dailyDeficit = metrics.dailyDeficit;
  const weeklyDeficit = metrics.weeklyDeficit;

  // Use extracted metrics
  const protein = metrics.protein;
  const carbs = metrics.carbs;
  const fat = metrics.fat;
  const proteinPerKg = metrics.proteinPerKg;
  const totalMacroCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const proteinPercentage = totalMacroCalories > 0 ? ((protein * 4) / totalMacroCalories) * 100 : 0;
  const carbsPercentage = totalMacroCalories > 0 ? ((carbs * 4) / totalMacroCalories) * 100 : 0;
  const fatPercentage = totalMacroCalories > 0 ? ((fat * 9) / totalMacroCalories) * 100 : 0;

  // Training metrics
  const weeklyWorkouts = metrics.trainingFrequency;
  const avgSessionDuration = metrics.sessionDurationMinutes;
  const trainingVolume = plan?.metrics?.trainingVolume?.value || 0;

  // Expected results
  const totalWeeks = weeklyOutlines.length;
  const expectedWeeklyWeightLoss = metrics.expectedWeeklyWeightLoss;
  const expectedTotalWeightLoss = expectedWeeklyWeightLoss * totalWeeks;
  const expectedWeeklyBodyFatLossKg = metrics.expectedWeeklyBodyFatLoss;
  
  // Calculate fat loss percentage for display
  const hasResistanceTraining = metrics.trainingFrequency > 0;
  const fatLossPercentage = (proteinPerKg >= 2.0 && hasResistanceTraining) ? 0.75 : 
                            (proteinPerKg >= 1.5) ? 0.65 : 0.55;

  // Hydration
  const waterIntake = plan?.metrics?.water?.value || (metrics.weight ? calculateWaterIntake(metrics.weight, 'moderate') : 0);

  // Confidence
  const confidenceScore = feasibility?.confidenceScore || 0;
  const feasibilityRating = feasibility?.isFeasible ? 'Optimal' : 'Adjusted';

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const MetricCard = ({
    id,
    icon: Icon,
    title,
    primaryMetric,
    primaryLabel,
    secondaryMetrics,
    details,
    color = 'blue',
  }: {
    id: string;
    icon: any;
    title: string;
    primaryMetric: string | number;
    primaryLabel: string;
    secondaryMetrics: Array<{ label: string; value: string | number }>;
    details?: Array<{ label: string; value: string; formula?: string; source?: string }>;
    color?: string;
  }) => {
    const isExpanded = expandedCard === id;
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      orange: 'bg-orange-50 text-orange-700 border-orange-200',
    };

    return (
      <Card className={`border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <div className="font-semibold">{title}</div>
            </div>
            {details && details.length > 0 && (
              <button
                onClick={() => toggleCard(id)}
                className="p-1 hover:bg-white/50 rounded-md transition-colors"
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Primary Metric */}
          <div className="text-center py-2">
            <div className="text-3xl font-bold">{primaryMetric}</div>
            <div className="text-sm text-muted-foreground">{primaryLabel}</div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {secondaryMetrics.map((metric, idx) => (
              <div key={idx} className="bg-white/60 rounded-md p-2">
                <div className="text-xs text-muted-foreground">{metric.label}</div>
                <div className="font-medium">{metric.value}</div>
              </div>
            ))}
          </div>

          {/* Expanded Details */}
          {isExpanded && details && (
            <div className="mt-3 pt-3 border-t space-y-2 text-xs">
              {details.map((detail, idx) => (
                <div key={idx} className="bg-white/60 rounded-md p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{detail.label}</div>
                      <div className="text-muted-foreground mt-0.5">{detail.value}</div>
                      {detail.formula && (
                        <div className="text-muted-foreground text-xs mt-1 font-mono">
                          Formula: {detail.formula}
                        </div>
                      )}
                      {detail.source && (
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Source: {detail.source}
                        </div>
                      )}
                    </div>
                    <Info className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Energy Balance */}
      <MetricCard
        id="energy"
        icon={Flame}
        title="Energy Balance"
        primaryMetric={dailyDeficit > 0 ? `-${dailyDeficit}` : dailyDeficit === 0 && tdee > 0 ? '0' : '—'}
        primaryLabel="kcal/day deficit"
        secondaryMetrics={[
          { label: 'TDEE', value: `${tdee} kcal` },
          { label: 'Target', value: `${targetCalories} kcal` },
          { label: 'Weekly Deficit', value: `${weeklyDeficit} kcal` },
          { label: 'BMR', value: `${bmr} kcal` },
        ]}
        details={[
          {
            label: 'Basal Metabolic Rate (BMR)',
            value: `${bmr} kcal/day`,
            formula: metrics?.bmr?.formula || 'Mifflin-St Jeor equation',
            source: metrics?.bmr?.source || 'Standard metabolic calculation',
          },
          {
            label: 'Total Daily Energy Expenditure (TDEE)',
            value: `${tdee} kcal/day`,
            formula: metrics?.tdee?.formula || 'BMR × Activity Factor',
            source: metrics?.tdee?.source || 'Activity-adjusted BMR',
          },
          {
            label: 'Daily Deficit Calculation',
            value: `${tdee} - ${targetCalories} = ${dailyDeficit} kcal`,
            formula: 'TDEE - Target Calories',
            source: 'Energy balance principle',
          },
        ]}
        color="blue"
      />

      {/* Macronutrients */}
      <MetricCard
        id="macros"
        icon={Apple}
        title="Macronutrients"
        primaryMetric={protein}
        primaryLabel="g protein/day"
        secondaryMetrics={[
          { label: 'Protein', value: `${Math.round(proteinPercentage)}% (${protein}g)` },
          { label: 'Carbs', value: `${Math.round(carbsPercentage)}% (${carbs}g)` },
          { label: 'Fat', value: `${Math.round(fatPercentage)}% (${fat}g)` },
          { label: 'Per kg BW', value: `${proteinPerKg.toFixed(1)}g/kg` },
        ]}
        details={[
          {
            label: 'Protein Target',
            value: `${protein}g/day = ${proteinPerKg.toFixed(1)}g/kg bodyweight`,
            formula: 'Target protein per kg × body weight',
            source: 'Muscle preservation during deficit',
          },
          {
            label: 'Why High Protein?',
            value: 'Preserves lean mass during caloric deficit. Research shows 1.8-2.2g/kg optimal for fat loss.',
            source: 'International Society of Sports Nutrition',
          },
          {
            label: 'Macro Distribution',
            value: `P: ${Math.round(proteinPercentage)}% | C: ${Math.round(carbsPercentage)}% | F: ${Math.round(fatPercentage)}%`,
            formula: 'Calories from macro / total calories',
          },
        ]}
        color="green"
      />

      {/* Training */}
      <MetricCard
        id="training"
        icon={Dumbbell}
        title="Training"
        primaryMetric={weeklyWorkouts}
        primaryLabel="sessions/week"
        secondaryMetrics={[
          { label: 'Frequency', value: `${weeklyWorkouts}x/week` },
          { label: 'Duration', value: `${avgSessionDuration} min` },
          { label: 'Weekly Volume', value: `${weeklyWorkouts * avgSessionDuration} min` },
          { label: 'Volume Score', value: trainingVolume > 0 ? trainingVolume : '—' },
        ]}
        details={[
          {
            label: 'Training Volume',
            value: trainingVolume > 0 ? `${trainingVolume} sets/week` : 'Calculated per muscle group',
            formula: metrics?.trainingVolume?.formula || 'Total sets × reps × load',
            source: metrics?.trainingVolume?.source || 'Progressive overload tracking',
          },
          {
            label: 'Split Type',
            value: framework?.trainingApproach?.split || 'Not specified',
            source: 'Optimized for recovery and muscle stimulation',
          },
          {
            label: 'Periodization',
            value: framework?.trainingApproach?.periodization || 'Progressive',
            source: 'Structured progression for continuous adaptation',
          },
        ]}
        color="purple"
      />

      {/* Expected Results */}
      <MetricCard
        id="results"
        icon={TrendingDown}
        title="Expected Results"
        primaryMetric={expectedWeeklyWeightLoss > 0 ? expectedWeeklyWeightLoss.toFixed(2) : '0.00'}
        primaryLabel="kg/week weight loss"
        secondaryMetrics={[
          { label: 'Weight Loss/Week', value: expectedWeeklyWeightLoss > 0 ? `${expectedWeeklyWeightLoss.toFixed(2)} kg` : '0.00 kg' },
          { label: 'Body Fat Loss/Week', value: expectedWeeklyBodyFatLossKg > 0 ? `${expectedWeeklyBodyFatLossKg.toFixed(2)} kg` : '0.00 kg' },
          { label: 'Total Weight Loss', value: expectedTotalWeightLoss > 0 ? `${expectedTotalWeightLoss.toFixed(1)} kg` : '0.0 kg' },
          { label: 'Confidence', value: `${Math.round(confidenceScore * 100)}%` },
        ]}
        details={[
          {
            label: 'Weight Loss Calculation',
            value: weeklyDeficit > 0 
              ? `${weeklyDeficit} kcal/week ÷ 7700 kcal/kg = ${expectedWeeklyWeightLoss.toFixed(2)} kg/week`
              : 'Insufficient data to calculate (TDEE or target calories missing)',
            formula: 'Weekly Deficit ÷ 7700 kcal per kg body fat',
            source: 'Energy balance and fat metabolism',
          },
          {
            label: 'Body Fat Loss Per Week',
            value: expectedWeeklyBodyFatLossKg > 0
              ? `${expectedWeeklyBodyFatLossKg.toFixed(2)} kg/week (${(fatLossPercentage * 100).toFixed(0)}% of total weight loss)`
              : '0.00 kg/week',
            formula: `Weight loss × ${(fatLossPercentage * 100).toFixed(0)}% (based on protein intake and resistance training)`,
            source: 'Research shows high protein (≥2g/kg) + resistance training = ~75% fat loss, 25% muscle loss',
          },
          {
            label: 'Total Expected Loss',
            value: expectedTotalWeightLoss > 0
              ? `Over ${totalWeeks} weeks: ${expectedTotalWeightLoss.toFixed(1)} kg total weight loss`
              : `Over ${totalWeeks} weeks: 0.0 kg (insufficient data)`,
            formula: 'Weekly loss × total weeks',
          },
          {
            label: 'Water Intake',
            value: waterIntake > 0 ? `${waterIntake} liters/day` : 'Not calculated',
            formula: metrics?.water?.formula || '33ml × body weight (kg)',
            source: metrics?.water?.source || 'Hydration for active individuals',
          },
          {
            label: 'Plan Feasibility',
            value: `${feasibilityRating} (${Math.round(confidenceScore * 100)}% confidence)`,
            source: 'AI analysis of sustainability and safety',
          },
        ]}
        color="orange"
      />
    </div>
  );
}
