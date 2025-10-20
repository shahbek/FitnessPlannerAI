import React, { useState, useCallback } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { DashboardForm } from '../forms/DashboardForm';
import { StreamingPlanDisplay } from '../plan/StreamingPlanDisplay';
import { useHighAccuracyAI } from '@/hooks/useHighAccuracyAI';
import { useAIStream } from '@/hooks/useAIStream';
import { DEFAULT_FORM_STATE } from '@/constants';

export function DashboardApp() {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Use the existing high accuracy AI hook
  const {
    plan: highAccuracyPlan,
    loading: highAccuracyLoading,
    error: highAccuracyError,
    progress: highAccuracyProgress,
    generateHighAccuracyPlan,
    clearError: clearHighAccuracyError,
    planSnapshots,
  } = useHighAccuracyAI();

  // Use the new AI streaming hook
  const {
    streamTextResponse,
    generateStructuredObject,
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

  const handleGeneratePlan = useCallback(async () => {
    if (highAccuracyLoading) return;
    
    if (!form.apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }
    
    try {
      setIsStreaming(true);
      setStreamingContent('');
      
      // Start streaming a preview of what's being generated
      const previewStream = await streamTextResponse(
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

      if (previewStream.error) {
        console.error('Preview stream failed:', previewStream.error);
      }

      // Generate the full plan using the existing system
      await generateHighAccuracyPlan(form);
      
    } catch (err) {
      console.error('Plan generation failed:', err);
    } finally {
      setIsStreaming(false);
    }
  }, [form, highAccuracyLoading, generateHighAccuracyPlan, streamTextResponse]);

  const handleClearError = useCallback(() => {
    clearHighAccuracyError();
    clearAIError();
  }, [clearHighAccuracyError, clearAIError]);

  const currentError = highAccuracyError || aiError;
  const currentLoading = highAccuracyLoading || aiStreaming || isStreaming;

  return (
    <DashboardLayout
      plan={highAccuracyPlan}
      loading={currentLoading}
      progress={highAccuracyProgress}
      error={currentError}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <DashboardForm
            form={form}
            onChange={handleChange}
            onSelectChange={handleSelectChange}
            onSubmit={handleGeneratePlan}
            loading={currentLoading}
            error={currentError}
          />
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2">
          <StreamingPlanDisplay
            plan={highAccuracyPlan}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
