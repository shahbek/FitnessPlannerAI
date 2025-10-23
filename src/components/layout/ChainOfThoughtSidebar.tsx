import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/Progress';
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { Brain, X } from 'lucide-react';

interface ChainOfThoughtSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentLoading: boolean;
  ragProgress: any;
}

export function ChainOfThoughtSidebar({ 
  isOpen, 
  onClose, 
  currentLoading, 
  ragProgress
}: ChainOfThoughtSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold font-sans flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Chain of Thought
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {/* Loading State */}
          {currentLoading && (
            <ChainOfThought defaultOpen={true}>
              <ChainOfThoughtHeader>
                Generating comprehensive fitness plan...
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <div className="space-y-4">
                  <Progress value={ragProgress?.progress || 0} className="h-3" />
                  <div className="text-sm text-muted-foreground">
                    {ragProgress?.currentStep || 'Processing...'}
                  </div>
                  
                  {ragProgress?.reasoning?.map((reason: string, index: number) => (
                    <ChainOfThoughtStep
                      key={`reasoning-${index}-${reason.substring(0, 20)}`}
                      label={reason}
                      status="complete"
                    />
                  ))}
                  
                  {/* Live AI Object Streaming */}
                  {ragProgress?.streamingContent && ragProgress.streamingContent.length > 0 && (
                    <div className="space-y-4">
                      {console.log('🎯 Rendering streaming content:', ragProgress.streamingContent)}
                      {ragProgress.streamingContent.map((content: any, index: number) => (
                        <CodeBlock
                          key={`streaming-${index}-${Date.now()}`}
                          code={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                          language={typeof content === 'string' ? 'text' : 'json'}
                          showLineNumbers={false}
                        />
                      ))}
                    </div>
                  )}
                  
                </div>
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}

          {/* Completed Plan Generation */}
          {!currentLoading && (
            <ChainOfThought defaultOpen={true}>
              <ChainOfThoughtHeader>
                Plan Generation Complete
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <div className="space-y-2">
                  <ChainOfThoughtStep
                    label="Analyzed user profile and goals"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Generated strategic framework"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Created exercise library"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Designed workout sessions"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Planned meal templates"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Generated shopping list"
                    status="complete"
                  />
                  <ChainOfThoughtStep
                    label="Created phase progression"
                    status="complete"
                  />
                  <div className="text-sm text-green-600 font-medium mt-4">
                    ✅ Your personalized fitness plan is ready!
                  </div>
                </div>
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}
        </div>
      </div>
    </div>
  );
}
