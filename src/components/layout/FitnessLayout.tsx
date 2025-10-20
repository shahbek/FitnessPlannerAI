import React, { useState } from 'react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { FitnessSidebar } from './FitnessSidebar';
import { ChainOfThoughtSidebar } from './ChainOfThoughtSidebar';
import { MultistepProfileForm } from '@/components/forms/MultistepProfileForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import { useAISdkRag } from '@/hooks/useAISdkRag';
import { useAIStream } from '@/hooks/useAIStream';
import { DEFAULT_FORM_STATE } from '@/constants';
import { useEffect } from 'react';
import { testWorkoutData } from '@/data/testWorkoutData';

import { WorkoutProgramView } from '@/components/workout/WorkoutProgramView';
import { 
  Brain, 
  CheckCircle, 
  Target, 
  Dumbbell, 
  Heart, 
  Calendar,
  Lightbulb,
  X
} from 'lucide-react';

interface FitnessLayoutProps {
  children?: React.ReactNode;
}

export function FitnessLayout({ children }: FitnessLayoutProps) {
  const [showNewWorkoutForm, setShowNewWorkoutForm] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | undefined>();
  const [showChainOfThought, setShowChainOfThought] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [workoutHistory, setWorkoutHistory] = useState<Array<{id: number; title: string; createdAt: string; data?: any}>>([
    {
      id: 1,
      title: "Fat Loss Program - Full Body",
      createdAt: new Date().toISOString(),
      data: testWorkoutData
    }
  ]);

  const {
    plan: ragPlan,
    loading: ragLoading,
    error: ragError,
    progress: ragProgress,
    generatePlan: generateRagPlan,
    clearError: clearRagError,
  } = useAISdkRag();

  const {
    streamTextResponse,
    isStreaming: aiStreaming,
    error: aiError,
    clearError: clearAIError,
  } = useAIStream();

  const handleNewWorkout = () => {
    setShowNewWorkoutForm(true);
  };

  const handleSelectWorkout = (id: number) => {
    setSelectedWorkoutId(id);
    // Here you would typically load the selected workout data
  };

  const handleDeleteWorkout = (id: number) => {
    setWorkoutHistory(prev => prev.filter(workout => workout.id !== id));
    if (selectedWorkoutId === id) {
      setSelectedWorkoutId(undefined);
    }
  };

  const handleFormComplete = (formData: any) => {
    // Map form data to the format expected by the AI service
    const mappedFormData = {
      ...formData,
      goal: formData.primaryGoal, // Map primaryGoal to goal for AI service
      bodyFat: formData.bodyFat || 20, // Add default body fat if not provided
      targetBf: formData.targetBf || 15, // Add default target body fat if not provided
    };
    
    console.log('📝 Form data received:', formData);
    console.log('🔄 Mapped form data for AI service:', mappedFormData);
    
    setForm(mappedFormData);
    setShowNewWorkoutForm(false);
    handleGeneratePlan(mappedFormData);
  };

  const handleFormCancel = () => {
    setShowNewWorkoutForm(false);
  };

  const validateApiKey = (apiKey: string): string | null => {
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
  };

  const handleGeneratePlan = async (formData?: any) => {
    const dataToUse = formData || form;
    
    if (ragLoading) return;
    
    const apiKeyError = validateApiKey(dataToUse.apiKey);
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
          apiKey: dataToUse.apiKey,
          endpoint: dataToUse.endpoint,
          model: dataToUse.model,
        },
        `Generate a brief preview of a fitness plan for a ${dataToUse.age} year old ${dataToUse.sex} who wants to ${dataToUse.primaryGoal}. Include key recommendations for training and nutrition.`,
        'You are a fitness expert providing brief, actionable advice.',
        (chunk) => {
          setStreamingContent(prev => prev + chunk);
        }
      );

      // Generate the full plan using AI SDK RAG
      const planPromise = generateRagPlan(dataToUse);
      
      // Wait for both to complete
      await Promise.all([previewPromise, planPromise]);
      
      console.log('✅ Plan generation completed, useEffect will handle history addition');
      
    } catch (err) {
      console.error('Plan generation failed:', err);
    }
  };

  const handleStartOver = () => {
    setStreamingContent('');
    setShowChainOfThought(false);
    clearRagError();
    clearAIError();
  };

  const currentError = ragError || aiError;
  const currentLoading = ragLoading || aiStreaming;

  // Add workout to history when plan is successfully generated
  useEffect(() => {
    if (ragPlan && !ragLoading && !ragError) {
      console.log('🎯 Plan generated successfully, adding to history:', ragPlan);
      
      // Log the complete JSON response for debugging
      console.log('📊 Complete Plan JSON Response:', JSON.stringify(ragPlan, null, 2));
      
      const newWorkout = {
        id: Date.now(), // Simple ID generation
        title: `${ragPlan.strategicFramework?.trainingApproach?.split || 'Fitness'} Program`,
        createdAt: new Date().toISOString(),
        data: ragPlan // Store the full plan data
      };
      
      setWorkoutHistory(prev => {
        // Check if this workout already exists to avoid duplicates
        const exists = prev.some(workout => 
          workout.title === newWorkout.title && 
          Math.abs(new Date(workout.createdAt).getTime() - newWorkout.id) < 10000 // Within 10 seconds
        );
        
        if (exists) {
          console.log('⚠️ Workout already exists in history, skipping');
          return prev;
        }
        
        console.log('✅ Adding new workout to history:', newWorkout);
        return [newWorkout, ...prev];
      });
      
      // Automatically select the new workout
      setSelectedWorkoutId(newWorkout.id);
    }
  }, [ragPlan, ragLoading, ragError]);

  return (
    <SidebarProvider defaultOpen={true}>
      <FitnessSidebar
        onNewWorkout={handleNewWorkout}
        onSelectWorkout={handleSelectWorkout}
        onDeleteWorkout={handleDeleteWorkout}
        selectedWorkoutId={selectedWorkoutId}
        workoutHistory={workoutHistory}
      />
      
      <SidebarInset>


        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">

              {/* Loading State */}
              {currentLoading && (
                <Card className="mb-6 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span className="font-medium">{ragProgress?.currentStep}</span>
                  </div>
                  <Progress value={ragProgress?.progress || 0} className="mb-4" />
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {ragProgress?.reasoning?.map((reason, index) => (
                      <div key={`reasoning-${index}-${reason.substring(0, 20)}`} className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" />
                        {reason}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Selected Workout Program View */}
              {selectedWorkoutId && (
                <div className="mb-8">
                  {(() => {
                    const selectedWorkout = workoutHistory.find(w => w.id === selectedWorkoutId);
                    return selectedWorkout ? (
                      <WorkoutProgramView 
                        workoutData={selectedWorkout.data} 
                        planTitle={selectedWorkout.title}
                      />
                    ) : null;
                  })()}
                </div>
              )}

              {/* Plan Overview */}
              {ragPlan && !selectedWorkoutId && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-6 font-sans">Your Fitness Plan</h2>
                  
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Target className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-muted-foreground truncate">
                              Confidence Score
                            </dt>
                            <dd className="text-lg font-medium text-foreground font-mono">
                              {Math.round((ragPlan.feasibility?.confidenceScore || 0.9) * 100)}%
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Dumbbell className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-muted-foreground truncate">
                              Exercises
                            </dt>
                            <dd className="text-lg font-medium text-foreground font-mono">
                              {ragPlan.exerciseLibrary?.length || 0}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Calendar className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-muted-foreground truncate">
                              Sessions
                            </dt>
                            <dd className="text-lg font-medium text-foreground font-mono">
                              {ragPlan.sessionTemplates?.length || 0}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Heart className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-muted-foreground truncate">
                              Meals
                            </dt>
                            <dd className="text-lg font-medium text-foreground font-mono">
                              {ragPlan.mealTemplates?.length || 0}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Plan Content */}
                  {children || (
                    <div className="space-y-6">
                      <Card className="p-6">
                        <h3 className="text-xl font-semibold mb-4 font-sans">Training Plan</h3>
                        {ragPlan?.strategicFramework?.trainingApproach ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Split:</span>
                                <span className="font-medium">{ragPlan.strategicFramework.trainingApproach.split}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Frequency:</span>
                                <span className="font-medium font-mono">{ragPlan.strategicFramework.trainingApproach.frequencyPerWeek} days/week</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="font-medium font-mono">{ragPlan.strategicFramework.trainingApproach.sessionDurationMinutes} min</span>
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
                                    <span className="font-mono">{String(volume)} sets/week</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Generate a plan to see your training details</p>
                          </div>
                        )}
                      </Card>

                      <Card className="p-6">
                        <h3 className="text-xl font-semibold mb-4 font-sans">Nutrition Plan</h3>
                        {ragPlan?.strategicFramework?.nutritionApproach ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Strategy:</span>
                                <span className="font-medium">{ragPlan.strategicFramework.nutritionApproach.caloricStrategy.deficitMagnitude}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Daily Deficit:</span>
                                <span className="font-medium font-mono">{ragPlan.strategicFramework.nutritionApproach.caloricStrategy.dailyDeficitCalories} cal</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Protein:</span>
                                <span className="font-medium font-mono">{ragPlan.strategicFramework.nutritionApproach.macroTargets.proteinTotalGrams}g</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Meal Frequency:</span>
                                <span className="font-medium font-mono">{ragPlan.strategicFramework.nutritionApproach.mealFrequency} meals/day</span>
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
                        ) : (
                          <div className="text-center py-8">
                            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Generate a plan to see your nutrition details</p>
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chain of Thoughts Sidebar */}
          <ChainOfThoughtSidebar
            isOpen={showChainOfThought}
            onClose={() => setShowChainOfThought(false)}
            currentLoading={currentLoading}
            ragProgress={ragProgress}
            streamingContent={streamingContent}
          />
        </div>
      </SidebarInset>

      {/* Multistep Form Modal */}
      {showNewWorkoutForm && (
        <MultistepProfileForm
          onComplete={handleFormComplete}
          onCancel={handleFormCancel}
        />
      )}
    </SidebarProvider>
  );
}
