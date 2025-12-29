import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Activity, Zap, Coffee, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DailyTimeline } from './DailyTimeline';
import { calculateWeeklyDeficitSummary, getTDEE, WeeklyDeficitSummary } from '@/utils/planCalculations';
import { getAverageDailyTargets } from '@/utils/planTargets';

interface WeeklyProgressionTimelineProps {
  plan: any;
  weeklySchedule?: any[];
}

interface DaySchedule {
  day: string;
  dayLetter: string;
  type: 'resistance' | 'cardio' | 'hybrid' | 'rest';
  workoutDetails?: {
    sessionName?: string;
    targetMuscles?: string[];
    exercises?: Array<{
      name: string;
      sets?: number;
      reps?: string;
    }>;
  };
  cardioDetails?: {
    type?: string;
    duration?: number;
    intensity?: string;
    template?: any; // Full CardioTemplate for detailed info
    timing?: string; // 'morning' | 'afternoon' | 'evening' | 'post_workout'
  };
}

interface TimelineEvent {
  time: string;
  type: 'meal' | 'workout' | 'cardio' | 'rest';
  emoji: string;
  label: string;
  details?: string;
}

interface WeekData {
  weekNumber: number;
  phase: string;
  focus: string;
  schedule: DaySchedule[];
  targets: {
    calories: number;
    protein: number;
  };
  notes?: string;
  selectedDay?: string;
  selectedDayTimeline?: TimelineEvent[];
  deficitSummary?: WeeklyDeficitSummary | null;
}

