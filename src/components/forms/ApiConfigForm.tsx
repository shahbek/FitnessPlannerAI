import React from 'react';
import { FormState } from '@/types';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Small } from '@/components/ui/Small';

interface ApiConfigFormProps {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ApiConfigForm({ form, onChange }: ApiConfigFormProps) {
  return (
    <Card>
      <Label>API Key (client-side only)</Label>
      <Input
        type="password"
        placeholder="GROQ_API_KEY"
        value={form.apiKey}
        onChange={onChange('apiKey')}
      />
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>Endpoint</Label>
          <Input value={form.endpoint} onChange={onChange('endpoint')} />
          <Small>OpenAI-compatible chat endpoint</Small>
        </div>
        <div>
          <Label>Model</Label>
          <Input value={form.model} onChange={onChange('model')} />
          <Small>e.g., llama-3.1-70b-versatile</Small>
        </div>
      </div>
    </Card>
  );
}
