import { useState, useCallback } from 'react';
import { FormState, FitnessPlan, ChatRequest, ChatResponse } from '@/types';
import { buildUserPrompt, parseAIResponse, validateForm } from '@/utils';
import { SYSTEM_PROMPT } from '@/constants';

export function useFitnessPlan(initialForm: FormState) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [parsed, setParsed] = useState<FitnessPlan | null>(null);

  const userPrompt = buildUserPrompt(form);

  const handleChange = useCallback((key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const callModel = useCallback(async () => {
    const validationErrors = validateForm(form);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setLoading(true);
    setError('');
    setRaw('');
    setSummary('');
    setParsed(null);

    try {
      const request: ChatRequest = {
        model: form.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      };

      const res = await fetch(form.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${form.apiKey}`,
        },
        body: JSON.stringify(request),
      }).catch(fetchError => {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('API Error:', res.status, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data: ChatResponse = await res.json();
      const content = data?.choices?.[0]?.message?.content || JSON.stringify(data);
      setRaw(content);

      const { json, human } = parseAIResponse(content);
      setParsed(json);
      setSummary(human);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [form, userPrompt]);

  const loadDemo = useCallback((demoData: FitnessPlan) => {
    setParsed(demoData);
    setSummary(JSON.stringify(demoData, null, 2));
    setRaw(JSON.stringify(demoData, null, 2));
    setError('');
  }, []);

  const clearResults = useCallback(() => {
    setRaw('');
    setSummary('');
    setError('');
    setParsed(null);
  }, []);

  return {
    form,
    setForm,
    loading,
    raw,
    summary,
    error,
    parsed,
    userPrompt,
    handleChange,
    callModel,
    loadDemo,
    clearResults,
  };
}
