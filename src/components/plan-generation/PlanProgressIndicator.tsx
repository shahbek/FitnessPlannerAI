/**
 * Plan Progress Indicator Component
 * 
 * Displays real-time progress updates during plan generation
 */

import { Progress } from '@/components/ui/Progress';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { PlanGenerationProgress } from '@/hooks/usePlanGenerator';

interface PlanProgressIndicatorProps {
  progress: PlanGenerationProgress | null;
  className?: string;
}

const phaseLabels: Record<string, string> = {
  initialization: 'Initializing',
  workout_planning: 'Planning Workouts',
  meal_planning: 'Planning Meals',
  verification: 'Verifying Plan',
  complete: 'Complete',
  error: 'Error',
};

const phaseColors: Record<string, string> = {
  initialization: 'bg-blue-500',
  workout_planning: 'bg-purple-500',
  meal_planning: 'bg-green-500',
  verification: 'bg-yellow-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
};

export function PlanProgressIndicator({ progress, className = '' }: PlanProgressIndicatorProps) {
  if (!progress) return null;

  const phaseLabel = phaseLabels[progress.phase] || progress.phase;
  const phaseColor = phaseColors[progress.phase] || 'bg-gray-500';

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {progress.phase === 'complete' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : progress.phase === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <h3 className="font-semibold">{phaseLabel}</h3>
          </div>
          <Badge variant="outline">{progress.progress}%</Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progress.progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{progress.currentStep}</p>
        </div>

        {/* Reasoning Steps */}
        {progress.reasoning && progress.reasoning.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Reasoning Steps:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {progress.reasoning.slice(0, 3).map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{step}</span>
                </li>
              ))}
              {progress.reasoning.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  +{progress.reasoning.length - 3} more steps...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {progress.warnings && progress.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Warnings:</p>
            <ul className="space-y-1 text-xs text-yellow-600 dark:text-yellow-400">
              {progress.warnings.slice(0, 2).map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

