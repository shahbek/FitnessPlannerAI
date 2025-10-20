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
import { useAISdkRag } from '@/hooks/useAISdkRag';
import { useAIStream } from '@/hooks/useAIStream';
import { DEFAULT_FORM_STATE } from '@/constants';

// AI Elements components (manually created)
import { ChainOfThought } from '@/components/ai-elements/chain-of-thought';
import { Message } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import { Reasoning } from '@/components/ai-elements/reasoning';
import { Sources } from '@/components/ai-elements/sources';
import { Task } from '@/components/ai-elements/task';

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
  TrendingUp,
  Activity,
  Settings,
  Menu,
  BookOpen,
  Lightbulb
} from 'lucide-react';

export function AIElementsDashboard() {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [showForm, setShowForm] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([]);
  const [sources, setSources] = useState<any[]>([]);

  const {
    plan: ragPlan,
    loading: ragLoading,
    error: ragError,
    progress: ragProgress,
    planSnapshots,
    generatePlan: generateRagPlan,
    clearError: clearRagError,
  } = useAISdkRag();

  const {
    streamTextResponse,
    isStreaming: aiStreaming,
    error: aiError,
    clearError: clearAIError,
  } = useAIStream();

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

  const validateApiKey = useCallback((apiKey: string): string | null => {
    if (!apiKey.trim()) {
      return 'API key is required';
    }
    
    // Check for non-ASCII characters
    if (!/^[\x00-\x7F]*$/.test(apiKey)) {
      return 'API key contains invalid characters. Please check for hidden characters or copy the key again.';
    }
    
    // Check minimum length
    if (apiKey.trim().length < 10) {
      return 'API key appears to be too short. Please check your key.';
    }
    
    // Check for common patterns
    if (!apiKey.includes('gsk_') && !apiKey.includes('sk-')) {
      return 'API key format appears incorrect. Groq keys start with "gsk_" and OpenAI keys start with "sk-".';
    }
    
    return null;
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    if (ragLoading) return;
    
    // Validate API key first
    const apiKeyError = validateApiKey(form.apiKey);
    if (apiKeyError) {
      alert(apiKeyError);
      return;
    }
    
    try {
      setShowForm(false);
      setStreamingContent('');
      setReasoningSteps([]);
      setSources([]);
      
      // Start streaming a preview while the main RAG plan generates
      const previewPromise = streamTextResponse(
        {
          apiKey: form.apiKey,
          endpoint: form.endpoint,
          model: form.model,
        },
        `Generate a brief preview of a fitness plan for a ${form.age} year old ${form.sex} who wants to ${form.goal}. Include key recommendations for training and nutrition.`,
        'You are a fitness expert providing brief, actionable advice.',
        (chunk) => {
          setStreamingContent(prev => prev + chunk);
        }
      );

      // Generate the full plan using AI SDK RAG
      const planPromise = generateRagPlan(form);
      
      // Wait for both to complete
      await Promise.all([previewPromise, planPromise]);
      
    } catch (err) {
      console.error('Plan generation failed:', err);
      setShowForm(true); // Show form again on error
    }
  }, [form, ragLoading, generateRagPlan, streamTextResponse, validateApiKey]);

  const handleStartOver = useCallback(() => {
    setShowForm(true);
    setStreamingContent('');
    setReasoningSteps([]);
    setSources([]);
    clearRagError();
    clearAIError();
  }, [clearRagError, clearAIError]);

  const currentError = ragError || aiError;
  const currentLoading = ragLoading || aiStreaming;

  // Show form initially or when there's an error
  if (showForm && !ragPlan) {
    return (
      <div className="min-h-screen bg-background">
        {/* Dashboard Header */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">AI Fitness Planner</h1>
                  <p className="text-sm text-muted-foreground">Powered by AI SDK RAG + Scientific Research</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Error Alert */}
          {currentError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{currentError}</AlertDescription>
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
                      className={`font-mono ${validateApiKey(form.apiKey) ? 'border-red-500' : form.apiKey.trim() ? 'border-green-500' : ''}`}
                    />
                    {validateApiKey(form.apiKey) && (
                      <p className="text-sm text-red-500 mt-1">{validateApiKey(form.apiKey)}</p>
                    )}
                    {form.apiKey.trim() && !validateApiKey(form.apiKey) && (
                      <p className="text-sm text-green-600 mt-1">✓ API key looks valid</p>
                    )}
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

                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    <strong>API Key Format:</strong> 
                    <br />• Groq keys start with <code className="bg-muted px-1 rounded">gsk_</code>
                    <br />• OpenAI keys start with <code className="bg-muted px-1 rounded">sk-</code>
                    <br />• Make sure to copy the entire key without extra spaces or characters
                  </AlertDescription>
                </Alert>
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
                    <Badge variant="outline">AI SDK RAG</Badge>
                    <Badge variant="outline">Scientific Research</Badge>
                    <Badge variant="outline">Chain of Thought</Badge>
                    <Badge variant="outline">Real-Time Streaming</Badge>
                  </div>
                  
                  <Button 
                    onClick={handleGeneratePlan} 
                    disabled={currentLoading || !form.apiKey?.trim()}
                    size="lg"
                    className="w-full max-w-md"
                  >
                    {currentLoading ? (
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

  // Show loading/streaming view with AI Elements
  if (currentLoading || ragProgress) {
    return (
      <div className="min-h-screen bg-background">
        {/* Dashboard Header */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">AI Fitness Planner</h1>
                  <p className="text-sm text-muted-foreground">Generating your personalized plan with AI SDK RAG</p>
                </div>
              </div>
              <Button onClick={handleStartOver} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* AI Elements Components */}
          <div className="space-y-6">
            {/* Chain of Thought */}
            <ChainOfThought>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <span className="font-semibold">AI Reasoning Process</span>
                </div>
                
                {ragProgress?.reasoning?.map((reason, index) => (
                  <div key={`reasoning-${index}-${reason.substring(0, 20)}`} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {reason}
                  </div>
                ))}
              </div>
            </ChainOfThought>

            {/* Progress with Task Component */}
            <Task>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Loader className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{ragProgress?.currentStep || 'Processing...'}</span>
                </div>
                
                <Progress value={ragProgress?.progress || 0} className="h-3" />
                
                <div className="text-sm text-muted-foreground">
                  {ragProgress?.progress || 0}% complete
                </div>
              </div>
            </Task>

            {/* Streaming Content with Message Component */}
            {streamingContent && (
              <Message>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">AI Preview</span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {streamingContent}
                  </div>
                </div>
              </Message>
            )}

            {/* Sources Component */}
            <Sources>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Research Sources</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Drawing from scientific research on progressive overload, protein timing, and periodization
                </div>
              </div>
            </Sources>
          </div>
        </div>
      </div>
    );
  }

  // Show results view with AI Elements
  if (ragPlan) {
    return (
      <div className="min-h-screen bg-background">
        {/* Dashboard Header */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">Your AI Fitness Plan</h1>
                  <p className="text-sm text-muted-foreground">
                    Generated with {Math.round((ragPlan.feasibility?.confidenceScore || 0.9) * 100)}% confidence using AI SDK RAG
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleStartOver} variant="outline" size="sm">
                  Start Over
                </Button>
                <Button size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Plan Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Confidence</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {Math.round((ragPlan.feasibility?.confidenceScore || 0.9) * 100)}%
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Exercises</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {ragPlan.exerciseLibrary?.length || 0}
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Sessions</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {ragPlan.sessionTemplates?.length || 0}
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Meals</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {ragPlan.mealTemplates?.length || 0}
              </div>
            </Card>
          </div>

          {/* Plan Details with AI Elements */}
          <div className="space-y-6">
            {/* Strategic Framework with Response Component */}
            {ragPlan.strategicFramework && (
              <Response>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Strategic Framework</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-primary mb-3">Training Approach</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Split:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.trainingApproach?.split}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.trainingApproach?.frequencyPerWeek} days/week</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.trainingApproach?.sessionDurationMinutes} min</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-primary mb-3">Nutrition Approach</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Strategy:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach?.caloricStrategy?.deficitMagnitude}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Daily Deficit:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach?.caloricStrategy?.dailyDeficitCalories} cal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Protein:</span>
                          <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach?.macroTargets?.proteinTotalGrams}g</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Response>
            )}

            {/* Exercise Library */}
            {ragPlan.exerciseLibrary && ragPlan.exerciseLibrary.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Exercise Library ({ragPlan.exerciseLibrary.length} exercises)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ragPlan.exerciseLibrary.slice(0, 6).map((exercise: any, index: number) => (
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
