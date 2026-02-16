/**
 * Unit Tests - Google, Azure, and OpenRouter Providers
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GoogleProvider } from '../../../src/services/ai/providers/google.provider';
import { AzureProvider, AzureProviderConfig } from '../../../src/services/ai/providers/azure.provider';
import { OpenRouterProvider, OpenRouterProviderConfig } from '../../../src/services/ai/providers/openrouter.provider';

describe('GoogleProvider', () => {
  let config: any;

  beforeEach(() => {
    config = {
      apiKey: process.env.GOOGLE_API_KEY || 'test-key',
      model: 'gemini-3.0-flash',
    };
  });

  describe('getName', () => {
    it('should return google as provider name', () => {
      const provider = new GoogleProvider(config);
      expect(provider.getName()).toBe('google');
    });
  });

  describe('getPricing', () => {
    it('should return correct pricing for gemini-3.0-flash', () => {
      const provider = new GoogleProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.00015);
      expect(pricing.outputTokenCostPer1k).toBe(0.0006);
      expect(pricing.embeddingCostPer1k).toBe(0.00001);
    });

    it('should return correct pricing for gemini-3.0-pro', () => {
      const configPro = { ...config, model: 'gemini-3.0-pro' };
      const provider = new GoogleProvider(configPro);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.00125);
      expect(pricing.outputTokenCostPer1k).toBe(0.005);
    });

    it('should return pricing for embeddings model', () => {
      const configEmbed = { ...config, model: 'text-embedding-005' };
      const provider = new GoogleProvider(configEmbed);
      const pricing = provider.getPricing();

      expect(pricing.embeddingCostPer1k).toBe(0.0000125);
    });
  });

  describe('getLimits', () => {
    it('should return correct limits for gemini-3.0-flash', () => {
      const provider = new GoogleProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(1000000);
      expect(limits.maxOutputTokens).toBe(65536);
    });

    it('should return correct limits for gemini-3.0-pro', () => {
      const configPro = { ...config, model: 'gemini-3.0-pro' };
      const provider = new GoogleProvider(configPro);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(2000000); // 2M context!
      expect(limits.maxOutputTokens).toBe(65536);
    });

    it('should return correct limits for gemini-3.0-flash', () => {
      const provider = new GoogleProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(1000000);
      expect(limits.requestsPerMinute).toBe(2000); // Much higher!
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
    it('should return pricing for gpt-4.1 deployment', () => {
      const config41 = { ...config, deploymentName: 'gpt-4.1-deployment' };
      const provider = new AzureProvider(config41);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.008);
      expect(pricing.outputTokenCostPer1k).toBe(0.032);
    });

    it('should return pricing for gpt-4.1-mini deployment', () => {
      const configMini = { ...config, deploymentName: 'gpt-4.1-mini-deployment' };
      const provider = new AzureProvider(configMini);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0004);
      expect(pricing.outputTokenCostPer1k).toBe(0.0016);
    });

    it('should return pricing for embedding deployment', () => {
      const configEmbed = { ...config, deploymentName: 'text-embedding-3-small' };
      const provider = new AzureProvider(configEmbed);
      const pricing = provider.getPricing();

      expect(pricing.embeddingCostPer1k).toBe(0.00002);
    });

    it('should fallback to gpt-4.1-mini pricing for unknown deployments', () => {
      const configUnknown = { ...config, deploymentName: 'custom-deployment' };
      const provider = new AzureProvider(configUnknown);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.0004);
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

describe('OpenRouterProvider', () => {
  let config: OpenRouterProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: process.env.OPENROUTER_API_KEY || 'test-key',
      model: 'anthropic/claude-sonnet-4-5',
      siteUrl: 'https://test.example.com',
      appName: 'TestOps Test',
    };
  });

  describe('getName', () => {
    it('should return openrouter as provider name', () => {
      const provider = new OpenRouterProvider(config);
      expect(provider.getName()).toBe('openrouter');
    });
  });

  describe('getPricing', () => {
    it('should return conservative default pricing before model info is fetched', () => {
      const provider = new OpenRouterProvider(config);
      const pricing = provider.getPricing();

      expect(pricing.inputTokenCostPer1k).toBe(0.005);
      expect(pricing.outputTokenCostPer1k).toBe(0.015);
      expect(pricing.embeddingCostPer1k).toBeUndefined();
    });
  });

  describe('getLimits', () => {
    it('should return conservative default limits before model info is fetched', () => {
      const provider = new OpenRouterProvider(config);
      const limits = provider.getLimits();

      expect(limits.maxInputTokens).toBe(128000);
      expect(limits.maxOutputTokens).toBe(4096);
      expect(limits.requestsPerMinute).toBe(200);
      expect(limits.tokensPerMinute).toBe(100000);
    });
  });

  describe('embed', () => {
    it('should throw error for embeddings (not supported via OpenRouter)', async () => {
      const provider = new OpenRouterProvider(config);

      await expect(provider.embed('test')).rejects.toThrow(
        'OpenRouter does not support embeddings'
      );
    });
  });

  describe('getModelInfo', () => {
    it('should return null before model info is fetched', () => {
      const provider = new OpenRouterProvider(config);
      expect(provider.getModelInfo()).toBeNull();
    });
  });

  describe('configuration validation', () => {
    it('should require API key', () => {
      const invalidConfig = { ...config, apiKey: '' };

      expect(() => new OpenRouterProvider(invalidConfig)).toThrow('API key');
    });

    it('should require model', () => {
      const invalidConfig = { ...config, model: '' };

      expect(() => new OpenRouterProvider(invalidConfig)).toThrow('model');
    });

    it('should accept config with optional siteUrl and appName', () => {
      const minimalConfig = {
        apiKey: 'test-key',
        model: 'meta-llama/llama-4-maverick',
      };

      const provider = new OpenRouterProvider(minimalConfig);
      expect(provider.getName()).toBe('openrouter');
    });
  });
});

describe('Provider Cost Comparison', () => {
  it('should compare costs across all providers', () => {
    const providers = [
      {
        name: 'Anthropic Claude Opus 4.6',
        inputCost: 0.015,
        outputCost: 0.075,
      },
      {
        name: 'OpenAI GPT-4.1',
        inputCost: 0.008,
        outputCost: 0.032,
      },
      {
        name: 'Google Gemini 3.0 Pro',
        inputCost: 0.00125,
        outputCost: 0.005,
      },
      {
        name: 'Google Gemini 3.0 Flash',
        inputCost: 0.00015,
        outputCost: 0.0006,
      },
      {
        name: 'Azure GPT-4.1',
        inputCost: 0.008,
        outputCost: 0.032,
      },
      {
        name: 'OpenRouter (default fallback)',
        inputCost: 0.005,
        outputCost: 0.015,
      },
    ];

    // Calculate cost for 1M input + 1M output tokens
    const costs = providers.map(p => ({
      name: p.name,
      totalCost: (p.inputCost * 1000) + (p.outputCost * 1000),
    }));

    // Sort by cost
    costs.sort((a, b) => a.totalCost - b.totalCost);

    // Gemini 3.0 Flash should be cheapest
    expect(costs[0].name).toContain('Flash');

    // Gemini 3.0 Pro should be second cheapest
    expect(costs[1].name).toContain('Gemini 3.0 Pro');

    // Anthropic Opus should be most expensive
    expect(costs[costs.length - 1].name).toContain('Opus');

    console.log('\nProvider Cost Comparison (1M input + 1M output tokens):');
    costs.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}: $${c.totalCost.toFixed(2)}`);
    });
  });

  it('should show context window advantages', () => {
    const contexts = [
      { name: 'Anthropic Claude Opus 4.6', tokens: 200000 },
      { name: 'OpenAI GPT-4.1', tokens: 1047576 },
      { name: 'Google Gemini 3.0 Pro', tokens: 2000000 },
      { name: 'Google Gemini 3.0 Flash', tokens: 1000000 },
      { name: 'Azure GPT-4.1', tokens: 1047576 },
      { name: 'OpenRouter (default)', tokens: 128000 },
    ];

    contexts.sort((a, b) => b.tokens - a.tokens);

    // Gemini 3.0 Pro should have largest context
    expect(contexts[0].tokens).toBe(2000000);
    expect(contexts[0].name).toContain('Gemini 3.0 Pro');

    console.log('\nProvider Context Window Comparison:');
    contexts.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}: ${(c.tokens / 1000).toLocaleString()}k tokens`);
    });
  });
});
