import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Utensils, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import mealsIcon from '@/assets/images/3dicons/meals.png';

export interface ViewMeal {
    mealId: string;
    mealName: string;
    mealType: string;
    isFromPlan: boolean;
    isConsumed: boolean;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    consumedAt?: number;
    usdaFdcId?: string;
    servingSize?: string;
}

export interface TargetMacros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface TodayMealsSectionViewProps {
    meals: ViewMeal[];
    targetMacros?: TargetMacros;
    consumedMacros: { calories: number; protein: number; carbs: number; fat: number };
    onToggleMeal: (mealId: string) => void;
    onAddMeal: () => void;
    onSwapMeal: (mealId: string) => void;
    onDeleteMeal: (mealId: string) => void;
    loadingMealId: string | null;
    // Optional flag to hide "Add/Edit" buttons for Demo mode if desired, 
    // though user requested NO 'Add' button for the demo.
    isDemo?: boolean;
}

export function TodayMealsSectionView({
    meals,
    targetMacros,
    consumedMacros,
    onToggleMeal,
    onAddMeal,
    onSwapMeal,
    onDeleteMeal,
    loadingMealId,
    isDemo = false,
}: TodayMealsSectionViewProps) {

    // Get meal type emoji - simplified/standardized
    const getMealIcon = (mealType: string) => {
        const type = mealType.toLowerCase();
        if (type.includes('breakfast')) return '🍳';
        if (type.includes('lunch')) return '🥗';
        if (type.includes('dinner')) return '🍽️';
        if (type.includes('snack')) return '🍎';
        if (type.includes('pre-workout')) return '⚡';
        if (type.includes('post-workout')) return '💪';
        return '🍴';
    };

    return (
        <Card
            className={cn(
                'rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl',
                'shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]',
                'hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]',
                'transition-all duration-300 overflow-hidden group min-w-[320px]' // min-w for horizontal scroll
            )}
        >
            <CardContent className="p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 -ml-2">
                            <div className="w-20 h-20 flex items-center justify-center">
                                <img
                                    src={mealsIcon}
                                    alt="Meals"
                                    className="w-20 h-20 object-contain drop-shadow-xl"
                                />
                            </div>
                        </div>
                        <div className="pt-2 leading-tight">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-orange-600/60 mb-1">
                                Nutrition
                            </div>
                            <div className="text-2xl font-black text-slate-900 tracking-tight">
                                Daily Meals
                            </div>
                        </div>
                    </div>

                    {!isDemo && (
                        <Button
                            onClick={onAddMeal}
                            size="sm"
                            className={cn(
                                "rounded-xl text-white font-bold shadow-md transition-all h-9 px-4",
                                "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                                "shadow-[0_2px_8px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_4px_12px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                            )}
                        >
                            <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
                            Add
                        </Button>
                    )}
                </div>

                {/* Macro Progress (compact & clean) */}
                {targetMacros && (
                    <div className="mb-6 w-full">
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { key: 'calories', label: 'Cal', unit: '', color: 'text-slate-900', bg: 'bg-slate-100', barBg: 'bg-slate-900' },
                                { key: 'protein', label: 'Pro', unit: 'g', color: 'text-emerald-600', bg: 'bg-emerald-50', barBg: 'bg-emerald-500' },
                                { key: 'carbs', label: 'Crb', unit: 'g', color: 'text-amber-600', bg: 'bg-amber-50', barBg: 'bg-amber-500' },
                                { key: 'fat', label: 'Fat', unit: 'g', color: 'text-rose-600', bg: 'bg-rose-50', barBg: 'bg-rose-500' },
                            ].map(({ key, label, unit, color, bg, barBg }) => {
                                const consumed = Math.round(consumedMacros[key as keyof typeof consumedMacros]);
                                const target = Math.round(targetMacros[key as keyof typeof targetMacros]);
                                const displayValue = target - consumed;
                                const pct = Math.min(100, Math.round((consumed / target) * 100));

                                return (
                                    <div key={key} className={cn("rounded-2xl p-2.5 flex flex-col items-center justify-center border border-slate-100/50", bg)}>
                                        <div className={cn("text-base md:text-lg font-black tracking-tight leading-none mb-1", color)}>
                                            {displayValue}
                                            <span className="text-[9px] font-bold ml-0.5 opacity-60">{unit}</span>
                                        </div>
                                        <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden mb-1">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-500", barBg)}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            {label} Left
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Meal List */}
                <div className="space-y-3">
                    {meals.length === 0 ? (
                        <div className="text-center py-8 rounded-2xl border-2 border-dashed border-slate-100">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                                <Utensils className="h-5 w-5 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-500">No meals logged yet</p>
                            {!isDemo && (
                                <Button
                                    onClick={onAddMeal}
                                    variant="link"
                                    className="text-orange-500 font-bold text-xs"
                                >
                                    Start tracking
                                </Button>
                            )}
                        </div>
                    ) : (
                        meals.map((meal) => (
                            <div
                                key={meal.mealId}
                                className={cn(
                                    'group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-300',
                                    meal.isConsumed
                                        ? 'bg-emerald-50/30 border border-emerald-100/50'
                                        : 'bg-white border border-slate-100 hover:border-orange-100 hover:shadow-md hover:shadow-orange-500/5'
                                )}
                            >
                                {/* Checkbox */}
                                <button
                                    onClick={() => onToggleMeal(meal.mealId)}
                                    disabled={loadingMealId === meal.mealId}
                                    className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
                                        'border-2 flex-shrink-0',
                                        meal.isConsumed
                                            ? 'bg-emerald-500 border-emerald-500 scale-110'
                                            : 'border-slate-300 bg-white group-hover:border-orange-400'
                                    )}
                                >
                                    {meal.isConsumed && <Check className="h-3.5 w-3.5 text-white" strokeWidth={4} />}
                                </button>

                                {/* Meal Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-lg leading-none">{getMealIcon(meal.mealType)}</span>
                                            <span
                                                className={cn(
                                                    'font-bold text-sm truncate transition-colors',
                                                    meal.isConsumed ? 'text-emerald-900 line-through decoration-emerald-200' : 'text-slate-800'
                                                )}
                                            >
                                                {meal.mealName}
                                            </span>
                                        </div>

                                        {/* Actions (hidden for demo) */}
                                        {!isDemo && (
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                {meal.isFromPlan && !meal.isConsumed && (
                                                    <button
                                                        onClick={() => onSwapMeal(meal.mealId)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                {!meal.isFromPlan && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('Delete this meal?')) onDeleteMeal(meal.mealId);
                                                        }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Macros Row */}
                                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
                                        <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md font-bold">
                                            {Math.round(meal.calories)} kcal
                                        </span>
                                        <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
                                            <span className={cn(meal.isConsumed && "opacity-50")}>
                                                <span className="text-emerald-600 font-bold">{Math.round(meal.protein)}</span>p
                                            </span>
                                            <span className={cn(meal.isConsumed && "opacity-50")}>
                                                <span className="text-amber-600 font-bold">{Math.round(meal.carbs)}</span>c
                                            </span>
                                            <span className={cn(meal.isConsumed && "opacity-50")}>
                                                <span className="text-rose-600 font-bold">{Math.round(meal.fat)}</span>f
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
