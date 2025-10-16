import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useMealSuggestions } from '@/hooks/useMealSuggestions';
import { FormState, WeeklyCheckpoint, ProgressionPhase } from '@/types';

interface MealDebuggerProps {
  form: FormState;
  checkpoint: WeeklyCheckpoint;
  phase: ProgressionPhase;
  userPreferences: string[];
}

export function MealDebugger({ form, checkpoint, phase, userPreferences }: MealDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const {
    suggestions,
    weeklyPlan,
    loading,
    error,
    generateMealSuggestions,
    clearError
  } = useMealSuggestions(form, checkpoint, phase, userPreferences);

  const testMealGeneration = async () => {
    setDebugInfo('Starting meal generation test...\n');
    console.log('=== MEAL GENERATION DEBUG ===');
    console.log('Form:', form);
    console.log('Checkpoint:', checkpoint);
    console.log('Phase:', phase);
    console.log('User Preferences:', userPreferences);
    
    setDebugInfo(prev => prev + 'Form data logged to console\n');
    setDebugInfo(prev => prev + `API Key present: ${!!form.apiKey}\n`);
    setDebugInfo(prev => prev + `Endpoint: ${form.endpoint}\n`);
    setDebugInfo(prev => prev + `Model: ${form.model}\n`);
    
    try {
      await generateMealSuggestions();
      setDebugInfo(prev => prev + 'Meal generation completed\n');
    } catch (e: any) {
      setDebugInfo(prev => prev + `Error: ${e.message}\n`);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Meal Generation Debugger</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium">Form Status</h4>
            <div className="text-sm text-gray-600">
              <div>API Key: {form.apiKey ? '✓ Present' : '✗ Missing'}</div>
              <div>Endpoint: {form.endpoint || 'Not set'}</div>
              <div>Model: {form.model || 'Not set'}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium">Generation Status</h4>
            <div className="text-sm text-gray-600">
              <div>Loading: {loading ? 'Yes' : 'No'}</div>
              <div>Error: {error ? 'Yes' : 'No'}</div>
              <div>Suggestions: {suggestions.length}</div>
              <div>Weekly Plan: {weeklyPlan.length} days</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
            <Button
              variant="secondary"
              onClick={clearError}
              className="mt-2"
            >
              Clear Error
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={testMealGeneration}
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Meal Generation'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setDebugInfo('')}
          >
            Clear Debug Info
          </Button>
        </div>

        {debugInfo && (
          <div className="p-3 bg-gray-50 border rounded">
            <h4 className="font-medium mb-2">Debug Output</h4>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
              {debugInfo}
            </pre>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800 mb-2">Success! Generated Meals</h4>
            <div className="text-sm text-green-700">
              <div>Total suggestions: {suggestions.length}</div>
              <div>Weekly plan days: {weeklyPlan.length}</div>
              <div>First meal: {suggestions[0]?.name || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
