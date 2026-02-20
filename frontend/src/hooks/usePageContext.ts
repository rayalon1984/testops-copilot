/**
 * usePageContext — Convenience hook for pages to report their context to the AI.
 *
 * Usage:
 *   usePageContext('dashboard');
 *   usePageContext('pipeline-detail', { type: 'pipeline', id: pipeline.id, label: pipeline.name });
 *
 * The entity is tracked via JSON serialization so that metadata changes
 * (e.g. status updates) correctly propagate to the AI context.
 */

import { useEffect } from 'react';
import { useAIContext, type AIPageContext, type AIEntityContext } from '../contexts/AIContext';

export function usePageContext(
  page: AIPageContext,
  entity?: AIEntityContext | null,
) {
  const { setPage, setEntity, clearEntity } = useAIContext();

  useEffect(() => {
    setPage(page);
  }, [page, setPage]);

  // Serialize entity to detect any property change (including metadata)
  const entityKey = entity ? JSON.stringify(entity) : null;

  useEffect(() => {
    if (entity && entity.type && entity.id) {
      setEntity(entity);
    } else {
      clearEntity();
    }
    // entityKey covers all entity property changes; entity ref is stable within a render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, setEntity, clearEntity]);
}
