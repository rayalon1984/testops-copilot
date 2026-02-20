/**
 * AIContext — Global AI awareness provider.
 *
 * Wraps the application so the AI Copilot always knows:
 * 1. What page the user is currently viewing
 * 2. What entity they're focused on (pipeline, test run, failure, etc.)
 * 3. Any additional metadata useful for contextual AI responses
 *
 * Pages call `setAIContext(...)` when they mount/update.
 * The AICopilot reads `aiContext` and injects it into every message.
 *
 * Uses a global React Context provider pattern for page-aware AI assistance.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

export type AIPageContext =
  | 'dashboard'
  | 'pipeline-list'
  | 'pipeline-detail'
  | 'testrun-list'
  | 'testrun-detail'
  | 'failure-knowledge-base'
  | 'cost-tracker'
  | 'notifications'
  | 'settings'
  | 'teams'
  | 'unknown';

export interface AIEntityContext {
  /** The type of entity the user is viewing */
  type: 'pipeline' | 'testrun' | 'failure' | 'team' | 'notification' | null;
  /** The entity ID (database ID or external key) */
  id: string | null;
  /** Human-readable label for display (e.g., pipeline name, test run name) */
  label: string | null;
  /** Optional extra metadata (status, result, etc.) */
  metadata?: Record<string, unknown>;
}

export interface AIContextState {
  /** Current page the user is on */
  page: AIPageContext;
  /** Entity the user is focused on (if any) */
  entity: AIEntityContext;
}

interface AIContextValue {
  /** Current AI context state */
  aiContext: AIContextState;
  /** Set the full context (typically called by page components on mount) */
  setAIContext: (ctx: Partial<AIContextState>) => void;
  /** Convenience: set just the page */
  setPage: (page: AIPageContext) => void;
  /** Convenience: set just the entity focus */
  setEntity: (entity: AIEntityContext) => void;
  /** Clear entity focus (e.g., when navigating away from a detail page) */
  clearEntity: () => void;
  /** Build a context string suitable for injecting into AI prompts */
  getContextString: () => string;
}

// ─── Default Values ───────────────────────────────────────────────────

const DEFAULT_ENTITY: AIEntityContext = { type: null, id: null, label: null };

const DEFAULT_STATE: AIContextState = {
  page: 'unknown',
  entity: DEFAULT_ENTITY,
};

const AIContextInstance = createContext<AIContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────

export function AIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AIContextState>(DEFAULT_STATE);

  const setAIContext = useCallback((ctx: Partial<AIContextState>) => {
    setState(prev => ({ ...prev, ...ctx }));
  }, []);

  const setPage = useCallback((page: AIPageContext) => {
    setState(prev => ({ ...prev, page }));
  }, []);

  const setEntity = useCallback((entity: AIEntityContext) => {
    setState(prev => ({ ...prev, entity }));
  }, []);

  const clearEntity = useCallback(() => {
    setState(prev => ({ ...prev, entity: DEFAULT_ENTITY }));
  }, []);

  const getContextString = useCallback((): string => {
    const parts: string[] = [];

    // Page context
    const pageLabels: Record<AIPageContext, string> = {
      dashboard: 'Dashboard overview',
      'pipeline-list': 'Pipeline list',
      'pipeline-detail': 'Pipeline detail view',
      'testrun-list': 'Test run list',
      'testrun-detail': 'Test run detail view',
      'failure-knowledge-base': 'Failure Knowledge Base',
      'cost-tracker': 'AI Cost Tracker',
      notifications: 'Notifications',
      settings: 'Settings',
      teams: 'Team management',
      unknown: 'Application',
    };

    parts.push(`User is viewing: ${pageLabels[state.page]}`);

    // Entity context
    if (state.entity.type && state.entity.id) {
      const entityDesc = state.entity.label
        ? `${state.entity.type} "${state.entity.label}" (ID: ${state.entity.id})`
        : `${state.entity.type} ${state.entity.id}`;
      parts.push(`Focused on: ${entityDesc}`);

      if (state.entity.metadata) {
        const meta = Object.entries(state.entity.metadata)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join(', ');
        parts.push(`Context: ${meta}`);
      }
    }

    return parts.join('. ');
  }, [state]);

  return (
    <AIContextInstance.Provider value={{ aiContext: state, setAIContext, setPage, setEntity, clearEntity, getContextString }}>
      {children}
    </AIContextInstance.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAIContext(): AIContextValue {
  const ctx = useContext(AIContextInstance);
  if (!ctx) {
    throw new Error('useAIContext must be used within an <AIProvider>');
  }
  return ctx;
}
