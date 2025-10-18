import React from 'react';
import { FormState } from '@/types';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Small } from '@/components/ui/Small';

interface ApiConfigFormProps {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export function ApiConfigForm({ form, onChange }: ApiConfigFormProps) {
  return (
    <Card>
      <h3 className="font-semibold mb-3">API Configuration</h3>
      
      <div className="space-y-3">
        <div>
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="Enter your API key..."
            value={form.apiKey}
            onChange={onChange('apiKey')}
          />
          <Small>Your API key is stored locally and never sent to our servers</Small>
        </div>

        <div>
          <Label>Endpoint</Label>
          <Input 
            value={form.endpoint} 
            onChange={onChange('endpoint')} 
            placeholder="https://api.example.com/v1/chat/completions"
          />
          <Small>API endpoint URL (e.g., https://api.groq.com/openai/v1/chat/completions)</Small>
        </div>

        <div>
          <Label>Model</Label>
          <Input 
            value={form.model} 
            onChange={onChange('model')} 
            placeholder="e.g., llama-3.3-70b-versatile"
          />
          <Small>AI model name to use for generation</Small>
        </div>
      </div>
    </Card>
  );
}
