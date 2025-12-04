import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, User } from 'lucide-react';
import { projectBodyComposition, estimateBodyFatFromBMI, calculateBMI } from '@/utils/planCalculations';
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
  userProfile?: {
    weight?: number;
    height?: number;
    gender?: string;
    age?: number;
    workoutDaysPerWeek?: number;
    bodyFat?: number;
    targetBodyFat?: number;
  };
}

export function BodyCompositionProjection({ plan, userProfile }: BodyCompositionProjectionProps) {
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Use plan metrics first, then fallback to calculations
  const planUserProfile = plan?.userProfile || userProfile;
  const startingWeight = planUserProfile?.weight || userProfile?.weight || 88;
  const height = planUserProfile?.height || userProfile?.height || 180;
  const gender = planUserProfile?.gender || userProfile?.gender || 'male';

  // Get TDEE from plan metrics (should be calculated during plan generation)
  // If missing, calculate from user profile
  let tdee = plan?.metrics?.tdee?.value || 0;
  if (!tdee && startingWeight && height && planUserProfile?.age && gender) {
    // Calculate BMR using Mifflin-St Jeor
    const sex = gender.toLowerCase() === 'male' || gender.toLowerCase() === 'm' ? 'male' : 'female';
    const bmr = sex === 'male'
      ? 10 * startingWeight + 6.25 * height - 5 * planUserProfile.age + 5
      : 10 * startingWeight + 6.25 * height - 5 * planUserProfile.age - 161;

    // Activity factor based on training days
    const trainingDays = planUserProfile?.workoutDaysPerWeek || userProfile?.workoutDaysPerWeek || 3;
    let activityFactor = 1.55;
    if (trainingDays <= 2) activityFactor = 1.375;
    else if (trainingDays <= 3) activityFactor = 1.55;
    else if (trainingDays <= 5) activityFactor = 1.725;
    else activityFactor = 1.9;

    tdee = Math.round(bmr * activityFactor);
  }

  // Get protein per kg from framework
  const framework = plan?.phaseAwareFramework || plan?.strategicFramework || {};
  const proteinPerKg = framework?.nutritionApproach?.macroTargets?.proteinPerKg ||
    (startingWeight > 0 && plan?.metrics?.macros?.protein
      ? plan.metrics.macros.protein / startingWeight
      : 2.0);

  // Estimate starting body fat if not provided
  const bmi = calculateBMI(height, startingWeight);
  // Use provided body fat if available, otherwise estimate from BMI
  const startingBodyFat = planUserProfile?.bodyFat || userProfile?.bodyFat || estimateBodyFatFromBMI(bmi, gender);

  const projections = useMemo(() => {
    if (weeklyOutlines.length === 0 || !tdee || !startingWeight) {
      return [];
    }

    return projectBodyComposition(
      startingWeight,
      startingBodyFat,
      weeklyOutlines,
      proteinPerKg,
      tdee,
      plan // Pass plan to use detailed cardio calorie data
    );
  }, [weeklyOutlines, startingWeight, startingBodyFat, proteinPerKg, tdee, plan]);

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
  const totalWeightLoss = startingWeight - finalProjection.weight;
  const totalFatLoss = finalProjection.cumulativeFatLoss;
  const fatLossPercentage = (totalFatLoss / totalWeightLoss) * 100;

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
      return (
        <div className="bg-white/90 backdrop-blur-md border border-white/50 p-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <p className="font-bold text-slate-800 mb-2">Week {label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-xs font-medium">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-600 min-w-[70px]">{entry.name}:</span>
                <span className="text-slate-900 font-bold">
                  {entry.value.toFixed(1)} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full border-2 border-white/60 bg-gradient-to-br from-white via-blue-50 to-blue-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(59,130,246,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9)] hover:shadow-[0_16px_50px_rgba(59,130,246,0.12)] transition-all duration-300">
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
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 shadow-md border border-blue-500/50">
            {fatLossPercentage.toFixed(0)}% Fat Loss
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-2 h-[300px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                  label={{ value: 'Weeks', position: 'insideBottomRight', offset: -5, fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  dy={10}
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
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <div className="p-1 bg-slate-200 rounded-md"><User className="w-3 h-3" /></div>
                Composition Analysis
              </h4>
              <p className="leading-relaxed text-xs">
                By maintaining high protein (<span className="font-bold text-slate-800">{proteinPerKg.toFixed(1)}g/kg</span>) and resistance training,
                you are projected to retain <span className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{((1 - ((totalWeightLoss - totalFatLoss) / totalWeightLoss)) * 100).toFixed(0)}%</span> of your lean mass while losing weight.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
