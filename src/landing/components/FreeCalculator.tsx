import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculateTDEE } from '@/utils/planCalculations';
import { GOAL_CATEGORY_OPTIONS } from '@/constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkles, ArrowRight, Plus } from 'lucide-react';
import { TodayMealsSectionView, ViewMeal } from '@/components/daily-tracker/meals/TodayMealsSectionView';
import { TodayCardioCardView } from '@/components/daily-tracker/cardio/TodayCardioCardView';
import { TodayHydrationCardView } from '@/components/daily-tracker/hydration/TodayHydrationCardView';
import { TodayWorkoutCardView, WorkoutData } from '@/components/daily-tracker/workout/TodayWorkoutCardView';

// Activity Levels mapping
const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Sedentary' },
    { value: 'light', label: 'Lightly Active' },
    { value: 'moderate', label: 'Moderately Active' },
    { value: 'active', label: 'Active' },
    { value: 'very_active', label: 'Very Active' }
];

// Default Data
const DEFAULT_VALUES = {
    age: 25,
    gender: 'male' as const,
    height: 180, // cm - internal storage always metric
    weight: 80, // kg - internal storage always metric
    activityLevel: 'moderate',
    goal: 'maintenance',
    unit: 'metric' as 'metric' | 'imperial'
};

const MACRO_COLORS = {
    protein: '#3b82f6', // blue-500
    carbs: '#ef4444',   // red-500
    fats: '#eab308'     // yellow-500
};

// Base Meals to be Optimized
const BASE_MEALS: ViewMeal[] = [
    {
        mealId: 'demo-1',
        mealName: 'High Protein Oatmeal',
        mealType: 'Breakfast',
        isFromPlan: true,
        isConsumed: false,
        calories: 450,
        protein: 30,
        carbs: 55,
        fat: 12
    },
    {
        mealId: 'demo-2',
        mealName: 'Grilled Chicken Salad',
        mealType: 'Lunch',
        isFromPlan: true,
        isConsumed: false,
        calories: 600,
        protein: 50,
        carbs: 20,
        fat: 25
    },
    {
        mealId: 'demo-3',
        mealName: 'Salmon & Asparagus',
        mealType: 'Dinner',
        isFromPlan: true,
        isConsumed: false,
        calories: 550,
        protein: 40,
        carbs: 10,
        fat: 35
    }
];

// Mock Workout Data
const MOCK_WORKOUT: WorkoutData = {
    sessionId: 'demo-workout',
    sessionName: 'Full Body Power',
    duration: 60,
    targetMuscles: ['Chest', 'Legs', 'Back'],
    exercises: [
        { exerciseId: 'e1', name: 'Barbell Squat', sets: 4, reps: '8-10' },
        { exerciseId: 'e2', name: 'Bench Press', sets: 4, reps: '8-10' },
        { exerciseId: 'e3', name: 'Bent Over Rows', sets: 3, reps: '10-12' },
        { exerciseId: 'e4', name: 'Overhead Press', sets: 3, reps: '10-12' }
    ]
};

