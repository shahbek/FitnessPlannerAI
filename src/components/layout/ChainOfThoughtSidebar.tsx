import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { StreamingText } from '@/components/ai-elements/StreamingText';
import { TextEffect } from '@/components/ui/text-effect';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { X, AlertCircle, Minimize2, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import logoLoadingAnimation from '@/assets/lottieanimations/LogoLoading.json';
import { cn } from '@/lib/utils';

import './ChainOfThoughtSidebar.css';

interface ChainOfThoughtSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentLoading: boolean;
  ragProgress: any; // Can be from useAISdkRag or usePlanGenerator
  onCancel?: () => void;
  error?: string | null;
  onRetry?: () => void;
  onViewPlan?: () => void; // Navigate to the generated plan
  isSaving?: boolean;
}

export function ChainOfThoughtSidebar({
  isOpen,
  onClose,
  currentLoading,
  ragProgress,
  error,
  onRetry,
  onViewPlan,
  isSaving = false
}: ChainOfThoughtSidebarProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cachedProgress, setCachedProgress] = useState<any>(null);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lottieRef = useRef<any>(null);

  // Clear cached progress when sidebar closes or new generation starts
  useEffect(() => {
    if (!isOpen) {
      // Delay clearing to allow closing animation
      const timer = setTimeout(() => {
        setCachedProgress(null);
        setMessageIndex(0);
      }, 500);
      return () => clearTimeout(timer);
    } else if (currentLoading && ragProgress?.phase !== 'complete') {
      // New generation started, clear old data
      setCachedProgress(null);
    }
  }, [isOpen, currentLoading, ragProgress?.phase]);

  // Update cached progress when new progress comes in
  useEffect(() => {
    if (ragProgress) {
      setCachedProgress(ragProgress);
    }
  }, [ragProgress]);

  // Interactive messages array - shown while actively generating
  const messages = [
    "Thinking",
    "Planning",
    "Analyzing",
    "Calculating",
    "Optimizing",
    "Almost there",
  ];

  // Timer for total generation time and pause animation when complete
  useEffect(() => {
    // Determine if we should be animating (aligned with isActivelyGenerating logic)
    const shouldAnimate = !error && (
      isSaving ||
      (currentLoading && ragProgress?.phase !== 'complete') ||
      (!ragProgress && !cachedProgress) // Initializing state
    );

    // Determine if we are fully complete
    const isFullyComplete = !isSaving && !currentLoading && ragProgress?.phase === 'complete';

    if (shouldAnimate) {
      setMessageIndex(0);

      // Ensure animation is playing
      if (lottieRef.current && !lottieRef.current.isPaused) {
        lottieRef.current.play();
      }
    } else if (isFullyComplete) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Smoothly transition to paused state after a brief delay
      setTimeout(() => {
        if (lottieRef.current) {
          lottieRef.current.pause();
          // Go to frame 0 for clean gray logo
          lottieRef.current.goToAndStop(0, true);
        }
      }, 500); // 500ms delay for smoother transition
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentLoading, ragProgress?.phase, isSaving, error, cachedProgress, ragProgress]);

  // Normalize progress format for display - use cachedProgress to retain data
  // ⚠️ MUST be defined before any functions or effects that use it
  const progressToUse = ragProgress || cachedProgress;
  const normalizedProgress = progressToUse ? {
    phase: progressToUse.phase || 'initialization',
    progress: progressToUse.progress ?? null,
    currentStep: progressToUse.currentStep || '',
    reasoning: progressToUse.reasoning || [],
    aiReasoning: progressToUse.reasoning && progressToUse.reasoning.length > 0
      ? progressToUse.reasoning.map((step: string) => `> ${step}`).join('\n')
      : progressToUse.currentStep || '',
    reasoningMode: progressToUse.phase === 'complete' ? 'complete' as const : 'thinking' as const,
  } : null;

  // Rotate messages every 3 seconds
  useEffect(() => {
    if ((currentLoading || isSaving) && ragProgress?.phase !== 'complete') {
      const messageInterval = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % messages.length);
      }, 3000);
      return () => clearInterval(messageInterval);
    }
  }, [currentLoading, isSaving, ragProgress?.phase, messages.length]);

  // Auto-scroll reasoning area when content changes (for streaming text)
  useEffect(() => {
    if (reasoningScrollRef.current && progressToUse?.aiReasoning) {
      const scrollContainer = reasoningScrollRef.current;
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Always scroll to bottom when new content arrives
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [progressToUse?.aiReasoning]);

  // Map phase to hierarchical step structure
  const getStepStatus = (phase: string, currentPhase: string) => {
    const phaseMapping: Record<string, string> = {
      'initialization': 'feasibility',
      'workout_planning': 'sessions',
      'meal_planning': 'meals',
      'shopping': 'shopping',
      'verification': 'finalizing',
      'complete': 'complete',
      'error': 'error',
    };

    const mappedCurrentPhase = phaseMapping[currentPhase] || currentPhase;
    const phaseOrder = ['feasibility', 'metrics', 'outlines', 'framework', 'exercises', 'sessions', 'meals', 'shopping', 'finalizing', 'complete'];
    const currentIndex = phaseOrder.indexOf(mappedCurrentPhase);
    const stepIndex = phaseOrder.indexOf(phase);

    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  // Generate plan summary for completion state
  const getPlanSummary = () => {
    if (!progressToUse || progressToUse.phase !== 'complete') return '';

    // Extract key details from the plan
    const reasoning = progressToUse.reasoning || [];

    // Try to extract weeks count
    const weeksMatch = reasoning.find((r: string) => r.includes('weekly outline') || r.includes('week'))?.match(/(\d+)\s*week/i);
    const weeks = weeksMatch ? weeksMatch[1] : null;

    // Try to extract plan type/goal
    const planTypeMatch = reasoning.find((r: string) => r.includes('Program') || r.includes('plan'))?.match(/([\w\s]+)\s+Program/i);
    const planType = planTypeMatch ? planTypeMatch[1] : 'Personalized Fitness';

    // Build summary
    let summary = `We've generated your ${weeks ? `${weeks}-week ` : ''}${planType} plan.`;

    // Add meal count if available
    const mealsMatch = reasoning.find((r: string) => r.includes('meal'))?.match(/(\d+)\s*days of meal/i);
    if (mealsMatch) {
      summary += ` Including ${mealsMatch[1]} days of customized meal plans`;
    }

    // Add workout count if available
    const workoutsMatch = reasoning.find((r: string) => r.includes('workout'))?.match(/(\d+)\s*workout/i);
    if (workoutsMatch) {
      summary += ` and ${workoutsMatch[1]} workout sessions`;
    }

    summary += '. Everything is tailored to your goals, experience level, and lifestyle.';

    return summary;
  };

  if (!isOpen) return null;

  // Lottie style based on state
  const lottieStyle = isMinimized
    ? { width: '24px', height: '24px' }
    : { width: '100px', height: '100px' };

  // Determine if actively generating
  // Consider active if:
  // 1. isSaving is true (finalizing)
  // 2. OR currentLoading is true AND phase is not complete
  // 3. OR we have no progress yet (initializing state before loading becomes true)
  // BUT ensure we don't show active if error exists
  const isActivelyGenerating = !error && (
    isSaving ||
    (currentLoading && (normalizedProgress || progressToUse)?.phase !== 'complete') ||
    !progressToUse
  );

  // Container classes for transition - responsive for mobile
  // Use ONLY right/bottom positioning to animate from bottom-right corner
  const containerClasses = cn(
    "fixed z-50 overflow-hidden liquid-sidebar",
    isMinimized
      ? "bottom-3 right-3 w-10 h-10 rounded-full cursor-pointer transition-all duration-200 ease-out !bg-transparent"
      : "bottom-3 right-3 w-[calc(100vw-24px)] md:w-96 h-[70vh] max-h-[500px] rounded-2xl shadow-2xl transition-all duration-200 ease-out"
  );

  // Determine display message
  const getDisplayMessage = () => {
    if (isSaving) return "Finalizing your plan...";
    if (!progressToUse) return "Initializing...";
    return messages[messageIndex];
  };

  return (
    <div
      className={containerClasses}
      role="complementary"
      aria-label="Plan generation progress"
      onClick={() => isMinimized && setIsMinimized(false)}
    >
      {/* Minimized View - AI Blob Effect */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
        isMinimized ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Animated AI Blob Background */}
        {isActivelyGenerating && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-[-50%] animate-spin-slow" style={{
              background: 'conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #ff6b6b)',
              filter: 'blur(8px)',
              animationDuration: '3s',
            }} />
          </div>
        )}

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center" style={{
          filter: isActivelyGenerating
            ? 'brightness(0) saturate(100%) invert(38%) sepia(100%) saturate(2163%) hue-rotate(355deg) brightness(96%) contrast(96%)'
            : 'brightness(0) saturate(100%) grayscale(100%)'
        }}>
          <Lottie
            lottieRef={lottieRef}
            animationData={logoLoadingAnimation}
            loop={isActivelyGenerating}
            autoplay={isActivelyGenerating}
            style={lottieStyle}
          />
        </div>
      </div>

      {/* Expanded View */}
      <div className={cn(
        "flex flex-col h-full transition-opacity duration-150",
        isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {/* Header Actions - Darker with inner shadow for 3D effect */}
        <div className="px-3 py-2 flex items-center justify-start gap-2 absolute top-0 left-0 right-0 z-10 bg-muted/30 border-b border-border/50">
          {/* Close Button (only when complete or error) - Apple Red */}
          {(!isActivelyGenerating || error) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full bg-gradient-to-br from-red-400 to-red-500 border border-red-500 shadow-[0_2px_4px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(153,27,27,0.2)]"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-3 w-3 text-white" />
            </Button>
          )}

          {/* Minimize Button - Apple Yellow */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 border border-amber-400 shadow-[0_2px_4px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(180,83,9,0.2)]"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            aria-label="Minimize sidebar"
          >
            <Minus className="h-3 w-3 text-amber-900" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden pt-10 bg-background">
          <div className="flex flex-col flex-1 min-h-0">
            {/* Single container - always show when not in error state */}
            {!error && (
              <div className="flex flex-col flex-1 min-h-0 p-4">
                {/* Lottie Animation - same element, just transitions between states */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center py-4 transition-all duration-300 ease-out">
                  <div
                    className="w-22 h-22 flex items-center justify-center transition-all duration-300 ease-out"
                    style={{
                      filter: isActivelyGenerating
                        ? 'brightness(0) saturate(100%) invert(38%) sepia(100%) saturate(2163%) hue-rotate(355deg) brightness(96%) contrast(96%)'
                        : 'brightness(0) saturate(100%) grayscale(100%)'
                    }}
                  >
                    <Lottie
                      lottieRef={lottieRef}
                      animationData={logoLoadingAnimation}
                      loop={isActivelyGenerating}
                      autoplay={isActivelyGenerating}
                      style={lottieStyle}
                    />
                  </div>

                  {/* Text - smoothly transitions between loading and complete */}
                  <div className="mt-4 text-center transition-all duration-300 ease-out">
                    {isActivelyGenerating ? (
                      <TextEffect
                        key={messageIndex + (isSaving ? 'saving' : 'gen')}
                        as="h2"
                        preset="fade-in-blur"
                        per="word"
                        className="text-lg font-editorial font-light text-foreground"
                        trigger={true}
                      >
                        {getDisplayMessage()}
                      </TextEffect>
                    ) : (
                      <div className="space-y-2">
                        <TextEffect
                          key="complete"
                          as="h2"
                          preset="fade-in-blur"
                          per="word"
                          className="text-lg font-editorial font-light text-foreground"
                          trigger={true}
                        >
                          Your plan is ready
                        </TextEffect>
                        {/* Streaming summary below the title */}
                        {getPlanSummary() && (
                          <div className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                            <StreamingText
                              text={getPlanSummary()}
                              speed={20}
                              delay={100}
                              pauseOnComplete={true}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hierarchical Step Structure - fade out when complete */}
                <div className={cn(
                  "flex-shrink-0 space-y-3 px-2 pb-4 transition-all duration-300 ease-out",
                  isActivelyGenerating
                    ? "opacity-100"
                    : "opacity-0 h-0 overflow-hidden"
                )}>
                  <div className="space-y-1">
                    {/* Workout Planning */}
                    {((normalizedProgress || progressToUse)?.phase === 'workout_planning' ||
                      (normalizedProgress || progressToUse)?.phase === 'sessions' ||
                      getStepStatus('sessions', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('sessions', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('sessions', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Generating Workouts</TextShimmer>
                              : 'Generating Workouts'
                          }
                          status={getStepStatus('sessions', (normalizedProgress || progressToUse)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || progressToUse)?.phase === 'workout_planning' || (normalizedProgress || progressToUse)?.phase === 'sessions') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Creating workout sessions'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}

                    {/* Meal Plan */}
                    {((normalizedProgress || progressToUse)?.phase === 'meal_planning' ||
                      (normalizedProgress || progressToUse)?.phase === 'meals' ||
                      getStepStatus('meals', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('meals', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('meals', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Generating Meal Plan</TextShimmer>
                              : 'Generating Meal Plan'
                          }
                          status={getStepStatus('meals', (normalizedProgress || progressToUse)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || progressToUse)?.phase === 'meals' || (normalizedProgress || progressToUse)?.phase === 'meal_planning') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Analyzing nutritional requirements'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}

                    {/* Shopping List */}
                    {((normalizedProgress || progressToUse)?.phase === 'shopping' ||
                      getStepStatus('shopping', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('shopping', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('shopping', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Generating Shopping Lists</TextShimmer>
                              : 'Generating Shopping Lists'
                          }
                          status={getStepStatus('shopping', (normalizedProgress || progressToUse)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || progressToUse)?.phase === 'shopping') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Creating weekly shopping lists'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}

                    {/* Verification */}
                    {((normalizedProgress || progressToUse)?.phase === 'verification' ||
                      getStepStatus('finalizing', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('finalizing', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('finalizing', (normalizedProgress || progressToUse)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Verifying Plan</TextShimmer>
                              : 'Verifying Plan'
                          }
                          status={getStepStatus('finalizing', (normalizedProgress || progressToUse)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || progressToUse)?.phase === 'verification') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Validating plan components'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <Progress
                      value={normalizedProgress?.progress ?? progressToUse?.progress ?? null}
                      className="h-1.5"
                    />
                  </div>
                </div>

                {/* Scrollable Reasoning Area - only show during loading */}
                {progressToUse?.aiReasoning && isActivelyGenerating && (
                  <div
                    ref={reasoningScrollRef}
                    className="flex-1 overflow-y-auto px-2 mt-4 min-h-0 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] font-mono text-xs bg-muted/30 rounded-lg p-3 mx-2 mb-2"
                  >
                    <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      <StreamingText
                        text={normalizedProgress?.aiReasoning || progressToUse?.aiReasoning || ''}
                        speed={15}
                        delay={5}
                        pauseOnComplete={true}
                      />
                    </div>
                  </div>
                )}

                {/* CTA - fade in when complete */}
                {!isActivelyGenerating && (normalizedProgress || progressToUse)?.phase === 'complete' && (
                  <div className="mt-auto pt-4 animate-in fade-in duration-300">
                    <Button
                      onClick={() => {
                        if (onViewPlan) {
                          onViewPlan();
                        }
                        onClose();
                      }}
                      className="w-full"
                    >
                      View Plan
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {error && !currentLoading && (
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-destructive">Generation Failed</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="w-full"
                  >
                    Retry Generation
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
