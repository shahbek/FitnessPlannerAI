import React, { useState } from 'react';
import { MultiAgentPlan, AgentResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface AgentReasoningProps {
  agentResponses: Partial<MultiAgentPlan>;
  loading?: boolean;
  currentPhase?: string;
}

export function AgentReasoning({ agentResponses, loading, currentPhase }: AgentReasoningProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const toggleAgent = (agent: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agent)) {
      newExpanded.delete(agent);
    } else {
      newExpanded.add(agent);
    }
    setExpandedAgents(newExpanded);
  };

  const getAgentInfo = (agent: string) => {
    const agents: Record<string, { name: string; icon: string; color: string; description: string }> = {
      physiological_analyst: {
        name: 'Physiological Analyst',
        icon: '🧬',
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        description: 'Analyzes body composition, metabolic state, and physiological responses'
      },
      training_programmer: {
        name: 'Training Programmer',
        icon: '💪',
        color: 'bg-green-50 border-green-200 text-green-800',
        description: 'Designs progressive training programs with periodization and fatigue management'
      },
      nutrition_strategist: {
        name: 'Nutrition Strategist',
        icon: '🥗',
        color: 'bg-orange-50 border-orange-200 text-orange-800',
        description: 'Creates nutrition strategies with macro periodization and adherence optimization'
      },
      master_coordinator: {
        name: 'Master Coordinator',
        icon: '🎯',
        color: 'bg-purple-50 border-purple-200 text-purple-800',
        description: 'Synthesizes all recommendations into a cohesive, integrated plan'
      }
    };
    return agents[agent] || { name: agent, icon: '🤖', color: 'bg-gray-50 border-gray-200 text-gray-800', description: 'AI Agent' };
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const renderAgentCard = (agent: string, response: AgentResponse) => {
    const info = getAgentInfo(agent);
    const isExpanded = expandedAgents.has(agent);
    const isSelected = selectedAgent === agent;

    return (
      <Card 
        key={agent}
        className={`transition-all duration-200 ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <div className={`p-4 rounded-lg border-l-4 ${info.color}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{info.icon}</span>
              <div>
                <h4 className="font-semibold text-lg">{info.name}</h4>
                <p className="text-sm text-gray-600">{info.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <div className={`text-sm font-medium ${getConfidenceColor(response.confidence)}`}>
                  {getConfidenceLabel(response.confidence)} Confidence
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(response.confidence * 100)}%
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAgent(isSelected ? null : agent)}
              >
                {isSelected ? 'Hide' : 'Focus'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toggleAgent(agent)}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>

          {/* Reasoning Preview */}
          <div className="mt-3">
            <div className="text-sm text-gray-700 line-clamp-3">
              {response.reasoning}
            </div>
          </div>

          {/* Key Recommendations Preview */}
          {response.recommendations && (
            <div className="mt-3">
              <div className="text-sm font-medium text-gray-600 mb-1">Key Recommendations:</div>
              <div className="text-sm text-gray-700">
                {Object.keys(response.recommendations).slice(0, 3).map((key, index) => (
                  <span key={index}>
                    {key.replace(/_/g, ' ')}
                    {index < 2 && ', '}
                  </span>
                ))}
                {Object.keys(response.recommendations).length > 3 && '...'}
              </div>
            </div>
          )}

          {isExpanded && (
            <div className="mt-6 space-y-6">
              {/* Full Reasoning */}
              <div>
                <h5 className="font-semibold mb-2">Detailed Reasoning</h5>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                  {response.reasoning}
                </div>
              </div>

              {/* Recommendations */}
              {response.recommendations && (
                <div>
                  <h5 className="font-semibold mb-2">Recommendations</h5>
                  <div className="space-y-3">
                    {Object.entries(response.recommendations).map(([key, value], index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="font-medium text-sm text-gray-600 mb-1">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="text-sm text-gray-700">
                          {typeof value === 'object' ? (
                            <pre className="whitespace-pre-wrap text-xs">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : (
                            String(value)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {response.citations && response.citations.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2">Scientific References</h5>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {response.citations.map((citation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        <span>{citation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {response.nextSteps && response.nextSteps.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2">Next Steps</h5>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {response.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-600 mr-2">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderSelectedAgent = () => {
    if (!selectedAgent) return null;

    const response = agentResponses[selectedAgent as keyof MultiAgentPlan];
    if (!response) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {getAgentInfo(selectedAgent).name} - Detailed Analysis
              </h3>
              <Button
                variant="secondary"
                onClick={() => setSelectedAgent(null)}
              >
                Close
              </Button>
            </div>
            {renderAgentCard(selectedAgent, response)}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-sm text-gray-600">
            {currentPhase ? `Running ${currentPhase}...` : 'Generating plan...'}
          </div>
        </div>
      </Card>
    );
  }

  const agents = Object.entries(agentResponses).filter(([_, response]) => response);

  if (agents.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500">
          No agent responses available. Generate a plan to see AI reasoning.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Agent Reasoning</h3>
        <div className="text-sm text-gray-600">
          {agents.length} agent{agents.length !== 1 ? 's' : ''} analyzed
        </div>
      </div>

      <div className="space-y-4">
        {agents.map(([agent, response]) => 
          response ? renderAgentCard(agent, response) : null
        )}
      </div>

      {/* Agent Summary */}
      <Card>
        <h4 className="font-semibold mb-3">Agent Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map(([agent, response]) => {
            if (!response) return null;
            const info = getAgentInfo(agent);
            return (
              <div key={agent} className="text-center">
                <div className="text-2xl mb-2">{info.icon}</div>
                <div className="font-medium text-sm">{info.name}</div>
                <div className={`text-xs ${getConfidenceColor(response.confidence)}`}>
                  {getConfidenceLabel(response.confidence)} Confidence
                </div>
                <div className="text-xs text-gray-500">
                  {response.citations?.length || 0} citations
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {renderSelectedAgent()}
    </div>
  );
}