export function FreeCalculator() {
    // State
    const [values, setValues] = useState<{
        age: number;
        gender: 'male' | 'female';
        height: number;
        weight: number;
        activityLevel: string;
        goal: string;
        unit: 'metric' | 'imperial';
    }>(DEFAULT_VALUES);
    const [displayHeightFt, setDisplayHeightFt] = useState('');
    const [displayHeightIn, setDisplayHeightIn] = useState('');
    const [displayWeightLbs, setDisplayWeightLbs] = useState('');

    // --- DEMO STATE ---
    const [mockMeals, setMockMeals] = useState<ViewMeal[]>(BASE_MEALS);
    const [mockCardioStatus, setMockCardioStatus] = useState<'completed' | null>(null);
    const [mockWorkoutStatus, setMockWorkoutStatus] = useState<'completed' | null>(null);
    const [mockWaterIntake, setMockWaterIntake] = useState(1250);
    const [mockWaterLogs, setMockWaterLogs] = useState<{ amount: number, timestamp: number }[]>([{ amount: 500, timestamp: Date.now() }]);

    const isMetric = values.unit === 'metric';

    // Handler helpers
    const updateWeight = (val: number, isMetricInput: boolean) => {
        if (isMetricInput) {
            setValues(prev => ({ ...prev, weight: val }));
        } else {
            setValues(prev => ({ ...prev, weight: val * 0.453592 }));
            setDisplayWeightLbs(val.toString());
        }
    };

    const updateHeightMetric = (val: number) => {
        setValues(prev => ({ ...prev, height: val }));
    };

    const updateHeightImperial = (ft: string, inc: string) => {
        setDisplayHeightFt(ft);
        setDisplayHeightIn(inc);
        const feet = parseInt(ft || '0');
        const inches = parseInt(inc || '0');
        const totalInches = (feet * 12) + inches;
        setValues(prev => ({ ...prev, height: totalInches * 2.54 }));
    };

    const toggleUnit = () => {
        const newUnit = isMetric ? 'imperial' : 'metric';
        setValues(prev => ({ ...prev, unit: newUnit }));

        if (newUnit === 'imperial') {
            // Initialize display values
            const totalInches = values.height / 2.54;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);
            setDisplayHeightFt(feet.toString());
            setDisplayHeightIn(inches.toString());
            setDisplayWeightLbs(Math.round(values.weight * 2.20462).toString());
        }
    };

    // Calculations
    const results = useMemo(() => {
        // Base TDEE
        const tdeeResult = calculateTDEE({
            weightKg: values.weight,
            heightCm: values.height,
            age: values.age,
            gender: values.gender,
            activityLevel: values.activityLevel
        });

        let targetCalories = tdeeResult.tdee;

        switch (values.goal) {
            case 'lean_bulk': targetCalories *= 1.10; break;
            case 'dirty_bulk': targetCalories *= 1.20; break;
            case 'mini_cut': targetCalories *= 0.80; break;
            case 'aggressive_cut': targetCalories *= 0.70; break;
            case 'recomp': targetCalories *= 1.0; break;
            case 'maintenance': targetCalories *= 1.0; break;
            case 'body_fat_goal': targetCalories *= 0.75; break;
            default: break;
        }
        targetCalories = Math.round(targetCalories);

        const protein = Math.round((targetCalories * 0.3) / 4);
        const carbs = Math.round((targetCalories * 0.35) / 4);
        const fats = Math.round((targetCalories * 0.35) / 9);

        // Simple prediction logic
        const dailyDeficit = tdeeResult.tdee - targetCalories;
        const weeklyDeficit = dailyDeficit * 7;
        const totalLossKg = (weeklyDeficit * 16) / 7700;

        const projectedWeight = Math.max(values.weight - totalLossKg, 40);
        const projectedWeightLbs = projectedWeight * 2.20462;

        return {
            tdee: tdeeResult.tdee,
            bmr: tdeeResult.bmr,
            targetCalories,
            macros: { calories: targetCalories, protein, carbs, fat: fats }, // Fixed shape for view
            prediction: {
                lossKg: totalLossKg,
                newWeightKg: projectedWeight,
                newWeightLbs: projectedWeightLbs
            }
        };
    }, [values]);

    // --- MOCK LP OPTIMIZER (Basic Math Distribution) ---
    useEffect(() => {
        // "Optimize" the mock meals to sum up to the calculated target
        const optimizeMockMeals = () => {
            // Target Distribution: Breakfast 30%, Lunch 35%, Dinner 35%
            const split = { Breakfast: 0.30, Lunch: 0.35, Dinner: 0.35 };

            // Update BASE_MEALS with strict macro distribution
            const updated = BASE_MEALS.map(meal => {
                const ratio = split[meal.mealType as keyof typeof split] || 0.33;

                return {
                    ...meal,
                    calories: Math.round(results.targetCalories * ratio),
                    protein: Math.round(results.macros.protein * ratio),
                    carbs: Math.round(results.macros.carbs * ratio),
                    fat: Math.round(results.macros.fat * ratio),
                };
            });

            // Preserve consumed state
            setMockMeals(prev => updated.map((u, i) => ({
                ...u,
                isConsumed: prev[i]?.isConsumed ?? false
            })));
        };

        optimizeMockMeals();
    }, [results]);


    const chartData = [
        { name: 'Protein', value: results.macros.protein * 4, color: MACRO_COLORS.protein, grams: results.macros.protein },
        { name: 'Carbs', value: results.macros.carbs * 4, color: MACRO_COLORS.carbs, grams: results.macros.carbs },
        { name: 'Fat', value: results.macros.fat * 9, color: MACRO_COLORS.fats, grams: results.macros.fat }, // Fixed name
    ];

    // ----- DEMO HANDLERS ----- //
    const toggleMockMeal = (id: string) => {
        setMockMeals(prev => prev.map(m => m.mealId === id ? { ...m, isConsumed: !m.isConsumed } : m));
    };

    const toggleMockCardio = () => {
        setMockCardioStatus(prev => prev === 'completed' ? null : 'completed');
    };

    const toggleMockWorkout = () => {
        setMockWorkoutStatus(prev => prev === 'completed' ? null : 'completed');
    };

    const addMockWater = (amt: number) => {
        setMockWaterIntake(prev => prev + amt);
        setMockWaterLogs(prev => [...prev, { amount: amt, timestamp: Date.now() }]);
    };
    const undoMockWater = () => {
        const last = mockWaterLogs[mockWaterLogs.length - 1];
        if (last) {
            setMockWaterIntake(prev => Math.max(0, prev - last.amount));
            setMockWaterLogs(prev => prev.slice(0, -1));
        }
    };

    // Derived Demo Data
    const consumedMacros = useMemo(() => {
        return mockMeals.filter(m => m.isConsumed).reduce((acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }, [mockMeals]);

    return (
        <section id="calculator" className="py-24 md:py-32 bg-background relative overflow-hidden">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground font-editorial">
                        Discover Your <span className="text-primary">Dream Physique</span>
                    </h2>
                    <p className="text-lg text-muted-foreground/80 max-w-xl mx-auto font-sans">
                        See exactly what it takes to transform your body in 16 weeks.
                    </p>
                </div>

                <div className="relative w-full max-w-full overflow-hidden animate-in slide-in-from-right-4 duration-700 delay-200">

                    {/* Scroll Container - NOW INCLUDES EVERYTHING */}
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 pt-2 scrollbar-hide px-4 lg:px-8">

                        {/* 1. Configuration / Inputs Card */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[400px]">
                            <div className="h-full bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[32px] p-6 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800">Your Stats</h3>
                                        {/* Unit Toggle Mini */}
                                        <div className="inline-flex rounded-full p-1 bg-slate-100/80 border border-slate-200">
                                            <button onClick={() => !isMetric && toggleUnit()} className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all", isMetric ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>Metric</button>
                                            <button onClick={() => isMetric && toggleUnit()} className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all", !isMetric ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>Imperial</button>
                                        </div>
                                    </div>

                                    {/* Weight */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight</Label>
                                        <div className="relative">
                                            <input type="number" value={isMetric ? values.weight || '' : displayWeightLbs} onChange={(e) => updateWeight(Number(e.target.value), isMetric)} className="w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none text-3xl font-bold py-1 font-mono text-slate-900" />
                                            <span className="absolute right-0 bottom-2 text-sm font-medium text-slate-400">{isMetric ? 'kg' : 'lbs'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Age */}
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Age</Label>
                                            <div className="relative">
                                                <input type="number" value={values.age} onChange={(e) => setValues(prev => ({ ...prev, age: Number(e.target.value) }))} className="w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none text-3xl font-bold py-1 font-mono text-slate-900" />
                                                <span className="absolute right-0 bottom-2 text-sm font-medium text-slate-400">yrs</span>
                                            </div>
                                        </div>

                                        {/* Height */}
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Height</Label>
                                            {isMetric ? (
                                                <div className="relative">
                                                    <input type="number" value={values.height || ''} onChange={(e) => updateHeightMetric(Number(e.target.value))} className="w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none text-3xl font-bold py-1 font-mono text-slate-900" />
                                                    <span className="absolute right-0 bottom-2 text-sm font-medium text-slate-400">cm</span>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input type="number" value={displayHeightFt} onChange={(e) => updateHeightImperial(e.target.value, displayHeightIn)} className="w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none text-3xl font-bold py-1 font-mono text-slate-900" />
                                                        <span className="absolute right-0 bottom-2 text-xs font-medium text-slate-400">ft</span>
                                                    </div>
                                                    <div className="relative flex-1">
                                                        <input type="number" value={displayHeightIn} onChange={(e) => updateHeightImperial(displayHeightFt, e.target.value)} className="w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none text-3xl font-bold py-1 font-mono text-slate-900" />
                                                        <span className="absolute right-0 bottom-2 text-xs font-medium text-slate-400">in</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sex */}
                                    <div className="space-y-2 pt-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sex</Label>
                                        <div className="flex gap-3">
                                            {['male', 'female'].map(g => (
                                                <button key={g} onClick={() => setValues(prev => ({ ...prev, gender: g as 'male' | 'female' }))} className={cn("flex-1 py-3 rounded-xl border font-semibold transition-all text-sm uppercase tracking-wide", values.gender === g ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Selectors */}
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</Label>
                                            <Select value={values.activityLevel} onValueChange={(v) => setValues(prev => ({ ...prev, activityLevel: v }))}>
                                                <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ACTIVITY_LEVELS.map(level => (
                                                        <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goal</Label>
                                            <Select value={values.goal} onValueChange={(v) => setValues(prev => ({ ...prev, goal: v }))}>
                                                <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {GOAL_CATEGORY_OPTIONS.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. TDEE Result Card */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[400px]">
                            <div className="h-full relative z-10 bg-background/80 backdrop-blur-xl border border-border/50 rounded-[32px] p-6 shadow-none overflow-hidden flex flex-col">

                                {/* Sales Pitch */}
                                <div className="mb-6 p-5 bg-primary/5 rounded-2xl border border-primary/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full" />
                                    <h3 className="text-base font-bold flex items-center gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-primary fill-primary" />
                                        16-Week Projection
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Follow your plan to reach {' '}
                                        <span className="font-bold text-foreground">
                                            {isMetric
                                                ? `${Math.round(results.prediction.newWeightKg)} kg`
                                                : `${Math.round(results.prediction.newWeightLbs)} lbs`
                                            }
                                        </span>
                                        {results.prediction.lossKg > 0
                                            ? ". Burn fat, keep muscle."
                                            : ". Build lean mass."
                                        }
                                    </p>
                                </div>

                                {/* Chart Container */}
                                <div className="relative h-[280px] w-full flex items-center justify-center mb-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={105}
                                                paddingAngle={4}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white border text-slate-900 border-slate-100 shadow-xl rounded-xl p-3">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-3 h-3 rounded-full" style={{ background: data.color }} />
                                                                    <span className="font-bold text-sm">{data.name}</span>
                                                                </div>
                                                                <div className="text-2xl font-black">{data.grams}g</div>
                                                                <div className="text-xs text-slate-500 font-medium">{Math.round(Number(payload[0].value))} kcal</div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                                cursor={false}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    {/* Center Text */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-muted-foreground font-semibold text-[10px] uppercase tracking-widest mb-1">Daily</span>
                                        <span className="text-5xl font-bold font-editorial">{results.targetCalories}</span>
                                        <span className="text-xs font-medium text-muted-foreground">kcal</span>
                                    </div>

                                    {/* Chart Legend Overlay */}
                                    <div className="absolute bottom-0 inset-x-0 flex justify-center gap-4">
                                        {chartData.map((d) => (
                                            <div key={d.name} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{d.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-amber-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />
                                    <Button
                                        className={cn(
                                            "w-full relative rounded-xl text-white font-bold shadow-md transition-all h-14 text-lg overflow-hidden",
                                            "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                                            "shadow-[0_2px_8px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                            "hover:shadow-[0_4px_12px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                                        )}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-200%] animate-[shimmer_3s_infinite]" />
                                        <Plus className="h-5 w-5 mr-2 relative z-10" strokeWidth={3} />
                                        <span className="relative z-10">Get My Transformation Plan</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Mock Workout */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[380px]">
                            <TodayWorkoutCardView
                                workoutData={MOCK_WORKOUT}
                                status={mockWorkoutStatus}
                                onComplete={toggleMockWorkout}
                                onSkip={() => { }}
                                isDemo={true}
                            />
                        </div>

                        {/* 4. Mock Daily Meals - Auto-Optimized */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[380px]">
                            <TodayMealsSectionView
                                meals={mockMeals}
                                targetMacros={results.macros}
                                consumedMacros={consumedMacros}
                                onToggleMeal={toggleMockMeal}
                                onAddMeal={() => { }} // No op for demo
                                onSwapMeal={() => { }}
                                onDeleteMeal={() => { }}
                                loadingMealId={null}
                                isDemo={true}
                            />
                        </div>

                        {/* 5. Mock Cardio */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[380px]">
                            <TodayCardioCardView
                                cardioData={{
                                    name: 'Zone 2 Steady State',
                                    type: 'Cardio',
                                    intensity: 'Moderate',
                                    duration: 45,
                                    caloriesBurned: 350,
                                    targetHeartRate: { min: 135, max: 145, zone: 'Zone 2' }
                                }}
                                status={mockCardioStatus}
                                actualDuration={mockCardioStatus === 'completed' ? 45 : undefined}
                                onComplete={toggleMockCardio}
                                onSkip={() => { }}
                                isDemo={true}
                            />
                        </div>

                        {/* 6. Mock Hydration */}
                        <div className="snap-center shrink-0 w-[340px] md:w-[380px]">
                            <TodayHydrationCardView
                                currentIntake={mockWaterIntake}
                                target={Math.round(values.weight * 33)}
                                onAddWater={addMockWater}
                                onUndo={undoMockWater}
                                isAdding={false}
                                isRemoving={false}
                                canUndo={mockWaterLogs.length > 0}
                            />
                        </div>
                    </div>

                    {/* Scroll Hints / Fade */}
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none" />
                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none" />

                    <p className="text-center text-xs text-muted-foreground font-medium mt-4 lg:hidden">
                        Swipe necessary to see all demo cards
                    </p>

                    {/* Decorational Gradient Blob */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-primary/20 via-orange-500/10 to-blue-500/20 blur-[100px] -z-10 rounded-full opacity-60" />
                </div>
            </div>
        </section>
    );
}
