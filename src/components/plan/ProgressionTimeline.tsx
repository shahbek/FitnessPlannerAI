import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';
import { ProgressivePlan, WeeklyCheckpoint, ProgressionPhase } from '@/types';
import { Card } from '@/components/ui/Card';

interface ProgressionTimelineProps {
  plan: ProgressivePlan;
  selectedWeek?: number;
  onWeekSelect?: (week: number) => void;
}

export function ProgressionTimeline({ plan, selectedWeek, onWeekSelect }: ProgressionTimelineProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'bodycomp' | 'nutrition' | 'training'>('overview');

  // Prepare data for charts
  const chartData = plan.timeline.checkpoints.map((checkpoint, index) => ({
    week: checkpoint.week,
    weight: checkpoint.predictedWeight,
    bodyFat: checkpoint.predictedBodyFat,
    leanMass: checkpoint.predictedLeanMass,
    calories: checkpoint.dailyCalories,
    protein: checkpoint.proteinGrams,
    fat: checkpoint.fatGrams,
    carbs: checkpoint.carbGrams,
    trainingVolume: checkpoint.trainingVolume,
    cardio: checkpoint.cardioMinutes,
    phase: checkpoint.phase,
    phaseType: plan.timeline.phases.find(p => 
      checkpoint.week >= p.startWeek && checkpoint.week <= p.endWeek
    )?.type || 'unknown'
  }));

  // Get phase markers for reference lines
  const phaseMarkers = plan.timeline.phases.map(phase => ({
    week: phase.startWeek + 1,
    name: phase.name,
    type: phase.type
  }));

  const formatTooltip = (value: any, name: string) => {
    const units: Record<string, string> = {
      weight: 'kg',
      bodyFat: '%',
      leanMass: 'kg',
      calories: 'kcal',
      protein: 'g',
      fat: 'g',
      carbs: 'g',
      trainingVolume: 'sets',
      cardio: 'min'
    };
    
    return [`${value}${units[name] || ''}`, name];
  };

  const getPhaseColor = (phaseType: string) => {
    const colors: Record<string, string> = {
      aggressive_cut: '#ef4444',
      moderate_cut: '#f97316',
      mini_cut: '#eab308',
      diet_break: '#22c55e',
      maintenance: '#3b82f6',
      deload: '#8b5cf6'
    };
    return colors[phaseType] || '#6b7280';
  };

  const OverviewChart = () => (
    <div className="space-y-6">
      {/* Body Composition Chart */}
      <div>
        <h4 className="font-semibold mb-3">Body Composition Progression</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="week" 
              label={{ value: 'Week', position: 'insideBottom', offset: -10 }}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="weight" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Weight (kg)"
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="leanMass" 
              stroke="#22c55e" 
              strokeWidth={2}
              name="Lean Mass (kg)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="bodyFat" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Body Fat (%)"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
                label={{ value: marker.name, position: 'top' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Calorie Progression */}
      <div>
        <h4 className="font-semibold mb-3">Calorie Progression</h4>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="calories" 
              stroke="#8b5cf6" 
              fill="#8b5cf6" 
              fillOpacity={0.3}
              name="Daily Calories"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const BodyCompChart = () => (
    <div className="space-y-6">
      {/* Weight and Body Fat */}
      <div>
        <h4 className="font-semibold mb-3">Weight & Body Fat Trends</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="weight" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Weight (kg)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="bodyFat" 
              stroke="#ef4444" 
              strokeWidth={3}
              name="Body Fat (%)"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Lean Mass Preservation */}
      <div>
        <h4 className="font-semibold mb-3">Lean Mass Preservation</h4>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={formatTooltip} />
            <Area 
              type="monotone" 
              dataKey="leanMass" 
              stroke="#22c55e" 
              fill="#22c55e" 
              fillOpacity={0.3}
              name="Lean Mass (kg)"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const NutritionChart = () => (
    <div className="space-y-6">
      {/* Macronutrient Breakdown */}
      <div>
        <h4 className="font-semibold mb-3">Macronutrient Progression</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="protein" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Protein (g)"
            />
            <Line 
              type="monotone" 
              dataKey="fat" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Fat (g)"
            />
            <Line 
              type="monotone" 
              dataKey="carbs" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Carbs (g)"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Calorie Distribution */}
      <div>
        <h4 className="font-semibold mb-3">Calorie Distribution</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData.slice(-8)}> {/* Last 8 weeks */}
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Bar dataKey="calories" fill="#8b5cf6" name="Daily Calories" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const TrainingChart = () => (
    <div className="space-y-6">
      {/* Training Volume */}
      <div>
        <h4 className="font-semibold mb-3">Training Volume Progression</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="trainingVolume" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Training Volume (sets/week)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="cardio" 
              stroke="#22c55e" 
              strokeWidth={2}
              name="Cardio (min/week)"
            />
            {phaseMarkers.map((marker, index) => (
              <ReferenceLine 
                key={index}
                x={marker.week} 
                stroke={getPhaseColor(marker.type)}
                strokeDasharray="5 5"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Phase Overview */}
      <div>
        <h4 className="font-semibold mb-3">Training Phases</h4>
        <div className="space-y-2">
          {plan.timeline.phases.map((phase, index) => (
            <div 
              key={phase.id}
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ borderLeftColor: getPhaseColor(phase.type), borderLeftWidth: 4 }}
            >
              <div>
                <div className="font-medium">{phase.name}</div>
                <div className="text-sm text-gray-600">
                  Weeks {phase.startWeek + 1}-{phase.endWeek + 1} • {phase.type.replace('_', ' ')}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>{phase.targetDeficit}% deficit</div>
                <div>{phase.proteinMultiplier}g/kg protein</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderChart = () => {
    switch (activeTab) {
      case 'bodycomp':
        return <BodyCompChart />;
      case 'nutrition':
        return <NutritionChart />;
      case 'training':
        return <TrainingChart />;
      default:
        return <OverviewChart />;
    }
  };

  return (
    <Card>
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Progression Timeline</h3>
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'bodycomp', label: 'Body Comp' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'training', label: 'Training' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {plan.timeline.totalWeeks}
            </div>
            <div className="text-sm text-gray-600">Total Weeks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {plan.timeline.phases.length}
            </div>
            <div className="text-sm text-gray-600">Phases</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round((plan.currentState.bodyFat - plan.goalState.targetBodyFat) * 10) / 10}%
            </div>
            <div className="text-sm text-gray-600">BF to Lose</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {plan.strategy.approach}
            </div>
            <div className="text-sm text-gray-600">Approach</div>
          </div>
        </div>
      </div>

      {renderChart()}

      {/* Week Selector */}
      {onWeekSelect && (
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Select Week for Details</h4>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {Array.from({ length: plan.timeline.totalWeeks }, (_, i) => {
              const week = i + 1;
              const checkpoint = plan.timeline.checkpoints[i];
              const phase = plan.timeline.phases.find(p => 
                week >= p.startWeek + 1 && week <= p.endWeek + 1
              );
              
              return (
                <button
                  key={week}
                  onClick={() => onWeekSelect(week)}
                  className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedWeek === week
                      ? 'bg-blue-100 text-blue-900 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{
                    borderLeftColor: phase ? getPhaseColor(phase.type) : '#6b7280',
                    borderLeftWidth: 3
                  }}
                >
                  {week}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
