import React, { useState } from 'react';
import { useFitnessPlan } from '@/hooks/useFitnessPlan';
import { useMultiAgentPlanner } from '@/hooks/useMultiAgentPlanner';
import { useAIMasterCoordinator } from '@/hooks/useAIMasterCoordinator';
import { DEFAULT_FORM_STATE, DEMO_PLAN, TAB_OPTIONS } from '@/constants';
import { copyToClipboard } from '@/utils';
import { exportPdf } from '@/utils/pdfExport';
import { formatPretty } from '@/utils';

// UI Components
import { Tabs } from '@/components/ui/Tabs';
import { Kbd } from '@/components/ui/Kbd';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Small } from '@/components/ui/Small';

// Form Components
import { ApiConfigForm } from '@/components/forms/ApiConfigForm';
import { UserProfileForm } from '@/components/forms/UserProfileForm';
import { ScheduleDietForm } from '@/components/forms/ScheduleDietForm';

// Plan Components
import { PlanOverview } from '@/components/plan/PlanOverview';
import { MealsTable } from '@/components/plan/MealsTable';
import { ProgressionTimeline } from '@/components/plan/ProgressionTimeline';
import { PhaseBreakdown } from '@/components/plan/PhaseBreakdown';
import { AgentReasoning } from '@/components/plan/AgentReasoning';
import { StreamingProgress } from '@/components/plan/StreamingProgress';
import { MealSuggestions } from '@/components/plan/MealSuggestions';

// Check-in Components
import { WeeklyCheckIn } from '@/components/checkin/WeeklyCheckIn';

// Debug Components
import { MealDebugger } from '@/components/debug/MealDebugger';