export function WeeklyProgressionTimeline({ plan, weeklySchedule }: WeeklyProgressionTimelineProps) {
  const [selectedDays, setSelectedDays] = useState<Record<number, string>>({});
  // Track which day tooltip is open (for click support on mobile)
  const [openDayTooltip, setOpenDayTooltip] = useState<string | null>(null);
  // Track which deficit tooltip is open
  const [openDeficitTooltip, setOpenDeficitTooltip] = useState<number | null>(null);

  const weeklyOutlines = Array.isArray(plan?.weeklyOutlines) ? plan.weeklyOutlines : [];

  // Debug Logging for Verification
  React.useEffect(() => {
    if (weeklyOutlines.length > 0 && plan?.userProfile) {
      console.group('📊 WEEKLY PROGRESSION VERIFICATION LOG');
      console.log('Timestamp:', new Date().toISOString());
      console.log('User TDEE:', getTDEE(plan));

      weeklyOutlines.forEach((week: any) => {
        const tdee = getTDEE(plan) || 2000;
        const deficitSummary = calculateWeeklyDeficitSummary(
          week.weekNumber,
          tdee,
          weeklySchedule || [],
          plan,
          plan.userProfile.weight || 70
        );

        console.group(`Week ${week.weekNumber} Breakdown`);
        console.log('Phase:', week.phase);

        // Log Cardio & Resistance Inputs
        const resistanceDays = week.trainingSchedule?.resistanceDays || [];
        const cardioSchedule = plan?.weeklyCardioSchedules?.find((s: any) => s.weekNumber === week.weekNumber);

        console.log('Res Days:', resistanceDays.length, 'Cardio Sessions:', cardioSchedule?.sessions?.length || 0);

        if (deficitSummary) {
          console.table(deficitSummary.dailyDeficits.map((d: any) => ({
            Day: d.day,
            'Intake (In)': d.caloriesConsumed,
            'TDEE (Base)': tdee,
            'Res Burn (Est)': d.resistanceCalories,
            'Cardio Burn': d.cardioCalories,
            'Total Out': tdee + d.resistanceCalories + d.cardioCalories,
            'NET DEFICIT': d.deficit
          })));
          console.log(`Weekly Total Deficit: ${deficitSummary.totalWeeklyDeficit}`);
        } else {
          console.warn('Could not calculate deficit summary');
        }
        console.groupEnd();
      });
      console.groupEnd();
    }
  }, [plan, weeklyOutlines, weeklySchedule]);

  if (weeklyOutlines.length === 0) {
    return (
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground">
            No weekly progression data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDayLetter = (day: string): string => {
    const dayMap: Record<string, string> = {
      'Monday': 'M',
      'Tuesday': 'T',
      'Wednesday': 'W',
      'Thursday': 'T',
      'Friday': 'F',
      'Saturday': 'S',
      'Sunday': 'S'
    };
    return dayMap[day] || day.charAt(0);
  };

  const getMealEmoji = (mealType: string): string => {
    const type = mealType.toLowerCase();
    if (type.includes('breakfast')) return '🍳';
    if (type.includes('lunch')) return '🥗';
    if (type.includes('dinner')) return '🍗';
    if (type.includes('snack') || type.includes('pre-workout')) return '🍌';
    if (type.includes('post-workout')) return '🥤';
    return '🍎';
  };

  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours + minutes / 60;
  };

  const buildDayTimeline = (weekNumber: number, day: string, weeklySchedule?: any[], week?: any): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    const scheduleWeek = weeklySchedule?.find((w: any) => w.weekNumber === weekNumber);
    if (!scheduleWeek || !scheduleWeek.days) return events;

    const scheduleDay = scheduleWeek.days.find((d: any) => d.day === day);
    if (!scheduleDay) return events;

    // Get detailed cardio schedule from CardioGenerationService (the ONLY source of truth)
    const weeklyCardioSchedules = plan?.weeklyCardioSchedules || [];
    const weekCardioSchedule = weeklyCardioSchedules.find((s: any) => s.weekNumber === weekNumber);
    const dayCardioSessions = weekCardioSchedule?.sessions?.filter((s: any) =>
      s.dayName === day || s.dayNumber === (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day) + 1)
    ) || [];

    // Cardio is determined ONLY by actual sessions from CardioGenerationService
    // NOT from placeholder trainingSchedule.cardioDays

    const getMealTiming = (mealType: string): string => {
      const type = mealType.toLowerCase();
      if (type.includes('breakfast')) return '7:00 AM';
      if (type.includes('lunch')) return '1:00 PM';
      if (type.includes('dinner')) return '7:00 PM';
      if (type.includes('mid-morning') || type.includes('snack') && type.includes('morning')) return '10:00 AM';
      if (type.includes('mid-afternoon') || type.includes('snack') && type.includes('afternoon')) return '4:00 PM';
      if (type.includes('pre-workout')) return '11:30 AM';
      if (type.includes('post-workout')) return '3:30 PM';
      if (type.includes('evening') || type.includes('snack')) return '9:00 PM';
      return '12:00 PM';
    };

    if (scheduleDay.meals && Array.isArray(scheduleDay.meals)) {
      scheduleDay.meals.forEach((meal: any) => {
        const timing = meal.timing || meal.time || getMealTiming(meal.mealType);
        events.push({
          time: timing,
          type: 'meal',
          emoji: getMealEmoji(meal.mealType),
          label: meal.mealType,
          details: `${Math.round(meal.calories)} cal`
        });
      });
    }

    if (scheduleDay.workouts && scheduleDay.workouts.length > 0) {
      events.push({
        time: '5:30 PM',
        type: 'workout',
        emoji: '🏋️',
        label: 'Workout',
        details: scheduleDay.workouts[0]?.sessionName || 'Training'
      });
    }

    // Only show cardio if there are actual sessions from CardioGenerationService
    if (dayCardioSessions.length > 0) {
      dayCardioSessions.forEach((session: any) => {
        const template = session.cardioTemplate;
        if (!template) {
          console.warn(`[DayTimeline] Week ${weekNumber}, ${day}: Missing cardioTemplate in session`);
          return;
        }

        // NO FALLBACK VALUES: All data must come from CardioGenerationService
        const sessionName = template.name || template.type;
        const sessionType = template.type;
        const sessionDuration = template.durationMinutes || template.totalDurationMinutes;
        const sessionIntensity = template.intensity;

        // Determine timing based on session timing
        let cardioTime = '5:30 PM';
        if (session.timing === 'morning') cardioTime = '7:00 AM';
        else if (session.timing === 'afternoon') cardioTime = '2:00 PM';
        else if (session.timing === 'evening') cardioTime = '6:00 PM';
        else if (session.timing === 'post_workout') {
          cardioTime = scheduleDay.workouts && scheduleDay.workouts.length > 0 ? '6:30 PM' : '5:30 PM';
        }

        let cardioDetailsStr = sessionName || 'Cardio';
        if (sessionType && sessionType !== sessionName) cardioDetailsStr += ` (${sessionType})`;
        if (sessionDuration) cardioDetailsStr += ` - ${sessionDuration} min`;
        if (sessionIntensity) cardioDetailsStr += ` @ ${sessionIntensity}`;

        if (template.caloriesBurned) {
          cardioDetailsStr += ` (~${Math.round(template.caloriesBurned)} cal)`;
        }

        events.push({
          time: cardioTime,
          type: 'cardio',
          emoji: '🏃',
          label: sessionName || 'Cardio',
          details: cardioDetailsStr
        });
      });
    }

    events.sort((a, b) => parseTime(a.time) - parseTime(b.time));

    return events;
  };

  const buildWeekSchedule = (week: any, weeklySchedule?: any[]): DaySchedule[] => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const trainingSchedule = week.trainingSchedule || {};
    const resistanceDays = trainingSchedule.resistanceDays || [];

    // Get detailed cardio schedule from CardioGenerationService (the ONLY source of truth)
    const weeklyCardioSchedules = plan?.weeklyCardioSchedules || [];
    const weekCardioSchedule = weeklyCardioSchedules.find((s: any) => s.weekNumber === week.weekNumber);

    // Build a set of actual cardio days from weeklyCardioSchedules
    // This is the REAL cardio data, NOT the placeholder trainingSchedule.cardioDays
    const actualCardioDays = new Set<string>();
    if (weekCardioSchedule?.sessions) {
      weekCardioSchedule.sessions.forEach((session: any) => {
        if (session.dayName) {
          actualCardioDays.add(session.dayName);
        } else if (session.dayNumber) {
          // Convert dayNumber to day name
          const dayName = days[session.dayNumber - 1];
          if (dayName) actualCardioDays.add(dayName);
        }
      });
    }

    const scheduleWeek = weeklySchedule?.find((w: any) => w.weekNumber === week.weekNumber);

    return days.map((day, dayIndex) => {
      const isResistance = resistanceDays.includes(day);
      // Use ACTUAL cardio days from CardioGenerationService, not placeholder data
      const hasCardioSession = actualCardioDays.has(day);

      let type: 'resistance' | 'cardio' | 'hybrid' | 'rest';
      if (isResistance && hasCardioSession) {
        type = 'hybrid';
      } else if (isResistance) {
        type = 'resistance';
      } else if (hasCardioSession) {
        type = 'cardio';
      } else {
        type = 'rest';
      }

      let workoutDetails = undefined;
      let cardioDetails = undefined;

      if (scheduleWeek && scheduleWeek.days) {
        const scheduleDay = scheduleWeek.days.find((d: any) =>
          d.day === day || d.dayNumber === (dayIndex + 1)
        );

        if (scheduleDay && isResistance) {
          const dayWorkouts = scheduleDay.workouts || [];
          if (dayWorkouts.length > 0) {
            const allExercises: any[] = [];
            const allTargetMuscles: Set<string> = new Set();
            let sessionNames: string[] = [];

            dayWorkouts.forEach((workout: any) => {
              if (workout.sessionName) sessionNames.push(workout.sessionName);
              if (workout.targetMuscles) {
                workout.targetMuscles.forEach((m: string) => allTargetMuscles.add(m));
              }
              if (workout.exercises) {
                allExercises.push(...workout.exercises);
              }
            });

            workoutDetails = {
              sessionName: sessionNames.join(' + ') || `${day} Workout`,
              targetMuscles: Array.from(allTargetMuscles),
              exercises: allExercises.map((ex: any) => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps
              }))
            };
          }
        }
      }

      // Get cardio details from the actual CardioGenerationService data
      if (hasCardioSession) {
        const dayCardioSession = weekCardioSchedule?.sessions?.find((s: any) =>
          s.dayName === day || s.dayNumber === (dayIndex + 1)
        );

        if (dayCardioSession && dayCardioSession.cardioTemplate) {
          const template = dayCardioSession.cardioTemplate;
          cardioDetails = {
            type: template.name || template.type,
            duration: template.durationMinutes || template.totalDurationMinutes,
            intensity: template.intensity,
            template: template, // Store full template for tooltip
            timing: dayCardioSession.timing
          };
        }
      }

      return {
        day,
        dayLetter: getDayLetter(day),
        type,
        workoutDetails,
        cardioDetails
      };
    });
  };

  const extractFocus = (objectives: string[]): string => {
    if (!objectives || objectives.length === 0) return 'Progressive Training';
    return objectives[0];
  };

  // Get TDEE from plan metrics or calculate from user profile
  const tdee = useMemo(() => {
    return getTDEE(plan, plan?.userProfile) || 2200; // Fallback to reasonable default
  }, [plan]);

  // Get user weight for resistance calorie calculations
  const userWeightKg = useMemo(() => {
    return plan?.userProfile?.weight || plan?.userProfile?.weightKg || 70; // Fallback default
  }, [plan]);

  const transformWeekData = (week: any, weeklySchedule?: any[]): WeekData => {
    const dailyTargets = getAverageDailyTargets(week);
    const schedule = buildWeekSchedule(week, weeklySchedule);

    const selectedDay = selectedDays[week.weekNumber];
    let dayToShow = selectedDay;

    if (!dayToShow) {
      const firstResistanceDay = schedule.find(d => d.type === 'resistance');
      dayToShow = firstResistanceDay?.day || schedule[0]?.day || 'Monday';
    }

    const selectedDayTimeline = dayToShow
      ? buildDayTimeline(week.weekNumber, dayToShow, weeklySchedule, week)
      : [];

    // Calculate weekly deficit summary
    const deficitSummary = weeklySchedule
      ? calculateWeeklyDeficitSummary(week.weekNumber, tdee, weeklySchedule, plan, userWeightKg)
      : null;

    return {
      weekNumber: week.weekNumber,
      phase: week.phase || 'Training',
      focus: extractFocus(week.objectives),
      schedule,
      targets: {
        calories: dailyTargets.calories || 0,
        protein: dailyTargets.protein || 0
      },
      notes: week.specialNotes || week.adjustments,
      selectedDay: dayToShow,
      selectedDayTimeline,
      deficitSummary
    };
  };

  const getPhaseColor = (phase: string) => {
    const phaseLower = phase?.toLowerCase() || '';
    if (phaseLower.includes('foundation')) return 'bg-gradient-to-br from-blue-300 to-blue-500 text-white border-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]';
    if (phaseLower.includes('hypertrophy')) return 'bg-gradient-to-br from-emerald-300 to-emerald-600 text-white border-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]';
    if (phaseLower.includes('strength')) return 'bg-gradient-to-br from-purple-400 to-purple-700 text-white border-purple-500 shadow-[0_2px_8px_rgba(147,51,234,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]';
    if (phaseLower.includes('taper') || phaseLower.includes('definition')) return 'bg-gradient-to-br from-amber-300 to-orange-600 text-white border-orange-400 shadow-[0_2px_8px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]';
    return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white border-gray-400 shadow-[0_2px_8px_rgba(107,114,128,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]';
  };

  const getDayIcon = (type: string) => {
    const iconSize = 16;
    switch (type) {
      case 'resistance':
        return <Dumbbell size={iconSize} />;
      case 'cardio':
        return <Activity size={iconSize} />;
      case 'hybrid':
        return <Zap size={iconSize} />;
      case 'rest':
        return <Coffee size={iconSize} className="text-slate-600" />;
      default:
        return null;
    }
  };

  const getDayStyles = (type: string) => {
    const baseStyle = `
      relative overflow-hidden
      transition-all duration-200 ease-out
      shadow-[inset_0_3px_6px_rgba(0,0,0,0.12),inset_0_-2px_4px_rgba(255,255,255,0.9),0_6px_20px_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.1)]
      hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,1),0_8px_24px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.12)]
      active:shadow-[inset_0_4px_12px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.15)]
      active:translate-y-[1px] active:scale-[0.96]
      before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/50 before:via-transparent before:to-transparent before:rounded-[60%] before:pointer-events-none
      after:content-[''] after:absolute after:top-[4px] after:left-[12%] after:right-[12%] after:h-[40%] after:bg-gradient-to-b after:from-white/70 after:via-white/30 after:to-transparent after:rounded-[70%] after:blur-[3px] after:pointer-events-none
    `;

    const squircleRadius = 'rounded-[60%]';

    switch (type) {
      case 'resistance':
        return `${baseStyle} ${squircleRadius} bg-gradient-to-br from-purple-300 via-purple-500 to-purple-700 ring-2 ring-purple-400/50 ring-inset text-white`;
      case 'cardio':
        return `${baseStyle} ${squircleRadius} bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 ring-2 ring-orange-400/50 ring-inset text-white`;
      case 'hybrid':
        return `${baseStyle} ${squircleRadius} bg-gradient-to-br from-fuchsia-300 via-pink-500 to-orange-600 ring-2 ring-pink-400/50 ring-inset text-white`;
      case 'rest':
        return `${baseStyle} ${squircleRadius} bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 ring-2 ring-slate-300/50 ring-inset text-slate-700`;
      default:
        return `${baseStyle} ${squircleRadius} bg-gradient-to-br from-gray-200 via-gray-300 to-gray-500 ring-2 ring-gray-300/50 ring-inset text-gray-600`;
    }
  };

  const weeklyData = weeklyOutlines.map((week: any) => transformWeekData(week, weeklySchedule));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Weekly Progression</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {weeklyData.map((week: WeekData) => (
          <Card
            key={week.weekNumber}
            className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.08),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-visible aspect-square flex flex-col"
          >
            <CardContent className="p-4 flex flex-col flex-1 justify-between">
              {/* Header: Week number and phase */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">WEEK {week.weekNumber}</span>
                    <Badge className={`${getPhaseColor(week.phase)} rounded-full px-3 py-1 text-xs font-bold`}>
                      {week.phase}
                    </Badge>
                  </div>
                </div>
                {week.notes && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-slate-500 hover:text-slate-700 transition-colors">
                          <Info size={16} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs rounded-lg">
                        <p className="text-xs">{week.notes}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="flex justify-between gap-1">
                {week.schedule.map((daySchedule: DaySchedule, idx: number) => {
                  const hasDetails = daySchedule.workoutDetails || daySchedule.cardioDetails;

                  const tooltipContent = (
                    <div className="space-y-2">
                      <div className="font-semibold text-lg text-slate-800" style={{ fontFamily: 'ITC Garamond Std, Garamond, serif' }}>{daySchedule.day}</div>

                      {daySchedule.workoutDetails && (
                        <div className="space-y-1.5">
                          {daySchedule.workoutDetails.sessionName && (
                            <div className="text-xs font-semibold text-purple-700">{daySchedule.workoutDetails.sessionName}</div>
                          )}
                          {daySchedule.workoutDetails.targetMuscles && daySchedule.workoutDetails.targetMuscles.length > 0 && (
                            <div className="text-xs text-slate-600">
                              Target: {daySchedule.workoutDetails.targetMuscles.join(', ')}
                            </div>
                          )}
                          {daySchedule.workoutDetails.exercises && daySchedule.workoutDetails.exercises.length > 0 && (
                            <div className="space-y-0.5 mt-1.5 pt-1.5 border-t border-slate-100">
                              {daySchedule.workoutDetails.exercises.slice(0, 4).map((ex, i) => (
                                <div key={i} className="text-[11px] text-slate-700">
                                  {ex.name} {ex.sets && ex.reps ? <span className="text-slate-500">({ex.sets}×{ex.reps})</span> : ''}
                                </div>
                              ))}
                              {daySchedule.workoutDetails.exercises.length > 4 && (
                                <div className="text-[10px] text-slate-400">+{daySchedule.workoutDetails.exercises.length - 4} more</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {daySchedule.cardioDetails && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-orange-700">{daySchedule.cardioDetails.type}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                            {daySchedule.cardioDetails.duration && (
                              <span>{daySchedule.cardioDetails.duration} min</span>
                            )}
                            {daySchedule.cardioDetails.intensity && (
                              <span>{daySchedule.cardioDetails.intensity}</span>
                            )}
                            {daySchedule.cardioDetails.timing && (
                              <span className="text-slate-500">{daySchedule.cardioDetails.timing.replace('_', ' ')}</span>
                            )}
                          </div>
                          {daySchedule.cardioDetails.template?.caloriesBurned && (
                            <div className="text-[11px] text-orange-600 font-medium">
                              ~{Math.round(daySchedule.cardioDetails.template.caloriesBurned)} cal burn
                            </div>
                          )}
                        </div>
                      )}

                      {daySchedule.type === 'rest' && (
                        <div className="text-xs text-slate-500">Rest & Recovery Day</div>
                      )}
                    </div>
                  );

                  const isSelected = week.selectedDay === daySchedule.day;
                  const dayTooltipId = `${week.weekNumber}-${daySchedule.day}`;
                  const isTooltipOpen = openDayTooltip === dayTooltipId;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5">
                      <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-orange-600' : 'text-slate-600'}`}>
                        {daySchedule.dayLetter}
                      </span>
                      {hasDetails ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip
                            open={isTooltipOpen}
                            onOpenChange={(open) => {
                              if (open) setOpenDayTooltip(dayTooltipId);
                              else if (isTooltipOpen) setOpenDayTooltip(null);
                            }}
                          >
                            <TooltipTrigger asChild>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Toggle tooltip on click
                                  setOpenDayTooltip(isTooltipOpen ? null : dayTooltipId);
                                  // Also select the day
                                  setSelectedDays(prev => ({
                                    ...prev,
                                    [week.weekNumber]: daySchedule.day
                                  }));
                                }}
                                onMouseEnter={() => setOpenDayTooltip(dayTooltipId)}
                                onMouseLeave={() => setOpenDayTooltip(null)}
                                className={`w-9 h-9 flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${getDayStyles(daySchedule.type)
                                  } ${isSelected ? 'scale-110 ring-2 ring-orange-400' : ''}`}
                              >
                                <div className="relative z-20 drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">
                                  {getDayIcon(daySchedule.type)}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs rounded-xl bg-white border border-slate-200 shadow-lg p-3" side="top">
                              {tooltipContent}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div
                          onClick={() => {
                            setSelectedDays(prev => ({
                              ...prev,
                              [week.weekNumber]: daySchedule.day
                            }));
                          }}
                          className={`w-9 h-9 flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${getDayStyles(daySchedule.type)
                            } ${isSelected ? 'scale-110 ring-2 ring-orange-400' : ''}`}
                        >
                          <div className="relative z-20 drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">
                            {getDayIcon(daySchedule.type)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Weekly Deficit & Projected Weight Loss */}
              {week.deficitSummary && (
                (() => {
                  const isDeficit = week.deficitSummary.totalWeeklyDeficit > 0;
                  const absoluteDeficit = Math.abs(week.deficitSummary.totalWeeklyDeficit);
                  const absoluteWeightChange = Math.abs(week.deficitSummary.projectedWeightLossKg);
                  const isDeficitTooltipOpen = openDeficitTooltip === week.weekNumber;

                  return (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip
                        open={isDeficitTooltipOpen}
                        onOpenChange={(open) => {
                          if (open) setOpenDeficitTooltip(week.weekNumber);
                          else if (isDeficitTooltipOpen) setOpenDeficitTooltip(null);
                        }}
                      >
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center justify-center cursor-help py-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDeficitTooltip(isDeficitTooltipOpen ? null : week.weekNumber);
                            }}
                            onMouseEnter={() => setOpenDeficitTooltip(week.weekNumber)}
                            onMouseLeave={() => setOpenDeficitTooltip(null)}
                          >
                            <div className="flex items-baseline gap-3">
                              {/* Deficit Value */}
                              <div className="flex items-baseline">
                                <span
                                  className={`text-3xl font-black tabular-nums tracking-tight ${isDeficit
                                      ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500'
                                      : 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500'
                                    } bg-clip-text text-transparent drop-shadow-sm`}
                                >
                                  {isDeficit ? '−' : '+'}{absoluteDeficit.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-wide">kcal</span>
                              </div>

                              {/* Animated Arrow */}
                              <div className={`flex items-center ${isDeficit ? 'text-teal-400' : 'text-orange-400'}`}>
                                <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="opacity-60">
                                  <path d="M0 6H16M16 6L11 1M16 6L11 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>

                              {/* Weight Change Value */}
                              <div className="flex items-baseline">
                                <span
                                  className={`text-3xl font-black tabular-nums tracking-tight ${isDeficit
                                      ? 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500'
                                      : 'bg-gradient-to-br from-rose-400 via-pink-500 to-purple-500'
                                    } bg-clip-text text-transparent drop-shadow-sm`}
                                >
                                  {isDeficit ? '−' : '+'}{absoluteWeightChange.toFixed(2)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-wide">kg</span>
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs rounded-xl bg-slate-900/95 backdrop-blur-xl text-white p-4 shadow-2xl border border-white/10" side="top">
                          <div className="space-y-3 text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${isDeficit ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-gradient-to-r from-amber-400 to-rose-400'}`}></div>
                              <p className={`font-semibold text-sm ${isDeficit ? 'text-emerald-300' : 'text-amber-300'}`}>
                                Weekly {isDeficit ? 'Deficit' : 'Surplus'}
                              </p>
                            </div>
                            <p className="text-slate-300 leading-relaxed">
                              Based on your TDEE, exercise burn, and calorie intake from your meal plan.
                            </p>
                            <div className="pt-2 border-t border-slate-700/50 space-y-1.5 text-slate-400">
                              <div className="flex justify-between">
                                <span>TDEE</span>
                                <span className="font-mono text-slate-300">{tdee.toLocaleString()} kcal/day</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Avg Daily {isDeficit ? 'Deficit' : 'Surplus'}</span>
                                <span className="font-mono text-slate-300">{Math.abs(week.deficitSummary!.averageDailyDeficit).toLocaleString()} kcal</span>
                              </div>
                              <div className="flex justify-between text-[10px] pt-1 text-slate-500">
                                <span>7,700 kcal ≈ 1 kg body weight</span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()
              )}

              {/* Focus text */}
              <div className="flex items-start gap-1.5 text-xs">
                <span className="text-muted-foreground shrink-0">🎯</span>
                <span className="font-medium leading-tight text-slate-600 line-clamp-2">{week.focus}</span>
              </div>

              {/* Daily Timeline */}
              {week.selectedDayTimeline && week.selectedDayTimeline.length > 0 && (
                <DailyTimeline events={week.selectedDayTimeline} />
              )}

              {/* Weekly Targets Footer */}
              <div className="relative overflow-hidden rounded-full shadow-[0_8px_28px_rgba(251,146,60,0.4),inset_0_3px_6px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,0.6),0_2px_8px_rgba(234,88,12,0.3)]">
                <div className="bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600 rounded-full px-4 py-2.5 relative">
                  <div className="absolute top-0 left-[10%] w-[50%] h-[60%] bg-gradient-to-br from-white/80 via-white/40 to-transparent rounded-full blur-lg pointer-events-none"></div>
                  <div className="absolute bottom-0 right-[10%] w-[40%] h-[50%] bg-gradient-to-tl from-black/20 to-transparent rounded-full blur-md pointer-events-none"></div>

                  <div className="relative flex items-center justify-center gap-5 text-sm">
	                    <div className="flex items-center gap-2">
	                      <span className="text-base drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">🍎</span>
	                      <span className="font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
	                        {Math.round(Number(week.targets.calories || 0)).toLocaleString()}
	                      </span>
	                      <span className="text-xs font-bold text-orange-50 uppercase tracking-wider drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">kcal</span>
	                    </div>
                    <div className="w-px h-5 bg-gradient-to-b from-transparent via-orange-200/80 to-transparent shadow-[0_0_4px_rgba(255,255,255,0.5)]"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-base drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">🥩</span>
                      <span className="font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{week.targets.protein}g</span>
                      <span className="text-xs font-bold text-orange-50 uppercase tracking-wider drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">pro</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2">
        <span className="font-bold">LEGEND:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-300 to-purple-600 shadow-[0_3px_8px_rgba(147,51,234,0.4),inset_0_1px_2px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.2)] flex items-center justify-center">
            <Dumbbell size={14} className="text-white drop-shadow-md" />
          </div>
          <span className="font-medium">Resistance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-300 to-orange-600 shadow-[0_3px_8px_rgba(249,115,22,0.4),inset_0_1px_2px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.2)] flex items-center justify-center">
            <Activity size={14} className="text-white drop-shadow-md" />
          </div>
          <span className="font-medium">Cardio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-300 via-pink-500 to-orange-600 shadow-[0_3px_8px_rgba(236,72,153,0.4),inset_0_1px_2px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.2)] flex items-center justify-center">
            <Zap size={14} className="text-white drop-shadow-md" />
          </div>
          <span className="font-medium">Hybrid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-200 to-slate-400 shadow-[0_3px_8px_rgba(100,116,139,0.4),inset_0_1px_2px_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.2)] flex items-center justify-center">
            <Coffee size={14} className="text-slate-700 drop-shadow-md" />
          </div>
          <span className="font-medium">Rest</span>
        </div>
      </div>
    </div>
  );
}
