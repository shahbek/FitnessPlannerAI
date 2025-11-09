import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/Progress';
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { StreamingText } from '@/components/ai-elements/StreamingText';
import { TextEffect } from '@/components/ui/text-effect';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { X, AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import logoLoadingAnimation from '@/assets/lottieanimations/LogoLoading.json';

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
  onCancel,
  error,
  onRetry
}: ChainOfThoughtSidebarProps) {
  const [generationTime, setGenerationTime] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
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
      setGenerationTime(0);
      setMessageIndex(0);
      intervalRef.current = setInterval(() => {
        setGenerationTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Pause animation when complete
      if (lottieRef.current) {
        lottieRef.current.pause();
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

  // Use MutationObserver to auto-scroll on any DOM changes (catches StreamingText updates)
  useEffect(() => {
    if (!reasoningScrollRef.current || !ragProgress?.aiReasoning) return;

    const scrollContainer = reasoningScrollRef.current;
    
    const observer = new MutationObserver(() => {
      // Scroll to bottom whenever content changes
      requestAnimationFrame(() => {
        const isNearBottom = 
          scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 50;
        
        // Only auto-scroll if user is near the bottom (hasn't scrolled up)
        if (isNearBottom) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
    });

    // Observe the content container for changes
    const contentContainer = scrollContainer.querySelector('div');
    if (contentContainer) {
      observer.observe(contentContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // Initial scroll to bottom
    requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });

    return () => {
      observer.disconnect();
    };
  }, [ragProgress?.aiReasoning]);

  // Map phase to hierarchical step structure
  // Support both old RAG phases and new IntegratedPlanGenerator phases
  const getStepStatus = (phase: string, currentPhase: string) => {
    // Map IntegratedPlanGenerator phases to RAG phases for display
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
  // Convert IntegratedPlanGenerator progress to RAG progress format
  const normalizedProgress = ragProgress ? {
    phase: ragProgress.phase || 'initialization',
    progress: ragProgress.progress ?? null,
    currentStep: ragProgress.currentStep || '',
    reasoning: ragProgress.reasoning || [],
    // Format reasoning for display - show actual CoT steps
    aiReasoning: ragProgress.reasoning && ragProgress.reasoning.length > 0
      ? ragProgress.reasoning.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n\n')
      : ragProgress.currentStep || '',
    reasoningMode: ragProgress.phase === 'complete' ? 'complete' as const : 'thinking' as const,
  } : null;

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full" role="complementary" aria-label="Plan generation progress">
      <div className="p-4">
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close chain of thought sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Loading State */}
          {currentLoading && (
            <div className="flex flex-col flex-1 min-h-0 p-4">
              {/* Big Centered Lottie Animation */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center py-8">
                <div className="w-22 h-22 flex items-center justify-center" style={{
                  filter: 'brightness(0) saturate(100%) invert(38%) sepia(100%) saturate(2163%) hue-rotate(355deg) brightness(96%) contrast(96%)'
                }}>
                  <Lottie 
                    lottieRef={lottieRef}
                    animationData={logoLoadingAnimation}
                    loop={true}
                    autoplay={true}
                    style={{ width: '100px', height: '100px' }}
                  />
                </div>
                
                {/* Interactive Messages with TextEffect */}
                <div className="mt-6 text-center">
                  <TextEffect
                    key={messageIndex}
                    as="h2"
                    preset="fade-in-blur"
                    per="word"
                    className="text-xl font-editorial font-light text-foreground"
                    trigger={true}
                  >
                    {messages[messageIndex]}
                  </TextEffect>
                </div>
              </div>

              {/* Hierarchical Step Structure - Only show when reached */}
              <div className="flex-shrink-0 space-y-3 px-4 pb-4">
                <div className="space-y-1">
                  {/* Workout Planning - Show for IntegratedPlanGenerator */}
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
                          {normalizedProgress?.currentStep || 
                           (normalizedProgress?.reasoning?.length ? 
                             normalizedProgress.reasoning[normalizedProgress.reasoning.length - 1] : 
                             'Creating workout sessions')}
                        </div>
                      )}
                    </ChainOfThoughtStep>
                  )}

                  {/* Meal Plan - Show actual CoT reasoning steps */}
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
                          {normalizedProgress?.currentStep || 
                           (normalizedProgress?.reasoning?.length ? 
                             normalizedProgress.reasoning[normalizedProgress.reasoning.length - 1] : 
                             'Analyzing nutritional requirements')}
                        </div>
                      )}
                    </ChainOfThoughtStep>
                  )}

                  {/* Verification - Show for IntegratedPlanGenerator */}
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
                  
                  {/* Weekly Outline - Only show when active or complete */}
                  {(getStepStatus('outlines', ragProgress?.phase || 'feasibility') === 'active' || 
                    getStepStatus('outlines', ragProgress?.phase || 'feasibility') === 'complete') && (
                    <ChainOfThoughtStep
                      label={
                        getStepStatus('outlines', ragProgress?.phase || 'feasibility') === 'active' 
                          ? <TextShimmer as="span">Generating Weekly Outline</TextShimmer>
                          : 'Generating Weekly Outline'
                      }
                      status={getStepStatus('outlines', ragProgress?.phase || 'feasibility')}
                    >
                      {ragProgress?.phase === 'outlines' && (
                        <div className="ml-6 mt-1 text-xs text-muted-foreground">
                          Creating structured output
                        </div>
                      )}
                    </ChainOfThoughtStep>
                  )}
                  
                  {/* Cost/Shopping - Only show when active or complete */}
                  {(getStepStatus('shopping', ragProgress?.phase || 'feasibility') === 'active' || 
                    getStepStatus('shopping', ragProgress?.phase || 'feasibility') === 'complete') && (
                    <ChainOfThoughtStep
                      label={
                        getStepStatus('shopping', ragProgress?.phase || 'feasibility') === 'active' 
                          ? <TextShimmer as="span">Generating Cost</TextShimmer>
                          : 'Generating Cost'
                      }
                      status={getStepStatus('shopping', ragProgress?.phase || 'feasibility')}
                    >
                      {ragProgress?.phase === 'shopping' && (
                        <div className="ml-6 mt-1 text-xs text-muted-foreground">
                          Creating structured output
                        </div>
                      )}
                    </ChainOfThoughtStep>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 pt-2">
                  <Progress 
                    value={normalizedProgress?.progress ?? ragProgress?.progress ?? null} 
                    className="h-2" 
                    aria-label={(normalizedProgress?.progress ?? ragProgress?.progress)
                      ? `Generation progress: ${normalizedProgress?.progress ?? ragProgress?.progress}%` 
                      : 'Generation in progress'}
                  />
                </div>
              </div>
                  
              {/* Scrollable Reasoning Area - Takes remaining space */}
              {ragProgress?.aiReasoning ? (
                <div 
                  ref={reasoningScrollRef}
                  className="flex-1 overflow-y-auto px-4 min-h-0 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  style={{ 
                    scrollBehavior: 'smooth'
                  }}
                >
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pr-2 pb-4">
                    <StreamingText
                      text={normalizedProgress?.aiReasoning || ragProgress?.aiReasoning || ''}
                      speed={3}
                      delay={10}
                      pauseOnComplete={(normalizedProgress || ragProgress)?.reasoningMode === 'complete'}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Waiting for reasoning updates...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {error && !currentLoading && (
            <ChainOfThought defaultOpen={true}>
              <ChainOfThoughtHeader className="text-destructive">
                Generation Failed
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <div className="space-y-4">
                  <div className="text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
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
              </ChainOfThoughtContent>
            </ChainOfThought>
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

              {/* Show reasoning text when available - Important info */}
              {(normalizedProgress?.aiReasoning || ragProgress?.aiReasoning) && (
                <div 
                  ref={reasoningScrollRef}
                  className="flex-1 overflow-y-auto px-4 mt-4 min-h-0 scroll-smooth border-t pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  style={{ 
                    scrollBehavior: 'smooth'
                  }}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
