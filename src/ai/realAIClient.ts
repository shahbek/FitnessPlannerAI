// Real AI Client - Makes actual API calls with proper validation
// Replaces all mock implementations with real API integration

export interface AIClientConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  provider: 'openai' | 'groq' | 'anthropic';
}

export interface AIClientMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIClientRequest {
  messages: AIClientMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AIClientResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason?: string;
}

export class RealAIClient {
  private config: AIClientConfig | null = null;
  private isInitialized = false;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestTimestamps: number[] = [];
  private cooldownUntil = 0;
  private readonly RATE_LIMIT_DELAY = 1500; // baseline spacing between attempts
  private readonly RATE_LIMIT_JITTER = 200;
  private readonly GROQ_MAX_REQUESTS_PER_MIN = 30;
  private readonly GROQ_SAFE_INTERVAL = 3500; // ≈17 requests/minute max workload
  private readonly GROQ_COOLDOWN_AFTER_429 = 60000; // enforced cooldown whenever Groq returns 429

  /**
   * Initialize the AI client with API key and form configuration
   */
  async initialize(apiKey: string, endpoint: string, model: string): Promise<void> {
    if (this.isInitialized) return;

    if (!apiKey || !endpoint || !model) {
      throw new Error('API key, endpoint, and model are required');
    }

    // Detect provider from endpoint
    let provider: 'openai' | 'groq' | 'anthropic';
    if (endpoint.includes('groq.com')) {
      provider = 'groq';
    } else if (endpoint.includes('openai.com')) {
      provider = 'openai';
    } else if (endpoint.includes('anthropic.com')) {
      provider = 'anthropic';
    } else {
      // Default to OpenAI format for custom endpoints
      provider = 'openai';
    }

    this.config = {
      apiKey,
      endpoint,
      model,
      provider
    };

    this.isInitialized = true;
    console.log(`✅ Real AI Client initialized with ${provider} (${model})`);
    console.log(`🔧 Using endpoint: ${endpoint}`);
    console.log(`🔧 Using model: ${model}`);
    console.log(`🔧 Using API key: ${apiKey.substring(0, 10)}...`);
  }

  /**
   * Make a real API call to the AI service with rate limiting
   */
  async generateResponse(request: AIClientRequest): Promise<AIClientResponse> {
    if (!this.isInitialized || !this.config) {
      throw new Error('AI Client not initialized. Call initialize() first.');
    }

    // Check if this is a Groq endpoint and apply rate limiting
    if (this.config.provider === 'groq') {
      return this.makeRateLimitedRequest(request);
    } else {
      // For non-Groq providers, make direct request
      return this.makeDirectRequest(request);
    }
  }

