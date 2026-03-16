/**
 * Chat route — uiContext wiring tests
 *
 * Verifies that:
 * 1. uiContext is extracted from the request body
 * 2. uiContext is passed through to handleChatStream
 * 3. Non-string uiContext is ignored
 * 4. Missing uiContext defaults to undefined
 */

jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({ autonomyLevel: 'balanced' }),
    },
  },
}));

jest.mock('@/middleware/validation', () => ({
  __esModule: true,
  validateChatMessage: (_req: any, _res: any, next: any) => next(),
  validateConfirmAction: (_req: any, _res: any, next: any) => next(),
}));

// Capture the ChatRequest passed to handleChatStream
const mockHandleChatStream = jest.fn().mockImplementation(async (_req: any, res: any) => {
  res.end();
});

jest.mock('@/services/ai/AIChatService', () => ({
  __esModule: true,
  handleChatStream: (...args: unknown[]) => mockHandleChatStream(...args),
}));

jest.mock('@/services/ai/ChatSessionService', () => ({
  __esModule: true,
}));

jest.mock('@/services/ai/ConfirmationService', () => ({
  __esModule: true,
}));

jest.mock('@/services/ai/tools', () => ({
  __esModule: true,
  toolRegistry: { get: jest.fn() },
}));

jest.mock('@/services/ai/config', () => ({
  __esModule: true,
  getConfigManager: () => ({ getProvider: () => 'mock' }),
}));

jest.mock('@/services/ai/mock-tool-results', () => ({
  __esModule: true,
  getMockToolResult: jest.fn(),
}));

jest.mock('@/services/ai/user-provider-config.service', () => ({
  __esModule: true,
  createProviderForUser: jest.fn().mockResolvedValue(null),
}));

import { Request, Response } from 'express';

// Dynamic import after mocks
let router: any;

beforeAll(async () => {
  const mod = await import('../chat');
  router = mod.default;
});

function createMockReqRes(body: Record<string, unknown>) {
  const req = {
    body,
    user: { id: 'user-1', role: 'admin' },
  } as unknown as Request;

  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    headersSent: false,
    writableEnded: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  return { req, res };
}

describe('POST /chat — uiContext passthrough', () => {
  beforeEach(() => {
    mockHandleChatStream.mockClear();
  });

  it('passes uiContext string to handleChatStream', async () => {
    const { req, res } = createMockReqRes({
      message: 'What tests failed?',
      uiContext: 'User is viewing: Dashboard overview',
    });

    // Find the POST /chat handler from the router
    const chatHandler = findRouteHandler(router, 'post', '/chat');
    await chatHandler(req, res, jest.fn());

    expect(mockHandleChatStream).toHaveBeenCalledTimes(1);
    const chatReq = mockHandleChatStream.mock.calls[0][0];
    expect(chatReq.uiContext).toBe('User is viewing: Dashboard overview');
  });

  it('sets uiContext to undefined when not provided', async () => {
    const { req, res } = createMockReqRes({
      message: 'Hello',
    });

    const chatHandler = findRouteHandler(router, 'post', '/chat');
    await chatHandler(req, res, jest.fn());

    expect(mockHandleChatStream).toHaveBeenCalledTimes(1);
    const chatReq = mockHandleChatStream.mock.calls[0][0];
    expect(chatReq.uiContext).toBeUndefined();
  });

  it('ignores non-string uiContext values', async () => {
    const { req, res } = createMockReqRes({
      message: 'Hello',
      uiContext: 42, // Not a string
    });

    const chatHandler = findRouteHandler(router, 'post', '/chat');
    await chatHandler(req, res, jest.fn());

    expect(mockHandleChatStream).toHaveBeenCalledTimes(1);
    const chatReq = mockHandleChatStream.mock.calls[0][0];
    expect(chatReq.uiContext).toBeUndefined();
  });
});

/**
 * Extract a route handler from an Express Router.
 * Express stores routes internally in router.stack.
 */
function findRouteHandler(
  router: any,
  method: string,
  path: string,
): (req: Request, res: Response, next: any) => Promise<void> {
  const layer = router.stack?.find((l: any) => {
    if (!l.route) return false;
    return l.route.path === path && l.route.methods[method];
  });

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found in router`);
  }

  // The last handler in the route stack is the actual handler (after middleware)
  const handlers = layer.route.stack.map((s: any) => s.handle);
  // Return the last handler (skip validation middleware which we've mocked)
  return handlers[handlers.length - 1];
}
