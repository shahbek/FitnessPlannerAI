/**
 * Plan Generation Panel Component
 * 
 * Complete UI component that integrates all plan generation components
 * This is an example of how to use usePlanGenerator with the UI components
 */

import { usePlanGenerator } from '@/hooks/usePlanGenerator';
import { PlanGenerationButton } from './PlanGenerationButton';
import { PlanProgressIndicator } from './PlanProgressIndicator';
import { PlanErrorDisplay } from './PlanErrorDisplay';
import { PlanReasoningDisplay } from './PlanReasoningDisplay';
import { UserProfile } from '@/models/UserProfile';
import { WeeklyOutline } from '@/models/PlanModels';
import { Card } from '@/components/ui/card';
import React, { useEffect } from 'react';

interface PlanGenerationPanelProps {
  userProfile: UserProfile;
  weeklyOutlines: WeeklyOutline[];
  onPlanGenerated?: (plan: any) => void;
  className?: string;
}

export function PlanGenerationPanel({
  userProfile,
  weeklyOutlines,
  onPlanGenerated,
  className = '',
}: PlanGenerationPanelProps) {
  const {
    plan,
    loading,
    error,
    progress,
    generatePlan,
    cancelGeneration,
    clearError,
    clearPlan,
    isGenerating,
    canCancel,
  } = usePlanGenerator();

  const handleGenerate = async () => {
    await generatePlan(userProfile, weeklyOutlines, {
      useUSDAAPI: true,
      useCoT: true,
      enableCorrections: true,
    });
  };

  // Call onPlanGenerated when plan is ready
  React.useEffect(() => {
    if (plan && onPlanGenerated) {
      onPlanGenerated(plan);
    }
  }, [plan, onPlanGenerated]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Generation Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Generate Fitness Plan</h3>
          <p className="text-sm text-muted-foreground">
            Create a personalized meal and workout plan based on your profile
          </p>
        </div>
        <div className="flex gap-2">
          {isGenerating && canCancel && (
            <PlanGenerationButton
              onClick={cancelGeneration}
              loading={false}
              variant="outline"
            >
              Cancel
            </PlanGenerationButton>
          )}
          <PlanGenerationButton
            onClick={handleGenerate}
            loading={loading}
            disabled={loading}
          />
        </div>
      </div>

      {/* Progress Indicator */}
      {progress && (
        <PlanProgressIndicator progress={progress} />
      )}

      {/* Error Display */}
      <PlanErrorDisplay error={error} onDismiss={clearError} />

      {/* Reasoning Display */}
      {progress && progress.phase !== 'complete' && progress.phase !== 'error' && (
        <PlanReasoningDisplay progress={progress} />
      )}

      {/* Success Message */}
      {plan && progress?.phase === 'complete' && (
        <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Plan generated successfully!
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
