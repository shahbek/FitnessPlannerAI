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
import { GoalCategory, getGoalCategoryLabel } from '@/models/UserProfile';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useWorkoutPlansWithCache } from '@/hooks/useWorkoutPlansWithCache';
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
  isAuthFresh?: boolean;
}

// Helper component to lazily load plan data
function PlanDataLoader({
  convexId,
  initialData,
  title,
  isAuthFresh
}: {
  convexId?: string,
  initialData?: any,
  title: string,
  isAuthFresh: boolean
}) {
  // If provided initialData is sufficient (e.g. active plan or newly generated), use it.
  // Otherwise, if we have a convexId, fetch the full plan.
  const shouldFetch = !initialData && !!convexId;
  const fetchedPlan = useQuery(api.workoutPlans.getWorkoutPlan, shouldFetch ? { planId: convexId as any } : "skip");

  const finalData = initialData || fetchedPlan?.fullPlanData;

  if (shouldFetch && !fetchedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <p className="text-muted-foreground">Loading plan details...</p>
      </div>
    );
  }

  if (!finalData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Plan data unavailable.</p>
      </div>
    );
  }

  return (
    <WorkoutProgramView
      workoutData={finalData}
      planTitle={title}
      workoutPlanId={convexId}
      isAuthFresh={isAuthFresh}
    />
  );
}

