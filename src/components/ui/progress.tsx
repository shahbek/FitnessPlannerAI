"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number | null; // null means indeterminate
  showLabel?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, showLabel = false, ...props }, ref) => {
  const isIndeterminate = value === null || value === undefined;
  const displayValue = isIndeterminate ? 0 : Math.max(0, Math.min(100, value));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      aria-label={showLabel && !isIndeterminate ? `Progress: ${displayValue}%` : undefined}
      aria-valuenow={isIndeterminate ? undefined : displayValue}
      aria-valuemin={isIndeterminate ? undefined : 0}
      aria-valuemax={isIndeterminate ? undefined : 100}
      {...props}
    >
      {isIndeterminate ? (
        <div className="h-full w-full overflow-hidden rounded-full relative">
          <div 
            className="h-full w-1/3 bg-primary rounded-full absolute"
            style={{
              animation: 'shimmer 1.5s ease-in-out infinite',
            }} 
          />
        </div>
      ) : (
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all duration-300"
          style={{ transform: `translateX(-${100 - displayValue}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
