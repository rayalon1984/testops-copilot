/**
 * usePageContext hook tests
 *
 * Covers:
 * - Page registration on mount
 * - Entity registration and cleanup
 * - Metadata changes trigger context updates (the fixed dependency array bug)
 * - Null entity clears context
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { AIProvider, useAIContext, type AIEntityContext } from '../../contexts/AIContext';
import { usePageContext } from '../usePageContext';

// ─── Helpers ───

function wrapper({ children }: { children: ReactNode }) {
  return <AIProvider>{children}</AIProvider>;
}

/** Render usePageContext and also expose the context state for assertions. */
function renderPageContext(
  page: Parameters<typeof usePageContext>[0],
  entity?: Parameters<typeof usePageContext>[1],
) {
  return renderHook(
    ({ page, entity }) => {
      usePageContext(page, entity);
      return useAIContext();
    },
    {
      wrapper,
      initialProps: { page, entity },
    },
  );
}

// ─── Tests ───

describe('usePageContext', () => {
  it('sets the page on mount', () => {
    const { result } = renderPageContext('dashboard');
    expect(result.current.aiContext.page).toBe('dashboard');
  });

  it('sets entity when provided', () => {
    const entity: AIEntityContext = { type: 'pipeline', id: 'p1', label: 'Main Pipeline' };
    const { result } = renderPageContext('pipeline-detail', entity);

    expect(result.current.aiContext.entity.type).toBe('pipeline');
    expect(result.current.aiContext.entity.id).toBe('p1');
    expect(result.current.aiContext.entity.label).toBe('Main Pipeline');
  });

  it('clears entity when null is passed', () => {
    const entity: AIEntityContext = { type: 'pipeline', id: 'p1', label: 'Test' };
    const { result, rerender } = renderPageContext('pipeline-detail', entity);

    expect(result.current.aiContext.entity.type).toBe('pipeline');

    // Navigate away — entity becomes null
    rerender({ page: 'pipeline-list', entity: null });
    expect(result.current.aiContext.entity.type).toBeNull();
    expect(result.current.aiContext.entity.id).toBeNull();
  });

  it('clears entity when undefined is passed', () => {
    const entity: AIEntityContext = { type: 'testrun', id: 'tr-1', label: 'Run' };
    const { result, rerender } = renderPageContext('testrun-detail', entity);

    expect(result.current.aiContext.entity.type).toBe('testrun');

    rerender({ page: 'testrun-list', entity: undefined });
    expect(result.current.aiContext.entity.type).toBeNull();
  });

  it('updates page when it changes', () => {
    const { result, rerender } = renderPageContext('dashboard');
    expect(result.current.aiContext.page).toBe('dashboard');

    rerender({ page: 'settings', entity: undefined });
    expect(result.current.aiContext.page).toBe('settings');
  });

  it('detects metadata changes on the same entity (regression test for dependency array bug)', () => {
    // Start with entity having status: RUNNING
    const entityV1: AIEntityContext = {
      type: 'pipeline',
      id: 'p1',
      label: 'Main',
      metadata: { status: 'RUNNING' },
    };
    const { result, rerender } = renderPageContext('pipeline-detail', entityV1);

    expect(result.current.aiContext.entity.metadata).toEqual({ status: 'RUNNING' });

    // Same type/id/label, but metadata changes to FAILED
    // Before the fix, this would NOT trigger an update because
    // the dependency array only checked type/id/label
    const entityV2: AIEntityContext = {
      type: 'pipeline',
      id: 'p1',
      label: 'Main',
      metadata: { status: 'FAILED', errorCount: 5 },
    };
    rerender({ page: 'pipeline-detail', entity: entityV2 });

    expect(result.current.aiContext.entity.metadata).toEqual({
      status: 'FAILED',
      errorCount: 5,
    });
  });

  it('handles entity with missing optional fields', () => {
    const entity: AIEntityContext = { type: 'failure', id: 'f-1', label: null };
    const { result } = renderPageContext('failure-knowledge-base', entity);

    expect(result.current.aiContext.entity.type).toBe('failure');
    expect(result.current.aiContext.entity.label).toBeNull();
  });
});
