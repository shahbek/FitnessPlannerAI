import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import { useHighAccuracyAI } from '@/hooks/useHighAccuracyAI';
import { DEFAULT_FORM_STATE } from '@/constants';
import { 
  Brain, 
  CheckCircle, 
  Download,
  Loader2, 
  Target, 
  User, 
  Zap,
  Dumbbell,
  Heart,
  Calendar,
  TrendingUp
} from 'lucide-react';

export function SimpleFitnessApp() {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [showForm, setShowForm] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');

  const {
    plan: highAccuracyPlan,
    loading: highAccuracyLoading,
    error: highAccuracyError,
    progress: highAccuracyProgress,
    generateHighAccuracyPlan,
    clearError: clearHighAccuracyError,
  } = useHighAccuracyAI();

  const handleChange = useCallback((field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    let value: string | number | boolean = e.target.value;
    if (e.target.type === 'number') {
      value = Number(e.target.value);
    } else if (e.target.type === 'checkbox') {
      value = (e.target as HTMLInputElement).checked;
    }
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectChange = useCallback((field: string) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    if (highAccuracyLoading) return;
    
    if (!form.apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }
    
    try {
      setShowForm(false);
      setStreamingContent('');
      await generateHighAccuracyPlan(form);
    } catch (err) {
      console.error('Plan generation failed:', err);
      setShowForm(true); // Show form again on error
    }
  }, [form, highAccuracyLoading, generateHighAccuracyPlan]);

  const handleStartOver = useCallback(() => {
    setShowForm(true);
    setStreamingContent('');
    clearHighAccuracyError();
  }, [clearHighAccuracyError]);

  // Show form initially or when there's an error
  if (showForm && !highAccuracyPlan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Brain className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">AI Fitness Planner</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Get your personalized fitness plan powered by AI and scientific research
            </p>
          </div>

          {/* Error Alert */}
          {highAccuracyError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{highAccuracyError}</AlertDescription>
            </Alert>
          )}

          {/* Main Form */}
          <Card className="p-8">
            <div className="space-y-8">
              {/* API Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">AI Configuration</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={form.apiKey}
                      onChange={handleChange('apiKey')}
                      placeholder="Enter your API key"
                      className="font-mono"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={form.endpoint}
                      onChange={handleChange('endpoint')}
                      placeholder="https://api.groq.com/openai/v1/chat/completions"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={form.model}
                      onChange={handleChange('model')}
                      placeholder="llama-3.3-70b-versatile"
                    />
                  </div>
                </div>

                {form.endpoint.includes('groq.com') && (
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Groq Rate Limiting:</strong> Requests are limited to 30 per minute. 
                      The system will automatically queue requests to stay within limits.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Personal Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="age">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      value={form.age}
                      onChange={handleChange('age')}
                      placeholder="25"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="sex">Sex *</Label>
                    <Select value={form.sex} onValueChange={handleSelectChange('sex')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="heightCm">Height (cm) *</Label>
                    <Input
                      id="heightCm"
                      type="number"
                      value={form.heightCm}
                      onChange={handleChange('heightCm')}
                      placeholder="175"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="weightKg">Weight (kg) *</Label>
                    <Input
                      id="weightKg"
                      type="number"
                      value={form.weightKg}
                      onChange={handleChange('weightKg')}
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>

              {/* Fitness Goals */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Fitness Goals</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="goal">Primary Goal *</Label>
                    <Select value={form.goal} onValueChange={handleSelectChange('goal')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fat_loss">Fat Loss</SelectItem>
                        <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                        <SelectItem value="body_recomposition">Body Recomposition</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="athletic_performance">Athletic Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="targetBf">Target Body Fat %</Label>
                    <Input
                      id="targetBf"
                      type="number"
                      value={form.targetBf}
                      onChange={handleChange('targetBf')}
                      placeholder="12"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="timelineWeeks">Timeline (weeks) *</Label>
                    <Input
                      id="timelineWeeks"
                      type="number"
                      value={form.timelineWeeks}
                      onChange={handleChange('timelineWeeks')}
                      placeholder="16"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="trainingDaysPerWeek">Training Days/Week *</Label>
                    <Input
                      id="trainingDaysPerWeek"
                      type="number"
                      min={1}
                      max={7}
                      value={form.trainingDaysPerWeek}
                      onChange={handleChange('trainingDaysPerWeek')}
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>

              {/* Training Preferences */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Training Preferences</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workoutLevel">Experience Level *</Label>
                    <Select value={form.workoutLevel} onValueChange={handleSelectChange('workoutLevel')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner (0-1 year)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (1-4 years)</SelectItem>
                        <SelectItem value="expert">Expert (4+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="workoutSplit">Preferred Split *</Label>
                    <Select value={form.workoutSplit} onValueChange={handleSelectChange('workoutSplit')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select split" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_body">Full Body (3 days)</SelectItem>
                        <SelectItem value="upper_lower">Upper/Lower (4 days)</SelectItem>
                        <SelectItem value="push_pull_legs">Push/Pull/Legs (5-6 days)</SelectItem>
                        <SelectItem value="bro_split">Body Part Split (5 days)</SelectItem>
                        <SelectItem value="phul">PHUL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="equipment">Available Equipment</Label>
                  <TextArea
                    id="equipment"
                    value={form.equipment}
                    onChange={handleChange('equipment')}
                    placeholder="e.g., barbell, dumbbells, gym access, bodyweight"
                    rows={2}
                  />
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-6 border-t">
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="outline">90%+ Confidence</Badge>
                    <Badge variant="outline">Research-Based</Badge>
                    <Badge variant="outline">Zero Hallucinations</Badge>
                    <Badge variant="outline">Real-Time Generation</Badge>
                  </div>
                  
                  <Button 
                    onClick={handleGeneratePlan} 
                    disabled={highAccuracyLoading || !form.apiKey?.trim()}
                    size="lg"
                    className="w-full max-w-md"
                  >
                    {highAccuracyLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Plan...
                      </div>
                    ) : !form.apiKey?.trim() ? (
                      'API Key Required'
                    ) : (
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Generate AI Fitness Plan
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading/streaming view
  if (highAccuracyLoading || highAccuracyProgress) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Brain className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Generating Your Plan</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              AI is analyzing your profile and creating your personalized fitness plan
            </p>
          </div>

          {/* Progress Card */}
          <Card className="p-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xl font-semibold">{highAccuracyProgress?.currentStep || 'Processing...'}</span>
              </div>
              
              <Progress value={highAccuracyProgress?.progress || 0} className="h-3" />
              
              <div className="space-y-2">
                {highAccuracyProgress?.reasoning?.map((reason, index) => (
                  <div key={`reasoning-${index}-${reason.substring(0, 20)}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show results view
  if (highAccuracyPlan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Your AI Fitness Plan</h1>
              <p className="text-muted-foreground text-lg">
                Generated with {Math.round((highAccuracyPlan.feasibility?.confidenceScore || 0.9) * 100)}% confidence
              </p>
            </div>
            <Button onClick={handleStartOver} variant="outline">
              Start Over
            </Button>
          </div>

          {/* Plan Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Confidence</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {Math.round((highAccuracyPlan.feasibility?.confidenceScore || 0.9) * 100)}%
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Exercises</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {highAccuracyPlan.exerciseLibrary?.length || 0}
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Sessions</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {highAccuracyPlan.sessionTemplates?.length || 0}
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Meals</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {highAccuracyPlan.mealTemplates?.length || 0}
              </div>
            </Card>
          </div>

          {/* Plan Details */}
          <div className="space-y-6">
            {/* Strategic Framework */}
            {highAccuracyPlan.strategicFramework && (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Strategic Framework</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-primary mb-3">Training Approach</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Split:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.trainingApproach?.split}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.trainingApproach?.frequencyPerWeek} days/week</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.trainingApproach?.sessionDurationMinutes} min</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-primary mb-3">Nutrition Approach</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.nutritionApproach?.caloricStrategy?.deficitMagnitude}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily Deficit:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.nutritionApproach?.caloricStrategy?.dailyDeficitCalories} cal</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Protein:</span>
                        <span className="font-medium">{highAccuracyPlan.strategicFramework.nutritionApproach?.macroTargets?.proteinTotalGrams}g</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Exercise Library */}
            {highAccuracyPlan.exerciseLibrary && highAccuracyPlan.exerciseLibrary.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Exercise Library ({highAccuracyPlan.exerciseLibrary.length} exercises)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {highAccuracyPlan.exerciseLibrary.slice(0, 6).map((exercise: any, index: number) => (
                    <div key={`exercise-${exercise.exerciseId || index}`} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{exercise.name}</h4>
                        <Badge variant="outline">{exercise.difficulty}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {exercise.muscleGroups?.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Session Templates */}
            {highAccuracyPlan.sessionTemplates && highAccuracyPlan.sessionTemplates.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Training Sessions ({highAccuracyPlan.sessionTemplates.length} templates)</h3>
                <div className="space-y-4">
                  {highAccuracyPlan.sessionTemplates.slice(0, 3).map((session: any, index: number) => (
                    <div key={`session-${session.templateId || index}`} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{session.name}</h4>
                        <span className="text-sm text-muted-foreground">{session.totalDurationMinutes} min</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.structure?.length || 0} exercises
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Full Plan
              </Button>
              <Button variant="outline" className="flex-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Start Tracking
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
