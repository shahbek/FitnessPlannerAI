import React, { useState, useEffect, useRef } from 'react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { FitnessSidebar } from './FitnessSidebar';
import { ChainOfThoughtSidebar } from './ChainOfThoughtSidebar';
import { MultistepProfileForm } from '@/components/forms/MultistepProfileForm';
import { Card, CardContent } from '@/components/ui/card';
import { useAISdkRag } from '@/hooks/useAISdkRag';
import { usePlanGenerator } from '@/hooks/usePlanGenerator';
import { formToUserProfile, formToWeeklyOutlines } from '@/utils/formToPlanModels';
import { DEFAULT_FORM_STATE } from '@/constants';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SettingsPage } from '@/pages/SettingsPage';

import { WorkoutProgramView } from '@/components/workout/WorkoutProgramView';
import {
  Target,
  Dumbbell,
  Heart,
  Calendar,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { AISdkRagService } from '@/services/aiSdkRagService';
import { dynamicCalculator } from '@/ai/dynamicCalculator';

type NavigationView = 'home' | 'settings' | 'settings-account' | 'settings-tokens';

interface FitnessLayoutProps {
  children?: React.ReactNode;
}

export function FitnessLayout({ children }: FitnessLayoutProps) {
  const [showNewWorkoutForm, setShowNewWorkoutForm] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | undefined>();
  const [showChainOfThought, setShowChainOfThought] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [workoutHistory, setWorkoutHistory] = useState<Array<{ id: number; title: string; createdAt: string; data?: any; convexId?: any }>>([]);
  const [currentView, setCurrentView] = useState<NavigationView>('home');
  const [cancellationRequested, setCancellationRequested] = useState(false);
  // Track which plans have been processed to prevent duplicate saves
  const processedPlanIds = useRef<Set<string>>(new Set());
  const generationAbortController = useRef<AbortController | null>(null);

  const { toast } = useToast();

  const {
    plan: ragPlan,
    loading: ragLoading,
    error: ragError,
    progress: ragProgress,
    generatePlan: generateRagPlan,
    clearError,
    clearPlan,
  } = useAISdkRag();

  // New IntegratedPlanGenerator hook (using USDA + CoT)
  const {
    plan: integratedPlan,
    loading: integratedLoading,
    error: integratedError,
    progress: integratedProgress,
    generatePlan: generateIntegratedPlan,
    cancelGeneration: cancelIntegratedGeneration,
    clearError: clearIntegratedError,
    clearPlan: clearIntegratedPlan,
  } = usePlanGenerator({ enableToasts: true });

  // Convex mutations for saving plans
  const createWorkoutPlan = useMutation(api.workoutPlans.createWorkoutPlan);
  const createMealPlan = useMutation(api.mealPlans.createMealPlan);
  const upsertUserProfile = useMutation(api.users.upsertUserProfile);
  const deleteWorkoutPlan = useMutation(api.workoutPlans.deleteWorkoutPlan);

  // Token system mutations and queries
  const recordTokenUsage = useMutation(api.accounts.recordTokenUsage);
  const getUserAccount = useQuery(api.accounts.getUserAccount);

  // Convex queries for loading saved plans
  const savedWorkoutPlans = useQuery(api.workoutPlans.getUserWorkoutPlans);
  // Note: savedMealPlans can be used for future meal plan features
  // const savedMealPlans = useQuery(api.mealPlans.getUserMealPlans);

  // Load saved plans from Convex when they're available
  useEffect(() => {
    console.log('🔄 useEffect triggered - savedWorkoutPlans:', savedWorkoutPlans?.length || 0, 'plans');

    if (savedWorkoutPlans && savedWorkoutPlans.length > 0) {
      console.log('📥 Loading saved workout plans from Convex:', savedWorkoutPlans);

      // Convert Convex workout plans to local state format
      const convertedPlans = savedWorkoutPlans.map(plan => {
        // ✅ Prioritize fullPlanData - it contains the complete plan structure
        let planData = plan.fullPlanData;

        // If fullPlanData exists, use it directly (it should have the correct structure)
        if (planData) {
          console.log('✅ Using fullPlanData from Convex for plan:', plan.name);
          // Ensure isActive is preserved
          if (!planData.hasOwnProperty('isActive')) {
            planData = { ...planData, isActive: plan.isActive };
          }
        } else {
          // Fallback: Reconstruct from stored phases (for backward compatibility)
          console.warn('⚠️ No fullPlanData found, reconstructing from phases for plan:', plan.name);
          planData = {
            weeklyOutlines: Array.isArray(plan.phases) ? plan.phases : [],
            phaseAwareFramework: {
              trainingApproach: {
                split: plan.description?.includes('Full Body') ? 'Full Body' : 'Progressive',
                periodization: plan.description || 'Progressive',
              }
            },
            isActive: plan.isActive,
          };
        }

        // ✅ Generate unique numeric ID from Convex ID string
        // Use a more robust hash that combines multiple factors
        const hashString = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return Math.abs(hash); // Ensure positive number
        };

        // Use Convex ID as the basis for unique ID
        // Combine hash with createdAt and plan name to ensure uniqueness
        const convexIdString = plan._id.toString();
        const hashValue = hashString(convexIdString);
        const nameHash = hashString(plan.name || '');
        // Combine multiple factors to ensure uniqueness
        const createdAtSuffix = plan.createdAt % 1000000; // Last 6 digits
        // Use combination that's very unlikely to collide
        const numericId = (hashValue * 1000000000 + nameHash * 1000 + createdAtSuffix) % Number.MAX_SAFE_INTEGER;

        return {
          id: numericId,
          convexId: plan._id, // Store Convex ID for deletion
          title: plan.name,
          createdAt: new Date(plan.createdAt).toISOString(),
          data: planData,
        };
      });

      // Merge with local state (keep any generating plans)
      setWorkoutHistory(prev => {
        // ✅ Build maps for efficient lookup
        const convexIdToLocalPlan = new Map<string, typeof prev[0]>();
        const convexIdToSavedPlan = new Map<string, typeof convertedPlans[0]>();

        // Map local plans (both generating and completed) by convexId
        for (const plan of prev) {
          if (plan.convexId) {
            convexIdToLocalPlan.set(plan.convexId.toString(), plan);
          }
        }

        // Map saved plans from Convex by convexId
        for (const plan of convertedPlans) {
          if (plan.convexId) {
            convexIdToSavedPlan.set(plan.convexId.toString(), plan);
          }
        }

        // ✅ Build deduplicated list: prefer saved versions over local optimistic ones
        const seenIds = new Set<number>();
        const seenConvexIds = new Set<string>();
        const deduplicated: typeof prev = [];
        let selectedPlanReplaced = false;
        let newSelectedId: number | undefined = undefined;

        // First, process saved plans from Convex (prefer these over local optimistic ones)
        for (const savedPlan of convertedPlans) {
          if (savedPlan.convexId) {
            const convexIdStr = savedPlan.convexId.toString();
            const localPlan = convexIdToLocalPlan.get(convexIdStr);

            // Check if we've already processed this convexId (prevent duplicates from rapid clicks)
            if (seenConvexIds.has(convexIdStr)) {
              console.log('⏭️ Skipping duplicate saved plan (already processed):', savedPlan.id, savedPlan.title);
              continue;
            }

            // If we have a local plan with the same convexId, replace it with saved version
            if (localPlan) {
              console.log('🔄 Replacing local plan with saved version:', localPlan.id, '->', savedPlan.id, savedPlan.title);

              // Update selection if needed
              if (selectedWorkoutId === localPlan.id && !selectedPlanReplaced) {
                console.log('📌 Updating selectedWorkoutId from local to saved:', localPlan.id, '->', savedPlan.id);
                newSelectedId = savedPlan.id;
                selectedPlanReplaced = true;
              }
            }

            // Add the saved plan (preferred version) - only if we haven't seen this ID or convexId
            if (!seenIds.has(savedPlan.id) && !seenConvexIds.has(convexIdStr)) {
              seenIds.add(savedPlan.id);
              seenConvexIds.add(convexIdStr);
              deduplicated.push(savedPlan);
            }
          } else {
            // Saved plan without convexId (shouldn't happen, but handle it)
            if (!seenIds.has(savedPlan.id)) {
              seenIds.add(savedPlan.id);
              deduplicated.push(savedPlan);
            }
          }
        }

        // Then, process local plans that haven't been replaced by saved versions
        for (const localPlan of prev) {
          // Skip if this convexId was already handled by a saved plan
          if (localPlan.convexId && seenConvexIds.has(localPlan.convexId.toString())) {
            console.log('⏭️ Skipping local plan, saved version already added:', localPlan.id, localPlan.title);
            continue;
          }

          // Skip if we've seen this ID before
          if (seenIds.has(localPlan.id)) {
            console.warn('⚠️ Duplicate ID detected, skipping:', localPlan.id, localPlan.title);
            continue;
          }

          // Skip if we've seen this convexId before
          if (localPlan.convexId && seenConvexIds.has(localPlan.convexId.toString())) {
            console.warn('⚠️ Duplicate convexId detected, skipping:', localPlan.convexId, localPlan.title);
            continue;
          }

          seenIds.add(localPlan.id);
          if (localPlan.convexId) {
            seenConvexIds.add(localPlan.convexId.toString());
          }
          deduplicated.push(localPlan);
        }

        // Update selectedWorkoutId if it was replaced
        if (selectedPlanReplaced && newSelectedId !== undefined) {
          setSelectedWorkoutId(newSelectedId);
        }

        console.log('✅ Updated workoutHistory with', deduplicated.length, 'plans (filtered duplicates)');
        return deduplicated;
      });

      // Auto-select the most recent active plan ONLY if nothing is currently selected
      // This prevents deselecting after a plan is generated
      if (!selectedWorkoutId) {
        const activePlan = convertedPlans.find(p => p.data?.isActive);
        if (activePlan) {
          console.log('📌 Auto-selecting active plan:', activePlan.title);
          setSelectedWorkoutId(activePlan.id);
        } else if (convertedPlans.length > 0) {
          // If no active plan, select the most recent one
          console.log('📌 Auto-selecting most recent plan:', convertedPlans[0].title);
          setSelectedWorkoutId(convertedPlans[0].id);
        }
      }
    } else if (savedWorkoutPlans && savedWorkoutPlans.length === 0) {
      console.log('ℹ️ No saved workout plans found in Convex');
    }
  }, [savedWorkoutPlans]);

  const handleNewWorkout = () => {
    setShowNewWorkoutForm(true);
  };

  const handleSelectWorkout = (id: number) => {
    setSelectedWorkoutId(id);
    setCurrentView('home'); // Reset to home when selecting workout
  };

  const handleNavigate = (view: NavigationView) => {
    // If navigating to just 'settings', default to 'settings-account'
    if (view === 'settings') {
      setCurrentView('settings-account');
    } else {
      setCurrentView(view);
    }
    if (view !== 'home') {
      setSelectedWorkoutId(undefined);
    }
  };

  // Generate breadcrumb JSX based on current view
  const renderBreadcrumb = () => {
    // Show breadcrumb for selected workout plans
    if (selectedWorkoutId) {
      const selectedWorkout = workoutHistory.find(w => w.id === selectedWorkoutId);
      if (selectedWorkout) {
        return (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  asChild
                  onClick={() => {
                    setSelectedWorkoutId(undefined);
                    setCurrentView('home');
                  }}
                  className="cursor-pointer"
                >
                  <span>Your Plans</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedWorkout.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        );
      }
    }

    // Settings breadcrumb
    if (currentView.startsWith('settings')) {
      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                onClick={() => handleNavigate('settings')}
                className="cursor-pointer"
              >
                <span>Settings</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {currentView === 'settings-account' && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Account</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {currentView === 'settings-tokens' && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Tokens</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      );
    }

    // No breadcrumb for home view
    return null;
  };

  const handleDeleteWorkout = async (id: number) => {
    // Find the workout to get its Convex ID
    const workout = workoutHistory.find(w => w.id === id);

    if (workout?.convexId && deleteWorkoutPlan) {
      console.log('🗑️ Deleting workout plan from Convex:', workout.convexId);
      try {
        await deleteWorkoutPlan({ planId: workout.convexId });
        console.log('✅ Workout plan deleted from Convex');
      } catch (err) {
        console.error('❌ Failed to delete workout plan:', err);
      }
    }

    // Remove from local state
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
      return 'API key format appears incorrect. Valid keys should start with "gsk_" or "sk-".';
    }

    return null;
  };

  // New integrated plan generation handler
  const handleGenerateIntegratedPlan = async (formData?: any) => {
    const dataToUse = formData || form;

    if (integratedLoading) return;

    try {
      setCancellationRequested(false);
      setShowChainOfThought(true);

      // Optimistically create a new plan object and add to history immediately
      const optimisticPlan = {
        id: Date.now(),
        title: `${dataToUse.primaryGoal} Program`,
        createdAt: new Date().toISOString(),
        data: {
          isGenerating: true,
          // Minimal structure - will be replaced with real data
          weeklyOutlines: [],
          phaseSessionTemplates: [],
          phaseMealTemplates: [],
        }
      };

      // Add optimistic plan to history and select it immediately
      setWorkoutHistory(prev => [optimisticPlan, ...prev]);
      setSelectedWorkoutId(optimisticPlan.id);

      // Convert form to UserProfile
      const userProfile = formToUserProfile(dataToUse);

      // Prefer RAG-generated progressive weekly outlines even for Integrated generator
      let weeklyOutlines = formToWeeklyOutlines(dataToUse);
      try {
        // Determine API key (form field or env) and endpoint
        const apiKey: string | undefined = dataToUse.apiKey || (import.meta as any).env?.VITE_GROQ_API_KEY;
        const endpoint = dataToUse.endpoint || 'groq';

        if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
          // Compute planning metrics (matches aiSdkRagService internal logic)
          const bmr = await dynamicCalculator.calculateBMR(userProfile);
          const tdee = await dynamicCalculator.calculateTDEE(userProfile, bmr.value);
          const macros = await dynamicCalculator.calculateMacroTargets(
            userProfile,
            tdee.value,
            userProfile.goal || 'fitness'
          );
          const fatLoss = await dynamicCalculator.calculateFatLossRate(userProfile);
          const trainingVolume = await dynamicCalculator.calculateTrainingVolume(
            userProfile,
            userProfile.goal || 'fitness'
          );
          const water = await dynamicCalculator.calculateWaterRequirement(userProfile);

          const metrics = { bmr, tdee, macros, fatLoss, trainingVolume, water } as const;

          // Use AISdkRagService to get detailed weekly outlines with progression
          const rag = new AISdkRagService(apiKey, endpoint, dataToUse.model || 'llama-3.3-70b-versatile');
          weeklyOutlines = await rag.generateDetailedWeeklyOutlines(userProfile, metrics);
          console.log('✅ Using RAG weekly outlines for Integrated generator');
        } else {
          console.warn('⚠️ No API key available for RAG weekly outlines. Falling back to basic outlines.');
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch RAG weekly outlines, using basic outlines:', e);
      }

      // Generate plan using IntegratedPlanGenerator with RAG weekly outlines
      await generateIntegratedPlan(userProfile, weeklyOutlines, {
        useUSDAAPI: true,
        useCoT: true,
        enableCorrections: true,
      });

      // Check if cancellation was requested
      if (cancellationRequested) {
        // Clean up optimistic plan
        setWorkoutHistory(prev => prev.filter(w => w.id !== optimisticPlan.id));
        if (selectedWorkoutId === optimisticPlan.id) {
          setSelectedWorkoutId(undefined);
        }
        toast({
          title: 'Generation Cancelled',
          description: 'Plan generation was cancelled.',
        });
        return;
      }

      console.log('✅ Integrated plan generation completed, useEffect will handle history addition');

    } catch (err: any) {
      console.error('Integrated plan generation failed:', err);

      // Clean up failed optimistic plan
      setWorkoutHistory(prev => prev.filter(w => w.data?.isGenerating && !w.convexId));

      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: err.message || 'Failed to generate plan',
      });
    }
  };

  const handleCancelIntegratedGeneration = () => {
    if (integratedLoading) {
      cancelIntegratedGeneration();
      setCancellationRequested(true);
      clearIntegratedError();
      toast({
        title: 'Cancelling Generation',
        description: 'Stopping plan generation...',
      });
    }
  };

  // Toggle between old RAG service and new IntegratedPlanGenerator
  // Set to true to use the new IntegratedPlanGenerator (USDA + CoT)
  const USE_INTEGRATED_GENERATOR = true;

  const handleGeneratePlan = async (formData?: any) => {
    const dataToUse = formData || form;

    // Use new integrated generator if enabled
    if (USE_INTEGRATED_GENERATOR) {
      return handleGenerateIntegratedPlan(formData);
    }

    if (ragLoading) return;

    const apiKeyError = validateApiKey(dataToUse.apiKey);
    if (apiKeyError) {
      toast({
        variant: 'destructive',
        title: 'Invalid API Key',
        description: apiKeyError,
      });
      return;
    }

    // Check token balance before generation
    const PLAN_GENERATION_COST = 100; // Tokens required for complete plan generation
    const userAccount = getUserAccount;
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'; // Development mode check

    // Allow testing in development mode, block in production if insufficient tokens
    if (!isDevelopment && userAccount && userAccount.tokens < PLAN_GENERATION_COST) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Tokens',
        description: `You need ${PLAN_GENERATION_COST} tokens to generate a plan. You have ${userAccount.tokens} tokens remaining. Please purchase more tokens.`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('settings-tokens')}
          >
            Purchase Tokens
          </Button>
        ),
      });
      return;
    }

    // Development mode: Show warning but allow generation
    if (isDevelopment && userAccount && userAccount.tokens < PLAN_GENERATION_COST) {
      console.log('⚠️ DEV MODE: Allowing plan generation with insufficient tokens for testing');
      toast({
        variant: 'default',
        title: 'Development Mode',
        description: `Testing mode: Generating plan with ${userAccount.tokens} tokens (requires ${PLAN_GENERATION_COST}). Token check bypassed.`,
      });
    }

    try {
      setCancellationRequested(false);
      setShowChainOfThought(true);

      // Create abort controller for cancellation
      generationAbortController.current = new AbortController();

      // Record generation attempt at START (before generation begins)
      // This ensures ALL attempts are tracked, including failures
      if (recordTokenUsage) {
        try {
          // Record as "pending" first - tracks the attempt before we know if it succeeds
          const result = await recordTokenUsage({
            operationType: "plan_generation",
            tokensUsed: PLAN_GENERATION_COST,
            status: "pending",
            operationSteps: [
              "feasibility_assessment",
              "strategic_framework",
              "weekly_outlines",
              "exercise_library",
              "session_templates",
              "meal_templates",
              "shopping_lists"
            ],
            details: {
              startedAt: new Date().toISOString(),
              userProfile: {
                goal: dataToUse.primaryGoal,
                timeline: dataToUse.timelineWeeks,
              },
            },
          });
          console.log('📝 Recorded generation attempt (pending):', result);
        } catch (tokenError) {
          console.error("Failed to record generation attempt:", tokenError);
          // Don't block generation, but log the error
        }
      }

      // Optimistically create a new plan object and add to history immediately
      // Use skeleton data structure instead of placeholder text
      const optimisticPlan = {
        id: Date.now(),
        title: `${dataToUse.primaryGoal} Program`,
        createdAt: new Date().toISOString(),
        data: {
          isGenerating: true,
          // Minimal structure - will be replaced with real data
          phaseAwareFramework: {},
          feasibility: {},
          exerciseLibrary: [],
          sessionTemplates: [],
          mealTemplates: [],
          weeklyOutlines: [],
        }
      };

      // Add optimistic plan to history and select it immediately
      setWorkoutHistory(prev => [optimisticPlan, ...prev]);
      setSelectedWorkoutId(optimisticPlan.id);

      // Generate the full plan using AI SDK RAG with real-time progress
      await generateRagPlan(dataToUse);

      // Check if cancellation was requested
      if (cancellationRequested) {
        // Clean up optimistic plan
        setWorkoutHistory(prev => prev.filter(w => w.id !== optimisticPlan.id));
        if (selectedWorkoutId === optimisticPlan.id) {
          setSelectedWorkoutId(undefined);
        }
        toast({
          title: 'Generation Cancelled',
          description: 'Plan generation was cancelled.',
        });
        return;
      }

      console.log('✅ Plan generation completed, useEffect will handle history addition');

      // Show success toast (use current plan)
      const planForToast = USE_INTEGRATED_GENERATOR ? integratedPlan : ragPlan;
      const exerciseCount = planForToast?.phaseExerciseLibraries?.flat().length ||
        planForToast?.phaseExerciseLibraries?.length || 0;
      const sessionCount = planForToast?.phaseSessionTemplates?.flat().length ||
        planForToast?.phaseSessionTemplates?.length || 0;
      const mealCount = planForToast?.phaseMealTemplates?.flat().length ||
        planForToast?.phaseMealTemplates?.length || 0;

      toast({
        variant: 'success',
        title: '🎉 Plan Generated Successfully!',
        description: `Created ${exerciseCount} exercises, ${sessionCount} sessions, and ${mealCount} meals.`,
      });

    } catch (err: any) {
      console.error('Plan generation failed:', err);

      // Record failed generation attempt
      if (recordTokenUsage) {
        try {
          await recordTokenUsage({
            operationType: "plan_generation",
            tokensUsed: 100, // PLAN_GENERATION_COST
            status: "failed",
            operationSteps: [
              "feasibility_assessment",
              "strategic_framework",
              "weekly_outlines",
              "exercise_library",
              "session_templates",
              "meal_templates",
              "shopping_lists"
            ],
            details: {
              error: err?.message || ragError || "Unknown error",
              failedAt: new Date().toISOString(),
              errorDetails: err instanceof Error ? err.stack : String(err),
            },
          });
          console.log('❌ Recorded failed generation attempt');
        } catch (tokenError) {
          console.error("Failed to record failed token usage:", tokenError);
        }
      }

      // Error is already set by useAISdkRag with user-friendly message
      // Just show toast if error exists
      if (ragError) {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: `${ragError}. This attempt has been logged.`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearError();
                handleGeneratePlan(dataToUse);
              }}
            >
              Retry
            </Button>
          ),
        });
      }

      // Clean up failed optimistic plan
      setWorkoutHistory(prev => prev.filter(w => w.data?.isGenerating && !w.convexId));
    } finally {
      generationAbortController.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (ragLoading) {
      setCancellationRequested(true);
      // Note: Actual cancellation would require aborting API calls
      // This is a placeholder for the cancellation logic
      clearPlan();
      clearError();
      toast({
        title: 'Cancelling Generation',
        description: 'Stopping plan generation...',
      });
    }
  };

  // Use integrated generator if enabled, otherwise use RAG
  const currentLoading = USE_INTEGRATED_GENERATOR ? integratedLoading : ragLoading;
  const currentProgress = USE_INTEGRATED_GENERATOR
    ? integratedProgress
    : ragProgress;
  const currentError = USE_INTEGRATED_GENERATOR
    ? integratedError
    : ragError;
  const currentPlan = USE_INTEGRATED_GENERATOR
    ? integratedPlan
    : ragPlan;

  // Update workout history when plan is successfully generated
  // ONLY runs when a NEW plan is successfully generated (plan changes, generation completes)
  useEffect(() => {
    // Use integrated plan if enabled, otherwise use RAG plan
    const planToProcess = USE_INTEGRATED_GENERATOR ? integratedPlan : ragPlan;
    const loadingToCheck = USE_INTEGRATED_GENERATOR ? integratedLoading : ragLoading;
    const errorToCheck = USE_INTEGRATED_GENERATOR ? integratedError : ragError;

    // Debug logging
    console.log('🔍 [useEffect] Plan save check:', {
      hasPlan: !!planToProcess,
      loading: loadingToCheck,
      error: !!errorToCheck,
      planType: USE_INTEGRATED_GENERATOR ? 'integrated' : 'rag',
      planGeneratedAt: planToProcess?.generatedAt,
    });

    // Only process when:
    // 1. We have a valid plan
    // 2. Generation is complete (not loading, no errors)
    // 3. This is a newly generated plan (not just a selection change)
    if (planToProcess && !loadingToCheck && !errorToCheck) {
      // Create a unique identifier for this plan to prevent duplicate processing
      // Use the plan's generatedAt timestamp if available, or hash the plan data
      const planSignature = planToProcess.generatedAt
        ? planToProcess.generatedAt
        : JSON.stringify(planToProcess).substring(0, 200);
      const planKey = `generated-${planSignature}`;

      // Check if we've already processed this plan
      if (processedPlanIds.current.has(planKey)) {
        console.log('⏭️ Plan already processed, skipping:', planKey);
        return;
      }

      console.log('🎯 NEW plan generated successfully, updating history and saving to Convex:', planToProcess);
      processedPlanIds.current.add(planKey);

      // Log the complete JSON response for debugging
      console.log('📊 Complete Plan JSON Response:', JSON.stringify(planToProcess, null, 2));

      // ✅ Handle both phaseAwareFramework and strategicFramework naming
      // For IntegratedPlanGenerator, use weeklyOutlines structure
      const framework = planToProcess.phaseAwareFramework || planToProcess.strategicFramework;
      // Use AI-generated plan name if available, otherwise fallback to split-based name
      // For IntegratedPlanGenerator, use form data or default
      const planName = framework?.planName || (() => {
        if (framework?.trainingApproach?.split) {
          return `${framework.trainingApproach.split} Program`;
        }
        // Fallback to form goal
        const goal = form?.primaryGoal || 'Fitness';
        return `${goal.charAt(0).toUpperCase() + goal.slice(1).replace('_', ' ')} Program`;
      })();

      // Find the optimistic plan that was created during generation (has isGenerating flag)
      // This ensures we update the correct plan even if selectedWorkoutId changed
      const optimisticPlan = workoutHistory.find(w => w.data?.isGenerating);
      const workoutId = optimisticPlan?.id || selectedWorkoutId || Date.now();

      // Extract user profile from form to embed in plan
      let planUserProfile: any = null;
      if (form) {
        planUserProfile = {
          age: form.age,
          gender: form.sex || 'male',
          height: form.heightCm,
          weight: form.weightKg,
          primaryGoal: form.primaryGoal || (form as any).goal || 'general fitness',
          // ✅ Add body composition data
          bodyFat: form.bodyFat,
          targetBodyFat: form.targetBf,
        };

        // Add optional fields if they exist (with proper type conversion)
        // Check both experienceLevel and workoutLevel (form uses workoutLevel)
        if ('experienceLevel' in form && form.experienceLevel) {
          planUserProfile.experienceLevel = form.experienceLevel;
        } else if ('workoutLevel' in form && (form as any).workoutLevel) {
          planUserProfile.experienceLevel = (form as any).workoutLevel;
        }
        if ('workoutDaysPerWeek' in form && form.workoutDaysPerWeek) {
          planUserProfile.workoutDaysPerWeek = form.workoutDaysPerWeek;
        }
        if ('sessionDuration' in form && form.sessionDuration) {
          planUserProfile.sessionDuration = form.sessionDuration;
        }

        // Handle array fields - ensure they're arrays, not empty strings
        if ('equipmentAccess' in form && form.equipmentAccess) {
          planUserProfile.equipmentAccess = Array.isArray(form.equipmentAccess)
            ? form.equipmentAccess
            : [];
        }

        if ('dietaryRestrictions' in form && form.dietaryRestrictions) {
          planUserProfile.dietaryRestrictions = Array.isArray(form.dietaryRestrictions)
            ? form.dietaryRestrictions
            : [];
        }

        if ('foodPreferences' in form || 'preferences' in form) {
          const prefs = (form as any).foodPreferences || (form as any).preferences;
          if (prefs && Array.isArray(prefs) && prefs.length > 0) {
            planUserProfile.foodPreferences = prefs;
          }
        }

        if ('dislikedFoods' in form) {
          const dislikes = (form as any).dislikedFoods;
          if (dislikes && Array.isArray(dislikes) && dislikes.length > 0) {
            planUserProfile.dislikedFoods = dislikes;
          }
        }
      }

      // Embed user profile in plan data so it's specific to this plan
      const planWithProfile = planUserProfile
        ? { ...planToProcess, userProfile: planUserProfile }
        : planToProcess;

      const updatedWorkout = {
        id: workoutId,
        title: planName,
        createdAt: new Date().toISOString(),
        data: planWithProfile // Store the full plan data with embedded user profile
      };

      // Save user profile to Convex (for logged-in user's profile)
      if (form && planUserProfile) {
        if (upsertUserProfile) {
          console.log('💾 Saving user profile to Convex:', planUserProfile);
          upsertUserProfile(planUserProfile)
            .then(() => console.log('✅ User profile saved successfully'))
            .catch(err => console.error('❌ Failed to save user profile:', err));
        } else {
          console.warn('⚠️ upsertUserProfile mutation not available');
        }
      }

      // Save complete workout plan with full data structure to Convex
      // ✅ CRITICAL: Only save NEWLY GENERATED plans - never save when just selecting/viewing
      // Only save if:
      // 1. This is the optimistic plan that was just generated (has isGenerating flag)
      // 2. The plan doesn't already have a convexId (prevent re-saving)
      // 3. We're not currently saving it (prevent concurrent saves)
      const existingPlan = workoutHistory.find(w => w.id === updatedWorkout.id);
      const isOptimisticPlan = existingPlan?.data?.isGenerating === true;
      const alreadySaved = existingPlan?.convexId !== undefined;
      const isSaving = processedPlanIds.current.has(`saving-${updatedWorkout.id}`);

      // ✅ ONLY save if this is a newly generated plan (not just a selected existing plan)
      // Use planWithProfile (which includes userProfile) instead of planToProcess
      if (createWorkoutPlan && planWithProfile && isOptimisticPlan && !alreadySaved && !isSaving) {
        // Mark as saving to prevent concurrent saves
        processedPlanIds.current.add(`saving-${updatedWorkout.id}`);
        // ✅ Store the COMPLETE plan data as-is so the parser can reconstruct it
        // Handle both phaseAwareFramework and strategicFramework naming
        const framework = planWithProfile.phaseAwareFramework || planWithProfile.strategicFramework;
        const periodization = framework?.trainingApproach?.periodization || 'Progressive';

        const workoutPlanData = {
          name: updatedWorkout.title,
          description: `${periodization} training program`,
          // Store the complete plan structure for the UI parser
          phases: planWithProfile.weeklyOutlines || [],
          fullPlanData: planWithProfile, // ✅ Store complete AI-generated plan with embedded userProfile
        };
        console.log('💪 Saving complete workout plan to Convex:', { name: workoutPlanData.name, hasFullData: !!workoutPlanData.fullPlanData });
        createWorkoutPlan(workoutPlanData)
          .then((convexId) => {
            console.log('✅ Workout plan saved successfully with ID:', convexId);

            // Update the pending record to success with plan ID
            // Note: We can't update existing records in Convex easily, so we create a new success record
            // The pending record shows the attempt, this shows the completion
            if (recordTokenUsage) {
              recordTokenUsage({
                operationType: "plan_generation",
                tokensUsed: 100, // PLAN_GENERATION_COST
                status: "success",
                planId: convexId,
                operationSteps: [
                  "feasibility_assessment",
                  "strategic_framework",
                  "weekly_outlines",
                  "exercise_library",
                  "session_templates",
                  "meal_templates",
                  "shopping_lists"
                ],
                details: {
                  completedAt: new Date().toISOString(),
                  planId: convexId,
                },
              }).catch((err) => {
                console.error("Failed to record successful token usage:", err);
              });
            }

            // Mark this convexId as processed to prevent duplicate saves
            processedPlanIds.current.add(`saved-${convexId}`);
            // Remove saving flag
            processedPlanIds.current.delete(`saving-${updatedWorkout.id}`);

            // Update local state with Convex ID - don't change the ID, let Convex query handle the merge
            // The ID will be recalculated when the plan comes back from Convex query
            setWorkoutHistory(prev => prev.map(w => {
              if (w.id === updatedWorkout.id && !w.convexId) {
                // Just add the convexId, keep the existing ID for now
                // When Convex query returns, it will replace this with the correct ID
                console.log('📝 Adding convexId to plan:', w.id, '->', convexId);
                return { ...w, convexId };
              }
              return w;
            }));
          })
          .catch(err => {
            console.error('❌ Failed to save workout plan:', err);
            // Remove saving flag on error so it can be retried
            processedPlanIds.current.delete(`saving-${updatedWorkout.id}`);
          });
      } else {
        if (!isOptimisticPlan) {
          console.log('⏭️ Not saving - this is not a newly generated plan (just viewing/selecting):', updatedWorkout.id);
        } else if (alreadySaved) {
          console.log('⏭️ Plan already saved to Convex, skipping save:', existingPlan?.convexId);
        } else if (isSaving) {
          console.log('⏭️ Plan save already in progress, skipping:', updatedWorkout.id);
        } else if (!createWorkoutPlan) {
          console.warn('⚠️ createWorkoutPlan mutation not available');
        } else if (!planToProcess) {
          console.warn('⚠️ No complete plan data to save');
        }
      }

      // Save meal plan to Convex - ONLY for newly generated plans
      // ✅ CRITICAL: Only save if this is a newly generated optimistic plan
      // Check for meal templates in both formats (RAG uses mealTemplates, Integrated uses phaseMealTemplates)
      const mealTemplates = planToProcess.mealTemplates ||
        (planToProcess.phaseMealTemplates?.[0] || []);
      if (createMealPlan && mealTemplates && mealTemplates.length > 0 && isOptimisticPlan && !alreadySaved) {
        // ✅ Handle both phaseAwareFramework and strategicFramework naming
        const framework = planToProcess.phaseAwareFramework || planToProcess.strategicFramework;
        const nutritionApproach = framework?.nutritionApproach;
        const mealPlanData = {
          name: `${updatedWorkout.title} - Meal Plan`,
          dailyCalories: nutritionApproach?.dailyCaloriesTotal || 2000,
          proteinGrams: nutritionApproach?.macroTargets?.proteinTotalGrams || 150,
          carbsGrams: nutritionApproach?.macroTargets?.carbsTotalGrams || 200,
          fatsGrams: nutritionApproach?.macroTargets?.fatsTotalGrams || 60,
          meals: mealTemplates.map((meal: any, index: number) => ({
            mealNumber: index + 1,
            name: meal.mealName || `Meal ${index + 1}`,
            timeOfDay: meal.timing || 'Any',
            recipes: [{
              name: meal.mealName || `Meal ${index + 1}`,
              ingredients: meal.ingredients?.map((ing: any) => ({
                name: ing.food || ing.name,
                amount: ing.quantity?.toString() || '1',
                unit: ing.unit || 'serving',
              })) || [],
              instructions: meal.prepNotes || 'Prepare as desired',
              macros: {
                calories: meal.macros?.calories || 0,
                protein: meal.macros?.proteinG || 0,
                carbs: meal.macros?.carbsG || 0,
                fats: meal.macros?.fatsG || 0,
              },
            }],
          })),
        };
        console.log('🍽️ Saving meal plan to Convex:', mealPlanData);
        createMealPlan(mealPlanData)
          .then(() => console.log('✅ Meal plan saved successfully'))
          .catch(err => console.error('❌ Failed to save meal plan:', err));
      } else {
        if (!createMealPlan) console.warn('⚠️ createMealPlan mutation not available');
        const mealTemplates = planToProcess?.mealTemplates || planToProcess?.phaseMealTemplates?.[0] || [];
        if (!mealTemplates || mealTemplates.length === 0) console.warn('⚠️ No meal data to save');
      }

      setWorkoutHistory(prev => {
        // Find and replace the optimistic plan with the real one
        const updatedHistory = prev.map(workout => {
          if (workout.id === selectedWorkoutId && workout.data?.isGenerating) {
            console.log('✅ Replacing optimistic plan with real data');
            return updatedWorkout;
          }
          return workout;
        });

        // If no optimistic plan found, add as new workout
        const hasOptimisticPlan = prev.some(workout => workout.id === selectedWorkoutId && workout.data?.isGenerating);
        if (!hasOptimisticPlan) {
          console.log('✅ Adding new workout to history:', updatedWorkout);
          return [updatedWorkout, ...prev];
        }

        return updatedHistory;
      });
    }
    // ✅ IMPORTANT: Only depend on plan and loading state - NOT selectedWorkoutId
    // This ensures uploads ONLY happen after successful generation, not when clicking plans
    // Include both RAG and Integrated plan dependencies
  }, [
    ragPlan, ragLoading, ragError,
    integratedPlan, integratedLoading, integratedError,
    workoutHistory, form, createWorkoutPlan, createMealPlan, upsertUserProfile,
    selectedWorkoutId, USE_INTEGRATED_GENERATOR
  ]);

  return (
    <SidebarProvider defaultOpen={true}>
      <FitnessSidebar
        onNewWorkout={handleNewWorkout}
        onSelectWorkout={handleSelectWorkout}
        onDeleteWorkout={handleDeleteWorkout}
        onNavigate={handleNavigate}
        currentView={currentView}
        selectedWorkoutId={selectedWorkoutId}
        workoutHistory={workoutHistory}
      />

      <SidebarInset className="relative flex flex-col h-screen overflow-hidden">
        {/* ✅ Header with Breadcrumb and Sidebar Toggle - Fixed position, never scrolls */}
        <div className="absolute top-0 left-0 right-0 z-50 border-b bg-white dark:bg-gray-950 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            {renderBreadcrumb()}
          </div>
        </div>

        {/* Main Content Area - Only this scrolls, with padding for fixed header */}
        <div className="flex flex-1 overflow-hidden min-h-0 pt-[60px]">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto overscroll-none">
            <div className="p-6">
              {/* ✅ Settings Pages */}
              {currentView.startsWith('settings') ? (
                <SettingsPage
                  currentView={currentView === 'settings-account' ? 'account' : currentView === 'settings-tokens' ? 'tokens' : 'account'}
                  onViewChange={(view) => {
                    if (view === 'account') handleNavigate('settings-account');
                    if (view === 'tokens') handleNavigate('settings-tokens');
                  }}
                />
              ) : (
                /* ✅ Home/Workout Content */
                <>

                  {/* Loading State - Show skeleton when loading plans */}
                  {currentLoading && workoutHistory.length === 0 && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-96" />
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                          <Card key={i} className="p-6">
                            <Skeleton className="h-16 w-16 rounded-lg mb-4" />
                            <Skeleton className="h-8 w-20 mb-2" />
                            <Skeleton className="h-4 w-32" />
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State - No Plans */}
                  {!selectedWorkoutId && !currentPlan && workoutHistory.length === 0 && !currentLoading && (
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                      <Card className="max-w-md w-full text-center border-2 border-dashed border-muted-foreground/20">
                        <CardContent className="pt-12 pb-8">
                          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6">
                            <Dumbbell className="h-10 w-10 text-primary" />
                          </div>
                          <h3 className="text-2xl font-semibold mb-2 font-editorial">Create Your First Plan</h3>
                          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                            Get started by creating a personalized workout and nutrition plan tailored to your goals.
                            Our AI will analyze your profile and create a comprehensive program just for you.
                          </p>
                          <Button
                            onClick={handleNewWorkout}
                            size="lg"
                            className="gap-2 bg-primary hover:bg-primary/90"
                          >
                            <Plus className="h-4 w-4" />
                            Create Workout Plan
                          </Button>
                          <div className="mt-8 pt-6 border-t">
                            <p className="text-sm text-muted-foreground mb-4">What you'll get:</p>
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div className="flex flex-col items-center gap-2">
                                <Target className="h-5 w-5 text-primary" />
                                <span className="text-muted-foreground">Custom Plan</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <Calendar className="h-5 w-5 text-primary" />
                                <span className="text-muted-foreground">Weekly Schedule</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <Heart className="h-5 w-5 text-primary" />
                                <span className="text-muted-foreground">Meal Plans</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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
                            workoutPlanId={selectedWorkout.convexId}
                          />
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Dashboard Overview - When plans exist but none selected */}
                  {!selectedWorkoutId && !ragPlan && workoutHistory.length > 0 && !ragLoading && (
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-2xl font-bold mb-2 font-editorial">Your Fitness Plans</h2>
                          <p className="text-muted-foreground">Select a plan to view details or create a new one</p>
                        </div>
                        <Button onClick={handleNewWorkout} className="gap-2">
                          <Plus className="h-4 w-4" />
                          New Plan
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="p-6 border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors cursor-pointer" onClick={handleNewWorkout}>
                          <div className="flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Plus className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold mb-1">Create New Plan</h3>
                              <p className="text-sm text-muted-foreground">Generate a personalized fitness program</p>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-6 bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Total Plans</span>
                            <Dumbbell className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-3xl font-bold">{workoutHistory.length}</div>
                        </Card>

                        <Card className="p-6 bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Active Plans</span>
                            <Target className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-3xl font-bold">
                            {workoutHistory.filter(w => w.data?.isActive).length}
                          </div>
                        </Card>
                      </div>

                      <Card className="p-6">
                        <h3 className="font-semibold mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2" onClick={handleNewWorkout}>
                            <Plus className="h-5 w-5" />
                            <span className="text-xs">New Plan</span>
                          </Button>
                          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2" disabled>
                            <Calendar className="h-5 w-5" />
                            <span className="text-xs">Schedule</span>
                          </Button>
                          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2" disabled>
                            <Target className="h-5 w-5" />
                            <span className="text-xs">Progress</span>
                          </Button>
                          <Button variant="outline" className="h-auto py-3 flex flex-col gap-2" disabled>
                            <Heart className="h-5 w-5" />
                            <span className="text-xs">Nutrition</span>
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Plan Overview */}
                  {currentPlan && !selectedWorkoutId && (
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold mb-6 font-editorial">Your Fitness Plan</h2>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-primary/10 rounded-lg">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <Badge variant="secondary" className="text-xs">Confidence</Badge>
                          </div>
                          <div className="text-3xl font-bold mb-1">
                            {Math.round(((currentPlan as any)?.feasibility?.confidenceScore || 0.9) * 100)}%
                          </div>
                          <p className="text-xs text-muted-foreground">Plan Feasibility</p>
                        </Card>

                        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-950/10 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                              <Dumbbell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <Badge variant="secondary" className="text-xs">Library</Badge>
                          </div>
                          <div className="text-3xl font-bold mb-1">
                            {(() => {
                              const cp: any = currentPlan;
                              const phaseLib = Array.isArray(cp?.phaseExerciseLibraries) ? cp.phaseExerciseLibraries.flat() : [];
                              return (phaseLib.length || cp?.exerciseLibrary?.length || 0);
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground">Total Exercises</p>
                        </Card>

                        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-950/10 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                              <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <Badge variant="secondary" className="text-xs">Schedule</Badge>
                          </div>
                          <div className="text-3xl font-bold mb-1">
                            {(() => {
                              const cp: any = currentPlan;
                              const phaseSessions = Array.isArray(cp?.phaseSessionTemplates) ? cp.phaseSessionTemplates.flat() : [];
                              return (phaseSessions.length || cp?.sessionTemplates?.length || 0);
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground">Workout Sessions</p>
                        </Card>

                        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-950/10 border-red-200 dark:border-red-800 hover:shadow-lg transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/50 rounded-lg">
                              <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <Badge variant="secondary" className="text-xs">Nutrition</Badge>
                          </div>
                          <div className="text-3xl font-bold mb-1">
                            {(() => {
                              const cp: any = currentPlan;
                              const phaseMeals = Array.isArray(cp?.phaseMealTemplates) ? cp.phaseMealTemplates.flat() : [];
                              return (phaseMeals.length || cp?.mealTemplates?.length || 0);
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground">Meal Plans</p>
                        </Card>
                      </div>

                      {/* Plan Content */}
                      {children || (
                        <div className="space-y-6">
                          <Card className="p-6">
                            <h3 className="text-xl font-semibold mb-4 font-editorial">Training Plan</h3>
                            {(() => {
                              // ✅ Handle both phaseAwareFramework and strategicFramework naming
                              // Use currentPlan which handles both RAG and Integrated plans
                              const framework = currentPlan?.phaseAwareFramework || currentPlan?.strategicFramework;
                              return framework?.trainingApproach ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Split:</span>
                                      <span className="font-medium">{framework.trainingApproach.split}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Frequency:</span>
                                      <span className="font-medium font-mono">{framework.trainingApproach.frequencyPerWeek} days/week</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Duration:</span>
                                      <span className="font-medium font-mono">{framework.trainingApproach.sessionDurationMinutes} min</span>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Periodization:</span>
                                      <span className="font-medium">{framework.trainingApproach.periodization}</span>
                                    </div>
                                    <div className="space-y-2">
                                      <span className="text-muted-foreground">Volume per muscle group:</span>
                                      {Object.entries(framework.trainingApproach.volumePerMuscleWeekly || {}).map(([muscle, volume]) => (
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
                              );
                            })()}
                          </Card>

                          <Card className="p-6">
                            <h3 className="text-xl font-semibold mb-4 font-editorial">Nutrition Plan</h3>
                            {(() => {
                              // ✅ Handle both phaseAwareFramework and strategicFramework naming
                              // Use currentPlan which handles both RAG and Integrated plans
                              const framework = currentPlan?.phaseAwareFramework || currentPlan?.strategicFramework;
                              return framework?.nutritionApproach ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Strategy:</span>
                                      <span className="font-medium">{framework.nutritionApproach.caloricStrategy.deficitMagnitude}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Daily Deficit:</span>
                                      <span className="font-medium font-mono">{framework.nutritionApproach.caloricStrategy.dailyDeficitCalories} cal</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Protein:</span>
                                      <span className="font-medium font-mono">{framework.nutritionApproach.macroTargets.proteinTotalGrams}g</span>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Meal Frequency:</span>
                                      <span className="font-medium font-mono">{framework.nutritionApproach.mealFrequency} meals/day</span>
                                    </div>
                                    <div className="space-y-2">
                                      <span className="text-muted-foreground">Timing:</span>
                                      <div className="text-sm space-y-1">
                                        <div>Pre-workout: {framework.nutritionApproach.timing.preWorkout}</div>
                                        <div>Post-workout: {framework.nutritionApproach.timing.postWorkout}</div>
                                        <div>Bedtime: {framework.nutritionApproach.timing.bedtime}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                  <p className="text-muted-foreground">Generate a plan to see your nutrition details</p>
                                </div>
                              );
                            })()}
                          </Card>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </SidebarInset>

      {/* Chain of Thoughts Sidebar - Moved outside SidebarInset to prevent layout interference */}
      <ChainOfThoughtSidebar
        isOpen={showChainOfThought}
        onClose={() => setShowChainOfThought(false)}
        currentLoading={currentLoading}
        ragProgress={currentProgress}
        onCancel={USE_INTEGRATED_GENERATOR ? handleCancelIntegratedGeneration : handleCancelGeneration}
        error={currentError}
        onRetry={() => {
          if (USE_INTEGRATED_GENERATOR) {
            clearIntegratedError();
            handleGenerateIntegratedPlan(form);
          } else {
            clearError();
            handleGeneratePlan(form);
          }
        }}
      />

      {/* Multistep Form Modal */}
      {
        showNewWorkoutForm && (
          <MultistepProfileForm
            onComplete={handleFormComplete}
            onCancel={handleFormCancel}
          />
        )
      }
    </SidebarProvider >
  );
}
