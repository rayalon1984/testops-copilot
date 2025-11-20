/**
 * AI Services - Main Export
 *
 * This file exports all AI-related functionality.
 * Use this as the single entry point for AI features.
 */

// Export types
export * from './types';

// Export configuration
export { getConfigManager, getConfig, isAIEnabled, isFeatureEnabled } from './config';

// Export providers
export { BaseProvider, ProviderConfig } from './providers/base.provider';
export { AnthropicProvider } from './providers/anthropic.provider';
export { OpenAIProvider } from './providers/openai.provider';
export {
  providerRegistry,
  getProvider,
  createProviderFromEnv,
  listAvailableProviders,
} from './providers/registry';

// Export vector database
export { WeaviateVectorClient, getVectorClient, closeVectorClient } from './vector/client';
export { VectorSearch, getVectorSearch } from './vector/search';
export * from './vector/schema';

// Export features
export { RCAMatchingService, RCAMatchingOptions } from './features/rca-matching';

// Export cache and cost tracking
export { AICache, getCache, closeCache } from './cache';
export { CostTracker, getCostTracker, UsageRecord } from './cost-tracker';

// Export main manager
export {
  AIManager,
  getAIManager,
  initializeAI,
  shutdownAI,
  AIManagerConfig,
} from './manager';
