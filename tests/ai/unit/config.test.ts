/**
 * Unit Tests - AI Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AIConfigManager } from '../../../src/services/ai/config';
import * as fs from 'fs';
import * as path from 'path';

describe('AIConfigManager', () => {
  const testConfigPath = path.join(__dirname, 'test-ai-config.yml');
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Clear AI-related env vars
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('AI_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;

    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('Default Configuration', () => {
    it('should load default config when no file or env vars present', () => {
      const manager = new AIConfigManager('/nonexistent/path.yml');
      const config = manager.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.features.rcaMatching).toBe(true);
      expect(config.features.categorization).toBe(true);
      expect(config.cost.monthlyBudgetUSD).toBe(100);
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should override with environment variables', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_PROVIDER = 'openai';
      process.env.AI_MODEL = 'gpt-4';
      process.env.AI_MONTHLY_BUDGET_USD = '200';

      const manager = new AIConfigManager('/nonexistent/path.yml');
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.cost.monthlyBudgetUSD).toBe(200);
    });

    it('should parse feature flags from env', () => {
      process.env.AI_FEATURE_RCA_MATCHING = 'true';
      process.env.AI_FEATURE_CATEGORIZATION = 'false';

      const manager = new AIConfigManager('/nonexistent/path.yml');
      const config = manager.getConfig();

      expect(config.features.rcaMatching).toBe(true);
      expect(config.features.categorization).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_PROVIDER = 'anthropic';
      process.env.AI_MODEL = 'claude-sonnet-4-20250514';

      const manager = new AIConfigManager();
      const validation = manager.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid provider', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_PROVIDER = 'invalid-provider' as any;

      const manager = new AIConfigManager();
      const validation = manager.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid provider: invalid-provider');
    });

    it('should reject negative budget', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_MONTHLY_BUDGET_USD = '-100';

      const manager = new AIConfigManager();
      const validation = manager.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('budget'))).toBe(true);
    });

    it('should reject invalid alert threshold', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_ALERT_THRESHOLD_PERCENT = '150';

      const manager = new AIConfigManager();
      const validation = manager.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('threshold'))).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should check if AI is enabled', () => {
      process.env.AI_ENABLED = 'true';
      const manager = new AIConfigManager();

      expect(manager.isEnabled()).toBe(true);
    });

    it('should check if feature is enabled', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_FEATURE_RCA_MATCHING = 'true';

      const manager = new AIConfigManager();

      expect(manager.isFeatureEnabled('rcaMatching')).toBe(true);
    });

    it('should return false for disabled feature even if AI is enabled', () => {
      process.env.AI_ENABLED = 'true';
      process.env.AI_FEATURE_NL_QUERIES = 'false';

      const manager = new AIConfigManager();

      expect(manager.isFeatureEnabled('nlQueries')).toBe(false);
    });

    it('should get provider name', () => {
      process.env.AI_PROVIDER = 'openai';
      const manager = new AIConfigManager();

      expect(manager.getProvider()).toBe('openai');
    });

    it('should get model name', () => {
      process.env.AI_MODEL = 'gpt-4-turbo';
      const manager = new AIConfigManager();

      expect(manager.getModel()).toBe('gpt-4-turbo');
    });
  });
});
