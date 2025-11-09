/**
 * Environment Configuration
 * 
 * Centralized environment variable management with validation
 * 
 * Note: In Vite, environment variables must be prefixed with VITE_ to be exposed to the client.
 * Access them via import.meta.env (not process.env).
 */

/**
 * Get environment variable - works in both browser (Vite) and Node.js
 */
function getEnvVar(key: string, defaultValue: string = ''): string {
  // In Vite (browser), import.meta.env is always available
  // @ts-ignore - import.meta.env is a Vite global
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key] || defaultValue;
  }
  // Fallback to process.env for Node.js (tests)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * Environment variable values (with defaults)
 * 
 * Note: For Vite, variables must be prefixed with VITE_ in .env file
 * Example: VITE_USDA_API_KEY=your_key_here
 */
export const env = {
  // USDA API
  USDA_API_KEY: getEnvVar('VITE_USDA_API_KEY') || getEnvVar('USDA_API_KEY', ''),
  
  // AI Model Configuration (Groq only)
  // Primary: VITE_GROQ_API_KEY (for Vite/browser)
  // Fallback: GROQ_API_KEY (for Node.js/tests)
  AI_MODEL_PROVIDER: 'groq' as const, // Only Groq is supported
  AI_API_KEY: getEnvVar('VITE_GROQ_API_KEY') || 
               getEnvVar('GROQ_API_KEY') ||
               getEnvVar('VITE_AI_API_KEY') || // Legacy support
               getEnvVar('AI_API_KEY', ''), // Legacy support
  AI_MODEL_NAME: getEnvVar('VITE_AI_MODEL_NAME') || getEnvVar('AI_MODEL_NAME', 'llama-3.3-70b-versatile'),
  AI_ENDPOINT: getEnvVar('VITE_AI_ENDPOINT') || getEnvVar('AI_ENDPOINT', ''),
  AI_TEMPERATURE: parseFloat(getEnvVar('VITE_AI_TEMPERATURE') || getEnvVar('AI_TEMPERATURE', '0.3')),
  
  // Application
  NODE_ENV: (getEnvVar('VITE_NODE_ENV') || getEnvVar('NODE_ENV', 
    typeof import.meta !== 'undefined' && import.meta.env?.MODE 
      ? import.meta.env.MODE 
      : 'development'
  )) as 'development' | 'staging' | 'production',
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL') || getEnvVar('API_BASE_URL', ''),
  DEBUG: getEnvVar('VITE_DEBUG') || getEnvVar('DEBUG', '') === 'true',
  
  // Performance & Caching
  USDA_CACHE_TTL: parseInt(getEnvVar('VITE_USDA_CACHE_TTL') || getEnvVar('USDA_CACHE_TTL', '24'), 10),
  USDA_CACHE_MAX_ITEMS: parseInt(getEnvVar('VITE_USDA_CACHE_MAX_ITEMS') || getEnvVar('USDA_CACHE_MAX_ITEMS', '10000'), 10),
  ENABLE_API_TRACKING: getEnvVar('VITE_ENABLE_API_TRACKING') || getEnvVar('ENABLE_API_TRACKING', '') !== 'false',
  
  // Feature Flags
  ENABLE_COT: getEnvVar('VITE_ENABLE_COT') || getEnvVar('ENABLE_COT', '') !== 'false',
  ENABLE_MEAL_CORRECTIONS: getEnvVar('VITE_ENABLE_MEAL_CORRECTIONS') || getEnvVar('ENABLE_MEAL_CORRECTIONS', '') !== 'false',
  ENABLE_WORKOUT_CORRECTIONS: getEnvVar('VITE_ENABLE_WORKOUT_CORRECTIONS') || getEnvVar('ENABLE_WORKOUT_CORRECTIONS', '') !== 'false',
  USE_AI_FOR_MEALS: getEnvVar('VITE_USE_AI_FOR_MEALS') || getEnvVar('USE_AI_FOR_MEALS', '') !== 'false',
  USE_AI_FOR_WORKOUTS: getEnvVar('VITE_USE_AI_FOR_WORKOUTS') || getEnvVar('USE_AI_FOR_WORKOUTS', '') !== 'false',
  
  // Rate Limiting
  USDA_RATE_LIMIT: parseInt(getEnvVar('VITE_USDA_RATE_LIMIT') || getEnvVar('USDA_RATE_LIMIT', '1000'), 10),
  AI_RATE_LIMIT: parseInt(getEnvVar('VITE_AI_RATE_LIMIT') || getEnvVar('AI_RATE_LIMIT', '30'), 10),
  RATE_LIMIT_RETRY_DELAY: parseInt(getEnvVar('VITE_RATE_LIMIT_RETRY_DELAY') || getEnvVar('RATE_LIMIT_RETRY_DELAY', '2000'), 10),
  
  // Security
  SESSION_SECRET: getEnvVar('VITE_SESSION_SECRET') || getEnvVar('SESSION_SECRET', ''),
} as const;

