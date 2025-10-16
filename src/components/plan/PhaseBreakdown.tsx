import React, { useState } from 'react';
import { ProgressivePlan, ProgressionPhase, WeeklyCheckpoint } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface PhaseBreakdownProps {
  plan: ProgressivePlan;
  selectedPhase?: number;
  onPhaseSelect?: (phaseIndex: number) => void;
}

export function PhaseBreakdown({ plan, selectedPhase, onPhaseSelect }: PhaseBreakdownProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0]));

  const togglePhase = (phaseIndex: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseIndex)) {
      newExpanded.delete(phaseIndex);
    } else {
      newExpanded.add(phaseIndex);
    }
    setExpandedPhases(newExpanded);
  };

  const getPhaseColor = (phaseType: string) => {
    const colors: Record<string, string> = {
      aggressive_cut: 'bg-red-50 border-red-200 text-red-800',
      moderate_cut: 'bg-orange-50 border-orange-200 text-orange-800',
      mini_cut: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      diet_break: 'bg-green-50 border-green-200 text-green-800',
      maintenance: 'bg-blue-50 border-blue-200 text-blue-800',
      deload: 'bg-purple-50 border-purple-200 text-purple-800'
    };
    return colors[phaseType] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  const getPhaseIcon = (phaseType: string) => {
    const icons: Record<string, string> = {
      aggressive_cut: '🔥',
      moderate_cut: '⚡',
      mini_cut: '💪',
      diet_break: '🍽️',
      maintenance: '⚖️',
      deload: '🔄'
    };
    return icons[phaseType] || '📋';
  };

  const getPhaseDescription = (phase: ProgressionPhase) => {
    const descriptions: Record<string, string> = {
      aggressive_cut: 'High-intensity fat loss phase with significant caloric deficit',
      moderate_cut: 'Balanced fat loss phase with moderate caloric deficit',
      mini_cut: 'Short, focused fat loss phase with minimal deficit',
      diet_break: 'Metabolic reset phase at maintenance calories',
      maintenance: 'Calorie balance phase to maintain current body composition',
      deload: 'Recovery phase with reduced training volume and intensity'
    };
    return descriptions[phase.type] || 'Specialized training phase';
  };

  const getPhaseGoals = (phase: ProgressionPhase) => {
    const goals: Record<string, string[]> = {
      aggressive_cut: [
        'Maximize fat loss while preserving muscle mass',
        'Maintain training intensity with reduced volume',
        'Monitor recovery and energy levels closely',
        'Prepare for diet break if needed'
      ],
      moderate_cut: [
        'Steady fat loss with sustainable approach',
        'Maintain strength and muscle mass',
        'Focus on adherence and consistency',
        'Plan for periodic refeed days'
      ],
      mini_cut: [
        'Quick fat loss push for specific goals',
        'Minimize muscle loss with high protein',
        'Short duration to avoid metabolic adaptation',
        'Quick transition back to maintenance'
      ],
      diet_break: [
        'Restore metabolic rate and hormone levels',
        'Improve training performance and recovery',
        'Provide psychological break from restriction',
        'Prepare for next cutting phase'
      ],
      maintenance: [
        'Maintain current body composition',
        'Focus on strength and performance gains',
        'Establish sustainable habits',
        'Prepare for future goals'
      ],
      deload: [
        'Reduce accumulated fatigue',
        'Allow for supercompensation',
        'Prevent overtraining and injury',
        'Prepare for increased intensity'
      ]
    };
    return goals[phase.type] || ['Phase-specific goals'];
  };

  const getPhaseCheckpoints = (phase: ProgressionPhase): WeeklyCheckpoint[] => {
    return plan.timeline.checkpoints.filter(
      cp => cp.week >= phase.startWeek + 1 && cp.week <= phase.endWeek + 1
    );
  };

  const getPhaseMetrics = (phase: ProgressionPhase) => {
    const checkpoints = getPhaseCheckpoints(phase);
    if (checkpoints.length === 0) return null;

    const first = checkpoints[0];
    const last = checkpoints[checkpoints.length - 1];
    
    return {
      weightChange: last.predictedWeight - first.predictedWeight,
      bodyFatChange: last.predictedBodyFat - first.predictedBodyFat,
      avgCalories: Math.round(
        checkpoints.reduce((sum, cp) => sum + cp.dailyCalories, 0) / checkpoints.length
      ),
      avgProtein: Math.round(
        checkpoints.reduce((sum, cp) => sum + cp.proteinGrams, 0) / checkpoints.length
      ),
      avgVolume: Math.round(
        checkpoints.reduce((sum, cp) => sum + cp.trainingVolume, 0) / checkpoints.length
      )
    };
  };

  const getTransitionTriggers = (phase: ProgressionPhase, nextPhase?: ProgressionPhase) => {
    if (!nextPhase) return ['Phase completion'];

    const triggers: Record<string, string[]> = {
      'aggressive_cut->diet_break': [
        '8-12 weeks of cutting completed',
        'Significant metabolic adaptation detected',
        'Energy levels consistently low',
        'Training performance declining'
      ],
      'moderate_cut->diet_break': [
        '10-12 weeks of cutting completed',
        'Moderate metabolic adaptation',
        'Hunger levels increasing',
        'Sleep quality declining'
      ],
      'diet_break->aggressive_cut': [
        '2 weeks of maintenance completed',
        'Metabolic markers restored',
        'Energy and performance improved',
        'Ready for next cutting phase'
      ],
      'diet_break->moderate_cut': [
        '2 weeks of maintenance completed',
        'Hormone levels normalized',
        'Recovery improved',
        'Prepared for moderate deficit'
      ]
    };

    const key = `${phase.type}->${nextPhase.type}`;
    return triggers[key] || ['Standard phase transition criteria'];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Phase Breakdown</h3>
        <div className="text-sm text-gray-600">
          {plan.timeline.phases.length} phases • {plan.timeline.totalWeeks} weeks total
        </div>
      </div>

      {plan.timeline.phases.map((phase, index) => {
        const isExpanded = expandedPhases.has(index);
        const isSelected = selectedPhase === index;
        const metrics = getPhaseMetrics(phase);
        const nextPhase = plan.timeline.phases[index + 1];
        const checkpoints = getPhaseCheckpoints(phase);

        return (
          <Card 
            key={phase.id}
            className={`transition-all duration-200 ${
              isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div 
              className={`p-4 rounded-lg border-l-4 ${getPhaseColor(phase.type)}`}
              style={{ borderLeftColor: getPhaseColor(phase.type).split(' ')[1].replace('border-', '#') }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getPhaseIcon(phase.type)}</span>
                  <div>
                    <h4 className="font-semibold text-lg">{phase.name}</h4>
                    <p className="text-sm text-gray-600">
                      Weeks {phase.startWeek + 1}-{phase.endWeek + 1} • {phase.endWeek - phase.startWeek + 1} weeks
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onPhaseSelect?.(index)}
                    className={isSelected ? 'bg-blue-100 text-blue-900' : ''}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => togglePhase(index)}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-sm text-gray-700">{getPhaseDescription(phase)}</p>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Rationale:</span> {phase.rationale}
                </div>
              </div>

              {metrics && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {metrics.weightChange > 0 ? '+' : ''}{metrics.weightChange.toFixed(1)}kg
                    </div>
                    <div className="text-xs text-gray-600">Weight Change</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">
                      {metrics.bodyFatChange > 0 ? '+' : ''}{metrics.bodyFatChange.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">BF Change</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">{metrics.avgCalories}</div>
                    <div className="text-xs text-gray-600">Avg Calories</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{metrics.avgProtein}g</div>
                    <div className="text-xs text-gray-600">Avg Protein</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-600">{metrics.avgVolume}</div>
                    <div className="text-xs text-gray-600">Avg Volume</div>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="mt-6 space-y-6">
                  {/* Phase Goals */}
                  <div>
                    <h5 className="font-semibold mb-2">Phase Goals</h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {getPhaseGoals(phase).map((goal, goalIndex) => (
                        <li key={goalIndex}>{goal}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Phase Parameters */}
                  <div>
                    <h5 className="font-semibold mb-2">Phase Parameters</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Deficit:</span> {phase.targetDeficit}%
                      </div>
                      <div>
                        <span className="font-medium">Protein:</span> {phase.proteinMultiplier}g/kg
                      </div>
                      <div>
                        <span className="font-medium">Volume:</span> {Math.round(phase.volumeAdjustment * 100)}%
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span> {phase.endWeek - phase.startWeek + 1} weeks
                      </div>
                    </div>
                  </div>

                  {/* Weekly Breakdown */}
                  <div>
                    <h5 className="font-semibold mb-2">Weekly Breakdown</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left">Week</th>
                            <th className="px-3 py-2 text-left">Weight</th>
                            <th className="px-3 py-2 text-left">BF%</th>
                            <th className="px-3 py-2 text-left">Calories</th>
                            <th className="px-3 py-2 text-left">Protein</th>
                            <th className="px-3 py-2 text-left">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkpoints.map((checkpoint) => (
                            <tr key={checkpoint.week} className="border-t">
                              <td className="px-3 py-2 font-medium">{checkpoint.week}</td>
                              <td className="px-3 py-2">{checkpoint.predictedWeight}kg</td>
                              <td className="px-3 py-2">{checkpoint.predictedBodyFat}%</td>
                              <td className="px-3 py-2">{checkpoint.dailyCalories}</td>
                              <td className="px-3 py-2">{checkpoint.proteinGrams}g</td>
                              <td className="px-3 py-2">{checkpoint.trainingVolume}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transition Criteria */}
                  <div>
                    <h5 className="font-semibold mb-2">
                      Transition to {nextPhase?.name || 'Next Phase'}
                    </h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {getTransitionTriggers(phase, nextPhase).map((trigger, triggerIndex) => (
                        <li key={triggerIndex}>{trigger}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Phase Notes */}
                  {checkpoints.some(cp => cp.notes) && (
                    <div>
                      <h5 className="font-semibold mb-2">Phase Notes</h5>
                      <div className="space-y-1 text-sm text-gray-700">
                        {checkpoints
                          .filter(cp => cp.notes)
                          .map((checkpoint, noteIndex) => (
                            <div key={noteIndex} className="flex">
                              <span className="font-medium mr-2">Week {checkpoint.week}:</span>
                              <span>{checkpoint.notes}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Phase Summary */}
      <Card>
        <h4 className="font-semibold mb-3">Phase Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h5 className="font-medium text-sm text-gray-600 mb-2">Cutting Phases</h5>
            <div className="text-2xl font-bold text-red-600">
              {plan.timeline.phases.filter(p => p.type.includes('cut')).length}
            </div>
            <div className="text-sm text-gray-600">
              {plan.timeline.phases
                .filter(p => p.type.includes('cut'))
                .reduce((sum, p) => sum + (p.endWeek - p.startWeek + 1), 0)} weeks total
            </div>
          </div>
          <div>
            <h5 className="font-medium text-sm text-gray-600 mb-2">Diet Breaks</h5>
            <div className="text-2xl font-bold text-green-600">
              {plan.timeline.phases.filter(p => p.type === 'diet_break').length}
            </div>
            <div className="text-sm text-gray-600">
              {plan.timeline.phases
                .filter(p => p.type === 'diet_break')
                .reduce((sum, p) => sum + (p.endWeek - p.startWeek + 1), 0)} weeks total
            </div>
          </div>
          <div>
            <h5 className="font-medium text-sm text-gray-600 mb-2">Deload Weeks</h5>
            <div className="text-2xl font-bold text-purple-600">
              {plan.timeline.phases.filter(p => p.type === 'deload').length}
            </div>
            <div className="text-sm text-gray-600">
              {plan.timeline.phases
                .filter(p => p.type === 'deload')
                .reduce((sum, p) => sum + (p.endWeek - p.startWeek + 1), 0)} weeks total
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
