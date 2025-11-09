/**
 * Plan Generation Button Component
 * 
 * Trigger component for generating fitness plans using IntegratedPlanGenerator
 */

import { Button } from '@/components/ui/Button';
import { Loader2, Sparkles } from 'lucide-react';

interface PlanGenerationButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function PlanGenerationButton({
  onClick,
  loading = false,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}: PlanGenerationButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Plan
        </>
      )}
    </Button>
  );
}