  /**
   * Make a rate-limited request for Groq
   */
  private async makeRateLimitedRequest(request: AIClientRequest): Promise<AIClientResponse> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await this.makeDirectRequest(request);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      await this.waitForAvailability();
      const request = this.requestQueue.shift();
      if (request) {
        const startTime = Date.now();
        this.lastRequestTime = startTime;
        this.requestTimestamps.push(startTime);
        try {
          await request();
        } catch (error) {
          console.error('Request in queue failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private async waitForAvailability(): Promise<void> {
    while (true) {
      const now = Date.now();

      if (now < this.cooldownUntil) {
        const wait = this.cooldownUntil - now;
        console.log(`⏳ Groq cooldown active: waiting ${wait}ms before next request`);
        await this.sleep(wait);
        continue;
      }

      this.requestTimestamps = this.requestTimestamps.filter(timestamp => now - timestamp < 60000);

      if (this.requestTimestamps.length >= this.GROQ_MAX_REQUESTS_PER_MIN) {
        const earliest = this.requestTimestamps[0];
        const waitUntil = earliest + 60000;
        const waitTime = Math.max(waitUntil - now, this.GROQ_SAFE_INTERVAL);
        console.log(`⏳ Groq window guard: waiting ${waitTime}ms to stay under 30/min`);
        await this.sleep(waitTime);
        continue;
      }

      const spacingSinceLast = now - this.lastRequestTime;
      if (spacingSinceLast < this.GROQ_SAFE_INTERVAL) {
        const waitTime =
          this.GROQ_SAFE_INTERVAL -
          spacingSinceLast +
          Math.floor(Math.random() * this.RATE_LIMIT_JITTER);
        console.log(`⏳ Enforcing safe interval: waiting ${waitTime}ms before next request`);
        await this.sleep(waitTime);
        continue;
      }

      return;
    }
  }

  private async sleep(durationMs: number): Promise<void> {
    if (durationMs <= 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private scheduleCooldown(durationMs = this.GROQ_COOLDOWN_AFTER_429): void {
    const target = Date.now() + durationMs;
    this.cooldownUntil = Math.max(this.cooldownUntil, target);
  }

  private async handleRateLimitBackoff(attempt: number): Promise<void> {
    const progressiveBackoff =
      this.RATE_LIMIT_DELAY + attempt * 1200 + Math.floor(Math.random() * this.RATE_LIMIT_JITTER);
    const cooldown = Math.max(progressiveBackoff, this.GROQ_COOLDOWN_AFTER_429);
    this.scheduleCooldown(cooldown);
    console.warn(`⚠️ Rate limit hit (attempt ${attempt}). Cooling down for ${cooldown}ms before retry.`);
    await this.sleep(cooldown);
  }

  /**
   * Make a direct API call without rate limiting
   */
  private async makeDirectRequest(request: AIClientRequest): Promise<AIClientResponse> {
    const provider = this.config!.provider;
    const maxRetries = provider === 'groq' ? 8 : 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Making API call to: ${this.config!.endpoint} (attempt ${attempt}/${maxRetries})`);
        console.log(`🔧 Using provider: ${provider}`);
        console.log(`🔧 Using model: ${this.config!.model}`);
        console.log(`🔧 Using API key: ${this.config!.apiKey.substring(0, 10)}...`);
        
        const response = await this.makeAPICall(request);
        return this.parseResponse(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRateLimitError = errorMessage.toLowerCase().includes('rate limit exceeded');

        if (isRateLimitError) {
          if (attempt < maxRetries) {
            await this.handleRateLimitBackoff(attempt);
            continue;
          }

          this.scheduleCooldown();
        }

        const lowerMessage = errorMessage.toLowerCase();
        const isTransientError =
          lowerMessage.includes('timeout') ||
          lowerMessage.includes('temporarily unavailable') ||
          lowerMessage.includes('internal server error') ||
          /http\s*500/i.test(errorMessage);
        if (isTransientError && attempt < maxRetries) {
          const backoff = 1500 + attempt * 1500;
          console.warn(`⚠️ Transient error (attempt ${attempt}). Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
          continue;
        }

        console.error('AI API call failed:', error);
        throw new Error(`AI API call failed: ${errorMessage}`);
      }
    }

    // Should not reach here due to return/throw in loop
    throw new Error('AI API call failed after maximum retry attempts.');
  }

  /**
   * Make the actual HTTP request to the AI API
   */
  private async makeAPICall(request: AIClientRequest): Promise<any> {
    const { apiKey, endpoint, model, provider } = this.config!;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add appropriate authorization header
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = this.buildRequestBody(request, model, provider);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle specific rate limit errors
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
        if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
          this.scheduleCooldown(retryAfterMs);
        } else {
          this.scheduleCooldown();
        }

        if (provider === 'groq') {
          throw new Error(`Rate limit exceeded for Groq (30 calls/minute). Please wait before making another request.`);
        } else {
          throw new Error(`Rate limit exceeded. Please wait before making another request.`);
        }
      }
      