export default function App() {
  const {
    form,
    loading,
    raw,
    summary,
    error,
    parsed,
    userPrompt,
    handleChange,
    callModel,
    loadDemo,
  } = useFitnessPlan(DEFAULT_FORM_STATE);

  // Multi-agent progressive planner
  const {
    loading: progressiveLoading,
    error: progressiveError,
    currentPhase,
    agentResponses,
    progressivePlan,
    reasoning,
    generateProgressivePlan,
    adjustPlan,
    clearError: clearProgressiveError
  } = useMultiAgentPlanner({ form });

  // AI Master Coordinator - Let AI do all the heavy lifting
  const {
    coordinatedPlan,
    loading: aiLoading,
    error: aiError,
    currentStep,
    generateCompleteAIPlan,
    clearError: clearAIError
  } = useAIMasterCoordinator(form);

  const [tab, setTab] = useState<string>('AI Plan');
  const [exporting, setExporting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  const [selectedPhase, setSelectedPhase] = useState<number | undefined>();
  const [showProgressivePlan, setShowProgressivePlan] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<any>(null);

  const handleExport = async () => {
    const planToExport = showProgressivePlan ? progressivePlan : parsed;
    if (!planToExport) {
      return;
    }
    
    try {
      setExporting(true);
      await exportPdf(planToExport);
    } catch (e: any) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleProgressiveProgress = (progress: any) => {
    setStreamingProgress(progress);
  };

  const handleGenerateProgressive = async () => {
    setShowProgressivePlan(true);
    setStreamingProgress(null);
    await generateProgressivePlan();
  };

  const handleLoadDemo = () => {
    loadDemo(DEMO_PLAN);
  };

  const runParserTest = () => {
    const edge = {
      week_plan: [],
      meals: [],
      calories: null,
      feasibility: { status: 'adjusted' as const, proposed_timeline_weeks: 16 },
    };
    const s = formatPretty(edge as any, 'Edge-case summary OK');
    if (!s.includes('Feasibility: adjusted') || !s.includes('Edge-case')) {
      console.error('Parser test failed');
    } else {
      loadDemo(edge as any);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Fitness Planner AI</h1>
          <p className="text-gray-600">
            AI-powered personal fitness trainer with intelligent workout and nutrition planning
          </p>
          <div className="mt-2 text-xs text-gray-500 flex gap-3 items-center">
            <span>
              Tips: <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to copy JSON; Export PDF for sharing.
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <ApiConfigForm form={form} onChange={handleChange} />
            <UserProfileForm form={form} onChange={handleChange} />
            <ScheduleDietForm form={form} onChange={handleChange} />

            <div className="flex flex-wrap gap-2">
              <Button onClick={callModel} disabled={loading || !form.apiKey}>
                Generate Single Week
              </Button>
              <Button 
                onClick={handleGenerateProgressive} 
                disabled={progressiveLoading || !form.apiKey}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {progressiveLoading ? 'Generating...' : 'Generate Multi-Week Plan'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => copyToClipboard(userPrompt)}
              >
                Copy Prompt
              </Button>
              <Button variant="secondary" onClick={handleLoadDemo}>
                Load Demo
              </Button>
              <Button variant="secondary" onClick={runParserTest}>
                Run Parser Test
              </Button>
            </div>
            
            {loading && <Small>Generating single week plan…</Small>}
            {progressiveLoading && <Small>Generating multi-week progressive plan…</Small>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {progressiveError && <p className="text-sm text-red-600">{progressiveError}</p>}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Streaming Progress */}
            {streamingProgress && (
              <StreamingProgress 
                progress={streamingProgress} 
                onComplete={() => setStreamingProgress(null)}
              />
            )}

            {/* Progressive Plan Display */}
            {showProgressivePlan && progressivePlan ? (
              <div className="space-y-4">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Multi-Week Progressive Plan</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => copyToClipboard(JSON.stringify(progressivePlan, null, 2))}
                      >
                        Copy JSON
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleExport}
                        disabled={!progressivePlan}
                      >
                        {exporting ? 'Exporting…' : 'Export PDF'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowProgressivePlan(false)}
                      >
                        Back to Single Week
                      </Button>
                    </div>
                  </div>
                  
                  <Tabs 
                    tabs={['Timeline', 'Phases', 'Meals', 'AI Reasoning', 'Check-in']} 
                    current={tab} 
                    onChange={setTab} 
                  />
                  
                  <div className="mt-4">
                    {tab === 'Timeline' && (
                      <ProgressionTimeline 
                        plan={progressivePlan}
                        selectedWeek={selectedWeek}
                        onWeekSelect={setSelectedWeek}
                      />
                    )}
                    
                    {tab === 'Phases' && (
                      <PhaseBreakdown 
                        plan={progressivePlan}
                        selectedPhase={selectedPhase}
                        onPhaseSelect={setSelectedPhase}
                      />
                    )}
                    
                    {tab === 'Meals' && (
                      <MealSuggestions 
                        plan={progressivePlan}
                        selectedWeek={selectedWeek}
                        userPreferences={form.preferences ? form.preferences.split(',').map(p => p.trim()) : []}
                        form={form}
                      />
                    )}
                    
                    {tab === 'AI Reasoning' && (
                      <AgentReasoning 
                        agentResponses={agentResponses}
                        loading={progressiveLoading}
                        currentPhase={currentPhase}
                      />
                    )}
                    
                    {tab === 'Check-in' && selectedWeek && (
                      <WeeklyCheckIn 
                        plan={progressivePlan}
                        currentWeek={selectedWeek}
                        onAdjustPlan={adjustPlan}
                        loading={progressiveLoading}
                      />
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              /* Single Week Plan Display */
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Preview</h3>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => parsed && copyToClipboard(JSON.stringify(parsed, null, 2))}
                  >
                    Copy JSON
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleExport}
                    disabled={!parsed}
                  >
                    {exporting ? 'Exporting…' : 'Export PDF'}
                  </Button>
                </div>
              </div>
              
              <Tabs tabs={TAB_OPTIONS} current={tab} onChange={setTab} />
              
              <div className="mt-3">
                  {tab === 'AI Plan' && (
                    <div>
                      <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">AI-Driven Complete Plan</h3>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              onClick={generateCompleteAIPlan}
                              disabled={aiLoading}
                            >
                              {aiLoading ? 'AI Generating...' : 'Generate AI Plan'}
                            </Button>
                            {coordinatedPlan && (
                              <Button
                                variant="secondary"
                                onClick={() => copyToClipboard(JSON.stringify(coordinatedPlan, null, 2))}
                              >
                                Copy JSON
                              </Button>
                            )}
                          </div>
                        </div>

                        {aiLoading && (
                          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              <span className="text-sm text-blue-700">{currentStep}</span>
                            </div>
                          </div>
                        )}

                        {aiError && (
                          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="text-red-700 text-sm">
                              Error: {aiError}
                            </div>
                            <Button
                              variant="secondary"
                              onClick={clearAIError}
                              className="mt-2"
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}

                        {coordinatedPlan && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-sm font-medium text-green-800">Overall Confidence</div>
                                <div className="text-2xl font-bold text-green-600">
                                  {Math.round(coordinatedPlan.overallConfidence * 100)}%
                                </div>
                              </div>
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-sm font-medium text-blue-800">Total Weeks</div>
                                <div className="text-2xl font-bold text-blue-600">
                                  {coordinatedPlan.weeklyPlans.length}
                                </div>
                              </div>
                              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="text-sm font-medium text-purple-800">Scientific References</div>
                                <div className="text-2xl font-bold text-purple-600">
                                  {coordinatedPlan.totalReferences.length}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold">Physiological Analysis</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg">
                                  <div className="text-sm font-medium">BMR</div>
                                  <div className="text-xl font-bold">{coordinatedPlan.physiologicalAnalysis.bmr} kcal</div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                  <div className="text-sm font-medium">TDEE</div>
                                  <div className="text-xl font-bold">{coordinatedPlan.physiologicalAnalysis.tdee} kcal</div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold">Weekly Plans</h4>
                              <div className="space-y-2">
                                {coordinatedPlan.weeklyPlans.map((weekPlan) => (
                                  <div key={weekPlan.week} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h5 className="font-semibold">Week {weekPlan.week} - {weekPlan.phase}</h5>
                                        <p className="text-sm text-gray-600">
                                          Confidence: {Math.round(weekPlan.confidence * 100)}%
                                        </p>
                                      </div>
                                      <div className="text-right text-sm text-gray-500">
                                        {weekPlan.scientificReferences.length} references
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold">Scientific References</h4>
                              <div className="max-h-40 overflow-y-auto">
                                <ul className="space-y-1 text-sm">
                                  {coordinatedPlan.totalReferences.map((ref, index) => (
                                    <li key={index} className="p-2 bg-gray-50 rounded">
                                      {ref}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Debug Section */}
                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold">Debug Tools</h4>
                              <MealDebugger
                                form={form}
                                checkpoint={{
                                  week: 1,
                                  phase: 'Test Phase',
                                  predictedWeight: 80,
                                  predictedBodyFat: 20,
                                  predictedLeanMass: 64,
                                  dailyCalories: 1800,
                                  proteinGrams: 160,
                                  fatGrams: 60,
                                  carbGrams: 150,
                                  trainingVolume: 20,
                                  cardioMinutes: 150,
                                  notes: '',
                                  adaptations: []
                                }}
                                phase={{
                                  id: 'test',
                                  name: 'Test Phase',
                                  type: 'moderate_cut',
                                  startWeek: 0,
                                  endWeek: 7,
                                  targetDeficit: 25,
                                  proteinMultiplier: 2.0,
                                  volumeAdjustment: 0.9,
                                  description: 'Test phase for debugging',
                                  rationale: 'Testing meal generation'
                                }}
                                userPreferences={form.preferences ? form.preferences.split(',').map(p => p.trim()) : []}
                              />
                            </div>
                          </div>
                        )}
                      </Card>
                    </div>
                  )}

                  {tab === 'Legacy Plan' && (
                  <div>
                    {parsed ? (
                      <PlanOverview plan={parsed} />
                    ) : (
                      <div className="prose max-w-none whitespace-pre-wrap">
                        {summary || 'Model output will appear here…'}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'Meals' && <MealsTable plan={parsed} />}

                {tab === 'Training JSON' && (
                  <pre className="rounded-xl bg-gray-950 text-gray-100 p-3 text-xs overflow-auto">
                    {JSON.stringify(parsed?.week_plan || {}, null, 2)}
                  </pre>
                )}

                {tab === 'Full JSON' && (
                  <pre className="rounded-xl bg-gray-950 text-gray-100 p-3 text-xs overflow-auto">
                    {JSON.stringify(parsed || {}, null, 2)}
                  </pre>
                )}

                {tab === 'Raw' && (
                  <pre className="rounded-xl bg-gray-950 text-gray-100 p-3 text-xs overflow-auto">
                    {raw || '(empty)'}
                  </pre>
                )}

                {tab === 'Prompt' && (
                  <pre className="rounded-xl bg-gray-50 text-gray-800 p-3 text-xs overflow-auto">
                    {userPrompt}
                  </pre>
                )}
              </div>
            </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
