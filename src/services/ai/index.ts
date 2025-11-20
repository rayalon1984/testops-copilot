/**
 * AI Services - Main Export
 *
 * This file exports all AI-related functionality.
 * Use this as the single entry point for AI features.
 */

// Export types
export * from './types';

// Export services (will be implemented in future phases)
// export { aiService } from './manager';
// export { providerRegistry } from './providers/registry';
// export { vectorDB } from './vector/client';
// export { rcaMatching } from './features/rca-matching';

/**
 * AI Service initialization status
 */
export const AI_INITIALIZED = false;

/**
 * Check if AI features are enabled
 */
export function isAIEnabled(): boolean {
  return process.env.AI_ENABLED === 'true';
}

/**
 * Get configured AI provider
 */
export function getAIProvider(): string | null {
  return process.env.AI_PROVIDER || null;
}

/**
 * Placeholder for future initialization
 */
export async function initializeAI(): Promise<void> {
  if (!isAIEnabled()) {
    console.log('ℹ️  AI features are disabled');
    return;
  }

  console.log('🚀 AI Services initialization...');
  console.log(`   Provider: ${getAIProvider()}`);

  // TODO: Phase 0 - Implement actual initialization
  // - Load configuration
  // - Initialize provider
  // - Connect to vector DB
  // - Set up cost tracking

  console.log('ℹ️  AI initialization placeholder (Phase 0)');
}
