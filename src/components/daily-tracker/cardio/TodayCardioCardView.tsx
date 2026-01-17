import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, Clock, Zap, Activity } from 'lucide-react';
import crossTrainerIcon from '@/assets/images/3dicons/cross-trainer.png';

export interface CardioDataView {
    name: string;
    type: string;
    intensity: string;
    duration: number;
    targetHeartRate?: {
        min: number;
        max: number;
        zone: string;
    } | null;
    caloriesBurned?: number;
}

export interface TodayCardioCardViewProps {
    cardioData: CardioDataView;
    status?: string | null;
    actualDuration?: number | null;
    onComplete?: (e: React.MouseEvent) => void;
    onSkip?: (e: React.MouseEvent) => void;
    isDemo?: boolean;
}

export function TodayCardioCardView({
    cardioData,
    status,
    actualDuration,
    onComplete,
    onSkip,
    isDemo = false,
}: TodayCardioCardViewProps) {
    const isCompleted = status === 'completed';
    const isSkipped = status === 'skipped';

    const { name, type, intensity, duration, targetHeartRate: targetHR, caloriesBurned: calories } = cardioData;

    // Get intensity color
    const getIntensityColor = () => {
        const intensityLower = (intensity || '').toLowerCase();
        if (intensityLower.includes('high') || intensityLower.includes('hiit')) {
            return {
                bg: 'from-rose-400 to-red-600',
                light: 'bg-rose-100 text-rose-700',
                text: 'text-rose-600',
            };
        }
        if (intensityLower.includes('low') || intensityLower.includes('zone 1')) {
            return {
                bg: 'from-teal-400 to-cyan-600',
                light: 'bg-teal-100 text-teal-700',
                text: 'text-teal-600',
            };
        }
        return {
            bg: 'from-rose-400 to-pink-600',
            light: 'bg-rose-100 text-rose-700',
            text: 'text-rose-600',
        };
    };

    const colors = getIntensityColor();

    return (
        <Card
            onClick={(!isCompleted && !isSkipped && onComplete) ? onComplete : undefined}
            className={cn(
                'rounded-3xl transition-all duration-300 overflow-hidden cursor-pointer group relative',
                isCompleted
                    ? 'border-0 bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_35px_60px_-15px_rgba(244,63,94,0.6),inset_0_2px_20px_rgba(255,255,255,0.5)]'
                    : isSkipped
                        ? 'border-slate-200 bg-slate-50/50 opacity-70'
                        : 'border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5'
            )}
        >
            <CardContent className="p-4 sm:p-6 relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 -ml-2">
                            <div className={cn("w-20 h-20 flex items-center justify-center transition-transform duration-500", isCompleted && "scale-110")}>
                                <img
                                    src={crossTrainerIcon}
                                    alt="Cardio"
                                    className={cn(
                                        "w-20 h-20 object-contain",
                                        isCompleted ? "drop-shadow-2xl" : "drop-shadow-xl"
                                    )}
                                />
                            </div>
                        </div>
                        <div className="pt-2">
                            <div
                                className={cn(
                                    'text-[11px] font-bold uppercase tracking-widest mb-1',
                                    isCompleted ? 'text-rose-100' : isSkipped ? 'text-slate-400' : 'text-rose-600/60'
                                )}
                            >
                                Cardio
                            </div>
                            <div
                                className={cn(
                                    'text-2xl font-black leading-none tracking-tight',
                                    isCompleted ? 'text-white' : isSkipped ? 'text-slate-500 line-through decoration-2' : 'text-slate-900'
                                )}
                            >
                                {name}
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onSkip) onSkip(e);
                        }}
                        className={cn(
                            'px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm',
                            isCompleted
                                ? 'bg-white/20 hover:bg-white/30 text-white border-0'
                                : isSkipped
                                    ? 'bg-slate-200 border-slate-300 text-slate-500'
                                    : 'bg-white border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50'
                        )}
                    >
                        {isCompleted ? 'Done' : isSkipped ? 'Skipped' : 'Skip'}
                    </button>
                </div>

                {/* Details Row */}
                <div className={cn(
                    "flex flex-wrap items-center gap-6 mb-6 pb-6 border-b mx-1",
                    isCompleted ? "border-white/20" : "border-slate-100"
                )}>
                    <div className={cn(
                        "flex items-center gap-2",
                        isCompleted ? "text-white" : "text-slate-600"
                    )}>
                        <Clock className={cn("h-4 w-4", isCompleted ? "text-rose-100" : "text-indigo-400")} />
                        <span className="text-sm font-medium">{actualDuration || duration} min</span>
                    </div>
                    <div className={cn(
                        "flex items-center gap-2",
                        isCompleted ? "text-white" : "text-slate-600"
                    )}>
                        <Activity className={cn("h-4 w-4", isCompleted ? "text-rose-100" : "text-rose-400")} />
                        <span className="text-sm font-medium">{type}</span>
                    </div>
                    {calories && (
                        <div className={cn(
                            "flex items-center gap-2",
                            isCompleted ? "text-white" : "text-slate-600"
                        )}>
                            <Zap className={cn("h-4 w-4", isCompleted ? "text-rose-100" : "text-amber-400")} />
                            <span className="text-sm font-medium">{calories} kcal</span>
                        </div>
                    )}
                </div>

                {/* Intensity & HR Zone */}
                <div className="flex flex-wrap gap-2 px-1">
                    <span
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold border',
                            isCompleted
                                ? 'bg-white/20 text-white border-white/20'
                                : isSkipped
                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                    : cn(colors.light, 'border-transparent')
                        )}
                    >
                        {intensity}
                    </span>
                    {targetHR && (
                        <span
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium border',
                                isCompleted
                                    ? 'bg-white/20 text-white border-white/20'
                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                            )}
                        >
                            ❤️ {targetHR.min}-{targetHR.max} bpm
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
