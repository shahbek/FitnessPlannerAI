import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { Response } from '@/components/ai-elements/response';
import { BookOpen, Brain, X } from 'lucide-react';

interface ChainOfThoughtSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentLoading: boolean;
  ragProgress: any; // Use any to match the hook's return type
  streamingContent: string;
}

export function ChainOfThoughtSidebar({ 
  isOpen, 
  onClose, 
  currentLoading, 
  ragProgress, 
  streamingContent 
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
          {/* AI Preview */}
          {streamingContent && (
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">AI Preview</span>
                </div>
                <Response>
                  {streamingContent}
                </Response>
              </div>
            </Card>
          )}

          {/* Loading State */}
          {currentLoading && (
            <ChainOfThought defaultOpen={true}>
              <ChainOfThoughtHeader>
                Generating Plan
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
                  
                  <div className="text-sm text-muted-foreground">
                    AI is analyzing your profile and generating a personalized fitness plan...
                  </div>
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
