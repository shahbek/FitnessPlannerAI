import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Utensils, Info, Dumbbell, Heart } from 'lucide-react';
import { calculateWeeklyExerciseCalories, calculateEnergyBalance, getTDEE } from '@/utils/planCalculations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

interface EnergyBalanceVisualizationProps {
  plan: any;
  userProfile?: {
    weight?: number;
    height?: number;
    age?: number;
    gender?: string;
    experienceLevel?: string;
    workoutDaysPerWeek?: number;
    bodyFat?: number;
  };
  selectedWeek?: number;
}

export function EnergyBalanceVisualization({ plan, userProfile, selectedWeek = 1 }: EnergyBalanceVisualizationProps) {
  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Use CENTRALIZED TDEE calculation for consistency across all components
  const tdee = getTDEE(plan, userProfile) || 0;
  const weight = userProfile?.weight || 88;

  const weekData = weeklyOutlines[selectedWeek - 1] || weeklyOutlines[0];

  const energyData = useMemo(() => {
    if (!weekData || !tdee) return null;

    const dailyMealCalories = weekData.dailyTargets?.calories || 0;
    // Pass plan to use detailed cardio calorie data if available
    // Make sure we're using the same data source as CardioOverview
    const exerciseCalories = calculateWeeklyExerciseCalories(weekData, weight, plan);
    const energyBalance = calculateEnergyBalance(tdee, dailyMealCalories, exerciseCalories);

    return {
      ...energyBalance,
      dailyExerciseBurn: Math.round(exerciseCalories.total / 7),
    };
  }, [weekData, tdee, weight, plan]);

  if (!energyData) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Insufficient data for energy balance
        </CardContent>
      </Card>
    );
  }

  const {
    maintenanceCalories,
    mealCalories,
    dietaryDeficit,
    exerciseBurn,
    netWeeklyDeficit,
    expectedWeightLoss,
  } = energyData;

  // Calculate net daily balance (positive = deficit, negative = surplus)
  const netDailyBalance = dietaryDeficit + Math.round(exerciseBurn.total / 7);
  const isDeficitMode = netDailyBalance >= 0;

  // Prepare chart data
  const chartData = [
    {
      name: 'TDEE',
      calories: maintenanceCalories,
      fill: 'url(#colorMaintenance)',
      label: 'TDEE (Maintenance)'
    },
    {
      name: 'Intake',
      calories: mealCalories,
      fill: 'url(#colorIntake)',
      label: 'Daily Food Intake'
    },
    {
      name: isDeficitMode ? 'Deficit' : 'Surplus',
      calories: Math.abs(netDailyBalance),
      fill: isDeficitMode ? 'url(#colorDeficit)' : 'url(#colorSurplus)',
      label: isDeficitMode ? 'Total Deficit' : 'Total Surplus'
    }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const fillType = payload[0].payload.fill;
      let dotColor = '#94a3b8'; // default maintenance
      if (fillType.includes('Intake')) dotColor = '#22c55e';
      else if (fillType.includes('Deficit')) dotColor = '#ef4444';
      else if (fillType.includes('Surplus')) dotColor = '#f59e0b';
      
      return (
        <div className="bg-white/90 backdrop-blur-md border border-white/50 p-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <p className="font-bold text-slate-800 mb-2">{payload[0].payload.label}</p>
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            <span className="text-slate-900 font-bold">
              {payload[0].value} kcal/day
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full border-2 border-white/60 bg-gradient-to-br from-white via-orange-50 to-orange-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(249,115,22,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9)] hover:shadow-[0_16px_50px_rgba(249,115,22,0.12)] transition-all duration-300 flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">
                Energy Balance
              </CardTitle>
              <div className="text-xs text-slate-500 font-medium">Calories In vs. Calories Out</div>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`shadow-sm border ${
              expectedWeightLoss >= 0 
                ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' 
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200'
            }`}
          >
            {expectedWeightLoss >= 0 ? '−' : '+'}{Math.abs(expectedWeightLoss).toFixed(2)} kg/week
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="grid md:grid-cols-2 gap-8 flex-1 min-h-0">
          {/* Chart Section */}
          <div className="w-full flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorMaintenance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="colorIntake" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#86efac" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="colorDeficit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="colorSurplus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#fcd34d" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} content={<CustomTooltip />} />
                <ReferenceLine y={maintenanceCalories} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Maintenance', position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <Bar dataKey="calories" radius={[6, 6, 0, 0]} animationDuration={1500}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Section */}
          <div className="space-y-6 flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 p-3 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm">
                <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Daily Intake</div>
                <div className="text-2xl font-black text-slate-800">{mealCalories}</div>
                <div className="text-xs text-green-600 font-bold">kcal/day</div>
              </div>
              <div className="bg-white/60 p-3 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm">
                <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">
                  {netWeeklyDeficit >= 0 ? 'Total Deficit' : 'Total Surplus'}
                </div>
                <div className={`text-2xl font-black ${netWeeklyDeficit >= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {netWeeklyDeficit >= 0 ? '−' : '+'}{Math.abs(Math.round(netWeeklyDeficit / 7))}
                </div>
                <div className={`text-xs font-bold ${netWeeklyDeficit >= 0 ? 'text-red-600' : 'text-amber-600'}`}>kcal/day (avg)</div>
              </div>
            </div>

            <div className="space-y-3 bg-white/40 p-4 rounded-xl border border-white/40">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <div className={`p-1 rounded ${dietaryDeficit >= 0 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                    <Utensils className="w-3.5 h-3.5" />
                  </div>
                  {dietaryDeficit >= 0 ? 'Dietary Deficit' : 'Dietary Surplus'}
                </span>
                <span className={`font-bold ${dietaryDeficit >= 0 ? 'text-slate-800' : 'text-amber-700'}`}>
                  {dietaryDeficit >= 0 ? '−' : '+'}{Math.abs(dietaryDeficit)} kcal
                </span>
              </div>

              {/* Exercise Burn - Separated */}
              <div className="space-y-2 pl-1">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Exercise Burn</div>
                <div className="flex items-center justify-between text-sm pl-3 border-l-2 border-purple-200">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="p-1 rounded bg-purple-100 text-purple-600"><Dumbbell className="w-3 h-3" /></div>
                    Resistance Training
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">−{Math.abs(Math.round(exerciseBurn.resistance / 7))}</span>
                    <span className="text-xs text-slate-500 ml-1">kcal/day</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pl-3 border-l-2 border-orange-200">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="p-1 rounded bg-orange-100 text-orange-600"><Heart className="w-3 h-3" /></div>
                    Cardio
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-orange-700">−{Math.abs(Math.round(exerciseBurn.cardio / 7))}</span>
                    <span className="text-xs text-slate-500 ml-1">kcal/day</span>
                    <div className="text-[10px] text-orange-500 font-medium mt-0.5">
                      {Math.abs(Math.round(exerciseBurn.cardio))} cal/week
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-200/40 mt-1.5">
                  <span className="flex items-center gap-2 text-slate-700 font-semibold">
                    Total Exercise Burn
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">−{Math.abs(Math.round(exerciseBurn.total / 7))}</span>
                    <span className="text-xs text-slate-500 ml-1">kcal/day</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>7,700 kcal deficit ≈ 1kg fat loss</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
