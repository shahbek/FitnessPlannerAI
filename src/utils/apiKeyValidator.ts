// API Key Validator and Debugger
// Helps diagnose API key issues

export interface APIKeyValidation {
  isValid: boolean;
  provider: string;
  format: string;
  issues: string[];
  suggestions: string[];
}

export class APIKeyValidator {
  /**
   * Validate and diagnose API key issues
   */
  static validateAPIKey(apiKey: string, endpoint: string): APIKeyValidation {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Basic validation
    if (!apiKey || apiKey.trim() === '') {
      issues.push('API key is empty or undefined');
      suggestions.push('Please provide a valid API key');
      return { isValid: false, provider: 'unknown', format: 'unknown', issues, suggestions };
    }

    // Detect provider from endpoint
    let provider = 'unknown';
    if (endpoint.includes('groq.com')) {
      provider = 'groq';
    } else if (endpoint.includes('openai.com')) {
      provider = 'openai';
    } else if (endpoint.includes('anthropic.com')) {
      provider = 'anthropic';
    } else if (endpoint.includes('api.together.xyz')) {
      provider = 'together';
    } else {
      provider = 'custom';
    }

    // Validate format based on provider
    const format = this.detectFormat(apiKey);
    
    if (provider === 'groq') {
      if (!apiKey.startsWith('gsk_')) {
        issues.push('Groq API keys should start with "gsk_"');
        suggestions.push('Please check your Groq API key format');
      }
    } else if (provider === 'openai') {
      if (!apiKey.startsWith('sk-')) {
        issues.push('OpenAI API keys should start with "sk-"');
        suggestions.push('Please check your OpenAI API key format');
      }
    } else if (provider === 'anthropic') {
      if (!apiKey.startsWith('sk-ant-')) {
        issues.push('Anthropic API keys should start with "sk-ant-"');
        suggestions.push('Please check your Anthropic API key format');
      }
    }

    // Check key length
    if (apiKey.length < 20) {
      issues.push('API key seems too short');
      suggestions.push('Most API keys are 40+ characters long');
    }

    // Check for common mistakes
    if (apiKey.includes(' ')) {
      issues.push('API key contains spaces');
      suggestions.push('Remove any spaces from your API key');
    }

    if (apiKey.includes('\n') || apiKey.includes('\r')) {
      issues.push('API key contains line breaks');
      suggestions.push('Remove any line breaks from your API key');
    }

    return {
      isValid: issues.length === 0,
      provider,
      format,
      issues,
      suggestions
    };
  }

  /**
   * Detect the format of an API key
   */
  private static detectFormat(apiKey: string): string {
    if (apiKey.startsWith('gsk_')) return 'groq';
    if (apiKey.startsWith('sk-')) return 'openai';
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    if (apiKey.startsWith('sk-')) return 'openai-compatible';
    return 'unknown';
  }

  /**
   * Get debugging information for API calls
   */
  static getDebugInfo(apiKey: string, endpoint: string, model: string): string {
    const validation = this.validateAPIKey(apiKey, endpoint);
    
    let debugInfo = `🔍 API Debug Information:\n`;
    debugInfo += `- Provider: ${validation.provider}\n`;
    debugInfo += `- Format: ${validation.format}\n`;
    debugInfo += `- Endpoint: ${endpoint}\n`;
    debugInfo += `- Model: ${model}\n`;
    debugInfo += `- Key Length: ${apiKey.length} characters\n`;
    debugInfo += `- Key Preview: ${apiKey.substring(0, 10)}...\n`;
    
    if (validation.issues.length > 0) {
      debugInfo += `\n❌ Issues Found:\n`;
      validation.issues.forEach(issue => debugInfo += `- ${issue}\n`);
    }
    
    if (validation.suggestions.length > 0) {
      debugInfo += `\n💡 Suggestions:\n`;
      validation.suggestions.forEach(suggestion => debugInfo += `- ${suggestion}\n`);
    }
    
    return debugInfo;
  }

  /**
   * Test API key with a simple request
   */
  static async testAPIKey(apiKey: string, endpoint: string, model: string): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const validation = this.validateAPIKey(apiKey, endpoint);
      if (!validation.isValid) {
        return {
          success: false,
          error: `API key validation failed: ${validation.issues.join(', ')}`
        };
      }

      // Detect provider for proper headers
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (endpoint.includes('anthropic.com')) {
        headers['x-api-key'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Make a simple test request
      const testBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message. Please respond with "API key is working".'
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(testBody)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          responseTime
        };
      }

      return {
        success: true,
        responseTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const apiKeyValidator = new APIKeyValidator();