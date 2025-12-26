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
  isAuthFresh?: boolean;
}

import '@/components/daily-tracker/TodayHeader.css';

export function TodayPage({ workoutPlanId, planData, isAuthFresh = false }: TodayPageProps) {
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

  // DEBUG: Check parsed data meals
  React.useEffect(() => {
    if (parsedData?.weeklySchedule) {
      console.log('[DEBUG] Parsed Data Week Numbers:', parsedData.weeklySchedule.map(w => w.weekNumber));
    }
  }, [parsedData]);

  // Calculate week and day number from plan start
  const { weekNumber, dayNumber, dayName } = useMemo(() => {
    // Assume plan starts on Monday of the first week (UTC)
    const planCreated = planData?.startDate
      ? new Date(planData.startDate)
      : (planData?.createdAt ? new Date(planData.createdAt) : new Date());

    const planStartDate = new Date(planCreated);
    // Ensure we treat the plan start as UTC midnight
    planStartDate.setUTCHours(0, 0, 0, 0);

    // If the plan start wasn't already a Monday (legacy plans), find previous Monday
    const dayOfWeek = planStartDate.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    planStartDate.setUTCDate(planStartDate.getUTCDate() - daysToMonday);

    // Normalize selectedDate to UTC midnight of the same calendar day for comparison
    const selDateUTC = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    ));

    const diffTime = selDateUTC.getTime() - planStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const weekNum = Math.floor(diffDays / 7) + 1;
    const dayNum = (diffDays % 7) + 1;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIdx = selectedDate.getDay();
    const dayName = days[dayIdx === 0 ? 6 : dayIdx - 1];

    return {
      // Ensure we don't show negative weeks if users look at dates before the plan started
      weekNumber: Math.max(1, weekNum),
      dayNumber: Math.max(1, Math.min(7, dayNum)),
      dayName,
    };
  }, [selectedDate, planData]);

  // Get today's data from plan
  const todayPlanData = useMemo(() => {
    if (!parsedData?.weeklySchedule) return null;

    const weekData = parsedData.weeklySchedule.find(
      (w) => w.weekNumber === weekNumber
    );
    if (!weekData) return null;

    const dayData = weekData.days.find((d) => d.dayNumber === dayNumber);
    console.log(`[DEBUG] TodayPage Calculated: Week ${weekNumber}, Day ${dayNumber}. Found Data?`, !!dayData);
    if (dayData?.meals) {
      console.log('[DEBUG] TodayPage Plan Meals:', dayData.meals.map(m => m.mealName));
    }
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

  // Initialize tracking for the day (Only if auth is fresh)
  React.useEffect(() => {
    if (!workoutPlanId || !todayPlanData || !isAuthFresh) return;

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
  }, [workoutPlanId, dateTimestamp, weekNumber, dayNumber, todayPlanData, waterTarget, getOrCreate, isAuthFresh]);

  // Query tracking data
  const trackingData = useQuery(
    api.dailyTracking.getDailyTracking,
    (workoutPlanId && isAuthFresh)
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
  const { minDate, maxDate } = useMemo(() => {
    // Default to current date if no plan data
    const start = planData?.startDate
      ? new Date(planData.startDate)
      : (planData?.createdAt ? new Date(planData.createdAt) : new Date());

    // Ensure start date is set to midnight
    start.setHours(0, 0, 0, 0);

    // Calculate end date based on plan duration (default 12 weeks if not specified)
    const durationWeeks = parsedData?.phaseProgression?.reduce((acc, p) => acc + p.durationWeeks, 0) || 12;

    const end = new Date(start);
    end.setDate(start.getDate() + (durationWeeks * 7) - 1);
    end.setHours(23, 59, 59, 999);

    return { minDate: start, maxDate: end };
  }, [planData, parsedData]);

  const isPrevDisabled = selectedDate <= minDate;
  const isNextDisabled = selectedDate >= maxDate;

  const handlePrevDay = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setDate(selectedDate.getDate() - 1);

    if (prevDate >= minDate) {
      setSelectedDate(prevDate);
    }
  };

  const handleNextDay = () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + 1);

    if (nextDate <= maxDate) {
      setSelectedDate(nextDate);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < minDate) setSelectedDate(minDate);
    else if (today > maxDate) setSelectedDate(maxDate);
    else setSelectedDate(today);
  };

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
    if (direction === 'prev') handlePrevDay();
    else handleNextDay();
  };

  // Activation Mutation
  const activatePlan = useMutation(api.workoutPlans.activateWorkoutPlan);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    if (!workoutPlanId) return;
    setIsActivating(true);
    try {
      await activatePlan({ planId: workoutPlanId as any });
    } catch (err) {
      console.error('Failed to activate plan:', err);
    } finally {
      setIsActivating(false);
    }
  };

  const isPlanActive = !!planData?.startDate;

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

  return (
    <div className="min-h-screen pb-24 pt-2 relative">
      {/* Activation Overlay - Absolute to content (respects width) but sticky (stays in view) */}
      {!isPlanActive && (
        <div className="absolute inset-0 z-30 bg-white/60 dark:bg-black/60 backdrop-blur-sm rounded-3xl">
          <div className="sticky top-0 h-[calc(100vh-140px)] flex items-center justify-center p-4">
            <Card className="w-full max-w-sm shadow-2xl border-0 bg-white/90 backdrop-blur-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
              <CardContent className="p-8 text-center space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to Start?</h2>
                  <div className="space-y-3">
                    <p className="text-slate-500">
                      Activate your plan to sync the schedule with today's date.
                    </p>
                    <p className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-1.5 rounded-lg inline-block border border-rose-100">
                      Note: Action is irreversible.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleActivate}
                  disabled={isActivating}
                  className="w-full h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 rounded-xl"
                >
                  {isActivating ? 'Activating...' : 'Activate Plan Now'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Floating Header */}
      <div className={cn("sticky top-4 z-40 px-2 sm:px-4 mb-4 transition-all duration-500")}>
        <div
          className="liquid-header transition-all transform hover:scale-[1.01]"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-full hover:bg-black/5", isPrevDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent")}
              onClick={() => navigateDate('prev')}
              disabled={isPrevDisabled}
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <div className="text-center min-w-[120px]">
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">
                Week {weekNumber}
              </div>
              <div className="text-sm font-bold text-slate-900 leading-none mb-1">
                {formatDateDisplay(selectedDate)}
              </div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                {dayName}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-full hover:bg-black/5", isNextDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent")}
              onClick={() => navigateDate('next')}
              disabled={isNextDisabled}
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </Button>
          </div>

          {/* Progress Ring */}
          <div className="relative">
            <DailyProgressRing progress={overallProgress} size={42} strokeWidth={4} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "px-2 sm:px-4 max-w-lg mx-auto space-y-4 transition-all duration-500",
        isLoading ? "opacity-60 pointer-events-none" : "opacity-100",
        !isPlanActive && "pointer-events-none"
      )}>
        {/* Quick Stats Bar */}
        <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <CardContent className="p-4 sm:p-6">
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


