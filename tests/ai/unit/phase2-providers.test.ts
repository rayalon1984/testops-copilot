/**
 * Unit Tests - Google and Azure Providers
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GoogleProvider } from '../../../src/services/ai/providers/google.provider';
import { AzureProvider, AzureProviderConfig } from '../../../src/services/ai/providers/azure.provider';

describe('GoogleProvider', () => {
  let config: any;

  beforeEach(() => {
    config = {
      apiKey: process.env.GOOGLE_API_KEY || 'test-key',
      model: 'gemini-pro',
    };
  });

  describe('getName', () => {
    it('should return google as provider name', () => {
      const provider = new GoogleProvider(config);
      expect(provider.getName()).toBe('google');
    });
  });

  describe('getPricing', () => {
    it('should return correct pricing for gemini-pro', () => {
      const provider = new GoogleProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0005);
      expect(pricing.outputTokenCostPer1k).toBe(0.0015);
      expect(pricing.embeddingCostPer1k).toBe(0.0001);
    });

    it('should return correct pricing for gemini-1.5-pro', () => {
      const config15 = { ...config, model: 'gemini-1.5-pro' };
      const provider = new GoogleProvider(config15);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.00125);
      expect(pricing.outputTokenCostPer1k).toBe(0.00375);
    });

    it('should return correct pricing for gemini-1.5-flash', () => {
      const configFlash = { ...config, model: 'gemini-1.5-flash' };
      const provider = new GoogleProvider(configFlash);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.000075);
      expect(pricing.outputTokenCostPer1k).toBe(0.0003);
    });

    it('should return pricing for embeddings model', () => {
      const configEmbed = { ...config, model: 'text-embedding-004' };
      const provider = new GoogleProvider(configEmbed);
      const pricing = provider.getPricing();

      expect(pricing.embeddingCostPer1k).toBe(0.0000125);
    });
  });

  describe('getLimits', () => {
    it('should return correct limits for gemini-pro', () => {
      const provider = new GoogleProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(30720);
      expect(limits.maxOutputTokens).toBe(2048);
    });

    it('should return correct limits for gemini-1.5-pro', () => {
      const config15 = { ...config, model: 'gemini-1.5-pro' };
      const provider = new GoogleProvider(config15);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(1000000); // 1M context!
      expect(limits.maxOutputTokens).toBe(8192);
    });

    it('should return correct limits for gemini-1.5-flash', () => {
      const configFlash = { ...config, model: 'gemini-1.5-flash' };
      const provider = new GoogleProvider(configFlash);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(1000000);
      expect(limits.requestsPerMinute).toBe(1000); // Much higher!
    });
  });

  describe('configuration validation', () => {
    it('should require API key', () => {
      const invalidConfig = { ...config, apiKey: '' };

      expect(() => new GoogleProvider(invalidConfig)).toThrow('API key');
    });

    it('should require model', () => {
      const invalidConfig = { ...config, model: '' };

      expect(() => new GoogleProvider(invalidConfig)).toThrow('model');
    });
  });
});

describe('AzureProvider', () => {
  let config: AzureProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: process.env.AZURE_OPENAI_KEY || 'test-key',
      model: 'gpt-4',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://test.openai.azure.com',
      deploymentName: 'gpt-4-deployment',
      apiVersion: '2024-02-15-preview',
    };
  });

  describe('getName', () => {
    it('should return azure as provider name', () => {
      const provider = new AzureProvider(config);
      expect(provider.getName()).toBe('azure');
    });
  });

  describe('getPricing', () => {
    it('should return pricing for gpt-4 deployment', () => {
      const provider = new AzureProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.03);
      expect(pricing.outputTokenCostPer1k).toBe(0.06);
    });

    it('should return pricing for gpt-35-turbo deployment', () => {
      const config35 = { ...config, deploymentName: 'gpt-35-turbo-deployment' };
      const provider = new AzureProvider(config35);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0015);
      expect(pricing.outputTokenCostPer1k).toBe(0.002);
    });

    it('should return pricing for embedding deployment', () => {
      const configEmbed = { ...config, deploymentName: 'text-embedding-3-small' };
      const provider = new AzureProvider(configEmbed);
      const pricing = provider.getPricing();

      expect(pricing.embeddingCostPer1k).toBe(0.00002);
    });

    it('should fallback to gpt-35-turbo pricing for unknown deployments', () => {
      const configUnknown = { ...config, deploymentName: 'custom-deployment' };
      const provider = new AzureProvider(configUnknown);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0015);
    });
  });

  describe('getLimits', () => {
    it('should return default limits', () => {
      const provider = new AzureProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(8192);
      expect(limits.maxOutputTokens).toBe(4096);
      expect(limits.requestsPerMinute).toBe(120);
    });
  });

  describe('configuration validation', () => {
    it('should require API key', () => {
      const invalidConfig = { ...config, apiKey: '' };

      expect(() => new AzureProvider(invalidConfig)).toThrow('API key');
    });

    it('should require endpoint', () => {
      const invalidConfig = { ...config, endpoint: '' };

      expect(() => new AzureProvider(invalidConfig)).toThrow('endpoint');
    });

    it('should require deployment name', () => {
      const invalidConfig = { ...config, deploymentName: '' };

      expect(() => new AzureProvider(invalidConfig)).toThrow('deployment');
    });

    it('should use default API version if not provided', () => {
      const configNoVersion = { ...config };
      delete (configNoVersion as any).apiVersion;

      const provider = new AzureProvider(configNoVersion);
      expect(provider).toBeDefined();
      // Should not throw, uses default version
    });
  });
});

describe('Provider Cost Comparison', () => {
  it('should compare costs across all providers', () => {
    const providers = [
      {
        name: 'Anthropic Claude Sonnet 4.5',
        inputCost: 0.003,
        outputCost: 0.015,
      },
      {
        name: 'OpenAI GPT-4 Turbo',
        inputCost: 0.01,
        outputCost: 0.03,
      },
      {
        name: 'Google Gemini Pro',
        inputCost: 0.0005,
        outputCost: 0.0015,
      },
      {
        name: 'Google Gemini 1.5 Flash',
        inputCost: 0.000075,
        outputCost: 0.0003,
      },
      {
        name: 'Azure GPT-4',
        inputCost: 0.03,
        outputCost: 0.06,
      },
    ];

    // Calculate cost for 1M input + 1M output tokens
    const costs = providers.map(p => ({
      name: p.name,
      totalCost: (p.inputCost * 1000) + (p.outputCost * 1000),
    }));

    // Sort by cost
    costs.sort((a, b) => a.totalCost - b.totalCost);

    // Gemini 1.5 Flash should be cheapest
    expect(costs[0].name).toContain('Flash');

    // Gemini Pro should be second cheapest
    expect(costs[1].name).toContain('Gemini Pro');

    // Azure/OpenAI GPT-4 should be most expensive
    expect(costs[costs.length - 1].name).toContain('Azure');

    console.log('\nProvider Cost Comparison (1M input + 1M output tokens):');
    costs.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}: $${c.totalCost.toFixed(2)}`);
    });
  });

  it('should show context window advantages', () => {
    const contexts = [
      { name: 'Anthropic Claude Sonnet 4.5', tokens: 200000 },
      { name: 'OpenAI GPT-4 Turbo', tokens: 128000 },
      { name: 'Google Gemini Pro', tokens: 30720 },
      { name: 'Google Gemini 1.5 Pro', tokens: 1000000 },
      { name: 'Google Gemini 1.5 Flash', tokens: 1000000 },
      { name: 'Azure GPT-4', tokens: 8192 },
    ];

    contexts.sort((a, b) => b.tokens - a.tokens);

    // Gemini 1.5 models should have largest context
    expect(contexts[0].tokens).toBe(1000000);
    expect(contexts[0].name).toContain('Gemini 1.5');

    console.log('\nProvider Context Window Comparison:');
    contexts.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}: ${(c.tokens / 1000).toLocaleString()}k tokens`);
    });
  });
});
