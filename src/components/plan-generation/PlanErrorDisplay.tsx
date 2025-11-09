/**
 * Plan Error Display Component
 * 
 * Displays errors from plan generation in a user-friendly way
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PlanErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function PlanErrorDisplay({ error, onDismiss, className = '' }: PlanErrorDisplayProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Plan Generation Failed</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{error}</p>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="mt-3"
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

