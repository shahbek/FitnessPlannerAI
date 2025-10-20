// API Debugger Component
// Helps diagnose API key and endpoint issues

import React, { useState } from 'react';
import { APIKeyValidator } from '@/utils/apiKeyValidator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface APIDebuggerProps {
  onClose: () => void;
}

export function APIDebugger({ onClose }: APIDebuggerProps) {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('https://api.groq.com/openai/v1/chat/completions');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runDiagnostics = () => {
    const validation = APIKeyValidator.validateAPIKey(apiKey, endpoint);
    const info = APIKeyValidator.getDebugInfo(apiKey, endpoint, model);
    setDebugInfo(info);
  };

  const testAPIKey = async () => {
    setTesting(true);
    try {
      const result = await APIKeyValidator.testAPIKey(apiKey, endpoint, model);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">API Debugger</h2>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Endpoint</label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="API endpoint URL"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model name"
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={runDiagnostics} variant="outline">
              Run Diagnostics
            </Button>
            <Button 
              onClick={testAPIKey} 
              disabled={testing || !apiKey || !endpoint}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {testing ? 'Testing...' : 'Test API Key'}
            </Button>
          </div>

          {debugInfo && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Diagnostic Results:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                {debugInfo}
              </pre>
            </div>
          )}

          {testResult && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Test Results:</h3>
              <div className={`p-3 rounded ${
                testResult.success 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className="font-medium">
                  {testResult.success ? '✅ API Key Working!' : '❌ API Key Failed'}
                </div>
                {testResult.error && (
                  <div className="mt-2 text-sm">
                    <strong>Error:</strong> {testResult.error}
                  </div>
                )}
                {testResult.responseTime && (
                  <div className="mt-2 text-sm">
                    <strong>Response Time:</strong> {testResult.responseTime}ms
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded">
            <h4 className="font-semibold text-blue-800 mb-2">Common Solutions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Check if your API key is correct and hasn't expired</li>
              <li>• Ensure the endpoint URL matches your API provider</li>
              <li>• Verify the model name is supported by your provider</li>
              <li>• Check if you have sufficient credits/quota</li>
              <li>• Try a different API provider (Groq, OpenAI, Anthropic)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

