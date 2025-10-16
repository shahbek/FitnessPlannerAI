import React, { useState } from 'react';
import { ProgressivePlan, WeeklyCheckpoint } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface WeeklyCheckInProps {
  plan: ProgressivePlan;
  currentWeek: number;
  onAdjustPlan: (adjustments: any) => void;
  loading?: boolean;
}

interface CheckInData {
  actualWeight: number;
  actualBodyFat?: number;
  adherenceScore: number; // 1-10
  energyLevel: number; // 1-10
  hungerLevel: number; // 1-10
  sleepQuality: number; // 1-10
  trainingPerformance: number; // 1-10
  notes: string;
  missedWorkouts: number;
  dietDeviations: number;
}

export function WeeklyCheckIn({ plan, currentWeek, onAdjustPlan, loading }: WeeklyCheckInProps) {
  const [checkInData, setCheckInData] = useState<CheckInData>({
    actualWeight: 0,
    actualBodyFat: undefined,
    adherenceScore: 7,
    energyLevel: 7,
    hungerLevel: 5,
    sleepQuality: 7,
    trainingPerformance: 7,
    notes: '',
    missedWorkouts: 0,
    dietDeviations: 0
  });

  const [showAdjustments, setShowAdjustments] = useState(false);
  const [adjustments, setAdjustments] = useState<any>(null);

  const currentCheckpoint = plan.timeline.checkpoints.find(cp => cp.week === currentWeek);
  const previousCheckpoint = plan.timeline.checkpoints.find(cp => cp.week === currentWeek - 1);

  if (!currentCheckpoint) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500">
          No checkpoint found for week {currentWeek}
        </div>
      </Card>
    );
  }

  const handleInputChange = (field: keyof CheckInData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setCheckInData(prev => ({ ...prev, [field]: value }));
  };

  const calculateDeviations = () => {
    if (!previousCheckpoint) return null;

    const weightDeviation = checkInData.actualWeight - currentCheckpoint.predictedWeight;
    const adherenceDeviation = checkInData.adherenceScore - 8; // Target adherence
    const energyDeviation = checkInData.energyLevel - 7; // Target energy
    const hungerDeviation = checkInData.hungerLevel - 6; // Target hunger (slightly elevated)

    return {
      weightDeviation,
      adherenceDeviation,
      energyDeviation,
      hungerDeviation,
      overallDeviation: (weightDeviation + adherenceDeviation + energyDeviation + hungerDeviation) / 4
    };
  };

  const generateAdjustments = () => {
    const deviations = calculateDeviations();
    if (!deviations) return;

    const adjustments: any = {
      week: currentWeek,
      deviations,
      recommendations: []
    };

    // Weight-based adjustments
    if (deviations.weightDeviation > 0.5) {
      adjustments.recommendations.push({
        type: 'calorie_reduction',
        value: -100,
        reason: 'Weight loss slower than predicted - reduce calories by 100 kcal/day'
      });
    } else if (deviations.weightDeviation < -0.5) {
      adjustments.recommendations.push({
        type: 'calorie_increase',
        value: 100,
        reason: 'Weight loss faster than predicted - increase calories by 100 kcal/day'
      });
    }

    // Adherence-based adjustments
    if (deviations.adherenceDeviation < -2) {
      adjustments.recommendations.push({
        type: 'simplify_plan',
        reason: 'Low adherence - simplify meal plan and training schedule'
      });
    }

    // Energy-based adjustments
    if (deviations.energyDeviation < -2) {
      adjustments.recommendations.push({
        type: 'reduce_volume',
        value: 0.8,
        reason: 'Low energy levels - reduce training volume by 20%'
      });
    }

    // Hunger-based adjustments
    if (deviations.hungerDeviation > 2) {
      adjustments.recommendations.push({
        type: 'increase_protein',
        value: 0.2,
        reason: 'High hunger levels - increase protein by 0.2g/kg bodyweight'
      });
    }

    // Sleep-based adjustments
    if (checkInData.sleepQuality < 6) {
      adjustments.recommendations.push({
        type: 'prioritize_recovery',
        reason: 'Poor sleep quality - prioritize recovery and reduce stress'
      });
    }

    // Training performance adjustments
    if (checkInData.trainingPerformance < 6) {
      adjustments.recommendations.push({
        type: 'deload_week',
        reason: 'Poor training performance - consider deload week'
      });
    }

    setAdjustments(adjustments);
    setShowAdjustments(true);
  };

  const applyAdjustments = () => {
    if (adjustments) {
      onAdjustPlan(adjustments);
      setShowAdjustments(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Week {currentWeek} Check-In</h3>
          
          {/* Current vs Predicted */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-medium mb-3">Predicted Values</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Weight:</span>
                  <span className="font-mono">{currentCheckpoint.predictedWeight}kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Body Fat:</span>
                  <span className="font-mono">{currentCheckpoint.predictedBodyFat}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Calories:</span>
                  <span className="font-mono">{currentCheckpoint.dailyCalories}/day</span>
                </div>
                <div className="flex justify-between">
                  <span>Protein:</span>
                  <span className="font-mono">{currentCheckpoint.proteinGrams}g/day</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Actual Values</h4>
              <div className="space-y-2">
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={checkInData.actualWeight || ''}
                    onChange={handleInputChange('actualWeight')}
                    placeholder="Enter current weight"
                  />
                </div>
                <div>
                  <Label>Body Fat % (optional)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={checkInData.actualBodyFat || ''}
                    onChange={handleInputChange('actualBodyFat')}
                    placeholder="Enter body fat %"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Subjective Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div>
              <Label>Adherence Score (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={checkInData.adherenceScore}
                onChange={handleInputChange('adherenceScore')}
              />
              <div className={`text-sm mt-1 ${getScoreColor(checkInData.adherenceScore)}`}>
                {getScoreLabel(checkInData.adherenceScore)}
              </div>
            </div>
            
            <div>
              <Label>Energy Level (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={checkInData.energyLevel}
                onChange={handleInputChange('energyLevel')}
              />
              <div className={`text-sm mt-1 ${getScoreColor(checkInData.energyLevel)}`}>
                {getScoreLabel(checkInData.energyLevel)}
              </div>
            </div>
            
            <div>
              <Label>Hunger Level (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={checkInData.hungerLevel}
                onChange={handleInputChange('hungerLevel')}
              />
              <div className={`text-sm mt-1 ${getScoreColor(10 - checkInData.hungerLevel)}`}>
                {getScoreLabel(10 - checkInData.hungerLevel)}
              </div>
            </div>
            
            <div>
              <Label>Sleep Quality (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={checkInData.sleepQuality}
                onChange={handleInputChange('sleepQuality')}
              />
              <div className={`text-sm mt-1 ${getScoreColor(checkInData.sleepQuality)}`}>
                {getScoreLabel(checkInData.sleepQuality)}
              </div>
            </div>
            
            <div>
              <Label>Training Performance (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={checkInData.trainingPerformance}
                onChange={handleInputChange('trainingPerformance')}
              />
              <div className={`text-sm mt-1 ${getScoreColor(checkInData.trainingPerformance)}`}>
                {getScoreLabel(checkInData.trainingPerformance)}
              </div>
            </div>
            
            <div>
              <Label>Missed Workouts</Label>
              <Input
                type="number"
                min="0"
                max="7"
                value={checkInData.missedWorkouts}
                onChange={handleInputChange('missedWorkouts')}
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="mb-6">
            <Label>Notes & Observations</Label>
            <textarea
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg resize-none"
              rows={3}
              value={checkInData.notes}
              onChange={handleInputChange('notes')}
              placeholder="Any additional observations, challenges, or successes this week..."
            />
          </div>

          {/* Generate Adjustments Button */}
          <div className="flex justify-center">
            <Button
              onClick={generateAdjustments}
              disabled={loading || !checkInData.actualWeight}
              className="px-8 py-2"
            >
              {loading ? 'Analyzing...' : 'Generate Adjustments'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Adjustments Display */}
      {showAdjustments && adjustments && (
        <Card>
          <div className="p-6">
            <h4 className="text-lg font-semibold mb-4">AI-Powered Adjustments</h4>
            
            {/* Deviation Analysis */}
            <div className="mb-6">
              <h5 className="font-medium mb-3">Deviation Analysis</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Weight</div>
                  <div className={`text-lg ${adjustments.deviations.weightDeviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {adjustments.deviations.weightDeviation > 0 ? '+' : ''}{adjustments.deviations.weightDeviation.toFixed(1)}kg
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Adherence</div>
                  <div className={`text-lg ${adjustments.deviations.adherenceDeviation < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {adjustments.deviations.adherenceDeviation > 0 ? '+' : ''}{adjustments.deviations.adherenceDeviation.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Energy</div>
                  <div className={`text-lg ${adjustments.deviations.energyDeviation < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {adjustments.deviations.energyDeviation > 0 ? '+' : ''}{adjustments.deviations.energyDeviation.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">Overall</div>
                  <div className={`text-lg ${adjustments.deviations.overallDeviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {adjustments.deviations.overallDeviation > 0 ? '+' : ''}{adjustments.deviations.overallDeviation.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mb-6">
              <h5 className="font-medium mb-3">Recommended Adjustments</h5>
              <div className="space-y-3">
                {adjustments.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-blue-900">
                          {rec.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          {rec.value && ` (${rec.value > 0 ? '+' : ''}${rec.value})`}
                        </div>
                        <div className="text-sm text-blue-700 mt-1">
                          {rec.reason}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <Button
                variant="secondary"
                onClick={() => setShowAdjustments(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={applyAdjustments}
                className="px-6"
              >
                Apply Adjustments
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
