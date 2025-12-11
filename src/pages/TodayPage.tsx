import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { DailyProgressRing } from '@/components/daily-tracker/DailyProgressRing';
import { TodayWorkoutCard } from '@/components/daily-tracker/TodayWorkoutCard';
import { TodayCardioCard } from '@/components/daily-tracker/TodayCardioCard';
import { TodayMealsSection } from '@/components/daily-tracker/TodayMealsSection';
import { TodayHydrationCard } from '@/components/daily-tracker/TodayHydrationCard';
import { TodayWeightCard } from '@/components/daily-tracker/TodayWeightCard';
import { parseWorkoutData } from '@/utils/workoutDataParser';
import { cn } from '@/lib/utils';
import { getTDEE, estimateResistanceCalories } from '@/utils/planCalculations';

interface TodayPageProps {
  workoutPlanId?: string;
  planData?: any;
}

import '@/components/daily-tracker/TodayHeader.css';

export function TodayPage({ workoutPlanId, planData }: TodayPageProps) {
  // Date state
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const dateTimestamp = selectedDate.getTime();

  // Parse plan data
  const parsedData = useMemo(() => {
    if (!planData) return null;
    return parseWorkoutData(planData);
  }, [planData]);

  // Calculate week and day number from plan start
  const { weekNumber, dayNumber, dayName } = useMemo(() => {
    // Assume plan starts on Monday of the first week
    const planStartDate = new Date();
    planStartDate.setHours(0, 0, 0, 0);
    // Find the previous Monday
    const dayOfWeek = planStartDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    planStartDate.setDate(planStartDate.getDate() - daysToMonday);

    const diffTime = selectedDate.getTime() - planStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const weekNum = Math.floor(diffDays / 7) + 1;
    const dayNum = (diffDays % 7) + 1;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIdx = selectedDate.getDay();
    const dayName = days[dayIdx === 0 ? 6 : dayIdx - 1];

    return {
      weekNumber: Math.max(1, weekNum),
      dayNumber: Math.max(1, Math.min(7, dayNum)),
      dayName,
    };
  }, [selectedDate]);

  // Get today's data from plan
  const todayPlanData = useMemo(() => {
    if (!parsedData?.weeklySchedule) return null;

    const weekData = parsedData.weeklySchedule.find(
      (w) => w.weekNumber === weekNumber
    );
    if (!weekData) return null;

    const dayData = weekData.days.find((d) => d.dayNumber === dayNumber);
    return dayData || null;
  }, [parsedData, weekNumber, dayNumber]);

  // Get user profile from plan
  const userProfile = useMemo(() => {
    return planData?.userProfile || {};
  }, [planData]);

  // Calculate water target based on weight
  const waterTarget = useMemo(() => {
    const weight = userProfile?.weight || 80;
    return Math.round(weight * 33); // 33ml per kg
  }, [userProfile]);

  // Get cardio data for today
  const cardioData = useMemo(() => {
    if (!planData?.weeklyCardioSchedules) return null;

    const weekSchedule = planData.weeklyCardioSchedules.find(
      (s: any) => s.weekNumber === weekNumber
    );
    if (!weekSchedule?.sessions) return null;

    return weekSchedule.sessions.find((s: any) => s.dayNumber === dayNumber);
  }, [planData, weekNumber, dayNumber]);

  // Get or create daily tracking
  const getOrCreate = useMutation(api.dailyTracking.getOrCreateDailyTracking);

  // Initialize tracking for the day
  React.useEffect(() => {
    if (!workoutPlanId || !todayPlanData) return;

    const targetMacros = todayPlanData.dailyMacros
      ? {
        calories: todayPlanData.dailyMacros.totalCalories,
        protein: todayPlanData.dailyMacros.protein,
        carbs: todayPlanData.dailyMacros.carbs,
        fat: todayPlanData.dailyMacros.fat,
      }
      : undefined;

    const plannedMeals = todayPlanData.meals?.map((meal) => ({
      mealId: meal.mealId,
      mealName: meal.mealName,
      mealType: meal.mealType,
      calories: meal.calories,
      protein: meal.macros.protein,
      carbs: meal.macros.carbs,
      fat: meal.macros.fat,
    }));

    getOrCreate({
      workoutPlanId: workoutPlanId as any,
      date: dateTimestamp,
      weekNumber,
      dayNumber,
      targetMacros,
      waterTarget,
      plannedMeals,
    }).catch((err) => {
      console.error('Failed to init daily tracking:', err);
    });
  }, [workoutPlanId, dateTimestamp, weekNumber, dayNumber, todayPlanData, waterTarget, getOrCreate]);

  // Query tracking data
  const trackingData = useQuery(
    api.dailyTracking.getDailyTracking,
    workoutPlanId
      ? { workoutPlanId: workoutPlanId as any, date: dateTimestamp }
      : 'skip'
  );

  const isLoading = trackingData === undefined;

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!trackingData) return 0;

    let completed = 0;
    let total = 0;

    // Workout (25%)
    total += 25;
    if (trackingData.workoutStatus === 'completed') completed += 25;

    // Cardio (15%)
    if (cardioData) {
      total += 15;
      if (trackingData.cardioStatus === 'completed') completed += 15;
    }

    // Meals (40%)
    const mealsCount = trackingData.meals?.length || 0;
    const mealsConsumed = trackingData.meals?.filter((m) => m.isConsumed).length || 0;
    if (mealsCount > 0) {
      total += 40;
      completed += (mealsConsumed / mealsCount) * 40;
    }

    // Water (15%)
    total += 15;
    const waterProgress = Math.min(
      1,
      (trackingData.waterIntakeMl || 0) / (trackingData.waterTarget || 3000)
    );
    completed += waterProgress * 15;

    // Weight (5%)
    total += 5;
    if (trackingData.bodyWeight) completed += 5;

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [trackingData, cardioData]);

  // Calculate consumed macros
  const consumedMacros = useMemo(() => {
    if (!trackingData?.meals) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    return trackingData.meals
      .filter((m) => m.isConsumed)
      .reduce(
        (acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + meal.protein,
          carbs: acc.carbs + meal.carbs,
          fat: acc.fat + meal.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
  }, [trackingData]);

  // Calculate live energy balance (Deficit/Surplus)
  const dailyDeficit = useMemo(() => {
    // 1. Get TDEE
    const tdee = getTDEE(planData, userProfile) || 2000;

    // 2. Calculate Exercise Burn
    let resistanceBurn = 0;
    if (trackingData?.workoutStatus === 'completed') {
      // Estimate based on plan data or default
      const duration = todayPlanData?.workouts?.[0]?.duration || 60;
      const weight = userProfile?.weight || 70;
      resistanceBurn = estimateResistanceCalories(duration, weight, 'moderate');
    }

    let cardioBurn = 0;
    if (trackingData?.cardioStatus === 'completed' && cardioData) {
      // Use template calories or tracked duration
      cardioBurn = cardioData.cardioTemplate?.caloriesBurned ||
        (cardioData.cardioTemplate?.durationMinutes ? cardioData.cardioTemplate.durationMinutes * 8 : 300);
    }

    // 3. Calculate Balance: (TDEE + Exercise) - Consumed
    // Positive = Deficit (Weight Loss)
    // Negative = Surplus (Weight Gain)
    return (tdee + resistanceBurn + cardioBurn) - consumedMacros.calories;
  }, [planData, userProfile, trackingData, todayPlanData, cardioData, consumedMacros]);

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  if (!workoutPlanId || !planData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Calendar className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">No Active Plan</h2>
        <p className="text-slate-500 text-center max-w-sm">
          Select a workout plan to start tracking your daily progress.
        </p>
      </div>
    );
  }

  const filterId = "header-liquid-filter";

  return (
    <div className="min-h-screen pb-24 pt-2">
      {/* SVG Filter for Liquid Glass Effect */}
      <svg
        width="0"
        height="0"
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          pointerEvents: 'none',
          zIndex: -1
        }}
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            filterUnits="objectBoundingBox"
            primitiveUnits="objectBoundingBox"
            colorInterpolationFilters="sRGB"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feImage
              href={`data:image/svg+xml,${encodeURIComponent(`
                <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="center-mask" cx="50%" cy="50%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="60%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </radialGradient>
                    <linearGradient id="edge-top" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#000000" />
                      <stop offset="8%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#808080" />
                    </linearGradient>
                    <linearGradient id="edge-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="92%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </linearGradient>
                    <linearGradient id="edge-left" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#000000" />
                      <stop offset="8%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#808080" />
                    </linearGradient>
                    <linearGradient id="edge-right" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="92%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="100" fill="#808080" rx="50" />
                  <rect width="400" height="100" fill="url(#center-mask)" rx="50" />
                  <rect width="400" height="100" fill="url(#edge-top)" rx="50" />
                  <rect width="400" height="100" fill="url(#edge-bottom)" rx="50" />
                  <rect width="400" height="100" fill="url(#edge-left)" rx="50" style="mix-blend-mode: multiply" />
                  <rect width="400" height="100" fill="url(#edge-right)" rx="50" style="mix-blend-mode: multiply" />
                  <rect width="400" height="100" fill="#808080" rx="50" style="filter: blur(2px); opacity: 0.3" />
                </svg>
              `)}`}
              preserveAspectRatio="none"
              result="borderMap"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.03"
              numOctaves="2"
              seed="5"
              result="turbulence"
            />
            <feGaussianBlur in="turbulence" stdDeviation="1.5" result="noise" />
            <feComposite in="noise" in2="borderMap" operator="multiply" result="combinedMap" />
            <feGaussianBlur in="combinedMap" stdDeviation="0.8" result="displacementMap" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="displacementMap"
              scale="8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Floating Header */}
      <div className="sticky top-4 z-40 px-4 mb-4">
        <div
          className="liquid-header transition-all transform hover:scale-[1.01]"
          style={{
            backdropFilter: `url("#${filterId}") blur(1px) saturate(120%) brightness(1)`,
            WebkitBackdropFilter: `url("#${filterId}") blur(1px) saturate(120%) brightness(1)`,
            '--liquid-filter': `url("#${filterId}")`,
          } as React.CSSProperties & { '--liquid-filter': string }}
        >
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-black/5"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <div className="text-center min-w-[120px]">
              <div className="text-sm font-bold text-slate-900">
                {formatDateDisplay(selectedDate)}
              </div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                {dayName}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-black/5"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </Button>
          </div>

          {/* Progress Ring with mini skeleton when loading */}
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-full">
                <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
              </div>
            )}
            <DailyProgressRing progress={overallProgress} size={42} strokeWidth={4} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn("px-4 max-w-lg mx-auto space-y-4 transition-opacity duration-300", isLoading ? "opacity-60 pointer-events-none" : "opacity-100")}>
        {/* Quick Stats Bar */}
        <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <CardContent className="p-6">
            {/* Live Energy Balance */}
            <div className="flex flex-col items-center justify-center mb-6 pb-6 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Live Energy Balance
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-6xl font-black tracking-tighter bg-clip-text text-transparent transform -ml-4",
                    dailyDeficit > 0
                      ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600"
                      : "bg-gradient-to-br from-rose-400 via-pink-500 to-orange-500"
                  )}
                >
                  {dailyDeficit > 0 ? '-' : '+'}{Math.abs(Math.round(dailyDeficit))}
                </span>
                <span className="text-base font-bold text-slate-300">kcal</span>
              </div>
              <span className={cn(
                "text-xs font-bold mt-3 px-4 py-1.5 rounded-full shadow-md transition-all border",
                dailyDeficit > 0
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white border-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]"
                  : "bg-gradient-to-br from-rose-400 to-rose-600 text-white border-rose-400 shadow-[0_2px_8px_rgba(244,63,94,0.4),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]"
              )}>
                {dailyDeficit > 0 ? "Deficit (Weight Loss)" : "Surplus (Weight Gain)"}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="flex flex-col gap-1">
                <div className="text-2xl font-black font-sans tracking-tight text-slate-800">
                  {Math.round(consumedMacros.calories)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Cal
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-2xl font-black font-sans tracking-tight text-emerald-500">
                  {Math.round(consumedMacros.protein)}g
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pro
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-2xl font-black font-sans tracking-tight text-amber-500">
                  {Math.round(consumedMacros.carbs)}g
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Carb
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-2xl font-black font-sans tracking-tight text-rose-500">
                  {Math.round(consumedMacros.fat)}g
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fat
                </div>
              </div>
            </div>

            {/* Target comparison bar */}
            {trackingData?.targetMacros && (
              <div className="mt-5 pt-4 border-t border-slate-100/60">
                <div className="flex justify-between text-xs font-medium text-slate-500">
                  <span>
                    {Math.round(consumedMacros.calories)} / {trackingData.targetMacros.calories} kcal
                  </span>
                  <span
                    className={
                      consumedMacros.calories >= trackingData.targetMacros.calories * 0.9
                        ? 'text-emerald-600'
                        : consumedMacros.calories >= trackingData.targetMacros.calories * 0.75
                          ? 'text-amber-600'
                          : 'text-slate-500'
                    }
                  >
                    {Math.round((consumedMacros.calories / trackingData.targetMacros.calories) * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    style={{
                      width: `${Math.min(100, (consumedMacros.calories / trackingData.targetMacros.calories) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workout Card */}
        <TodayWorkoutCard
          workoutPlanId={workoutPlanId}
          date={dateTimestamp}
          workoutData={todayPlanData?.workouts?.[0]}
          status={trackingData?.workoutStatus}
          isRestDay={todayPlanData?.restDay}
        />

        {/* Cardio Card */}
        {cardioData && (
          <TodayCardioCard
            workoutPlanId={workoutPlanId}
            date={dateTimestamp}
            cardioData={cardioData}
            status={trackingData?.cardioStatus}
            actualDuration={trackingData?.cardioDurationActual}
          />
        )}

        {/* Meals Section */}
        <TodayMealsSection
          workoutPlanId={workoutPlanId}
          date={dateTimestamp}
          meals={trackingData?.meals || []}
          targetMacros={trackingData?.targetMacros}
          consumedMacros={consumedMacros}
        />

        {/* Hydration Card */}
        <TodayHydrationCard
          workoutPlanId={workoutPlanId}
          date={dateTimestamp}
          currentIntake={trackingData?.waterIntakeMl || 0}
          target={trackingData?.waterTarget || waterTarget}
          logs={trackingData?.waterLogs || []}
        />

        {/* Weight Card */}
        <TodayWeightCard
          workoutPlanId={workoutPlanId}
          date={dateTimestamp}
          currentWeight={trackingData?.bodyWeight}
          previousWeight={trackingData?.previousWeight}
          userWeight={userProfile?.weight}
        />
      </div>
    </div>
  );
}


