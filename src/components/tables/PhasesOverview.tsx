import React from 'react';
import { EnhancedPhasesOverview } from '@/components/plan-overview/EnhancedPhasesOverview';
import type { PhaseProgressionRow } from '@/utils/workoutDataParser';

interface PhasesOverviewProps {
  plan: any; // Complete plan JSON
  progression: PhaseProgressionRow[];
  weeklySchedule?: any[]; // Passed from parsedData
  userProfile?: {
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    primaryGoal?: string;
    experienceLevel?: string;
    workoutDaysPerWeek?: number;
    sessionDuration?: number;
    equipmentAccess?: string[];
    dietaryRestrictions?: string[];
    bodyFat?: number;
    targetBodyFat?: number;
  };
  workoutPlanId?: string; // Convex ID for the workout plan
}

export function PhasesOverview({ plan, progression, weeklySchedule, userProfile, workoutPlanId }: PhasesOverviewProps) {
  return (
    <EnhancedPhasesOverview
      plan={plan}
      weeklySchedule={weeklySchedule}
      progression={progression}
      userProfile={userProfile}
      workoutPlanId={workoutPlanId}
    />
  );
}
