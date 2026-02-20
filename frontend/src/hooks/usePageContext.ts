/**
 * usePageContext — Convenience hook for pages to report their context to the AI.
 *
 * Usage:
 *   usePageContext('dashboard');
 *   usePageContext('pipeline-detail', { type: 'pipeline', id: pipeline.id, label: pipeline.name });
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

  useEffect(() => {
    if (entity && entity.type && entity.id) {
      setEntity(entity);
    } else {
      clearEntity();
    }
  }, [entity?.type, entity?.id, entity?.label, setEntity, clearEntity]);
}
