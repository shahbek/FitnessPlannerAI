import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface DailySchedule {
    day: string;
    dayNumber: number;
    dailyMacros: {
        totalCalories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
}

interface WeeklySchedule {
    weekNumber: number;
    days: DailySchedule[];
}

interface DailyMacroTrendsProps {
    weeklySchedule: WeeklySchedule[];
}

export function DailyMacroTrends({ weeklySchedule }: DailyMacroTrendsProps) {
    const chartData = useMemo(() => {
        if (!weeklySchedule) return [];

        const data: any[] = [];
        weeklySchedule.forEach(week => {
            week.days.forEach(day => {
                data.push({
                    name: `W${week.weekNumber} ${day.day.substring(0, 3)}`, // e.g., W1 Mon
                    fullLabel: `Week ${week.weekNumber} - ${day.day}`,
                    protein: Math.round(day.dailyMacros.protein),
                    carbs: Math.round(day.dailyMacros.carbs),
                    fat: Math.round(day.dailyMacros.fat),
                    calories: Math.round(day.dailyMacros.totalCalories)
                });
            });
        });
        return data;
    }, [weeklySchedule]);

    if (!chartData.length) return null;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/90 backdrop-blur-md border border-white/50 p-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                    <p className="font-bold text-slate-800 mb-2">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-xs font-medium">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-slate-600 min-w-[60px]">{entry.name}:</span>
                                <span className="text-slate-900 font-bold">
                                    {entry.value}{entry.name.includes('Calories') ? ' kcal' : 'g'}
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
        <Card className="h-full border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12)] transition-all duration-300">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                            <Activity className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">
                                Daily Macro Trends
                            </CardTitle>
                            <div className="text-xs text-slate-500 font-medium">Nutrient Distribution Over Time</div>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm">
                        Projected Intake
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorProtein" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCarbs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Macros (g)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 11, fontWeight: 600 }, offset: 10 }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Calories (kcal)', angle: 90, position: 'insideRight', style: { fill: '#94a3b8', fontSize: 11, fontWeight: 600 }, offset: 10 }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }}
                                iconType="circle"
                                formatter={(value) => <span className="text-slate-600 font-semibold text-xs ml-1">{value}</span>}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="protein"
                                name="Protein"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
                                animationDuration={1500}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="carbs"
                                name="Carbs"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                                animationDuration={1500}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="fat"
                                name="Fat"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#f59e0b' }}
                                animationDuration={1500}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="calories"
                                name="Calories"
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#ef4444' }}
                                animationDuration={1500}
                                opacity={0.6}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