/**
 * Environment validation result
 */
export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate environment configuration
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  if (!env.USDA_API_KEY) {
    errors.push('USDA_API_KEY is required');
  }

  // AI configuration validation (Groq only)
  if (env.USE_AI_FOR_MEALS || env.USE_AI_FOR_WORKOUTS) {
    if (!env.AI_API_KEY) {
      errors.push('VITE_GROQ_API_KEY (or GROQ_API_KEY for Node.js) is required when AI features are enabled');
    }
  }

  // Temperature validation
  if (env.AI_TEMPERATURE < 0 || env.AI_TEMPERATURE > 1) {
    errors.push(`AI_TEMPERATURE must be between 0 and 1, got ${env.AI_TEMPERATURE}`);
  }

  // Cache validation
  if (env.USDA_CACHE_TTL < 0) {
    errors.push('USDA_CACHE_TTL must be >= 0');
  }
  if (env.USDA_CACHE_MAX_ITEMS < 0) {
    errors.push('USDA_CACHE_MAX_ITEMS must be >= 0');
  }

  // Rate limit validation
  if (env.USDA_RATE_LIMIT < 1) {
    errors.push('USDA_RATE_LIMIT must be >= 1');
  }
  if (env.AI_RATE_LIMIT < 1) {
    errors.push('AI_RATE_LIMIT must be >= 1');
  }

  // Warnings for development
  if (env.NODE_ENV === 'production') {
    if (!env.SESSION_SECRET || env.SESSION_SECRET === 'your_session_secret_here') {
      warnings.push('SESSION_SECRET should be set to a secure random string in production');
    }
    if (env.DEBUG) {
      warnings.push('DEBUG should be false in production');
    }
  }

  // Warnings for missing optional features
  if (!env.USE_AI_FOR_MEALS && !env.USE_AI_FOR_WORKOUTS) {
    warnings.push('AI features are disabled. Using deterministic methods only.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get environment info for logging (without sensitive data)
 */
export function getEnvInfo(): Record<string, string | number | boolean> {
  return {
    NODE_ENV: env.NODE_ENV,
    AI_MODEL_PROVIDER: env.AI_MODEL_PROVIDER,
    AI_MODEL_NAME: env.AI_MODEL_NAME,
    AI_TEMPERATURE: env.AI_TEMPERATURE,
    ENABLE_COT: env.ENABLE_COT,
    USE_AI_FOR_MEALS: env.USE_AI_FOR_MEALS,
    USE_AI_FOR_WORKOUTS: env.USE_AI_FOR_WORKOUTS,
    USDA_CACHE_TTL: env.USDA_CACHE_TTL,
    USDA_CACHE_MAX_ITEMS: env.USDA_CACHE_MAX_ITEMS,
    // Never log API keys
    hasUSDAKey: !!env.USDA_API_KEY,
    hasAIKey: !!env.AI_API_KEY,
  };
}

