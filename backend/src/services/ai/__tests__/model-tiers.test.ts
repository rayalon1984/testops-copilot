/**
 * Tests for Model Tiers — Capability-Aware Model Routing
 */
import {
  resolveModelProfile,
  canModelHandleFeature,
  getSupportedFeatures,
  getRequiredTier,
  getPromptHints,
  DEFAULT_FEATURE_REQUIREMENTS,
} from '../model-tiers';

// ── Model Profile Resolution ──

describe('resolveModelProfile', () => {
  it('resolves known Anthropic models', () => {
    const profile = resolveModelProfile('claude-opus-4-6', 'anthropic');
    expect(profile.tier).toBe('large');
    expect(profile.contextWindow).toBe(200000);
    expect(profile.supportsToolCalling).toBe(true);
    expect(profile.supportsStructuredOutput).toBe(true);
  });

  it('resolves known small models', () => {
    const profile = resolveModelProfile('meta-llama/llama-3.2-3b-instruct', 'openrouter');
    expect(profile.tier).toBe('small');
    expect(profile.contextWindow).toBe(8192);
    expect(profile.supportsToolCalling).toBe(false);
    expect(profile.supportsStructuredOutput).toBe(false);
  });

  it('resolves known medium models', () => {
    const profile = resolveModelProfile('meta-llama/llama-3.1-70b-instruct', 'openrouter');
    expect(profile.tier).toBe('medium');
    expect(profile.supportsToolCalling).toBe(true);
  });

  it('infers tier for unknown small models from name pattern', () => {
    const profile = resolveModelProfile('custom/my-model-7b-chat', 'openrouter');
    expect(profile.tier).toBe('small');
  });

  it('infers tier for unknown medium models from name pattern', () => {
    const profile = resolveModelProfile('custom/my-model-70b-chat', 'openrouter');
    expect(profile.tier).toBe('medium');
  });

  it('defaults anthropic to large tier', () => {
    const profile = resolveModelProfile('claude-unknown-model', 'anthropic');
    expect(profile.tier).toBe('large');
  });

  it('defaults openai to large tier', () => {
    const profile = resolveModelProfile('gpt-future', 'openai');
    expect(profile.tier).toBe('large');
  });

  it('allows context window override', () => {
    const profile = resolveModelProfile('custom-model', 'openrouter', 4096);
    expect(profile.contextWindow).toBe(4096);
  });
});

// ── Feature Routing ──

describe('canModelHandleFeature', () => {
  it('small models can handle basic features', () => {
    expect(canModelHandleFeature('small', 'categorization')).toBe(true);
    expect(canModelHandleFeature('small', 'flakyDetection')).toBe(true);
    expect(canModelHandleFeature('small', 'personaRouting')).toBe(true);
  });

  it('small models cannot handle advanced features', () => {
    expect(canModelHandleFeature('small', 'agenticChat')).toBe(false);
    expect(canModelHandleFeature('small', 'codeFix')).toBe(false);
    expect(canModelHandleFeature('small', 'ticketGeneration')).toBe(false);
    expect(canModelHandleFeature('small', 'contextEnrichment')).toBe(false);
  });

  it('small models cannot handle standard features', () => {
    expect(canModelHandleFeature('small', 'logSummary')).toBe(false);
    expect(canModelHandleFeature('small', 'rcaMatching')).toBe(false);
  });

  it('medium models can handle basic and standard features', () => {
    expect(canModelHandleFeature('medium', 'categorization')).toBe(true);
    expect(canModelHandleFeature('medium', 'logSummary')).toBe(true);
    expect(canModelHandleFeature('medium', 'rcaMatching')).toBe(true);
  });

  it('medium models cannot handle advanced features', () => {
    expect(canModelHandleFeature('medium', 'agenticChat')).toBe(false);
    expect(canModelHandleFeature('medium', 'codeFix')).toBe(false);
  });

  it('large models can handle all features', () => {
    const allFeatures = Object.keys(DEFAULT_FEATURE_REQUIREMENTS) as (keyof typeof DEFAULT_FEATURE_REQUIREMENTS)[];
    for (const feature of allFeatures) {
      expect(canModelHandleFeature('large', feature)).toBe(true);
    }
  });
});

describe('getSupportedFeatures', () => {
  it('returns only basic features for small tier', () => {
    const features = getSupportedFeatures('small');
    expect(features).toContain('categorization');
    expect(features).toContain('flakyDetection');
    expect(features).toContain('personaRouting');
    expect(features).not.toContain('agenticChat');
    expect(features).not.toContain('logSummary');
  });

  it('returns basic + standard features for medium tier', () => {
    const features = getSupportedFeatures('medium');
    expect(features).toContain('categorization');
    expect(features).toContain('logSummary');
    expect(features).toContain('rcaMatching');
    expect(features).not.toContain('agenticChat');
  });

  it('returns all features for large tier', () => {
    const features = getSupportedFeatures('large');
    expect(features.length).toBe(Object.keys(DEFAULT_FEATURE_REQUIREMENTS).length);
  });
});

describe('getRequiredTier', () => {
  it('returns small for basic features', () => {
    expect(getRequiredTier('categorization')).toBe('small');
    expect(getRequiredTier('flakyDetection')).toBe('small');
  });

  it('returns medium for standard features', () => {
    expect(getRequiredTier('logSummary')).toBe('medium');
    expect(getRequiredTier('rcaMatching')).toBe('medium');
  });

  it('returns large for advanced features', () => {
    expect(getRequiredTier('agenticChat')).toBe('large');
    expect(getRequiredTier('codeFix')).toBe('large');
  });
});

// ── Prompt Hints ──

describe('getPromptHints', () => {
  it('returns restrictive hints for small models', () => {
    const hints = getPromptHints('small');
    expect(hints.simplifyJsonOutput).toBe(true);
    expect(hints.includeExamples).toBe(false);
    expect(hints.includeChainOfThought).toBe(false);
    expect(hints.maxContextItems).toBeLessThan(5);
    expect(hints.maxSystemPromptChars).toBeLessThan(2000);
  });

  it('returns moderate hints for medium models', () => {
    const hints = getPromptHints('medium');
    expect(hints.simplifyJsonOutput).toBe(false);
    expect(hints.includeExamples).toBe(true);
    expect(hints.includeChainOfThought).toBe(false);
  });

  it('returns full hints for large models', () => {
    const hints = getPromptHints('large');
    expect(hints.simplifyJsonOutput).toBe(false);
    expect(hints.includeExamples).toBe(true);
    expect(hints.includeChainOfThought).toBe(true);
    expect(hints.maxContextItems).toBeGreaterThanOrEqual(10);
  });

  it('small models have smaller code snippet limits', () => {
    const small = getPromptHints('small');
    const large = getPromptHints('large');
    expect(small.maxCodeSnippetChars).toBeLessThan(large.maxCodeSnippetChars);
  });
});
