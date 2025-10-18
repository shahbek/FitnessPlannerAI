import React, { useMemo, useState } from 'react';
import { useHighAccuracyAI } from '@/hooks/useHighAccuracyAI';
import { DEFAULT_FORM_STATE } from '@/constants';
import { copyToClipboard } from '@/utils';
import { exportPdf } from '@/utils/pdfExport';

// AI RAG system is now integrated directly

// Add global error handler for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// UI Components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextArea } from '@/components/ui/TextArea';
// import { Tabs } from '@/components/ui/Tabs';

// Form Components
import { ApiConfigForm } from '@/components/forms/ApiConfigForm';
import { UserProfileForm } from '@/components/forms/UserProfileForm';
import { ScheduleDietForm } from '@/components/forms/ScheduleDietForm';

// Plan Components
import { HighAccuracyPlanDisplay } from '@/components/plan/HighAccuracyPlanDisplay';

export default function App() {
  // High-Accuracy AI System - 90%+ confidence with scientific grounding
  const {
    plan: highAccuracyPlan,
    loading: highAccuracyLoading,
    error: highAccuracyError,
    progress: highAccuracyProgress,
    generateHighAccuracyPlan,
    clearError: clearHighAccuracyError,
    // clearProgress: clearHighAccuracyProgress
    planSnapshots,
  } = useHighAccuracyAI();

  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  // const [exporting, setExporting] = useState(false);
  const [showHighAccuracyPlan, setShowHighAccuracyPlan] = useState(false);
  
  const [debugMode, setDebugMode] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    let value: string | number | boolean = e.target.value;
    if (e.target.type === 'number') {
      value = Number(e.target.value);
    } else if (e.target.type === 'checkbox') {
      value = (e.target as HTMLInputElement).checked;
    }
    setForm(prev => ({ ...prev, [field]: value }));
  };
  const handleSelectChange = (field: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const planPreview = useMemo(() => {
    if (planSnapshots.length > 0) {
      return JSON.stringify(planSnapshots, null, 2);
    }

    if (highAccuracyPlan) {
      const { feasibility, strategy, weeklyPlans, dailyPlans, mealPlans, overallConfidence } = highAccuracyPlan;
      return JSON.stringify(
        {
          feasibility,
          strategy,
          weeklyPlans,
          dailyPlans,
          mealPlans,
          overallConfidence,
        },
        null,
        2
      );
    }

    if (highAccuracyProgress) {
      return JSON.stringify(
        {
          status: 'generating',
          phase: highAccuracyProgress.phase,
          progress: highAccuracyProgress.progress,
          currentStep: highAccuracyProgress.currentStep,
          notes: highAccuracyProgress.reasoning,
        },
        null,
        2
      );
    }

    return '// No plan generated yet. Fill out the form and click Generate to see live JSON output here.';
  }, [highAccuracyPlan, highAccuracyProgress, planSnapshots]);

  const handleExport = async () => {
    if (!highAccuracyPlan) {
      return;
    }
    
    try {
      // setExporting(true);
      await exportPdf(highAccuracyPlan as any);
    } catch (e: any) {
      console.error('Export failed:', e);
    } finally {
      // setExporting(false);
    }
  };


  const handleGeneratePlan = async () => {
    if (highAccuracyLoading) return; // Prevent multiple clicks
    
    // Check if API key is provided
    if (!form.apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }
    
    try {
      setShowHighAccuracyPlan(true);
      await generateHighAccuracyPlan(form);
    } catch (err) {
      console.error('Generation failed:', err);
      // Error is handled by the hook
    }
  };

  const handleTestRAG = async () => {
    try {
      console.log('Testing AI RAG system...');
      const { aiRAG } = await import('@/ai/aiRAG');
      await aiRAG.initialize();
      const response = await aiRAG.query({
        question: 'What are the optimal protein requirements for fat loss?',
        userProfile: {
          age: 30,
          sex: 'male',
          weightKg: 80,
          heightCm: 180,
          bodyFat: 20,
          goal: 'fat loss'
        },
        context: ['nutrition', 'protein', 'fat_loss'],
        maxFacts: 3,
        minConfidence: 0.9
      });
      console.log('AI RAG test successful:', response);
      alert(`AI RAG system test successful!\n\nAnswer: ${response.answer}\nConfidence: ${Math.round(response.confidence * 100)}%\nSources: ${response.sources.length}`);
    } catch (error: any) {
      console.error('AI RAG test failed:', error);
      alert(`AI RAG test failed: ${error.message}`);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fitness Planner AI</h1>
              <p className="text-muted-foreground">
                AI-powered personal fitness trainer with intelligent workout and nutrition planning
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  debugMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {debugMode ? 'Debug ON' : 'Debug OFF'}
              </button>
            </div>
          </div>
        </header>

        {/* Debug Information */}
        {debugMode && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold mb-2">🐛 Debug Information</h3>
            <div className="text-sm space-y-1">
              <div>API Key: {form.apiKey ? `${form.apiKey.substring(0, 10)}...` : 'Not provided'}</div>
              <div>Endpoint: {form.endpoint}</div>
              <div>Model: {form.model}</div>
              <div>Provider: {form.endpoint.includes('groq.com') ? 'Groq (Rate Limited: 30/min)' : 'Other'}</div>
              <div>Form Data: {JSON.stringify(form, null, 2)}</div>
            </div>
          </div>
        )}

        {/* Rate Limiting Notice for Groq */}
        {form.endpoint.includes('groq.com') && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-800">Groq Rate Limiting Active</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Requests are limited to 30 per minute. The system will automatically queue and delay requests to stay within limits.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-1 space-y-6">
            <ApiConfigForm form={form} onChange={handleChange} />
            <UserProfileForm form={form} onChange={handleChange} onSelectChange={handleSelectChange} />
            <ScheduleDietForm form={form} onChange={handleChange} />

            {/* Generate Button */}
            <Card className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Generate Your Plan</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a personalized fitness plan based on scientific evidence
                </p>
                
                <div className="space-y-3">
                  <Button 
                    onClick={handleGeneratePlan} 
                    disabled={highAccuracyLoading || !form.apiKey.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {highAccuracyLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating Plan...
                      </div>
                    ) : !form.apiKey.trim() ? (
                      'API Key Required'
                    ) : (
                      'Generate AI Fitness Plan'
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleTestRAG}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Test RAG System
                  </Button>
                </div>

                {highAccuracyError && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{highAccuracyError}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearHighAccuracyError}
                      className="mt-2"
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Indicator */}
            {highAccuracyProgress && (
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span className="font-medium">{highAccuracyProgress.currentStep}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-4">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${highAccuracyProgress.progress}%` }}
                    ></div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {highAccuracyProgress.reasoning.map((reason, index) => (
                      <div key={index}>• {reason}</div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Live Plan Data Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      Inspect the structured JSON returned by the AI while it generates your plan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(planPreview)}
                      disabled={!highAccuracyPlan && !highAccuracyProgress}
                    >
                      Copy JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPreviewExpanded(prev => !prev)}
                    >
                      {isPreviewExpanded ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>
                {isPreviewExpanded && (
                  <TextArea
                    readOnly
                    value={planPreview}
                    className="font-mono text-xs h-72 bg-secondary/50"
                  />
                )}
              </div>
            </Card>

            {/* Plan Display */}
            {showHighAccuracyPlan && highAccuracyPlan ? (
              <HighAccuracyPlanDisplay 
                plan={highAccuracyPlan}
                onExport={handleExport}
                onCopy={() => copyToClipboard(JSON.stringify(highAccuracyPlan, null, 2))}
              />
            ) : (
              <Card className="p-8">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-4">Ready to Generate Your Plan</h3>
                  <p className="text-muted-foreground mb-6">
                    Fill out your profile information and click "Generate AI Fitness Plan" to create your personalized plan.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="text-2xl font-bold text-primary">90%+</div>
                      <div className="text-sm text-primary">Confidence Score</div>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">100+</div>
                      <div className="text-sm text-blue-700">Scientific Facts</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">Zero</div>
                      <div className="text-sm text-green-700">Hallucinations</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
