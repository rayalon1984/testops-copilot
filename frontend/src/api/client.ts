/**
 * Centralized API Client
 *
 * Single source of truth for all HTTP calls to the backend.
 * Eliminates duplicated localStorage.getItem('accessToken') calls (was 37+)
 * and provides consistent auth headers, error handling, and typing.
 *
 * Usage with react-query:
 *   import { api } from '../api/client';
 *   import type { ApiSchemas } from '../api';
 *
 *   const { data } = useQuery<ApiSchemas['Pipeline'][]>({
 *     queryKey: ['pipelines'],
 *     queryFn: () => api.get('/pipelines'),
 *   });
 */

const API_BASE = '/api/v1';

// ─── Error class ───

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── CSRF token management ───

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
  const data = await res.json();
  csrfToken = data.token as string;
  return csrfToken;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─── Auth helpers ───

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

function buildHeaders(customHeaders?: HeadersInit, method?: string): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...customHeaders,
  });

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Attach CSRF token on state-changing requests
  if (csrfToken && STATE_CHANGING_METHODS.has(method ?? '')) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  return headers;
}

// ─── Core fetch wrapper ───

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { rawResponse?: boolean },
  _csrfRetried = false,
): Promise<T> {
  const { rawResponse, headers: customHeaders, ...fetchOptions } = options || {};
  const method = fetchOptions.method ?? 'GET';

  // Ensure CSRF token is available before state-changing requests
  if (STATE_CHANGING_METHODS.has(method) && !csrfToken) {
    await fetchCsrfToken();
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: buildHeaders(customHeaders as HeadersInit | undefined, method),
    credentials: 'include',
  });

  if (!response.ok) {
    // On 401, clear token — let the caller (AuthContext) decide on redirect
    if (response.status === 401) {
      localStorage.removeItem('accessToken');
    }

    // On 403 with CSRF error, refresh token and retry once
    if (response.status === 403 && !_csrfRetried) {
      const body = await response.json().catch(() => ({}));
      if (body.code === 'CSRF_INVALID' || body.message?.includes('CSRF')) {
        await fetchCsrfToken();
        return apiFetch<T>(path, options, true);
      }
      throw new ApiError(response.status, body.message || 'Forbidden', body);
    }

    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(
      response.status,
      body.message || body.error || 'Request failed',
      body,
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Caller wants the raw Response (e.g., for SSE streams)
  if (rawResponse) {
    return response as unknown as T;
  }

  return response.json();
}

// ─── Public API ───

export const api = {
  get: <T>(path: string) =>
    apiFetch<T>(path),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
