/**
 * Unit Tests - AI Providers
 *
 * Tests for BaseProvider, AnthropicProvider, and OpenAIProvider.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseProvider, ProviderConfig } from '../../../src/services/ai/providers/base.provider';
import { AnthropicProvider } from '../../../src/services/ai/providers/anthropic.provider';
import { OpenAIProvider } from '../../../src/services/ai/providers/openai.provider';
import { AIProviderName, ChatMessage } from '../../../src/services/ai/types';

// Mock provider for testing BaseProvider
class MockProvider extends BaseProvider {
  getName(): AIProviderName {
    return 'anthropic';
  }

  getPricing() {
    return {
      inputTokenCostPer1k: 0.01,
      outputTokenCostPer1k: 0.03,
    };
  }

  getLimits() {
    return {
      maxInputTokens: 100000,
      maxOutputTokens: 4096,
      requestsPerMinute: 50,
      tokensPerMinute: 40000,
    };
  }

  async chat(messages: ChatMessage[]) {
    return {
      content: 'Test response',
      provider: this.getName(),
      model: 'test-model',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      cost: this.calculateCost(100, 50),
      cached: false,
      responseTimeMs: 100,
    };
  }

  async embed(text: string): Promise<number[]> {
    return new Array(1536).fill(0.1);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('BaseProvider', () => {
  let provider: MockProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-key',
      model: 'test-model',
      maxTokens: 1000,
      temperature: 0.7,
    };
    provider = new MockProvider(config);
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const cost = provider['calculateCost'](1000, 500);

      // 1000 tokens input * $0.01/1k = $0.01
      // 500 tokens output * $0.03/1k = $0.015
      // Total = $0.025
      expect(cost.inputCost).toBe(0.01);
      expect(cost.outputCost).toBe(0.015);
      expect(cost.totalCost).toBe(0.025);
    });

    it('should round costs to 6 decimal places', () => {
      const cost = provider['calculateCost'](123, 456);

      expect(cost.inputCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6);
      expect(cost.outputCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6);
      expect(cost.totalCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens from text length', () => {
      const text = 'This is a test message with some words';
      const tokens = provider['estimateTokens'](text);

      // Should be roughly text.length / 4
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 4));
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      expect(() => provider['validateConfig']()).not.toThrow();
    });

    it('should throw on missing API key', () => {
      const invalidConfig = { ...config, apiKey: '' };
      const invalidProvider = new MockProvider(invalidConfig);

      expect(() => invalidProvider['validateConfig']()).toThrow('API key is required');
    });

    it('should throw on missing model', () => {
      const invalidConfig = { ...config, model: '' };
      const invalidProvider = new MockProvider(invalidConfig);

      expect(() => invalidProvider['validateConfig']()).toThrow('model is required');
    });
  });
});

describe('AnthropicProvider', () => {
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
      model: 'claude-opus-4-6',
      maxTokens: 1000,
    };
  });

  describe('getName', () => {
    it('should return anthropic as provider name', () => {
      const provider = new AnthropicProvider(config);
      expect(provider.getName()).toBe('anthropic');
    });
  });

  describe('getPricing', () => {
    it('should return correct pricing', () => {
      const provider = new AnthropicProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.015);
      expect(pricing.outputTokenCostPer1k).toBe(0.075);
      expect(pricing.embeddingCostPer1k).toBeUndefined();
    });
  });

  describe('getLimits', () => {
    it('should return correct limits', () => {
      const provider = new AnthropicProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(200000);
      expect(limits.maxOutputTokens).toBe(8192);
      expect(limits.requestsPerMinute).toBe(50);
    });
  });

  describe('embed', () => {
    it('should throw error for embeddings', async () => {
      const provider = new AnthropicProvider(config);

      await expect(provider.embed('test')).rejects.toThrow(
        'Anthropic does not provide embeddings'
      );
    });
  });
});

describe('OpenAIProvider', () => {
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      model: 'gpt-4.1',
      maxTokens: 1000,
    };
  });

  describe('getName', () => {
    it('should return openai as provider name', () => {
      const provider = new OpenAIProvider(config);
      expect(provider.getName()).toBe('openai');
    });
  });

  describe('getPricing', () => {
    it('should return correct pricing for gpt-4.1', () => {
      const provider = new OpenAIProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.008);
      expect(pricing.outputTokenCostPer1k).toBe(0.032);
    });

    it('should return correct pricing for gpt-4.1-mini', () => {
      const configMini = { ...config, model: 'gpt-4.1-mini' };
      const provider = new OpenAIProvider(configMini);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0004);
      expect(pricing.outputTokenCostPer1k).toBe(0.0016);
    });
  });

  describe('getLimits', () => {
    it('should return correct limits', () => {
      const provider = new OpenAIProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(1047576);
      expect(limits.maxOutputTokens).toBe(32768);
      expect(limits.requestsPerMinute).toBe(500);
    });
  });
});
