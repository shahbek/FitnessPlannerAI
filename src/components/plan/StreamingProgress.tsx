import React, { useEffect, useState } from 'react';
import { StreamingProgress as StreamingProgressType } from '@/types';
import { Card } from '@/components/ui/Card';

interface StreamingProgressProps {
  progress: StreamingProgressType;
  onComplete?: () => void;
}

export function StreamingProgress({ progress, onComplete }: StreamingProgressProps) {
  const [displayedReasoning, setDisplayedReasoning] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');

  useEffect(() => {
    // Animate reasoning steps appearing
    if (progress.reasoning.length > displayedReasoning.length) {
      const timer = setTimeout(() => {
        setDisplayedReasoning(progress.reasoning);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress.reasoning, displayedReasoning.length]);

  useEffect(() => {
    // Animate current step
    if (progress.currentStep !== currentStep) {
      setCurrentStep(progress.currentStep);
    }
  }, [progress.currentStep, currentStep]);

  const getPhaseIcon = (phase: string) => {
    const icons: Record<string, string> = {
      analysis: '🧬',
      planning: '💡',
      synthesis: '🎯',
      complete: '✅'
    };
    return icons[phase] || '⚙️';
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      analysis: 'text-blue-600',
      planning: 'text-green-600',
      synthesis: 'text-purple-600',
      complete: 'text-green-600'
    };
    return colors[phase] || 'text-gray-600';
  };

  const getPhaseDescription = (phase: string) => {
    const descriptions: Record<string, string> = {
      analysis: 'Analyzing physiological state and calculating timeline',
      planning: 'Designing training and nutrition strategies',
      synthesis: 'Integrating all recommendations into cohesive plan',
      complete: 'Plan generation complete!'
    };
    return descriptions[phase] || 'Processing...';
  };

  const getProgressBarColor = (phase: string) => {
    const colors: Record<string, string> = {
      analysis: 'bg-blue-500',
      planning: 'bg-green-500',
      synthesis: 'bg-purple-500',
      complete: 'bg-green-500'
    };
    return colors[phase] || 'bg-gray-500';
  };

  const getAgentStatus = (phase: string) => {
    const agents: Record<string, string[]> = {
      analysis: ['Physiological Analyst'],
      planning: ['Training Programmer', 'Nutrition Strategist'],
      synthesis: ['Master Coordinator'],
      complete: ['All Agents Complete']
    };
    return agents[phase] || [];
  };

  return (
    <Card>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getPhaseIcon(progress.phase)}</span>
            <div>
              <h3 className="text-lg font-semibold">
                {progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)} Phase
              </h3>
              <p className="text-sm text-gray-600">
                {getPhaseDescription(progress.phase)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(progress.progress)}%
            </div>
            <div className="text-sm text-gray-500">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(progress.phase)}`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {/* Current Step */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Current Step:</span>
          </div>
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            {currentStep}
          </div>
        </div>

        {/* Active Agents */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">Active Agents:</div>
          <div className="flex flex-wrap gap-2">
            {getAgentStatus(progress.phase).map((agent, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {agent}
              </span>
            ))}
          </div>
        </div>

        {/* Reasoning Steps */}
        {displayedReasoning.length > 0 && (
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">AI Reasoning Steps:</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {displayedReasoning.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg animate-fade-in"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="text-sm text-gray-700 flex-1">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partial Results Preview */}
        {progress.partialResults && Object.keys(progress.partialResults).length > 0 && (
          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">Partial Results:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(progress.partialResults).map(([key, value]) => (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className="text-sm text-gray-700">
                    {typeof value === 'object' ? (
                      <div className="text-xs">
                        {Object.keys(value).length} items generated
                      </div>
                    ) : (
                      String(value).slice(0, 50) + (String(value).length > 50 ? '...' : '')
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase Indicators */}
        <div className="flex justify-center space-x-4">
          {['analysis', 'planning', 'synthesis', 'complete'].map((phase, index) => (
            <div
              key={phase}
              className={`flex flex-col items-center space-y-1 ${
                progress.phase === phase
                  ? getPhaseColor(phase)
                  : progress.progress > (index + 1) * 25
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}
            >
              <div className="text-2xl">{getPhaseIcon(phase)}</div>
              <div className="text-xs font-medium">
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </div>
              {progress.phase === phase && (
                <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
              )}
            </div>
          ))}
        </div>

        {/* Completion Message */}
        {progress.phase === 'complete' && onComplete && (
          <div className="mt-6 text-center">
            <div className="text-green-600 text-lg font-semibold mb-2">
              🎉 Plan Generation Complete!
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Your comprehensive multi-week progressive plan is ready for review.
            </p>
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Complete Plan
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </Card>
  );
}
