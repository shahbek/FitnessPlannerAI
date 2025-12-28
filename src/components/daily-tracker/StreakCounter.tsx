
import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Lottie from 'lottie-react';
import fireAnimation from '@/assets/lottieanimations/fire.json';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StreakCounterProps {
    workoutPlanId: string;
    isAuthFresh?: boolean;
}

export function StreakCounter({ workoutPlanId, isAuthFresh = false }: StreakCounterProps) {
    // Fetch history (limit 365 to catch long streaks)
    const history = useQuery(api.dailyTracking.getTrackingHistory,
        (isAuthFresh && workoutPlanId) ? {
            workoutPlanId: workoutPlanId as any,
            limit: 365
        } : 'skip'
    );

    const streak = useMemo(() => {
        // Handle loading state
        if (history === undefined) return null;
        if (history.length === 0) return 0;

        // Helper to check if a day counts as "active"
        const isDayActive = (entry: any) => {
            const hasConsumedMeals = entry.meals?.some((m: any) => m.isConsumed);
            const hasWorkout = entry.workoutStatus === 'completed';
            const hasCardio = entry.cardioStatus === 'completed';
            const hasWater = (entry.waterIntakeMl || 0) > 0;
            const hasWeight = (entry.bodyWeight || 0) > 0;

            return hasConsumedMeals || hasWorkout || hasCardio || hasWater || hasWeight;
        };

        // Helper to check if two dates are the same day (ignoring time)
        const isSameDay = (d1: Date, d2: Date) => {
            return d1.getFullYear() === d2.getFullYear() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getDate() === d2.getDate();
        };

        // Sort by date descending (newest first)
        const sorted = [...history].sort((a, b) => Number(b.date) - Number(a.date));

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        let currentStreak = 0;

        // Find matches for "today" and "yesterday"
        // We use isSameDay against the stored timestamp converted to a Date object
        const todayEntry = sorted.find(e => isSameDay(new Date(Number(e.date)), now));
        const yesterdayEntry = sorted.find(e => isSameDay(new Date(Number(e.date)), yesterday));

        let nextDateToCheck = now;

        if (todayEntry && isDayActive(todayEntry)) {
            // Streak includes today
            currentStreak = 1; // Count today
            nextDateToCheck = yesterday; // Start checking backwards from yesterday
        } else if (yesterdayEntry && isDayActive(yesterdayEntry)) {
            // Streak continues from yesterday
            currentStreak = 1; // Count yesterday (effectively)
            nextDateToCheck = new Date(yesterday);
            nextDateToCheck.setDate(nextDateToCheck.getDate() - 1); // Check day before yesterday
        } else {
            return 0;
        }

        // Now count backwards consecutively
        // We already counted the first day (today or yesterday)
        // nextDateToCheck is set to the *next* day we need to verify

        // Loop backwards
        while (true) {
            const entry = sorted.find(e => isSameDay(new Date(Number(e.date)), nextDateToCheck));
            if (entry && isDayActive(entry)) {
                currentStreak++;
                nextDateToCheck.setDate(nextDateToCheck.getDate() - 1); // Go back one more day
            } else {
                break;
            }
        }

        return currentStreak;
    }, [history]);

    // Don't show if 0? Or user said "as soon as you log one day... it will have 1".
    // If 0, maybe hide or show 0? "Simple counter... as soon as you log one day... it will have 1". 
    // Implies 0 might be hidden. I'll hide if 0 to keep it clean, or show 0 if they want to see the feature.
    // "streak... as soon as you log one day... it will have 1".
    if (streak === 0) return null;

    return (
        <div className="flex items-center justify-center mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-1">
                <span className="font-sans font-black text-5xl text-slate-800 leading-none pt-1">
                    {streak}
                </span>
                <div className="w-12 h-12">
                    <Lottie
                        animationData={fireAnimation}
                        loop={true}
                        autoplay={true}
                    />
                </div>
            </div>
        </div>
    );
}
