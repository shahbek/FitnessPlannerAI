import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import { useAISdkRag } from '@/hooks/useAISdkRag';
import { useAIStream } from '@/hooks/useAIStream';
import { DEFAULT_FORM_STATE } from '@/constants';

// AI Elements components
import { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Sources, SourcesTrigger, SourcesContent } from '@/components/ai-elements/sources';
import { DataTable } from '@/components/tables/DataTable';

import { 
  Brain, 
  CheckCircle, 
  Loader2, 
  Target, 
  User, 
  Dumbbell,
  Heart,
  Calendar,
  TrendingUp,
  Activity,
  BookOpen,
  Lightbulb,
  Moon,
  Sun,
  X
} from 'lucide-react';

export function PerplexityDashboard() {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [activeTab, setActiveTab] = useState('overview');
  const [showChainOfThought, setShowChainOfThought] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

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
    
    if (!/^[\x00-\x7F]*$/.test(apiKey)) {
      return 'API key contains invalid characters. Please check for hidden characters or copy the key again.';
    }
    
    if (apiKey.trim().length < 10) {
      return 'API key appears to be too short. Please check your key.';
    }
    
    if (!apiKey.includes('gsk_') && !apiKey.includes('sk-')) {
      return 'API key format appears incorrect. Groq keys start with "gsk_" and OpenAI keys start with "sk-".';
    }
    
    return null;
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    if (ragLoading) return;
    
    const apiKeyError = validateApiKey(form.apiKey);
    if (apiKeyError) {
      alert(apiKeyError);
      return;
    }
    
    try {
      setShowChainOfThought(true);
      setStreamingContent('');
      
      // Start streaming a preview while the main RAG plan generates
      const previewPromise = streamTextResponse(
        {
          apiKey: form.apiKey,
          endpoint: form.endpoint,
          model: form.model,
        },
        `Generate a brief preview of a fitness plan for a ${form.age} year old ${form.sex} who wants to ${form.primaryGoal}. Include key recommendations for training and nutrition.`,
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
    }
  }, [form, ragLoading, generateRagPlan, streamTextResponse, validateApiKey]);

  const handleStartOver = useCallback(() => {
    setStreamingContent('');
    setShowChainOfThought(false);
    clearRagError();
    clearAIError();
  }, [clearRagError, clearAIError]);

  const currentError = ragError || aiError;
  const currentLoading = ragLoading || aiStreaming;

  const navigation = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'training', label: 'Training', icon: Dumbbell },
    { id: 'nutrition', label: 'Nutrition', icon: Heart },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'research', label: 'Research', icon: BookOpen },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="text-center py-12">
              <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">AI Fitness Planner</h1>
              <p className="text-muted-foreground text-lg mb-8">
                Get your personalized fitness plan powered by AI and scientific research
              </p>
              
              {!ragPlan && (
                <Button onClick={handleGeneratePlan} size="lg" className="mb-8">
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Your Plan
                </Button>
              )}

              {ragPlan && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <Card className="p-4 text-center">
                    <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">
                      {Math.round((ragPlan.feasibility?.confidenceScore || 0.9) * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Confidence</div>
                  </Card>
                  
                  <Card className="p-4 text-center">
                    <Dumbbell className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {ragPlan.exerciseLibrary?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Exercises</div>
                  </Card>
                  
                  <Card className="p-4 text-center">
                    <Calendar className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">
                      {ragPlan.sessionTemplates?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Sessions</div>
                  </Card>
                  
                  <Card className="p-4 text-center">
                    <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">
                      {ragPlan.mealTemplates?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Meals</div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">User Profile</h2>
            
            <Card className="p-6">
              <div className="space-y-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="primaryGoal">Primary Goal *</Label>
                    <Select value={form.primaryGoal} onValueChange={handleSelectChange('primaryGoal')}>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workoutSplit">Workout Split *</Label>
                    <Select value={form.workoutSplit} onValueChange={handleSelectChange('workoutSplit')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select split" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_body">Full Body</SelectItem>
                        <SelectItem value="upper_lower">Upper/Lower</SelectItem>
                        <SelectItem value="push_pull_legs">Push/Pull/Legs</SelectItem>
                        <SelectItem value="body_part">Body Part Split</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="equipment">Available Equipment *</Label>
                    <Select value={form.equipment} onValueChange={handleSelectChange('equipment')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gym_membership">Gym Membership</SelectItem>
                        <SelectItem value="bodyweight">Bodyweight Only</SelectItem>
                        <SelectItem value="calisthenics">Calisthenics Equipment</SelectItem>
                        <SelectItem value="home_gym">Home Gym (Basic)</SelectItem>
                        <SelectItem value="home_gym_advanced">Home Gym (Advanced)</SelectItem>
                        <SelectItem value="minimal">Minimal Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="schedule">Training Schedule *</Label>
                  <Textarea
                    id="schedule"
                    value={form.schedule}
                    onChange={handleChange('schedule')}
                    placeholder="Describe your available training times, e.g., 'Monday-Friday: 6-7 AM before work, Saturday: 10-11 AM, Sunday: rest day'"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="preferences">Food Preferences & Dietary Restrictions</Label>
                  <Textarea
                    id="preferences"
                    value={form.preferences}
                    onChange={handleChange('preferences')}
                    placeholder="List your food preferences, dietary restrictions, allergies, or foods you enjoy/dislike, e.g., 'Vegetarian, allergic to nuts, love Mediterranean food, dislike spicy food'"
                    rows={3}
                  />
                </div>
              </div>
            </Card>
          </div>
        );

      case 'training':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Training Plan</h2>
            
            {ragPlan?.strategicFramework?.trainingApproach ? (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Training Approach</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Split:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.trainingApproach.split}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.trainingApproach.frequencyPerWeek} days/week</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.trainingApproach.sessionDurationMinutes} min</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Periodization:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.trainingApproach.periodization}</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-muted-foreground">Volume per muscle group:</span>
                      {Object.entries(ragPlan.strategicFramework.trainingApproach.volumePerMuscleWeekly).map(([muscle, volume]) => (
                        <div key={muscle} className="flex justify-between text-sm">
                          <span className="capitalize">{muscle}:</span>
                          <span>{String(volume)} sets/week</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Generate a plan to see your training details</p>
              </Card>
            )}

            {ragPlan?.exerciseLibrary && ragPlan.exerciseLibrary.length > 0 && (
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
          </div>
        );

      case 'nutrition':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Nutrition Plan</h2>
            
            {ragPlan?.strategicFramework?.nutritionApproach ? (
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Nutrition Approach</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Strategy:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach.caloricStrategy.deficitMagnitude}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily Deficit:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach.caloricStrategy.dailyDeficitCalories} cal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protein:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach.macroTargets.proteinTotalGrams}g</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Meal Frequency:</span>
                      <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach.mealFrequency} meals/day</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-muted-foreground">Timing:</span>
                      <div className="text-sm space-y-1">
                        <div>Pre-workout: {ragPlan.strategicFramework.nutritionApproach.timing.preWorkout}</div>
                        <div>Post-workout: {ragPlan.strategicFramework.nutritionApproach.timing.postWorkout}</div>
                        <div>Bedtime: {ragPlan.strategicFramework.nutritionApproach.timing.bedtime}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Generate a plan to see your nutrition details</p>
              </Card>
            )}
          </div>
        );

      case 'progress':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Progress & Phases</h2>
            
            {ragPlan?.phaseProgression?.phases ? (
              <div className="space-y-4">
                {ragPlan.phaseProgression.phases.map((phase: any, index: number) => (
                  <Card key={`phase-${phase.phaseNumber || index}`} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Phase {phase.phaseNumber}: {phase.name}</h3>
                      <Badge variant="outline">{phase.durationWeeks} weeks</Badge>
                    </div>
                    <p className="text-muted-foreground mb-4">{phase.focus}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Training Modifications</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {phase.trainingModifications.map((mod: string, i: number) => (
                            <li key={i}>• {mod}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Expected Outcomes</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {phase.expectedOutcomes.map((outcome: string, i: number) => (
                            <li key={i}>• {outcome}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Generate a plan to see your phase progression</p>
              </Card>
            )}
          </div>
        );

      case 'research':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Research & Debug</h2>
            
            <div className="space-y-6">
              {planSnapshots.map((snapshot: any, index: number) => (
                <Card key={`snapshot-${snapshot.stage || index}`} className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h3 className="text-lg font-semibold">{snapshot.type}</h3>
                  </div>
                  
                  {snapshot.data && (
                    <DataTable data={snapshot.data} type={snapshot.type} />
                  )}
                </Card>
              ))}
              
              {planSnapshots.length === 0 && (
                <Card className="p-6 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Generate a plan to see the research data</p>
                </Card>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-6 w-6 text-primary" />
              <span className="font-bold">AI Fitness</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDarkMode(!darkMode)}
                className="flex-1"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChainOfThought(!showChainOfThought)}
                className="flex-1"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveTab(item.id)}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t">
            <Button
              onClick={handleGeneratePlan}
              disabled={currentLoading || !form.apiKey?.trim()}
              className="w-full"
            >
              {currentLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Generate Plan
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">
                {navigation.find(nav => nav.id === activeTab)?.label || 'Dashboard'}
              </h1>
              
              <div className="flex items-center gap-2">
                {currentError && (
                  <Alert variant="destructive" className="mr-4">
                    <AlertDescription>{currentError}</AlertDescription>
                  </Alert>
                )}
                
                <Button variant="outline" size="sm" onClick={handleStartOver}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

           {/* Content Area */}
           <div className="flex-1 overflow-auto">
             <div className="p-6">
               {streamingContent && (
                 <div className="mb-6">
                   <Message from="assistant">
                     <MessageContent>
                       <div className="space-y-2">
                         <div className="flex items-center gap-2">
                           <BookOpen className="h-4 w-4 text-blue-600" />
                           <span className="font-medium">AI Preview</span>
                         </div>
                         <Response>
                           {streamingContent}
                         </Response>
                       </div>
                     </MessageContent>
                   </Message>
                 </div>
               )}

               {renderContent()}
             </div>
           </div>
        </div>

        {/* Right Sidebar - Chain of Thought */}
        {showChainOfThought && (
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Chain of Thought</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChainOfThought(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
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
                        
                        {ragProgress?.reasoning?.map((reason, index) => (
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

                <ChainOfThought defaultOpen={true}>
                  <ChainOfThoughtHeader>
                    AI Reasoning Process
                  </ChainOfThoughtHeader>
                  <ChainOfThoughtContent>
                    <div className="space-y-3">
                      {ragProgress?.reasoning?.map((reason, index) => (
                        <ChainOfThoughtStep
                          key={`reasoning-${index}-${reason.substring(0, 20)}`}
                          label={reason}
                          status="complete"
                        />
                      ))}
                    </div>
                  </ChainOfThoughtContent>
                </ChainOfThought>

                <Sources>
                  <SourcesTrigger count={3} />
                  <SourcesContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Research Sources</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Drawing from scientific research on progressive overload, protein timing, and periodization
                      </div>
                    </div>
                  </SourcesContent>
                </Sources>

                <Reasoning defaultOpen={true}>
                  <ReasoningTrigger />
                  <ReasoningContent>
                    Analyzing user profile and generating personalized recommendations based on scientific evidence
                  </ReasoningContent>
                </Reasoning>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
