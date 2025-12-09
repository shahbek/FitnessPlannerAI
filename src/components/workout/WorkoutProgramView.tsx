import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { parseWorkoutData, ParsedWorkoutData } from '@/utils/workoutDataParser';
import { PhaseProgressionTable } from '@/components/tables/PhaseProgressionTable';
import { PhasesOverview } from '@/components/tables/PhasesOverview';
import { ComprehensiveMealTable } from '@/components/tables/ComprehensiveMealTable';
import { WeeklyScheduleTable } from '@/components/tables/WeeklyScheduleTable';
import { WeeklyShoppingTable } from '@/components/tables/WeeklyShoppingTable';
import { useSidebar } from '@/components/ui/sidebar';
import mealsIcon from '@/assets/images/3dicons/meals.png';
import dumbellIcon from '@/assets/images/3dicons/dumbell.png';
import groceriesIcon from '@/assets/images/3dicons/groceries.png';
import steppingStoolIcon from '@/assets/images/3dicons/stepping_stool.png';

interface WorkoutProgramViewProps {
  workoutData: any; // Raw JSON data from AI
  planTitle?: string;
  workoutPlanId?: string; // Convex ID for the workout plan
}

export function WorkoutProgramView({ workoutData, planTitle, workoutPlanId }: WorkoutProgramViewProps) {
  const { state: sidebarState, isMobile } = useSidebar();
  const [parsedData, setParsedData] = useState<ParsedWorkoutData | null>(null);
  const [activeTab, setActiveTab] = useState('phases');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(planTitle || 'Workout Program');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updateWorkoutPlan = useMutation(api.workoutPlans.updateWorkoutPlan);

  // Update editedTitle when planTitle prop changes
  useEffect(() => {
    setEditedTitle(planTitle || 'Workout Program');
  }, [planTitle]);

  // Extract user profile from plan data (plan-specific profile)
  // Fallback to logged-in user's profile if plan doesn't have one
  const planUserProfile = workoutData?.userProfile;
  const loggedInUserProfile = useQuery(api.users.getUserProfile);
  const userProfile = planUserProfile || loggedInUserProfile || undefined;

  // Parse the data when component mounts or data changes
  useEffect(() => {
    if (workoutData) {
      try {
        const parsed = parseWorkoutData(workoutData);
        setParsedData(parsed);
        console.log('✅ Parsed workout data:', parsed);
      } catch (error) {
        console.error('Error parsing workout data:', error);
      }
    }
  }, [workoutData]);

  // Check if the plan is still generating
  const isGenerating = workoutData?.isGenerating;

  useEffect(() => {
    if (activeTab === 'comprehensive-meals' && parsedData?.comprehensiveMeals?.length) {
      console.log('\n🍽️ [UI] Meal names for current plan:');
      parsedData.comprehensiveMeals.forEach((meal, index) => {
        console.log(`  Meal ${index + 1}: ${meal.name}`);
      });
      console.log('');
    }
  }, [activeTab, parsedData]);

  // Sync contentEditable content when not editing or when title changes
  // This must be called before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (titleRef.current && !isEditingTitle) {
      // When not editing, ensure DOM matches React state
      if (titleRef.current.textContent !== editedTitle) {
        titleRef.current.textContent = editedTitle;
      }
    }
  }, [editedTitle, isEditingTitle]);

  if (!parsedData || isGenerating) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500" role="status" aria-live="polite" aria-label="Loading workout plan">
        {/* Header with skeleton */}
        <div className="border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
              <div className="h-8 w-px bg-border"></div>
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
              <div className="h-8 w-px bg-border"></div>
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Content with skeleton */}
        <Tabs defaultValue="comprehensive-meals" className="w-full">
          <div
            className="fixed bottom-8 z-50 flex justify-center items-center pointer-events-none transition-all duration-200 px-6"
            style={{
              left: isMobile ? '0' : (sidebarState === 'expanded' ? '16rem' : '0'),
              right: 0
            }}
          >
            <TabsList variant="glass" className="pointer-events-auto flex-shrink-0">
              <TabsTrigger value="comprehensive-meals" disabled>
                <div className="flex flex-col items-center gap-0">
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="h-3 w-12 mt-1" />
                </div>
              </TabsTrigger>
              <TabsTrigger value="weekly-schedule" disabled>
                <div className="flex flex-col items-center gap-0">
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="h-3 w-12 mt-1" />
                </div>
              </TabsTrigger>
              <TabsTrigger value="shopping" disabled>
                <div className="flex flex-col items-center gap-0">
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="h-3 w-12 mt-1" />
                </div>
              </TabsTrigger>
              <TabsTrigger value="phases" disabled>
                <div className="flex flex-col items-center gap-0">
                  <Skeleton className="w-9 h-9 rounded" />
                  <Skeleton className="h-3 w-12 mt-1" />
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-4 pb-32">
            <TabsContent value="comprehensive-meals" className="mt-0">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="p-4">
                          <div className="space-y-3">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <div className="flex gap-2 mt-3">
                              <Skeleton className="h-6 w-16 rounded-full" />
                              <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  }

  const handleTitleClick = () => {
    if (workoutPlanId) {
      setIsEditingTitle(true);
      // Focus the contentEditable element after a brief delay to ensure it's rendered
      setTimeout(() => {
        if (titleRef.current) {
          // Ensure content is set before focusing
          if (titleRef.current.textContent !== editedTitle) {
            titleRef.current.textContent = editedTitle;
          }
          titleRef.current.focus();
          // Select all text for easy editing
          const range = document.createRange();
          range.selectNodeContents(titleRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  };

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    const newTitle = titleRef.current?.textContent?.trim() || editedTitle;
    
    // Only update if title changed and we have a plan ID
    if (newTitle !== editedTitle && workoutPlanId && newTitle.length > 0) {
      setEditedTitle(newTitle);
      try {
        await updateWorkoutPlan({
          planId: workoutPlanId as any,
          name: newTitle,
        });
      } catch (error) {
        console.error('Failed to update plan title:', error);
        // Revert on error
        const originalTitle = planTitle || 'Workout Program';
        setEditedTitle(originalTitle);
        if (titleRef.current) {
          titleRef.current.textContent = originalTitle;
        }
      }
    } else if (newTitle.length === 0) {
      // Revert if empty
      const originalTitle = planTitle || 'Workout Program';
      setEditedTitle(originalTitle);
      if (titleRef.current) {
        titleRef.current.textContent = originalTitle;
      }
    } else {
      // Sync DOM with state if no change
      if (titleRef.current && titleRef.current.textContent !== editedTitle) {
        titleRef.current.textContent = editedTitle;
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      const originalTitle = planTitle || 'Workout Program';
      setEditedTitle(originalTitle);
      if (titleRef.current) {
        titleRef.current.textContent = originalTitle;
      }
    }
  };

  const tabs = [
    {
      value: 'phases',
      label: 'Phases',
      icon: steppingStoolIcon,
      content: (
        <PhasesOverview
          plan={workoutData}
          progression={parsedData.phaseProgression}
          weeklySchedule={parsedData.weeklySchedule}
          userProfile={userProfile || undefined}
          workoutPlanId={workoutPlanId}
        />
      )
    },
    {
      value: 'comprehensive-meals',
      label: 'Meals',
      icon: mealsIcon,
      content: <ComprehensiveMealTable data={parsedData.comprehensiveMeals} />
    },
    {
      value: 'weekly-schedule',
      label: 'Schedule',
      icon: dumbellIcon,
      content: <WeeklyScheduleTable data={parsedData.weeklySchedule} plan={workoutData} />
    },
    {
      value: 'shopping',
      label: 'Groceries',
      icon: groceriesIcon,
      content: <WeeklyShoppingTable data={parsedData.weeklyShopping} />
    }
  ];

  return (
    <div className="space-y-8 relative animate-in fade-in duration-500">
      {/* Header - Clean, minimal design */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              ref={titleRef}
              contentEditable={isEditingTitle && !!workoutPlanId}
              suppressContentEditableWarning
              onClick={handleTitleClick}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className={`text-3xl font-editorial font-light tracking-tight mb-2 ${
                workoutPlanId 
                  ? 'cursor-text hover:opacity-80 transition-opacity outline-none focus:outline-none focus:ring-0' 
                  : ''
              } ${isEditingTitle ? 'ring-1 ring-border rounded px-2 -mx-2' : ''}`}
              style={{
                minHeight: '2.5rem',
                ...(isEditingTitle ? { 
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                } : {})
              }}
            >
              {editedTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              Complete fitness program with exercises, nutrition, and progression
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-semibold font-mono">{parsedData.exerciseLibrary.length}</div>
              <div className="text-muted-foreground text-xs mt-1">Exercises</div>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <div className="text-center">
              <div className="text-2xl font-semibold font-mono">{parsedData.sessionTemplates.length}</div>
              <div className="text-muted-foreground text-xs mt-1">Sessions</div>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <div className="text-center">
              <div className="text-2xl font-semibold font-mono">{parsedData.mealTemplates.length}</div>
              <div className="text-muted-foreground text-xs mt-1">Meals</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Content - Clean tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        {/* Tabs container - positioned relative to plan view area, accounting for content padding */}
        <div
          className="fixed bottom-8 z-50 flex justify-center items-center pointer-events-none transition-all duration-200 px-6"
          style={{
            // On mobile, sidebar is a Sheet overlay, so it doesn't take space - always use left: 0
            // On desktop with offcanvas mode: expanded = 16rem, collapsed = 0 (slides off-screen)
            left: isMobile ? '0' : (sidebarState === 'expanded' ? '16rem' : '0'),
            right: 0,
          }}
        >
          <TabsList variant="glass" className="pointer-events-auto flex-shrink-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex flex-col items-center gap-0"
              >
                {tab.icon && (
                  <img
                    src={tab.icon}
                    alt={tab.label}
                    className="w-9 h-9 object-contain flex-shrink-0"
                    onError={(e) => {
                      console.error('Failed to load icon:', tab.icon);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="text-xs">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4 pb-32">
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              {tab.content}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
