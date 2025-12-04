import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/Progress';
import { ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { StreamingText } from '@/components/ai-elements/StreamingText';
import { TextEffect } from '@/components/ui/text-effect';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { X, AlertCircle, Minimize2 } from 'lucide-react';
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
}

export function ChainOfThoughtSidebar({
  isOpen,
  onClose,
  currentLoading,
  ragProgress,
  error,
  onRetry
}: ChainOfThoughtSidebarProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lottieRef = useRef<any>(null);

  // Interactive messages array
  const messages = [
    "We are generating your plan",
    "Sit still",
    "This will be worth it",
    "Almost there",
    "Creating something special",
  ];

  // Timer for total generation time and pause animation when complete
  useEffect(() => {
    if (currentLoading) {
      setMessageIndex(0);
      // Reset minimize state on new generation
      setIsMinimized(true); // Start minimized by default as per user preference implied by "when in the small circle view" focus
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Pause animation when complete
      if (lottieRef.current) {
        lottieRef.current.pause();
        // Go to frame 0
        lottieRef.current.goToAndStop(0, true);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentLoading]);

  // Rotate messages every 3 seconds
  useEffect(() => {
    if (currentLoading) {
      const messageInterval = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % messages.length);
      }, 3000);
      return () => clearInterval(messageInterval);
    }
  }, [currentLoading, messages.length]);

  // Auto-scroll reasoning area when content changes (for streaming text)
  useEffect(() => {
    if (reasoningScrollRef.current && ragProgress?.aiReasoning) {
      const scrollContainer = reasoningScrollRef.current;
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Always scroll to bottom when new content arrives
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
    }
  }, [ragProgress?.aiReasoning]);

  // Map phase to hierarchical step structure
  const getStepStatus = (phase: string, currentPhase: string) => {
    const phaseMapping: Record<string, string> = {
      'initialization': 'feasibility',
      'workout_planning': 'sessions',
      'meal_planning': 'meals',
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

  // Normalize progress format for display
  const normalizedProgress = ragProgress ? {
    phase: ragProgress.phase || 'initialization',
    progress: ragProgress.progress ?? null,
    currentStep: ragProgress.currentStep || '',
    reasoning: ragProgress.reasoning || [],
    aiReasoning: ragProgress.reasoning && ragProgress.reasoning.length > 0
      ? ragProgress.reasoning.map((step: string) => `> ${step}`).join('\n')
      : ragProgress.currentStep || '',
    reasoningMode: ragProgress.phase === 'complete' ? 'complete' as const : 'thinking' as const,
  } : null;

  if (!isOpen) return null;

  // Lottie style based on state
  const lottieStyle = isMinimized
    ? { width: '40px', height: '40px' }
    : { width: '100px', height: '100px' };

  // Container classes for transition
  const containerClasses = cn(
    "fixed z-50 transition-all duration-500 ease-in-out overflow-hidden liquid-sidebar",
    isMinimized
      ? "bottom-[10px] right-[10px] w-14 h-14 rounded-full cursor-pointer hover:scale-105"
      : "bottom-[10px] right-[10px] w-96 h-[500px] rounded-2xl shadow-2xl"
  );

  return (
    <div
      className={containerClasses}
      role="complementary"
      aria-label="Plan generation progress"
      onClick={() => isMinimized && setIsMinimized(false)}
    >
      {/* Minimized View */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
        isMinimized ? "opacity-100 delay-200" : "opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center justify-center" style={{
          filter: currentLoading
            ? 'brightness(0) saturate(100%) invert(38%) sepia(100%) saturate(2163%) hue-rotate(355deg) brightness(96%) contrast(96%)'
            : 'brightness(0) saturate(100%) grayscale(100%)'
        }}>
          <Lottie
            lottieRef={lottieRef}
            animationData={logoLoadingAnimation}
            loop={currentLoading}
            autoplay={currentLoading}
            style={lottieStyle}
          />
        </div>
      </div>

      {/* Expanded View */}
      <div className={cn(
        "flex flex-col h-full transition-opacity duration-300",
        isMinimized ? "opacity-0 pointer-events-none" : "opacity-100 delay-200"
      )}>
        {/* Header Actions */}
        <div className="p-4 flex items-center justify-between absolute top-0 left-0 right-0 z-10">
          {/* Minimize Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/50 hover:bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            aria-label="Minimize sidebar"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>

          {/* Close Button (only when complete or error) */}
          {(!currentLoading || error) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/50 hover:bg-background/80 backdrop-blur-sm"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden pt-12">
          <div className="flex flex-col flex-1 min-h-0">
            {/* Loading State */}
            {currentLoading && (
              <div className="flex flex-col flex-1 min-h-0 p-4">
                {/* Big Centered Lottie Animation */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center py-4">
                  <div className="w-22 h-22 flex items-center justify-center" style={{
                    filter: 'brightness(0) saturate(100%) invert(38%) sepia(100%) saturate(2163%) hue-rotate(355deg) brightness(96%) contrast(96%)'
                  }}>
                    <Lottie
                      lottieRef={lottieRef}
                      animationData={logoLoadingAnimation}
                      loop={true}
                      autoplay={true}
                      style={lottieStyle}
                    />
                  </div>

                  {/* Interactive Messages with TextEffect */}
                  <div className="mt-4 text-center h-8">
                    <TextEffect
                      key={messageIndex}
                      as="h2"
                      preset="fade-in-blur"
                      per="word"
                      className="text-lg font-editorial font-light text-foreground"
                      trigger={true}
                    >
                      {messages[messageIndex]}
                    </TextEffect>
                  </div>
                </div>

                {/* Hierarchical Step Structure */}
                <div className="flex-shrink-0 space-y-3 px-2 pb-4">
                  <div className="space-y-1">
                    {/* Workout Planning */}
                    {((normalizedProgress || ragProgress)?.phase === 'workout_planning' ||
                      (normalizedProgress || ragProgress)?.phase === 'sessions' ||
                      getStepStatus('sessions', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('sessions', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('sessions', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Generating Workouts</TextShimmer>
                              : 'Generating Workouts'
                          }
                          status={getStepStatus('sessions', (normalizedProgress || ragProgress)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || ragProgress)?.phase === 'workout_planning' || (normalizedProgress || ragProgress)?.phase === 'sessions') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Creating workout sessions'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}

                    {/* Meal Plan */}
                    {((normalizedProgress || ragProgress)?.phase === 'meal_planning' ||
                      (normalizedProgress || ragProgress)?.phase === 'meals' ||
                      getStepStatus('meals', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('meals', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('meals', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Generating Meal Plan</TextShimmer>
                              : 'Generating Meal Plan'
                          }
                          status={getStepStatus('meals', (normalizedProgress || ragProgress)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || ragProgress)?.phase === 'meals' || (normalizedProgress || ragProgress)?.phase === 'meal_planning') && (
                            <div className="ml-6 mt-1 text-xs text-muted-foreground">
                              {normalizedProgress?.currentStep || 'Analyzing nutritional requirements'}
                            </div>
                          )}
                        </ChainOfThoughtStep>
                      )}

                    {/* Verification */}
                    {((normalizedProgress || ragProgress)?.phase === 'verification' ||
                      getStepStatus('finalizing', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active' ||
                      getStepStatus('finalizing', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'complete') && (
                        <ChainOfThoughtStep
                          label={
                            getStepStatus('finalizing', (normalizedProgress || ragProgress)?.phase || 'feasibility') === 'active'
                              ? <TextShimmer as="span">Verifying Plan</TextShimmer>
                              : 'Verifying Plan'
                          }
                          status={getStepStatus('finalizing', (normalizedProgress || ragProgress)?.phase || 'feasibility')}
                        >
                          {((normalizedProgress || ragProgress)?.phase === 'verification') && (
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
                      value={normalizedProgress?.progress ?? ragProgress?.progress ?? null}
                      className="h-1.5"
                    />
                  </div>
                </div>

                {/* Scrollable Reasoning Area - Takes remaining space */}
                {ragProgress?.aiReasoning && (
                  <div
                    ref={reasoningScrollRef}
                    className="flex-1 overflow-y-auto px-2 min-h-0 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-muted/30 rounded-lg p-3 mx-2 mb-2 font-mono text-xs"
                  >
                    <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      <StreamingText
                        text={normalizedProgress?.aiReasoning || ragProgress?.aiReasoning || ''}
                        speed={3}
                        delay={10}
                        pauseOnComplete={(normalizedProgress || ragProgress)?.reasoningMode === 'complete'}
                      />
                    </div>
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

            {/* Completed Plan Generation */}
            {!currentLoading && !error && (
              <div className="flex flex-col flex-1 min-h-0 p-4">
                {/* Grey Paused Lottie Animation */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center py-8">
                  <div className="w-32 h-32 flex items-center justify-center" style={{
                    filter: 'brightness(0) saturate(100%) grayscale(100%)'
                  }}>
                    <Lottie
                      lottieRef={lottieRef}
                      animationData={logoLoadingAnimation}
                      loop={false}
                      autoplay={false}
                      style={{ width: '128px', height: '128px' }}
                    />
                  </div>

                  {/* Completion Message */}
                  <div className="mt-6 text-center">
                    <TextEffect
                      as="h2"
                      preset="fade-in-blur"
                      per="word"
                      className="text-xl font-editorial font-light text-foreground"
                      trigger={true}
                    >
                      Your plan is ready
                    </TextEffect>
                  </div>
                </div>

                {/* Show reasoning text when available */}
                {(normalizedProgress?.aiReasoning || ragProgress?.aiReasoning) && (
                  <div
                    ref={reasoningScrollRef}
                    className="flex-1 overflow-y-auto px-4 mt-4 min-h-0 scroll-smooth border-t pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pr-2 pb-4">
                      <StreamingText
                        text={normalizedProgress?.aiReasoning || ragProgress?.aiReasoning || ''}
                        speed={3}
                        delay={10}
                        pauseOnComplete={true}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4">
                  <Button onClick={onClose} className="w-full">
                    View Plan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
