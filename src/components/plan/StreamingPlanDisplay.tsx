import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { 
  Activity, 
  Brain, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Dumbbell, 
  Heart, 
  Loader2, 
  Target, 
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

interface StreamingPlanDisplayProps {
  plan: any;
  isStreaming?: boolean;
  streamingContent?: string;
  onComplete?: () => void;
}

export function StreamingPlanDisplay({ 
  plan, 
  isStreaming = false, 
  streamingContent = '', 
  onComplete 
}: StreamingPlanDisplayProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentSection, setCurrentSection] = useState('');

  useEffect(() => {
    if (streamingContent) {
      setDisplayedContent(prev => prev + streamingContent);
    }
  }, [streamingContent]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 0.8) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  if (!plan && !isStreaming) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Ready to Generate Your Plan</h3>
          <p className="text-muted-foreground">
            Fill out your profile and click "Generate Plan" to create your personalized fitness plan.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with confidence score */}
      {plan?.feasibility && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">AI Fitness Plan</h2>
              <p className="text-muted-foreground">
                Generated with scientific evidence and research-backed recommendations
              </p>
            </div>
            <Badge className={getConfidenceColor(plan.feasibility.confidenceScore)}>
              {getConfidenceLabel(plan.feasibility.confidenceScore)} Confidence
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Confidence Score</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {Math.round(plan.feasibility.confidenceScore * 100)}%
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Research Sources</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {plan.feasibility.researchCitations?.length || 0}
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Validation</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {plan.feasibility.isFeasible ? 'Valid' : 'Review Needed'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Streaming content */}
      {isStreaming && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Generating your personalized plan...</span>
          </div>
          <Progress value={75} className="mb-4" />
          <div className="text-sm text-muted-foreground">
            <p>• Analyzing your profile and goals</p>
            <p>• Retrieving scientific research</p>
            <p>• Generating training and nutrition plans</p>
            <p>• Validating recommendations</p>
          </div>
        </Card>
      )}

      {/* Strategic Framework */}
      {plan?.strategicFramework && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Strategic Framework
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Training Approach */}
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Training Approach</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Split</span>
                  <span className="font-medium">{plan.strategicFramework.trainingApproach?.split}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Frequency</span>
                  <span className="font-medium">{plan.strategicFramework.trainingApproach?.frequencyPerWeek} days/week</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Session Duration</span>
                  <span className="font-medium">{plan.strategicFramework.trainingApproach?.sessionDurationMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Periodization</span>
                  <span className="font-medium">{plan.strategicFramework.trainingApproach?.periodization}</span>
                </div>
              </div>
            </div>

            {/* Nutrition Approach */}
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Nutrition Approach</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Caloric Strategy</span>
                  <span className="font-medium">{plan.strategicFramework.nutritionApproach?.caloricStrategy?.deficitMagnitude}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Daily Deficit</span>
                  <span className="font-medium">{plan.strategicFramework.nutritionApproach?.caloricStrategy?.dailyDeficitCalories} cal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Protein Target</span>
                  <span className="font-medium">{plan.strategicFramework.nutritionApproach?.macroTargets?.proteinTotalGrams}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Meals Per Day</span>
                  <span className="font-medium">{plan.strategicFramework.nutritionApproach?.mealStructure?.mealsPerDay || 4}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Exercise Library */}
      {plan?.exerciseLibrary && plan.exerciseLibrary.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Exercise Library ({plan.exerciseLibrary.length} exercises)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.exerciseLibrary.slice(0, 6).map((exercise: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{exercise.name}</h4>
                  <Badge variant="outline">{exercise.difficulty}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {exercise.muscleGroups?.join(', ')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Equipment: {exercise.equipment?.join(', ')}
                </div>
              </div>
            ))}
          </div>
          
          {plan.exerciseLibrary.length > 6 && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm">
                View All {plan.exerciseLibrary.length} Exercises
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Session Templates */}
      {plan?.sessionTemplates && plan.sessionTemplates.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Training Sessions ({plan.sessionTemplates.length} templates)
          </h3>
          
          <div className="space-y-4">
            {plan.sessionTemplates.slice(0, 3).map((session: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{session.name}</h4>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{session.totalDurationMinutes} min</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {session.structure?.length || 0} exercises
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Meal Templates */}
      {plan?.mealTemplates && plan.mealTemplates.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Nutrition Plan ({plan.mealTemplates.length} meal templates)
          </h3>
          
          <div className="space-y-4">
            {plan.mealTemplates.slice(0, 2).map((meal: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{meal.templateId}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{meal.totalDailyCalories} cal</span>
                    <span>{meal.totalDailyProteinG}g protein</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {meal.meals?.length || 0} meals per day
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Phase Progression */}
      {plan?.phaseProgression && plan.phaseProgression.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Program Phases ({plan.phaseProgression.length} phases)
          </h3>
          
          <div className="space-y-4">
            {plan.phaseProgression.map((phase: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{phase.phaseName}</h4>
                  <Badge variant="outline">
                    Weeks {phase.weekRange?.start}-{phase.weekRange?.end}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {phase.goals?.join(', ')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Expected: {phase.expectedOutcomes}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Shopping List */}
      {plan?.shoppingList && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Weekly Shopping List
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(plan.shoppingList).map(([category, items]: [string, any]) => (
              <div key={category} className="p-4 border rounded-lg">
                <h4 className="font-medium capitalize mb-2">{category}</h4>
                <div className="space-y-1">
                  {Array.isArray(items) && items.slice(0, 3).map((item: string, index: number) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      • {item}
                    </div>
                  ))}
                  {Array.isArray(items) && items.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{items.length - 3} more items
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download Full Plan
        </Button>
        <Button variant="outline" className="flex-1">
          <Activity className="h-4 w-4 mr-2" />
          Start Tracking
        </Button>
      </div>
    </div>
  );
}
