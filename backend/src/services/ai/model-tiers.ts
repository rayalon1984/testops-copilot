/**
 * Model Tiers — Capability-Aware Model Routing
 *
 * Defines model capability tiers so the system can:
 *  1. Route features to the right model size (small models for classification,
 *     large models for code generation)
 *  2. Adjust prompts and output expectations based on model capability
 *  3. Enable on-prem deployments with 3B-12B parameter models for basic
 *     analysis while reserving cloud models for heavy lifting
 *
 * Tier definitions:
 *  - small  (3B-12B):  Llama 3.2 3B, Mistral 7B, Phi-3 — classification, tagging, simple extraction
 *  - medium (13B-70B): Llama 3 70B, Mixtral 8x22B — summarization, structured analysis, flaky detection
 *  - large  (>70B / frontier): Claude, GPT-4, Gemini Pro — code generation, PR creation, complex RCA
 */

import { AIProviderName } from './types';
import { logger } from '@/utils/logger';

// ── Types ───────────────────────────────────────────────────────────────

export type ModelTier = 'small' | 'medium' | 'large';

/**
 * AI features classified by the minimum model tier that can handle them.
 */
export type FeatureComplexity = 'basic' | 'standard' | 'advanced';

/**
 * Mapping of feature names to their minimum required complexity level.
 */
export interface FeatureRequirements {
  /** Simple category selection from fixed set */
  categorization: FeatureComplexity;
  /** Flaky test detection (pattern matching on history) */
  flakyDetection: FeatureComplexity;
  /** Summarize logs into a short digest */
  logSummary: FeatureComplexity;
  /** Persona routing (micro-classification) */
  personaRouting: FeatureComplexity;
  /** Root cause analysis with vector similarity */
  rcaMatching: FeatureComplexity;
  /** Cross-platform context enrichment */
  contextEnrichment: FeatureComplexity;
  /** Generate Jira tickets / PR descriptions */
  ticketGeneration: FeatureComplexity;
  /** Agentic chat with tool calling (ReAct loop) */
  agenticChat: FeatureComplexity;
  /** Code fix suggestions */
  codeFix: FeatureComplexity;
}

/**
 * Default feature requirements — what tier each feature needs at minimum.
 */
export const DEFAULT_FEATURE_REQUIREMENTS: FeatureRequirements = {
  // ── Basic (can run on small 3B-12B models) ──
  categorization: 'basic',
  flakyDetection: 'basic',
  personaRouting: 'basic',

  // ── Standard (needs medium 13B-70B models) ──
  logSummary: 'standard',
  rcaMatching: 'standard',

  // ── Advanced (needs large / frontier models) ──
  contextEnrichment: 'advanced',
  ticketGeneration: 'advanced',
  agenticChat: 'advanced',
  codeFix: 'advanced',
};

/**
 * Maps feature complexity levels to the minimum model tier.
 */
const COMPLEXITY_TO_TIER: Record<FeatureComplexity, ModelTier> = {
  basic: 'small',
  standard: 'medium',
  advanced: 'large',
};

// ── Model Capability Profiles ───────────────────────────────────────────

export interface ModelProfile {
  /** Model identifier (e.g. 'meta-llama/llama-3.2-3b-instruct') */
  modelId: string;
  /** Which tier this model falls into */
  tier: ModelTier;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Whether the model supports structured JSON output reliably */
  supportsStructuredOutput: boolean;
  /** Whether the model supports native tool/function calling */
  supportsToolCalling: boolean;
  /** Provider this model is served through */
  provider: AIProviderName;
}

/**
 * Known model profiles. The system auto-detects tier for unknown models
 * based on context window size and provider.
 */
const KNOWN_MODELS: ModelProfile[] = [
  // ── Small tier (3B-12B, on-prem friendly) ──
  {
    modelId: 'meta-llama/llama-3.2-3b-instruct',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    provider: 'openrouter',
  },
  {
    modelId: 'mistralai/mistral-7b-instruct',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    provider: 'openrouter',
  },
  {
    modelId: 'microsoft/phi-3-mini-128k-instruct',
    tier: 'small',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    provider: 'openrouter',
  },
  {
    modelId: 'google/gemma-2-9b-it',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    provider: 'openrouter',
  },

  // ── Medium tier (13B-70B) ──
  {
    modelId: 'meta-llama/llama-3.1-70b-instruct',
    tier: 'medium',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'openrouter',
  },
  {
    modelId: 'mistralai/mixtral-8x22b-instruct',
    tier: 'medium',
    contextWindow: 65536,
    maxOutputTokens: 4096,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'openrouter',
  },
  {
    modelId: 'mistralai/mistral-small-latest',
    tier: 'medium',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'openrouter',
  },

  // ── Large tier (frontier models) ──
  {
    modelId: 'claude-opus-4-6',
    tier: 'large',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'anthropic',
  },
  {
    modelId: 'claude-sonnet-4-5-20250514',
    tier: 'large',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'anthropic',
  },
  {
    modelId: 'gpt-4.1',
    tier: 'large',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'openai',
  },
  {
    modelId: 'gemini-3.0-flash',
    tier: 'large',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    provider: 'google',
  },
];

// ── Model Tier Resolution ───────────────────────────────────────────────

/**
 * Resolve the model profile for a given model ID.
 * Falls back to heuristic detection for unknown models.
 */
