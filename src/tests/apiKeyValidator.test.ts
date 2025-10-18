// API Key Validator Tests
// Tests for critical security component

import { APIKeyValidator } from '@/utils/apiKeyValidator';

describe('APIKeyValidator', () => {
  let validator: APIKeyValidator;

  beforeEach(() => {
    validator = APIKeyValidator.getInstance();
    // Clear any cached validation
    validator.clearValidatedKey();
  });

  describe('validateUserAPIKey', () => {
    it('should reject empty API key', async () => {
      const result = await validator.validateUserAPIKey('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject API key that is too short', async () => {
      const result = await validator.validateUserAPIKey('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should detect OpenAI API key format', () => {
      const result = validator['detectProvider']('sk-1234567890abcdef');
      expect(result).toBe('openai');
    });

    it('should detect Groq API key format', () => {
      const result = validator['detectProvider']('gsk_1234567890abcdef');
      expect(result).toBe('groq');
    });

    it('should detect Anthropic API key format', () => {
      const result = validator['detectProvider']('sk-ant-1234567890abcdef');
      expect(result).toBe('anthropic');
    });

    it('should default to OpenAI for unknown format', () => {
      const result = validator['detectProvider']('unknown-format-key');
      expect(result).toBe('openai');
    });
  });

  describe('validateOnStartup', () => {
    it('should throw error when no API key is found', async () => {
      // Mock environment to have no API keys
      const originalEnv = process.env;
      process.env = {};

      await expect(validator.validateOnStartup()).rejects.toThrow('No valid API key found');

      process.env = originalEnv;
    });

    it('should validate environment API key when available', async () => {
      // Mock environment with valid API key
      const originalEnv = process.env;
      process.env = { OPENAI_API_KEY: 'sk-test1234567890abcdef' };

      // Mock the testAPIKey method to return true
      const mockTestAPIKey = jest.fn().mockResolvedValue(true);
      validator['testAPIKey'] = mockTestAPIKey;

      const result = await validator.validateOnStartup();
      expect(result).toBe('sk-test1234567890abcdef');
      expect(mockTestAPIKey).toHaveBeenCalled();

      process.env = originalEnv;
    });
  });

  describe('getAPIConfig', () => {
    it('should return null when no key is validated', () => {
      const config = validator.getAPIConfig();
      expect(config).toBeNull();
    });

    it('should return OpenAI config for OpenAI key', () => {
      validator['validatedKey'] = 'sk-1234567890abcdef';
      validator['detectProvider'] = jest.fn().mockReturnValue('openai');

      const config = validator.getAPIConfig();
      expect(config).not.toBeNull();
      expect(config?.provider).toBe('OpenAI');
      expect(config?.endpoint).toContain('openai.com');
    });

    it('should return Groq config for Groq key', () => {
      validator['validatedKey'] = 'gsk_1234567890abcdef';
      validator['detectProvider'] = jest.fn().mockReturnValue('groq');

      const config = validator.getAPIConfig();
      expect(config).not.toBeNull();
      expect(config?.provider).toBe('Groq');
      expect(config?.endpoint).toContain('groq.com');
    });
  });

  describe('isKeyValidated', () => {
    it('should return false when no key is validated', () => {
      expect(validator.isKeyValidated()).toBe(false);
    });

    it('should return true when key is validated', () => {
      validator['validatedKey'] = 'sk-1234567890abcdef';
      expect(validator.isKeyValidated()).toBe(true);
    });
  });

  describe('clearValidatedKey', () => {
    it('should clear validated key and cache', () => {
      validator['validatedKey'] = 'sk-1234567890abcdef';
      validator['validationCache'].set('test-key', { isValid: true });

      validator.clearValidatedKey();

      expect(validator['validatedKey']).toBeNull();
      expect(validator['validationCache'].size).toBe(0);
    });
  });
});
