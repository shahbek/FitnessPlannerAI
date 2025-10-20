import { useState, useCallback } from 'react';

interface AIStreamConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

interface StreamingResponse {
  content: string;
  isComplete: boolean;
  error?: string;
}

export function useAIStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamTextResponse = useCallback(async (
    config: AIStreamConfig,
    prompt: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<StreamingResponse> => {
    try {
      setIsStreaming(true);
      setError(null);

      // For now, use a simple fetch-based streaming approach
      // This can be enhanced with proper AI SDK integration later
      
      // Determine the correct API endpoint
      let apiEndpoint: string;
      if (config.endpoint === 'groq') {
        apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
      } else if (config.endpoint === 'openai') {
        apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      } else {
        apiEndpoint = config.endpoint;
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk?.(content);
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      return {
        content: fullContent,
        isComplete: true,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        content: '',
        isComplete: false,
        error: errorMessage,
      };
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const generateStructuredObject = useCallback(async <T>(
    config: AIStreamConfig,
    prompt: string,
    _schema: any,
    systemPrompt?: string
  ): Promise<{ data: T | null; error: string | null }> => {
    try {
      setIsStreaming(true);
      setError(null);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in response');
      }

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(content);
        return {
          data: parsed as T,
          error: null,
        };
      } catch (parseError) {
        throw new Error('Response is not valid JSON');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        data: null,
        error: errorMessage,
      };
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const generateTextResponse = useCallback(async (
    config: AIStreamConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ text: string | null; error: string | null }> => {
    try {
      setIsStreaming(true);
      setError(null);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      return {
        text: content || null,
        error: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        text: null,
        error: errorMessage,
      };
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return {
    streamTextResponse,
    generateStructuredObject,
    generateTextResponse,
    isStreaming,
    error,
    clearError: () => setError(null),
  };
}