      // Handle other HTTP errors
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }

    return await response.json();
  }

  /**
   * Build request body based on provider
   */
  private buildRequestBody(request: AIClientRequest, model: string, provider: string): any {
    const baseBody = {
      model,
      temperature: request.temperature || 0.3,
      max_tokens: request.max_tokens || 4000,
      stream: request.stream || false
    };

    if (provider === 'anthropic') {
      return {
        ...baseBody,
        messages: request.messages,
        max_tokens: request.max_tokens || 4000
      };
    } else {
      return {
        ...baseBody,
        messages: request.messages
      };
    }
  }

  /**
   * Parse response based on provider
   */
  private parseResponse(response: any): AIClientResponse {
    const { provider } = this.config!;

    if (provider === 'anthropic') {
      return {
        content: response.content?.[0]?.text || '',
        usage: response.usage,
        model: response.model,
        finish_reason: response.stop_reason
      };
    } else {
      return {
        content: response.choices?.[0]?.message?.content || '',
        usage: response.usage,
        model: response.model,
        finish_reason: response.choices?.[0]?.finish_reason
      };
    }
  }

  /**
   * Generate a simple completion
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: AIClientMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.generateResponse({
      messages,
      temperature: 0.3,
      max_tokens: 4000
    });

    return response.content;
  }

  /**
   * Generate a structured response with specific format
   */
  async generateStructuredResponse(
    prompt: string, 
    systemPrompt: string,
    expectedFormat: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      retries?: number;
    }
  ): Promise<{ content: string; confidence: number; reasoning: string }> {
    const maxTokens = options?.maxTokens ?? 4000;
    const temperature = options?.temperature ?? 0.1;
    const maxRetries = options?.retries ?? 3;

    // Enhanced prompt with multiple attempts to get valid JSON
    const structuredPrompt = `${prompt}

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON
2. Do NOT include any text before or after the JSON
3. Do NOT include explanations, comments, or markdown formatting
4. Ensure all required fields are present
5. Use the EXACT structure provided below

REQUIRED JSON FORMAT:
${expectedFormat}

Your response must be valid JSON that can be parsed by JSON.parse() without any modifications.`;

    const enhancedSystemPrompt = `${systemPrompt}

You are a specialized JSON response generator. Your ONLY job is to return valid JSON that matches the exact format requested. Never include any text outside the JSON structure. Never use markdown code blocks or explanations. Just pure JSON.`;

    const messages: AIClientMessage[] = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: structuredPrompt }
    ];

    // Try multiple times with improved prompts if needed
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 Generating structured response (attempt ${attempt}/${maxRetries})`);
        
        const response = await this.generateResponse({
          messages,
          temperature: attempt === 1 ? temperature : Math.min(temperature + 0.1, 0.3), // Slightly increase temperature on retries
          max_tokens: maxTokens
        });

        console.log(`🤖 AI structured response (attempt ${attempt}):`, response.content);

        // Validate that the response is parseable JSON
        const cleanedContent = this.extractJsonFromResponse(response.content);
        
        try {
          JSON.parse(cleanedContent);
          console.log(`✅ Successfully generated valid JSON on attempt ${attempt}`);
          
          // Extract confidence and reasoning from response
          const confidenceMatch = response.content.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i);
          const reasoningMatch = response.content.match(/reasoning[:\s]*(.+?)(?=\n\n|\n[A-Z]|$)/is);

          return {
            content: cleanedContent,
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.8,
            reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'Based on AI analysis'
          };
        } catch (parseError) {
          console.warn(`⚠️ Attempt ${attempt} failed JSON validation:`, parseError);
          
          if (attempt < maxRetries) {
            // Add more specific instructions for retry
            messages.push({
              role: 'user',
              content: `The previous response was not valid JSON. Please try again with ONLY valid JSON, no other text. The JSON must be parseable by JSON.parse().`
            });
            continue;
          } else {
            console.error('❌ All attempts failed to generate valid JSON');
            throw new Error(`Failed to generate valid JSON after ${maxRetries} attempts. Last error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate structured response after ${maxRetries} attempts`);
  }

  /**
   * Extract JSON from AI response, handling common formatting issues
   */
  private extractJsonFromResponse(content: string): string {
    let cleaned = content.trim();
    
    // Remove markdown code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
    
    // Find JSON object or array
    const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*?\}/);
    
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    } else if (objectMatch) {
      cleaned = objectMatch[0];
    }
    
    // Remove any trailing text after the JSON
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    
    if (lastBrace > lastBracket && lastBrace !== -1) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    } else if (lastBracket !== -1) {
      cleaned = cleaned.substring(0, lastBracket + 1);
    }
    
    return cleaned.trim();
  }

  /**
   * Get current configuration
   */
  getConfig(): AIClientConfig | null {
    return this.config;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.config !== null;
  }
}

// Export singleton instance
export const realAIClient = new RealAIClient();
