// API Key Validation System - CRITICAL SECURITY COMPONENT
// Enforces mandatory API key validation before any AI operations

export interface APIKeyValidationResult {
  isValid: boolean;
  error?: string;
  provider?: 'openai' | 'groq' | 'anthropic';
}

export class APIKeyValidator {
  private static instance: APIKeyValidator;
  private validatedKey: string | null = null;
  private validationCache: Map<string, APIKeyValidationResult> = new Map();

  static getInstance(): APIKeyValidator {
    if (!APIKeyValidator.instance) {
      APIKeyValidator.instance = new APIKeyValidator();
    }
    return APIKeyValidator.instance;
  }

  /**
   * Validate API key at application startup - FAIL FAST if invalid
   */
  async validateOnStartup(): Promise<string> {
    console.log('🔐 Starting API key validation...');
    
    // Check for API key in environment variables first
    const envApiKey = process.env.OPENAI_API_KEY || 
                     process.env.GROQ_API_KEY || 
                     process.env.ANTHROPIC_API_KEY;
    
    if (envApiKey) {
      console.log('✅ Found API key in environment variables');
      const validation = await this.validateAPIKey(envApiKey);
      if (validation.isValid) {
        this.validatedKey = envApiKey;
        console.log('✅ Environment API key validated successfully');
        return envApiKey;
      } else {
        throw new Error(`❌ Environment API key validation failed: ${validation.error}`);
      }
    }

    // If no environment key, check localStorage for development
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('fitness_planner_api_key');
      if (storedKey) {
        console.log('🔍 Found API key in localStorage');
        const validation = await this.validateAPIKey(storedKey);
        if (validation.isValid) {
          this.validatedKey = storedKey;
          console.log('✅ Stored API key validated successfully');
          return storedKey;
        } else {
          console.warn('⚠️ Stored API key validation failed, removing from storage');
          localStorage.removeItem('fitness_planner_api_key');
        }
      }
    }

    // No valid API key found
    throw new Error(
      '❌ FATAL ERROR: No valid API key found!\n\n' +
      'Please set one of the following:\n' +
      '1. Environment variable: OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY\n' +
      '2. Or enter your API key in the application form\n\n' +
      'The application cannot function without a valid API key.'
    );
  }

  /**
   * Validate API key from user input
   */
  async validateUserAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        isValid: false,
        error: 'API key cannot be empty'
      };
    }

    if (apiKey.length < 20) {
      return {
        isValid: false,
        error: 'API key appears to be too short (minimum 20 characters)'
      };
    }

    return await this.validateAPIKey(apiKey);
  }

  /**
   * Test API key with actual API call
   */
  private async validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    // Check cache first
    if (this.validationCache.has(apiKey)) {
      return this.validationCache.get(apiKey)!;
    }

    // Determine provider based on key format
    const provider = this.detectProvider(apiKey);
    
    try {
      const isValid = await this.testAPIKey(apiKey, provider);
      
      const result: APIKeyValidationResult = {
        isValid,
        provider,
        error: isValid ? undefined : 'API key validation failed'
      };

      // Cache result
      this.validationCache.set(apiKey, result);
      
      if (isValid) {
        this.validatedKey = apiKey;
        // Store in localStorage for convenience
        if (typeof window !== 'undefined') {
          localStorage.setItem('fitness_planner_api_key', apiKey);
        }
      }

      return result;
    } catch (error) {
      const result: APIKeyValidationResult = {
        isValid: false,
        provider,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
      
      this.validationCache.set(apiKey, result);
      return result;
    }
  }

  /**
   * Detect API provider from key format
   */
  private detectProvider(apiKey: string): 'openai' | 'groq' | 'anthropic' {
    if (apiKey.startsWith('sk-')) {
      return 'openai';
    } else if (apiKey.startsWith('gsk_')) {
      return 'groq';
    } else if (apiKey.startsWith('sk-ant-')) {
      return 'anthropic';
    } else {
      // Default to OpenAI format
      return 'openai';
    }
  }

  /**
   * Test API key with actual API call
   */
  private async testAPIKey(apiKey: string, provider: 'openai' | 'groq' | 'anthropic'): Promise<boolean> {
    const endpoints = {
      openai: 'https://api.openai.com/v1/chat/completions',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages'
    };

    const endpoint = endpoints[provider];
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'anthropic' && { 'x-api-key': apiKey })
        },
        body: JSON.stringify({
          model: provider === 'anthropic' ? 'claude-3-haiku-20240307' : 
                 provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-3.5-turbo',
          messages: provider === 'anthropic' ? 
            [{ role: 'user', content: 'Hello' }] :
            [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
          ...(provider === 'anthropic' && { max_tokens: 10 })
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if we got a valid response
      if (provider === 'anthropic') {
        return data.content && Array.isArray(data.content) && data.content.length > 0;
      } else {
        return data.choices && Array.isArray(data.choices) && data.choices.length > 0;
      }
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  /**
   * Get currently validated API key
   */
  getValidatedKey(): string | null {
    return this.validatedKey;
  }

  /**
   * Check if API key is currently validated
   */
  isKeyValidated(): boolean {
    return this.validatedKey !== null;
  }

  /**
   * Clear validated key (for logout/security)
   */
  clearValidatedKey(): void {
    this.validatedKey = null;
    this.validationCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fitness_planner_api_key');
    }
  }

  /**
   * Get API configuration for validated key
   */
  getAPIConfig(): { endpoint: string; model: string; provider: string } | null {
    if (!this.validatedKey) return null;

    const provider = this.detectProvider(this.validatedKey);
    
    const configs = {
      openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        provider: 'OpenAI'
      },
      groq: {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        provider: 'Groq'
      },
      anthropic: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-opus-20240229',
        provider: 'Anthropic'
      }
    };

    return configs[provider];
  }
}

// Export singleton instance
export const apiKeyValidator = APIKeyValidator.getInstance();
