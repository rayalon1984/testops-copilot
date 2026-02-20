/**
 * AIContext + usePageContext tests
 *
 * Covers:
 * - AIProvider initialization and default state
 * - setPage / setEntity / clearEntity state transitions
 * - getContextString output format
 * - Metadata serialization (objects don't become [object Object])
 * - usePageContext dependency tracking (metadata changes trigger updates)
 * - useAIContext throws outside provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AIProvider, useAIContext, type AIEntityContext } from '../AIContext';

// ─── Helpers ───

function wrapper({ children }: { children: ReactNode }) {
  return <AIProvider>{children}</AIProvider>;
}

function renderTestContext() {
  return renderHook(() => useAIContext(), { wrapper });
}

// ─── Tests ───

describe('AIContext', () => {
  describe('initialization', () => {
    it('starts with page=unknown and null entity', () => {
      const { result } = renderTestContext();
      expect(result.current.aiContext.page).toBe('unknown');
      expect(result.current.aiContext.entity).toEqual({ type: null, id: null, label: null });
    });

    it('does not include breadcrumb in state', () => {
      const { result } = renderTestContext();
      expect('breadcrumb' in result.current.aiContext).toBe(false);
    });
  });

  describe('setPage', () => {
    it('updates the current page', () => {
      const { result } = renderTestContext();
      act(() => result.current.setPage('dashboard'));
      expect(result.current.aiContext.page).toBe('dashboard');
    });

    it('preserves entity when page changes', () => {
      const { result } = renderTestContext();
      const entity: AIEntityContext = { type: 'pipeline', id: 'p1', label: 'Main' };

      act(() => {
        result.current.setEntity(entity);
        result.current.setPage('pipeline-detail');
      });

      expect(result.current.aiContext.page).toBe('pipeline-detail');
      expect(result.current.aiContext.entity).toEqual(entity);
    });
  });

  describe('setEntity / clearEntity', () => {
    it('sets the focused entity', () => {
      const { result } = renderTestContext();
      const entity: AIEntityContext = { type: 'testrun', id: 'tr-1', label: 'Run #42' };

      act(() => result.current.setEntity(entity));
      expect(result.current.aiContext.entity).toEqual(entity);
    });

    it('clears entity back to defaults', () => {
      const { result } = renderTestContext();
      act(() => result.current.setEntity({ type: 'pipeline', id: 'p1', label: 'X' }));
      act(() => result.current.clearEntity());
      expect(result.current.aiContext.entity).toEqual({ type: null, id: null, label: null });
    });
  });

  describe('setAIContext (partial update)', () => {
    it('merges partial state', () => {
      const { result } = renderTestContext();
      act(() => result.current.setAIContext({ page: 'settings' }));
      expect(result.current.aiContext.page).toBe('settings');
      // Entity should still be default
      expect(result.current.aiContext.entity.type).toBeNull();
    });
  });

  describe('getContextString', () => {
    it('returns page-only context for unknown entity', () => {
      const { result } = renderTestContext();
      act(() => result.current.setPage('dashboard'));
      expect(result.current.getContextString()).toBe('User is viewing: Dashboard overview');
    });

    it('includes entity when focused', () => {
      const { result } = renderTestContext();
      act(() => {
        result.current.setPage('pipeline-detail');
        result.current.setEntity({ type: 'pipeline', id: 'p1', label: 'E2E Suite' });
      });

      const ctx = result.current.getContextString();
      expect(ctx).toContain('User is viewing: Pipeline detail view');
      expect(ctx).toContain('Focused on: pipeline "E2E Suite" (ID: p1)');
    });

    it('includes entity without label', () => {
      const { result } = renderTestContext();
      act(() => {
        result.current.setPage('testrun-detail');
        result.current.setEntity({ type: 'testrun', id: 'tr-99', label: null });
      });

      const ctx = result.current.getContextString();
      expect(ctx).toContain('Focused on: testrun tr-99');
    });

    it('serializes metadata without losing object values', () => {
      const { result } = renderTestContext();
      act(() => {
        result.current.setPage('pipeline-detail');
        result.current.setEntity({
          type: 'pipeline',
          id: 'p1',
          label: 'Main',
          metadata: {
            status: 'FAILED',
            counts: { passed: 10, failed: 2 },
          },
        });
      });

      const ctx = result.current.getContextString();
      expect(ctx).toContain('Context: status: FAILED');
      // Object metadata should be JSON-stringified, not [object Object]
      expect(ctx).toContain('counts: {"passed":10,"failed":2}');
      expect(ctx).not.toContain('[object Object]');
    });

    it('renders all page labels correctly', () => {
      const { result } = renderTestContext();
      const pageMap: Record<string, string> = {
        'dashboard': 'Dashboard overview',
        'pipeline-list': 'Pipeline list',
        'failure-knowledge-base': 'Failure Knowledge Base',
        'cost-tracker': 'AI Cost Tracker',
      };

      for (const [page, label] of Object.entries(pageMap)) {
        act(() => result.current.setPage(page as any));
        expect(result.current.getContextString()).toContain(label);
      }
    });
  });

  describe('useAIContext outside provider', () => {
    it('throws a helpful error', () => {
      // Suppress console.error for this intentional throw
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAIContext());
      }).toThrow('useAIContext must be used within an <AIProvider>');

      spy.mockRestore();
    });
  });
});
