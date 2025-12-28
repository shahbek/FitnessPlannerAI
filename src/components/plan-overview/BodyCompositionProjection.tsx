import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, User } from 'lucide-react';
import {
  estimateBodyFatFromBMI,
  calculateBMI,
  calculateWeeklyDeficitSummary,
  getTDEE
} from '@/utils/planCalculations';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface BodyCompositionProjectionProps {
  plan: any;
  weeklySchedule?: any[];
  userProfile?: {
    weight?: number;
    height?: number;
    gender?: string;
    age?: number;
    workoutDaysPerWeek?: number;
    bodyFat?: number;
    targetBodyFat?: number;
    experienceLevel?: string;
  };
}

export function BodyCompositionProjection({ plan, weeklySchedule, userProfile }: BodyCompositionProjectionProps) {
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Use plan metrics first, then fallback to calculations
  const planUserProfile = plan?.userProfile || userProfile;
  const startingWeight = planUserProfile?.weight || userProfile?.weight || 88;
  const height = planUserProfile?.height || userProfile?.height || 180;
  const gender = planUserProfile?.gender || userProfile?.gender || 'male';

  // Get TDEE using centralized function
  const tdee = useMemo(() => {
    return getTDEE(plan, planUserProfile) || 2200;
  }, [plan, planUserProfile]);

  // Get protein per kg from framework
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg ||
    (startingWeight > 0 && plan?.metrics?.macros?.protein
      ? plan.metrics.macros.protein / startingWeight
      : 2.0);

  // Estimate starting body fat if not provided
  const bmi = calculateBMI(height, startingWeight);
  const startingBodyFat = planUserProfile?.bodyFat || userProfile?.bodyFat || estimateBodyFatFromBMI(bmi, gender);

  // Get experience level for muscle gain rate calculation
  const experienceLevel = planUserProfile?.experienceLevel || userProfile?.experienceLevel || 'intermediate';
  const userGender = (gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'm') ? 'male' : 'female';
  const userAge = planUserProfile?.age || userProfile?.age || 30;

  /**
   * Calculate maximum weekly muscle gain rate based on training experience
   * Based on research by Lyle McDonald, Alan Aragon, and meta-analyses
   * 
   * Natural muscle gain rates (kg/week):
   * - Beginner (0-1 years): 0.20-0.25 kg/week (males), 0.10-0.125 kg/week (females)
   * - Intermediate (1-3 years): 0.10-0.15 kg/week (males), 0.05-0.075 kg/week (females)  
   * - Advanced (3+ years): 0.05-0.08 kg/week (males), 0.025-0.04 kg/week (females)
   * 
   * Factors: Age reduces rate by ~1% per year after 30
   */
  const getMaxWeeklyMuscleGain = (): number => {
    const level = experienceLevel.toLowerCase();
    let baseRate: number;

    if (level === 'beginner' || level === 'novice') {
      baseRate = userGender === 'male' ? 0.22 : 0.11;
    } else if (level === 'advanced' || level === 'expert') {
      baseRate = userGender === 'male' ? 0.06 : 0.03;
    } else {
      // Intermediate (default)
      baseRate = userGender === 'male' ? 0.12 : 0.06;
    }

    // Age adjustment: reduce by 1% per year after 30
    const ageAdjustment = userAge > 30 ? Math.max(0.5, 1 - (userAge - 30) * 0.01) : 1;

    // Protein adjustment: need at least 1.6g/kg for optimal muscle synthesis
    const proteinAdjustment = proteinPerKg >= 1.6 ? 1 : (proteinPerKg / 1.6);

    return baseRate * ageAdjustment * proteinAdjustment;
  };

  // Calculate projections using the SAME method as weekly progression card
  const projections = useMemo(() => {
    if (weeklyOutlines.length === 0 || !tdee || !startingWeight) {
      return [];
    }

    const maxWeeklyMuscleGain = getMaxWeeklyMuscleGain();

    // Calories required to build 1 kg of muscle tissue
    // Research suggests ~2,500-3,500 kcal needed per kg muscle (including water/glycogen)
    const KCAL_PER_KG_MUSCLE = 2800;

    const results: Array<{
      weekNumber: number;
      weight: number;
      bodyFat: number;
      fatMass: number;
      leanMass: number;
      weeklyWeightChange: number;
      cumulativeWeightChange: number;
      weeklyFatLoss: number;
      cumulativeFatLoss: number;
    }> = [];

    let currentWeight = startingWeight;
    let currentFatMass = startingWeight * (startingBodyFat / 100);
    let currentLeanMass = startingWeight - currentFatMass;
    let cumulativeWeightChange = 0;
    let cumulativeFatLoss = 0;

    weeklyOutlines.forEach((week: any) => {
      const weekNumber = week.weekNumber;

      // Use the SAME calculation as weekly progression card
      // Pass empty array for weeklySchedule if missing, as new logic relies on plan
      const deficitSummary = calculateWeeklyDeficitSummary(
        weekNumber,
        tdee,
        weeklySchedule || [],
        plan,
        currentWeight
      );

      // Positive = deficit (fat loss), Negative = surplus (potential muscle gain)
      const weeklyBalance = deficitSummary?.projectedWeightLossKg || 0;
      const isDeficit = weeklyBalance > 0;

      // DEBUG LOG
      if (weekNumber === 1 || weekNumber === weeklyOutlines.length) {
        console.group(`📉 BodyComp Week ${weekNumber}`);
        console.log('Current Weight:', currentWeight.toFixed(1));
        console.log('TDEE Used:', tdee);
        console.log('Weekly Balance (LossKg):', weeklyBalance);
        console.log('Is Deficit?', isDeficit);
        if (deficitSummary) {
          console.log('Total Intake:', deficitSummary.dailyDeficits.reduce((a: number, b: any) => a + b.caloriesConsumed, 0));
          console.log('Total Output:', deficitSummary.dailyDeficits.reduce((a: number, b: any) => a + b.resistanceCalories + b.cardioCalories + 2500, 0)); // rough check
        }
        console.groupEnd();
      }

      let fatChange: number;
      let leanMassChange: number;

      if (isDeficit) {
        // DEFICIT: Fat loss with minimal muscle loss
        // 7,700 kcal deficit = 1 kg fat loss
        const weeklyFatLoss = weeklyBalance;

        // Lean mass preservation based on protein intake
        let leanMassLossRatio = 0.05;
        if (proteinPerKg >= 2.0) {
          leanMassLossRatio = 0.02;
        } else if (proteinPerKg >= 1.8) {
          leanMassLossRatio = 0.05;
        } else if (proteinPerKg >= 1.5) {
          leanMassLossRatio = 0.10;
        } else {
          leanMassLossRatio = 0.15;
        }

        fatChange = -weeklyFatLoss;
        leanMassChange = -weeklyFatLoss * leanMassLossRatio;

      } else {
        // SURPLUS: Muscle gain with some fat gain
        const weeklySurplus = Math.abs(weeklyBalance); // in kg (from 7700 rule)
        const weeklySurplusKcal = weeklySurplus * 7700; // convert back to kcal

        // Calculate max muscle gain for this week
        // Limited by: genetics, training stimulus, protein synthesis rate
        const maxMuscleGainThisWeek = maxWeeklyMuscleGain;

        // Calories that CAN go to muscle (limited by max rate)
        const kcalForMuscle = maxMuscleGainThisWeek * KCAL_PER_KG_MUSCLE;

        // Actual muscle gain = min of (surplus available, max possible)
        const actualMuscleGain = Math.min(
          weeklySurplusKcal / KCAL_PER_KG_MUSCLE,
          maxMuscleGainThisWeek
        );

        // Remaining surplus after muscle synthesis → stored as fat
        const remainingSurplusKcal = Math.max(0, weeklySurplusKcal - (actualMuscleGain * KCAL_PER_KG_MUSCLE));
        const fatGain = remainingSurplusKcal / 7700;

        // With optimal protein (≥1.6g/kg), muscle synthesis is maximized
        // With suboptimal protein, more goes to fat
        const proteinEfficiency = proteinPerKg >= 1.6 ? 1 : (proteinPerKg / 1.6) * 0.7;

        leanMassChange = actualMuscleGain * proteinEfficiency;
        fatChange = fatGain + (actualMuscleGain * (1 - proteinEfficiency)); // Unused protein calories → fat
      }

      // Update masses
      const newFatMass = Math.max(0, currentFatMass + fatChange);
      const newLeanMass = Math.max(0, currentLeanMass + leanMassChange);
      const newWeight = newFatMass + newLeanMass;
      const newBodyFat = newWeight > 0 ? (newFatMass / newWeight) * 100 : 0;

      // Track changes
      const totalWeightChange = (newWeight - currentWeight);
      cumulativeWeightChange += totalWeightChange;
      cumulativeFatLoss += (fatChange < 0 ? Math.abs(fatChange) : 0);

      results.push({
        weekNumber,
        weight: newWeight,
        bodyFat: newBodyFat,
        fatMass: newFatMass,
        leanMass: newLeanMass,
        weeklyWeightChange: totalWeightChange,
        cumulativeWeightChange,
        weeklyFatLoss: fatChange < 0 ? Math.abs(fatChange) : -fatChange, // Negative if gaining fat
        cumulativeFatLoss,
      });

      // Update current values for next iteration
      currentWeight = newWeight;
      currentFatMass = newFatMass;
      currentLeanMass = newLeanMass;
    });

    return results;
  }, [weeklyOutlines, weeklySchedule, startingWeight, startingBodyFat, proteinPerKg, tdee, plan, experienceLevel, userGender, userAge]);

  if (projections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Insufficient data for projection
        </CardContent>
      </Card>
    );
  }

  const finalProjection = projections[projections.length - 1];

  // Calculate total changes
  const startingFatMass = startingWeight * (startingBodyFat / 100);
  const startingLeanMass = startingWeight - startingFatMass;

  const totalWeightChange = finalProjection.weight - startingWeight; // Positive = gain, Negative = loss
  const totalFatChange = finalProjection.fatMass - startingFatMass; // Positive = gain, Negative = loss
  const totalLeanMassChange = finalProjection.leanMass - startingLeanMass; // Positive = gain, Negative = loss

  // Determine if this is a bulk or cut scenario
  const isWeightLoss = totalWeightChange < 0;
  const isFatLoss = totalFatChange < 0;
  const isMuscleGain = totalLeanMassChange > 0;

  // Calculate percentages for display
  const fatChangePercent = startingFatMass > 0 ? Math.abs(totalFatChange / startingFatMass * 100) : 0;
  const leanMassChangePercent = startingLeanMass > 0 ? Math.abs(totalLeanMassChange / startingLeanMass * 100) : 0;

  // Prepare chart data
  const chartData = [
    {
      week: 0,
      weight: startingWeight,
      leanMass: startingWeight * (1 - startingBodyFat / 100),
      fatMass: startingWeight * (startingBodyFat / 100),
    },
    ...projections.map(p => ({
      week: p.weekNumber,
      weight: p.weight,
      leanMass: p.leanMass,
      fatMass: p.fatMass,
    }))
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Calculate total weight from lean mass + fat mass
      const leanMass = payload.find((p: any) => p.dataKey === 'leanMass')?.value || 0;
      const fatMass = payload.find((p: any) => p.dataKey === 'fatMass')?.value || 0;
      const totalWeight = leanMass + fatMass;

      return (
        <div className="bg-white/95 backdrop-blur-md border border-white/50 p-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <p className="font-bold text-slate-800 mb-3">Week {label}</p>
          <div className="space-y-2">
            {/* Total Weight - Prominent */}
            <div className="flex items-center gap-2 text-sm font-medium pb-2 border-b border-slate-100">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
              <span className="text-slate-700 min-w-[80px]">Weight:</span>
              <span className="text-slate-900 font-black text-base">
                {totalWeight.toFixed(1)} kg
              </span>
            </div>
            {/* Lean Mass */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
              <span className="text-slate-600 min-w-[80px]">Lean Mass:</span>
              <span className="text-indigo-700 font-bold">
                {leanMass.toFixed(1)} kg
              </span>
            </div>
            {/* Fat Mass */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-slate-600 min-w-[80px]">Fat Mass:</span>
              <span className="text-amber-700 font-bold">
                {fatMass.toFixed(1)} kg
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col border-2 border-white/60 bg-gradient-to-br from-white via-blue-50 to-blue-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(59,130,246,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9)] hover:shadow-[0_16px_50px_rgba(59,130,246,0.12)] transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">
                Body Composition
              </CardTitle>
              <div className="text-xs text-slate-500 font-medium">Projected Progress Over Time</div>
            </div>
          </div>
          {/* Dynamic badges for fat and muscle changes */}
          <div className="flex items-center gap-2">
            {/* Muscle Badge */}
            {isMuscleGain ? (
              <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700 shadow-md border border-indigo-500/50">
                +{leanMassChangePercent.toFixed(1)}% Muscle
              </Badge>
            ) : (
              <Badge variant="outline" className="text-rose-600 border-rose-300 bg-rose-50">
                −{leanMassChangePercent.toFixed(1)}% Muscle
              </Badge>
            )}

            {/* Fat Badge */}
            {isFatLoss ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 shadow-md border border-emerald-500/50">
                −{fatChangePercent.toFixed(1)}% Fat
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                +{fatChangePercent.toFixed(1)}% Fat
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid lg:grid-cols-3 gap-8 flex-1">
          {/* Chart Section */}
          <div className="lg:col-span-2 min-h-[280px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                <defs>
                  <linearGradient id="colorLean" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="week"
                  label={{ value: 'Weeks', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  dy={5}
                />
                <YAxis
                  label={{ value: 'kg', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-slate-600 font-semibold text-xs ml-1">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="leanMass"
                  stackId="1"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorLean)"
                  name="Lean Mass"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="fatMass"
                  stackId="1"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#colorFat)"
                  name="Fat Mass"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Stats & Insights */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/60 p-4 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm group hover:shadow-md transition-all">
                <div className="text-xs text-blue-600 mb-1 font-bold uppercase tracking-wide">Projected Weight</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-blue-900 tracking-tight">{finalProjection.weight.toFixed(1)}</span>
                  <span className="text-sm font-bold text-blue-600">kg</span>
                </div>
                <div className="text-xs text-blue-500 mt-2 font-medium bg-blue-50 inline-block px-2 py-1 rounded-full">
                  From {startingWeight.toFixed(1)} kg
                </div>
              </div>

              <div className="bg-white/60 p-4 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm group hover:shadow-md transition-all">
                <div className="text-xs text-amber-600 mb-1 font-bold uppercase tracking-wide">Body Fat %</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-amber-900 tracking-tight">{finalProjection.bodyFat.toFixed(1)}</span>
                  <span className="text-sm font-bold text-amber-600">%</span>
                </div>
                <div className="text-xs text-amber-500 mt-2 font-medium bg-amber-50 inline-block px-2 py-1 rounded-full">
                  From {startingBodyFat.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 shadow-inner">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <div className="p-1 bg-slate-200 rounded-md"><User className="w-3 h-3" /></div>
                Composition Analysis
              </h4>

              {/* Fat Change */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/50">
                <span className="text-xs text-slate-600">Fat Mass</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isFatLoss ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {isFatLoss ? '−' : '+'}{Math.abs(totalFatChange).toFixed(2)} kg ({fatChangePercent.toFixed(1)}%)
                </span>
              </div>

              {/* Lean Mass Change */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-600">Lean Mass</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isMuscleGain ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                  {isMuscleGain ? '+' : '−'}{Math.abs(totalLeanMassChange).toFixed(2)} kg ({leanMassChangePercent.toFixed(1)}%)
                </span>
              </div>

              {/* Analysis Text */}
              <p className="leading-relaxed text-xs text-slate-500">
                {isWeightLoss ? (
                  <>
                    With <span className="font-bold text-slate-700">{proteinPerKg.toFixed(1)}g/kg</span> protein + resistance training,
                    you {isMuscleGain ? 'gain muscle while losing fat' : `retain ${(100 - leanMassChangePercent).toFixed(0)}% of lean mass`} while cutting.
                  </>
                ) : totalWeightChange > 0 ? (
                  <>
                    At <span className="font-bold text-slate-700">{experienceLevel}</span> level with <span className="font-bold text-slate-700">{proteinPerKg.toFixed(1)}g/kg</span> protein,
                    <span className="font-bold text-indigo-600"> {(Math.abs(totalLeanMassChange) / Math.abs(totalWeightChange) * 100).toFixed(0)}%</span> of weight gain is muscle.
                  </>
                ) : (
                  <>
                    At maintenance with <span className="font-bold text-slate-700">{proteinPerKg.toFixed(1)}g/kg</span> protein,
                    body composition remains stable.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