export function resolveModelProfile(
  modelId: string,
  provider: AIProviderName,
  contextWindow?: number
): ModelProfile {
  // Check known models first
  const known = KNOWN_MODELS.find(m => m.modelId === modelId);
  if (known) return known;

  // Partial match (model ID might include version suffix)
  const partial = KNOWN_MODELS.find(m =>
    modelId.startsWith(m.modelId) || m.modelId.startsWith(modelId)
  );
  if (partial) return { ...partial, modelId };

  // Heuristic: infer tier from model name patterns
  const tier = inferTierFromModelId(modelId, provider);
  const inferredContextWindow = contextWindow || inferContextWindow(tier);

  logger.info(
    `[ModelTiers] Unknown model "${modelId}" — inferred tier: ${tier}, ` +
    `context: ${inferredContextWindow}`
  );

  return {
    modelId,
    tier,
    contextWindow: inferredContextWindow,
    maxOutputTokens: tier === 'small' ? 2048 : tier === 'medium' ? 4096 : 8192,
    supportsStructuredOutput: tier !== 'small',
    supportsToolCalling: tier !== 'small',
    provider,
  };
}

/**
 * Infer tier from model ID string patterns.
 */
function inferTierFromModelId(modelId: string, provider: AIProviderName): ModelTier {
  const lower = modelId.toLowerCase();

  // Small model signals
  if (
    lower.includes('3b') || lower.includes('7b') || lower.includes('8b') ||
    lower.includes('mini') || lower.includes('tiny') || lower.includes('nano') ||
    lower.includes('phi-3') || lower.includes('gemma-2')
  ) {
    return 'small';
  }

  // Medium model signals
  if (
    lower.includes('13b') || lower.includes('14b') || lower.includes('22b') ||
    lower.includes('34b') || lower.includes('70b') || lower.includes('mixtral') ||
    lower.includes('mistral-small') || lower.includes('mistral-medium')
  ) {
    return 'medium';
  }

  // Frontier providers default to large
  if (provider === 'anthropic' || provider === 'openai' || provider === 'google') {
    return 'large';
  }

  // Azure and Bedrock typically host large models
  if (provider === 'azure' || provider === 'bedrock') {
    return 'large';
  }

  // OpenRouter default to medium (could be anything)
  return 'medium';
}

function inferContextWindow(tier: ModelTier): number {
  switch (tier) {
    case 'small': return 8192;
    case 'medium': return 32768;
    case 'large': return 128000;
  }
}

// ── Feature Routing ─────────────────────────────────────────────────────

/**
 * Check if a model tier can handle a given feature.
 */
export function canModelHandleFeature(
  modelTier: ModelTier,
  feature: keyof FeatureRequirements,
  requirements: FeatureRequirements = DEFAULT_FEATURE_REQUIREMENTS
): boolean {
  const requiredComplexity = requirements[feature];
  const requiredTier = COMPLEXITY_TO_TIER[requiredComplexity];

  const tierRank: Record<ModelTier, number> = { small: 1, medium: 2, large: 3 };
  return tierRank[modelTier] >= tierRank[requiredTier];
}

/**
 * Get all features that a model tier can handle.
 */
export function getSupportedFeatures(
  modelTier: ModelTier,
  requirements: FeatureRequirements = DEFAULT_FEATURE_REQUIREMENTS
): (keyof FeatureRequirements)[] {
  const allFeatures = Object.keys(requirements) as (keyof FeatureRequirements)[];
  return allFeatures.filter(f => canModelHandleFeature(modelTier, f, requirements));
}

/**
 * Get the minimum required tier for a feature.
 */
export function getRequiredTier(
  feature: keyof FeatureRequirements,
  requirements: FeatureRequirements = DEFAULT_FEATURE_REQUIREMENTS
): ModelTier {
  return COMPLEXITY_TO_TIER[requirements[feature]];
}

// ── Prompt Complexity Hints ─────────────────────────────────────────────

export interface PromptHints {
  /** Use simplified JSON schema (fewer fields, no nested objects) */
  simplifyJsonOutput: boolean;
  /** Maximum system prompt length in characters */
  maxSystemPromptChars: number;
  /** Whether to include examples in the prompt */
  includeExamples: boolean;
  /** Whether to include chain-of-thought instructions */
  includeChainOfThought: boolean;
  /** Maximum context items (Jira issues, log lines, etc.) */
  maxContextItems: number;
  /** Maximum characters for code snippets / diffs in prompts */
  maxCodeSnippetChars: number;
}

/**
 * Get prompt construction hints based on model tier.
 */
export function getPromptHints(tier: ModelTier): PromptHints {
  switch (tier) {
    case 'small':
      return {
        simplifyJsonOutput: true,
        maxSystemPromptChars: 1500,
        includeExamples: false,
        includeChainOfThought: false,
        maxContextItems: 3,
        maxCodeSnippetChars: 300,
      };
    case 'medium':
      return {
        simplifyJsonOutput: false,
        maxSystemPromptChars: 3000,
        includeExamples: true,
        includeChainOfThought: false,
        maxContextItems: 5,
        maxCodeSnippetChars: 1000,
      };
    case 'large':
      return {
        simplifyJsonOutput: false,
        maxSystemPromptChars: 8000,
        includeExamples: true,
        includeChainOfThought: true,
        maxContextItems: 10,
        maxCodeSnippetChars: 3000,
      };
  }
}
