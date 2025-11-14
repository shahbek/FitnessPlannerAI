/**
 * Environment Configuration
 * 
 * Centralized environment variable management with validation
 * 
 * Note: In Vite, environment variables must be prefixed with VITE_ to be exposed to the client.
 * Access them via import.meta.env (not process.env).
 */

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off']);

function readEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    const viteEnv = (import.meta as any).env as Record<string, string | undefined> | undefined;
    if (viteEnv && Object.prototype.hasOwnProperty.call(viteEnv, key)) {
      const value = viteEnv[key];
      if (value !== undefined) {
        return typeof value === 'string' ? value : String(value);
      }
    }
  }

  if (typeof process !== 'undefined' && process.env && Object.prototype.hasOwnProperty.call(process.env, key)) {
    return process.env[key];
  }

  return undefined;
}

function getStringEnvVar(keys: string[], defaultValue = ''): string {
  for (const key of keys) {
    const raw = readEnvVar(key);
    if (raw === undefined || raw === null) {
      continue;
    }
    const value = raw.trim();
    if (value !== '') {
      return value;
    }
  }
  return defaultValue;
}

function getBooleanEnvVar(keys: string[], defaultValue: boolean): boolean {
  for (const key of keys) {
    const raw = readEnvVar(key);
    if (raw === undefined || raw === null) {
      continue;
    }
    const value = raw.trim().toLowerCase();
    if (value === '') {
      continue;
    }
    if (TRUE_VALUES.has(value)) {
      return true;
    }
    if (FALSE_VALUES.has(value)) {
      return false;
    }
    // Unrecognized string – fall back to default
    return defaultValue;
  }
  return defaultValue;
}

function getNumberEnvVar(keys: string[], defaultValue: number): number {
  for (const key of keys) {
    const raw = readEnvVar(key);
    if (raw === undefined || raw === null) {
      continue;
    }
    const value = raw.trim();
    if (value === '') {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return defaultValue;
  }
  return defaultValue;
}

function getNodeEnvDefault(): 'development' | 'staging' | 'production' {
  if (typeof import.meta !== 'undefined') {
    const viteMode = (import.meta as any).env?.MODE as string | undefined;
    if (viteMode) {
      const normalized = viteMode.toLowerCase();
      if (normalized === 'production' || normalized === 'staging') {
        return normalized;
      }
    }
  }
  return 'development';
}

/**
 * Environment variable values (with defaults)
 * 
 * Note: For Vite, variables must be prefixed with VITE_ in .env file
 * Example: VITE_USDA_API_KEY=your_key_here
 */
export const env = {
  // USDA API
  get USDA_API_KEY(): string {
    return getStringEnvVar(['VITE_USDA_API_KEY', 'USDA_API_KEY']);
  },

  // AI Model Configuration (Groq only)
  get AI_MODEL_PROVIDER(): 'groq' | 'openai' {
    const provider = getStringEnvVar(['VITE_AI_MODEL_PROVIDER', 'AI_MODEL_PROVIDER'], 'groq').toLowerCase();
    return provider === 'openai' ? 'openai' : 'groq';
  },
  get AI_API_KEY(): string {
    return getStringEnvVar(['VITE_GROQ_API_KEY', 'GROQ_API_KEY', 'VITE_AI_API_KEY', 'AI_API_KEY']);
  },
  get AI_MODEL_NAME(): string {
    return getStringEnvVar(['VITE_AI_MODEL_NAME', 'AI_MODEL_NAME'], 'llama-3.3-70b-versatile');
  },
  get AI_ENDPOINT(): string {
    return getStringEnvVar(['VITE_AI_ENDPOINT', 'AI_ENDPOINT']);
  },
  get AI_TEMPERATURE(): number {
    return getNumberEnvVar(['VITE_AI_TEMPERATURE', 'AI_TEMPERATURE'], 0.3);
  },

  // Application
  get NODE_ENV(): 'development' | 'staging' | 'production' {
    const value = getStringEnvVar(['VITE_NODE_ENV', 'NODE_ENV'], getNodeEnvDefault());
    const normalized = value.toLowerCase();
    if (normalized === 'production' || normalized === 'staging') {
      return normalized;
    }
    return 'development';
  },
  get API_BASE_URL(): string {
    return getStringEnvVar(['VITE_API_BASE_URL', 'API_BASE_URL']);
  },
  get DEBUG(): boolean {
    return getBooleanEnvVar(['VITE_DEBUG', 'DEBUG'], false);
  },

  // Performance & Caching
  get USDA_CACHE_TTL(): number {
    return getNumberEnvVar(['VITE_USDA_CACHE_TTL', 'USDA_CACHE_TTL'], 24);
  },
  get USDA_CACHE_MAX_ITEMS(): number {
    return getNumberEnvVar(['VITE_USDA_CACHE_MAX_ITEMS', 'USDA_CACHE_MAX_ITEMS'], 10000);
  },
  get ENABLE_API_TRACKING(): boolean {
    return getBooleanEnvVar(['VITE_ENABLE_API_TRACKING', 'ENABLE_API_TRACKING'], true);
  },

  // Feature Flags
  get ENABLE_COT(): boolean {
    return getBooleanEnvVar(['VITE_ENABLE_COT', 'ENABLE_COT'], true);
  },
  get ENABLE_MEAL_CORRECTIONS(): boolean {
    return getBooleanEnvVar(['VITE_ENABLE_MEAL_CORRECTIONS', 'ENABLE_MEAL_CORRECTIONS'], true);
  },
  get ENABLE_WORKOUT_CORRECTIONS(): boolean {
    return getBooleanEnvVar(['VITE_ENABLE_WORKOUT_CORRECTIONS', 'ENABLE_WORKOUT_CORRECTIONS'], true);
  },
  get USE_AI_FOR_MEALS(): boolean {
    return getBooleanEnvVar(['VITE_USE_AI_FOR_MEALS', 'USE_AI_FOR_MEALS'], true);
  },
  get USE_AI_FOR_WORKOUTS(): boolean {
    return getBooleanEnvVar(['VITE_USE_AI_FOR_WORKOUTS', 'USE_AI_FOR_WORKOUTS'], true);
  },

  // Rate Limiting
  get USDA_RATE_LIMIT(): number {
    return getNumberEnvVar(['VITE_USDA_RATE_LIMIT', 'USDA_RATE_LIMIT'], 1000);
  },
  get AI_RATE_LIMIT(): number {
    return getNumberEnvVar(['VITE_AI_RATE_LIMIT', 'AI_RATE_LIMIT'], 30);
  },
  get RATE_LIMIT_RETRY_DELAY(): number {
    return getNumberEnvVar(['VITE_RATE_LIMIT_RETRY_DELAY', 'RATE_LIMIT_RETRY_DELAY'], 2000);
  },

  // Security
  get SESSION_SECRET(): string {
    return getStringEnvVar(['VITE_SESSION_SECRET', 'SESSION_SECRET']);
  },
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

