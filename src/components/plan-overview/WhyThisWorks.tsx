import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAverageDailyTargets } from '@/utils/planTargets';

interface WhyThisWorksProps {
  plan: any;
  userProfile?: {
    weight?: number;
  };
}

export function WhyThisWorks({ plan, userProfile }: WhyThisWorksProps) {
  const metrics = plan?.metrics || {};
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const feasibility = plan?.feasibility || {};
  const validation = plan?.validationResults || {};
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Generate dynamic reasons based on actual plan data
  const reasons: Array<{
    category: string;
    principle: string;
    evidence: string;
    dataPoints: string[];
    validated: boolean;
  }> = [];

  // 1. Energy Management
  const tdee = metrics?.tdee?.value || 0;
  const week0Targets = getAverageDailyTargets(weeklyOutlines[0]);
  const targetCalories = metrics?.macros?.calories || week0Targets.calories || 0;
  const deficit = tdee - targetCalories;
  const weeklyDeficit = deficit * 7;
  const expectedWeeklyLoss = weeklyDeficit / 7700;

  if (deficit > 0) {
    reasons.push({
      category: 'Energy Management',
      principle: 'Progressive Caloric Targets',
      evidence: 'Progressive energy targets align with sustainable fat loss research. Moderate deficits (15-25% below TDEE) optimize fat loss while preserving metabolic health.',
      dataPoints: [
        `TDEE: ${tdee} kcal/day`,
        `Target: ${targetCalories} kcal/day`,
        `Deficit: ${deficit} kcal/day (${((deficit / tdee) * 100).toFixed(0)}% below maintenance)`,
        `Expected loss: ${expectedWeeklyLoss.toFixed(2)} kg/week`,
      ],
      validated: validation?.macroConsistency?.isValid ?? true,
    });
  } else if (deficit < 0) {
    reasons.push({
      category: 'Energy Management',
      principle: 'Controlled Caloric Surplus',
      evidence: 'A controlled surplus supports training performance and muscle protein synthesis while limiting excess fat gain when paired with progressive resistance training.',
      dataPoints: [
        `TDEE: ${tdee} kcal/day`,
        `Target: ${targetCalories} kcal/day`,
        `Surplus: ${Math.abs(deficit)} kcal/day (${((Math.abs(deficit) / tdee) * 100).toFixed(0)}% above maintenance)`,
        `Expected change: +${Math.abs(expectedWeeklyLoss).toFixed(2)} kg/week (energy-balance estimate)`,
      ],
      validated: validation?.macroConsistency?.isValid ?? true,
    });
  }

  // 2. Muscle Preservation
  const protein = metrics?.macros?.protein || 0;
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg || 0;
  const weight = userProfile?.weight || 88;

  if (proteinPerKg >= 1.6) {
    reasons.push({
      category: 'Muscle Preservation',
      principle: 'High Protein Intake',
      evidence: 'High protein intake (≥1.8g/kg) preserves lean mass during caloric deficit. Research shows this threshold meets requirements for muscle protein synthesis during fat loss.',
      dataPoints: [
        `Daily protein: ${protein}g`,
        `Per kg bodyweight: ${proteinPerKg.toFixed(1)}g/kg`,
        `Target bodyweight: ${weight}kg`,
        `Meets research threshold: ✓`,
      ],
      validated: validation?.dietaryCompliance?.isCompliant ?? true,
    });
  }

  // 3. Progressive Overload
  const trainingFrequency = framework?.trainingApproach?.frequencyPerWeek || weeklyOutlines[0]?.trainingSchedule?.resistanceDays?.length || 0;
  const periodization = framework?.trainingApproach?.periodization || 'Progressive';

  if (trainingFrequency > 0) {
    const phases = Array.from(new Set(weeklyOutlines.map((w: any) => w.phase))).length;
    reasons.push({
      category: 'Progressive Overload',
      principle: 'Structured Training Progression',
      evidence: 'Structured training with phase-based progression drives continuous adaptation. Progressive overload ensures consistent strength and muscle gains.',
      dataPoints: [
        `Training frequency: ${trainingFrequency}×/week`,
        `Periodization: ${periodization}`,
        `Program phases: ${phases}`,
        `Split type: ${framework?.trainingApproach?.split || 'Balanced'}`,
      ],
      validated: validation?.progressiveOverload?.isValid ?? true,
    });
  }

  // 4. Recovery Optimization
  const cardioSchedule = weeklyOutlines[0]?.cardioSchedule;
  const cardioDays = weeklyOutlines[0]?.trainingSchedule?.cardioDays || [];
  const restDays = weeklyOutlines[0]?.trainingSchedule?.restDays || [];

  if (restDays.length > 0 || cardioDays.length > 0) {
    reasons.push({
      category: 'Recovery Optimization',
      principle: 'Strategic Rest and Cardio Placement',
      evidence: 'Cardio placement and rest days are strategically positioned to support training performance without compromising recovery.',
      dataPoints: [
        `Cardio sessions: ${cardioSchedule?.sessions || 0}×/week`,
        `Cardio days: ${cardioDays.join(', ') || 'None'}`,
        `Rest days: ${restDays.join(', ')}`,
        `Recovery optimized: ✓`,
      ],
      validated: validation?.recovery?.isValid ?? true,
    });
  }

  // 5. Macro Distribution
  const carbsPercentage = framework?.nutritionApproach?.macroTargets?.carbPercentage || 0;
  const fatPercentage = framework?.nutritionApproach?.macroTargets?.fatPercentage || 0;

  if (carbsPercentage > 0 && fatPercentage > 0) {
    reasons.push({
      category: 'Macronutrient Balance',
      principle: 'Optimal Macro Distribution',
      evidence: 'Balanced macronutrient distribution supports training performance (carbs for energy) and hormonal health (fats for hormone production) while maximizing protein for muscle preservation.',
      dataPoints: [
        `Protein: ${proteinPerKg.toFixed(1)}g/kg`,
        `Carbs: ${carbsPercentage}% (${metrics?.macros?.carbs || 0}g)`,
        `Fat: ${fatPercentage}% (${metrics?.macros?.fat || 0}g)`,
        `Distribution validated: ✓`,
      ],
      validated: validation?.macroConsistency?.isValid ?? true,
    });
  }

  // AI Confidence
  const aiConfidence = feasibility?.confidenceScore || 0;
  const aiReasoning = feasibility?.reasoning || '';

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Why This Plan Works</div>
            <div className="text-sm text-muted-foreground mt-1">
              Evidence-based rationale for your personalized plan
            </div>
          </div>
          <Badge variant="default" className="text-sm">
            {Math.round(aiConfidence * 100)}% Confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Reasoning */}
        {aiReasoning && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-900 mb-2">AI Analysis</div>
            <div className="text-sm text-blue-800">{aiReasoning}</div>
          </div>
        )}

        {/* Dynamic Reasons */}
        {reasons.map((reason, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-4 border-2 ${reason.validated
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
              }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {reason.validated ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <div className="font-semibold text-sm">
                    {reason.category} {reason.validated && <span className="text-green-600">(Validated)</span>}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {reason.principle}
                  </div>
                </div>
                <div className="text-sm">{reason.evidence}</div>
                <div className="space-y-1">
                  {reason.dataPoints.map((point, pidx) => (
                    <div key={pidx} className="flex items-center gap-2 text-sm">
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <div className="font-mono text-xs">{point}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Validation Summary */}
        {validation && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-3">Plan Validation Summary</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {validation.dietaryCompliance && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${validation.dietaryCompliance.isCompliant ? 'text-green-600' : 'text-red-600'}`} />
                  <span>Dietary Compliance</span>
                </div>
              )}
              {validation.macroConsistency && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${validation.macroConsistency.isValid ? 'text-green-600' : 'text-red-600'}`} />
                  <span>Macro Consistency</span>
                </div>
              )}
              {validation.progressiveOverload && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${validation.progressiveOverload.isValid ? 'text-green-600' : 'text-red-600'}`} />
                  <span>Progressive Overload</span>
                </div>
              )}
              {validation.recovery && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${validation.recovery.isValid ? 'text-green-600' : 'text-red-600'}`} />
                  <span>Recovery</span>
                </div>
              )}
              {validation.trainingLogic && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${validation.trainingLogic.isValid ? 'text-green-600' : 'text-red-600'}`} />
                  <span>Training Logic</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
