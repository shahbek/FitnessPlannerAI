import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  text: string;
  className?: string;
  speed?: number; // Characters per interval (default: 1)
  delay?: number; // Delay between characters in ms (default: 20)
  onComplete?: () => void;
  pauseOnComplete?: boolean; // Whether to keep cursor after completion
}

/**
 * StreamingText - A typewriter/streaming text effect component
 * Shows text character by character to simulate AI thinking/typing
 */
export function StreamingText({
  text,
  className,
  speed = 1,
  delay = 20,
  onComplete,
  pauseOnComplete = false,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    // Reset if text changes
    if (displayedText.length > text.length) {
      setDisplayedText('');
      setIsComplete(false);
    }

    // If text is already complete, show it immediately
    if (displayedText === text) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    // Calculate how many characters to add
    const remaining = text.length - displayedText.length;
    const charsToAdd = Math.min(speed, remaining);

    // Add characters
    const timer = setTimeout(() => {
      const newText = text.substring(0, displayedText.length + charsToAdd);
      setDisplayedText(newText);

      if (newText.length === text.length) {
        setIsComplete(true);
        onComplete?.();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, displayedText, speed, delay, onComplete]);

  return (
    <span className={cn('inline-block', className)}>
      {displayedText}
      {(!isComplete || pauseOnComplete) && (
        <span className="animate-pulse text-primary ml-0.5">▊</span>
      )}
    </span>
  );
}

interface StreamingReasoningProps {
  currentReasoning?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * StreamingReasoning - Shows what the AI is currently working on
 * Streams updates as new reasoning text comes in
 */
export function StreamingReasoning({
  currentReasoning,
  className,
  prefix = '🤔 ',
  suffix = '',
}: StreamingReasoningProps) {
  return (
    <div className={cn('text-sm text-muted-foreground', className)}>
      {currentReasoning ? (
        <StreamingText
          text={`${prefix}${currentReasoning}${suffix}`}
          speed={2}
          delay={15}
          pauseOnComplete={false}
        />
      ) : (
        <span className="inline-flex items-center gap-2">
          <span className="animate-pulse">●</span>
          <span>AI is analyzing...</span>
        </span>
      )}
    </div>
  );
}