export function FitnessLayout({ children, isAuthFresh = false }: FitnessLayoutProps) {
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
  // mealPlans table removed as it was redundant
  const upsertUserProfile = useMutation(api.users.upsertUserProfile);
  const deleteWorkoutPlan = useMutation(api.workoutPlans.deleteWorkoutPlan);

  // Token system mutations and queries
  const recordTokenUsage = useMutation(api.accounts.recordTokenUsage);
  // Only fetch tokens if auth knows we are fresh (to avoid Unauthenticated error on immediate render)
  const getUserAccount = useQuery(api.accounts.getUserAccount, isAuthFresh ? {} : "skip");

  // Use our new cached plans hook
  const { plans: savedWorkoutPlans, isLoaded: plansLoaded } = useWorkoutPlansWithCache(workoutHistory, isAuthFresh);
  // Note: savedMealPlans can be used for future meal plan features
  // const savedMealPlans = useQuery(api.mealPlans.getUserMealPlans);

  // Load saved plans from Convex via Cache Hook
  useEffect(() => {
    console.log('🔄 useEffect triggered - savedWorkoutPlans (via Cache):', savedWorkoutPlans?.length || 0, 'plans');

    if (savedWorkoutPlans && savedWorkoutPlans.length > 0) {
      // Merge with local state (keep any generating plans)
      setWorkoutHistory(prev => {
        // ✅ Build maps for efficient lookup
        const convexIdToLocalPlan = new Map<string, typeof prev[0]>();

        // Map local plans (optimistic/generating)
        for (const plan of prev) {
          if (plan.convexId) {
            convexIdToLocalPlan.set(plan.convexId.toString(), plan);
          }
        }

        // Filter out any local versions that are now present in the saved/cached plans
        // We fundamentally trust the savedWorkoutPlans (checked against cache/server) more than local state
        // EXCEPT for "generating" plans which might not be in saved yet.

        // 1. Keep "generating" plans (no convexId yet, or specifically marked)
        const generatingPlans = prev.filter(p => p.data?.isGenerating && !p.convexId && !processedPlanIds.current.has(p.id.toString()));

        // 2. Keep saved plans
        const merged = [...generatingPlans, ...savedWorkoutPlans];

        // 🔒 OPTIMISTIC PLAN CLEANUP
        // If we have any saved plans that match the creation time of a generating plan, remove the generating one
        // This handles cases where the optimistic plan and the real plan momentarily coexist
        if (generatingPlans.length > 0 && savedWorkoutPlans.length > 0) {
          const latestSaved = savedWorkoutPlans[0]; // Assuming desc order
          // If latest saved is very recent (within last minute), clear generating to be safe
          const isRecent = (new Date().getTime() - new Date(latestSaved.createdAt).getTime()) < 60000;
          if (isRecent && generatingPlans.length > 0) {
            console.log('🧹 Cleaning up optimistic plan as fresh saved plan arrived:', latestSaved.id);
            return savedWorkoutPlans;
          }
        }

        return merged;
      });

      // ✅ Check if current selection exists in savedWorkoutPlans
      const currentlySelected = savedWorkoutPlans.find((p: any) => p.id === selectedWorkoutId);

      // If we don't have a valid selection, select the most recent one
      // BUT ONLY if we are not currently generating a plan (preserving optimistic view)
      const isGenerating = workoutHistory.some(p => p.data?.isGenerating);
      if (!isGenerating && !currentlySelected && savedWorkoutPlans.length > 0) {
        const mostRecentCompleted = savedWorkoutPlans[0];
        console.log('🔄 No valid selection, auto-selecting most recent completed plan:', mostRecentCompleted.id, mostRecentCompleted.title);
        setSelectedWorkoutId(mostRecentCompleted.id);
        setCurrentView('home');
      }
    }
  }, [savedWorkoutPlans, selectedWorkoutId]); // Added selectedWorkoutId dependency to re-check if selection is cleared

  // Additional safety effect: If we have plans but no selection (e.g. cleared manually), select one immediately
  useEffect(() => {
    if (!selectedWorkoutId && workoutHistory.length > 0) {
      const activePlan = workoutHistory.find(p => p.data?.isActive);
      if (activePlan) {
        console.log('🎯 Auto-selecting active plan:', activePlan.id);
        setSelectedWorkoutId(activePlan.id);
        setCurrentView('home');
      } else {
        console.log('🎯 Auto-selecting most recent plan:', workoutHistory[0].id);
        setSelectedWorkoutId(workoutHistory[0].id);
        setCurrentView('home');
      }
    }
  }, [selectedWorkoutId, workoutHistory]);

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
    // Don't clear selectedWorkoutId when going to settings, just hide it via view state
  };

  // Generate breadcrumb JSX based on current view
  const renderBreadcrumb = () => {
    // ✅ Check currentView FIRST before selectedWorkoutId
    // This ensures Settings breadcrumb shows even when a plan is selected

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

    // Show breadcrumb for selected workout plans (only if not in Settings)
    if (selectedWorkoutId) {
      const selectedWorkout = workoutHistory.find(w => w.id === selectedWorkoutId);
      if (selectedWorkout) {
        return (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {/* Made "Your Plans" non-clickable or essentially a reset to default plan */}
                <span className="font-medium">Your Plans</span>
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
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: 'Could not delete the plan. You may need to sign in again.',
        });
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
      // IMPORTANT: Only include bodyFat if user explicitly provided it
      // If undefined, NutritionCalculationService will correctly fall back to Mifflin-St Jeor
      bodyFat: formData.bodyFat ? formData.bodyFat : undefined,
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

      // 💰 PAYMENT ENFORCEMENT
      // Check token balance and deduct BEFORE generation starts
      const PLAN_GENERATION_COST = 100;
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

      // Strict check for production
      if (!isDevelopment && (!getUserAccount || getUserAccount.tokens < PLAN_GENERATION_COST)) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Tokens',
          description: `You need ${PLAN_GENERATION_COST} tokens to generate a plan.`,
          action: (
            <Button variant="outline" size="sm" onClick={() => setCurrentView('settings-tokens')}>
              Purchase
            </Button>
          ),
        });
        return;
      }

      // Record generation attempt at START (before generation begins)
      // This ensures ALL attempts are tracked, including failures
      // Use "pending" status - does NOT deduct tokens yet
      if (recordTokenUsage) {
        try {
          const result = await recordTokenUsage({
            operationType: "plan_generation",
            tokensUsed: PLAN_GENERATION_COST,
            status: "pending", // Track attempt, don't deduct yet
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
              generator: "integrated",
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
      // Use goalCategory label if available, otherwise fall back to primaryGoal
      const goalLabel = (dataToUse as any).goalCategory
        ? getGoalCategoryLabel((dataToUse as any).goalCategory as GoalCategory)
        : dataToUse.primaryGoal?.replace(/_/g, ' ') || 'Fitness';

      const optimisticPlan = {
        id: Date.now(),
        title: `${goalLabel} Program`,
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

      // ✅ CLEANUP: Remove the optimistic "generating" plan from sidebar
      const optimisticPlan = workoutHistory.find(w => w.data?.isGenerating);
      if (optimisticPlan) {
        setWorkoutHistory(prev => prev.filter(w => w.id !== optimisticPlan.id));

        // ✅ NAVIGATION: Select the first available plan (or undefined if none)
        const remainingPlans = workoutHistory.filter(w => w.id !== optimisticPlan.id);
        if (remainingPlans.length > 0) {
          setSelectedWorkoutId(remainingPlans[0].id);
        } else {
          setSelectedWorkoutId(undefined);
        }
      }

      // ✅ FIXED: Record failed generation with 0 tokens (no charge for failures)
      if (recordTokenUsage) {
        try {
          await recordTokenUsage({
            operationType: "plan_generation",
            tokensUsed: 0, // ✅ NO tokens charged for failures
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
              error: err?.message || integratedError || "Unknown error",
              failedAt: new Date().toISOString(),
              errorDetails: err instanceof Error ? err.stack : String(err),
            },
          });
          console.log('❌ Recorded failed generation (0 tokens charged)');
        } catch (tokenError) {
          console.error("Failed to record failed token usage:", tokenError);
        }
      }

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
      // Use goalCategory label if available, otherwise fall back to primaryGoal
      const goalLabel = (dataToUse as any).goalCategory
        ? getGoalCategoryLabel((dataToUse as any).goalCategory as GoalCategory)
        : dataToUse.primaryGoal?.replace(/_/g, ' ') || 'Fitness';

      const optimisticPlan = {
        id: Date.now(),
        title: `${goalLabel} Program`,
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
        // Fallback to form goal - use goalCategory (new) or primaryGoal (legacy)
        const goalCategory = (form as any)?.goalCategory as GoalCategory | undefined;
        if (goalCategory) {
          return `${getGoalCategoryLabel(goalCategory)} Program`;
        }
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
          // ✅ New goal category system (takes priority)
          goalCategory: (form as any).goalCategory || undefined,
          // ✅ Body fat goal (for body_fat_goal category)
          bodyFatGoal: (form as any).bodyFatGoal || undefined,
          // Legacy field for backward compatibility
          primaryGoal: form.primaryGoal || (form as any).goal || 'general fitness',
          // ✅ Add body composition data
          bodyFat: form.bodyFat,
          targetBodyFat: form.targetBf,
          // ✅ Add activity level
          activityLevel: (form as any).activityLevel || (form as any).activity,
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
        // ✅ Add activityLevel for accurate TDEE calculation
        if ('activityLevel' in form && (form as any).activityLevel) {
          planUserProfile.activityLevel = (form as any).activityLevel;
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
                // ✅ Remove isGenerating flag to show final plan name in sidebar
                console.log('📝 Adding convexId to plan:', w.id, '->', convexId);
                const updatedData = w.data ? { ...w.data, isGenerating: false } : w.data;
                return { ...w, convexId, data: updatedData };
              }
              return w;
            }));

            // ✅ NAVIGATION: Ensure the newly generated plan stays selected and view is set to home
            setSelectedWorkoutId(updatedWorkout.id);
            setCurrentView('home');
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
    workoutHistory, form, createWorkoutPlan, upsertUserProfile,
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
                          <PlanDataLoader
                            initialData={selectedWorkout.data}
                            title={selectedWorkout.title}
                            convexId={selectedWorkout.convexId ? selectedWorkout.convexId.toString() : undefined}
                            isAuthFresh={isAuthFresh}
                          />
                        ) : null;
                      })()}
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
                                    {(() => {
                                      const strategy = framework.nutritionApproach.caloricStrategy as any;
                                      const dailyDelta =
                                        typeof strategy.dailyEnergyDeltaCalories === 'number'
                                          ? strategy.dailyEnergyDeltaCalories
                                          : Number(strategy.dailyDeficitCalories || 0);
                                      const isDeficit = dailyDelta >= 0;
                                      return (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Strategy:</span>
                                            <span className="font-medium">{framework.nutritionApproach.caloricStrategy.deficitMagnitude}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">{isDeficit ? 'Daily Deficit:' : 'Daily Surplus:'}</span>
                                            <span className="font-medium font-mono">
                                              {isDeficit ? '−' : '+'}{Math.abs(Math.round(dailyDelta))} cal
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
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
        isSaving={!currentLoading && !currentError && !!workoutHistory.find(w => w.id === selectedWorkoutId && w.data?.isGenerating)}
        onRetry={() => {
          if (USE_INTEGRATED_GENERATOR) {
            clearIntegratedError();
            handleGenerateIntegratedPlan(form);
          } else {
            clearError();
            handleGeneratePlan(form);
          }
        }}
        onViewPlan={() => {
          // ✅ Navigate to the plan and ensure we have a plan selected
          // Find the most recent plan (should be the newly generated one)
          const latestPlan = workoutHistory[0];
          if (latestPlan) {
            setSelectedWorkoutId(latestPlan.id);
            setCurrentView('home'); // 'home' is the correct view for workout content
          } else {
            // Fallback: if no plans, just go to home (will show empty state)
            setCurrentView('home');
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
