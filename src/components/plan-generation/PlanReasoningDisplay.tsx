/**
 * Plan Reasoning Display Component
 * 
 * Displays Chain-of-Thought reasoning steps from plan generation
 */

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Brain, ChevronRight } from 'lucide-react';
import { PlanGenerationProgress } from '@/hooks/usePlanGenerator';

interface PlanReasoningDisplayProps {
  progress: PlanGenerationProgress | null;
  className?: string;
  maxSteps?: number;
}

export function PlanReasoningDisplay({ 
  progress, 
  className = '',
  maxSteps = 10 
}: PlanReasoningDisplayProps) {
  if (!progress || !progress.reasoning || progress.reasoning.length === 0) {
    return null;
  }

  const visibleSteps = progress.reasoning.slice(0, maxSteps);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Reasoning Steps</h3>
          <Badge variant="outline">{progress.reasoning.length} steps</Badge>
        </div>

        <div className="space-y-2">
          {visibleSteps.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">{step}</p>
            </div>
          ))}

          {progress.reasoning.length > maxSteps && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{progress.reasoning.length - maxSteps} more steps...
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

