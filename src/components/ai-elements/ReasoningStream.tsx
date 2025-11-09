import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Brain, Zap } from 'lucide-react';

interface ReasoningUpdate {
  id: string;
  text: string;
  timestamp: number;
  type?: 'thinking' | 'analysis' | 'generation' | 'formatting';
}

interface ReasoningStreamProps {
  currentStep?: string;
  aiReasoning?: string;
  reasoningMode?: 'thinking' | 'formatting' | 'complete';
  className?: string;
}

/**
 * ReasoningStream - Shows a stream of what the AI is working on
 * Displays multiple reasoning updates in a chat-like interface
 */
// Helper to determine reasoning type from text
const getReasoningType = (text: string): 'thinking' | 'analysis' | 'generation' | 'formatting' => {
  const lower = text.toLowerCase();
  if (lower.includes('analyzing') || lower.includes('assessing') || lower.includes('calculating')) {
    return 'analysis';
  }
  if (lower.includes('generating') || lower.includes('creating') || lower.includes('building')) {
    return 'generation';
  }
  if (lower.includes('formatting') || lower.includes('structuring') || lower.includes('organizing')) {
    return 'formatting';
  }
  return 'thinking';
};

export function ReasoningStream({
  currentStep,
  aiReasoning,
  reasoningMode,
  className,
}: ReasoningStreamProps) {
  const [reasoningHistory, setReasoningHistory] = useState<ReasoningUpdate[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add new reasoning updates when they come in
  useEffect(() => {
    if (currentStep && currentStep.trim()) {
      const update: ReasoningUpdate = {
        id: `reasoning-${Date.now()}-${Math.random()}`,
        text: currentStep,
        timestamp: Date.now(),
        type: getReasoningType(currentStep),
      };

      setReasoningHistory((prev) => {
        // Don't add duplicate reasoning if it's the same as the last one (within 2 seconds)
        const lastUpdate = prev[prev.length - 1];
        const timeDiff = Date.now() - (lastUpdate?.timestamp || 0);
        
        if (lastUpdate?.text === currentStep && timeDiff < 2000) {
          return prev;
        }
        return [...prev, update].slice(-15); // Keep last 15 updates
      });
    }
  }, [currentStep]);

  // Scroll to bottom when new reasoning comes in
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [reasoningHistory]);

  // Get icon based on reasoning type
  const getIcon = (type?: string) => {
    switch (type) {
      case 'thinking':
        return <Brain className="h-3 w-3 text-blue-500" />;
      case 'generation':
        return <Zap className="h-3 w-3 text-yellow-500" />;
      case 'formatting':
        return <Sparkles className="h-3 w-3 text-purple-500" />;
      default:
        return <Sparkles className="h-3 w-3 text-primary" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'space-y-2 max-h-64 overflow-y-auto pr-2',
        className
      )}
    >
      {reasoningHistory.map((update) => (
        <div
          key={update.id}
          className="flex items-start gap-2 text-xs animate-in fade-in slide-in-from-right-2 duration-300"
        >
          <div className="mt-0.5 flex-shrink-0">
            {getIcon(update.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground leading-relaxed">
              {update.text}
            </p>
          </div>
        </div>
      ))}

      {/* Current streaming reasoning */}
      {aiReasoning && reasoningMode !== 'complete' && (
        <div className="flex items-start gap-2 text-xs">
          <div className="mt-0.5 flex-shrink-0">
            <Sparkles className="h-3 w-3 text-purple-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground leading-relaxed">
              <StreamingText
                text={aiReasoning}
                speed={3}
                delay={10}
                pauseOnComplete={false}
              />
            </p>
          </div>
        </div>
      )}

      {/* Show placeholder when no reasoning yet */}
      {reasoningHistory.length === 0 && !aiReasoning && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="animate-pulse">●</span>
          <span>Preparing to generate your plan...</span>
        </div>
      )}
    </div>
  );
}

// Helper component for streaming individual text
function StreamingText({
  text,
  speed = 3,
  delay = 10,
  pauseOnComplete = false,
}: {
  text: string;
  speed?: number;
  delay?: number;
  pauseOnComplete?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    if (displayedText.length >= text.length) {
      setIsComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      const charsToAdd = Math.min(speed, text.length - displayedText.length);
      const newText = text.substring(0, displayedText.length + charsToAdd);
      setDisplayedText(newText);

      if (newText.length === text.length) {
        setIsComplete(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, displayedText, speed, delay]);

  return (
    <>
      {displayedText}
      {(!isComplete || pauseOnComplete) && (
        <span className="animate-pulse text-primary ml-0.5">▊</span>
      )}
    </>
  );
}

