import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';

// Mock config before importing csrf middleware
jest.mock('../../config', () => ({
  config: {
    security: {
      csrfSecret: 'test-csrf-secret-must-be-at-least-32-characters-long',
      secureCookie: false,
    },
  },
}));

import { doubleCsrfProtection, csrfTokenHandler } from '../csrf';

function createApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: 'test-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }));
  app.get('/api/v1/csrf-token', csrfTokenHandler);
  app.use(doubleCsrfProtection);
  app.post('/api/v1/test', (_req, res) => res.json({ success: true }));
  app.put('/api/v1/test', (_req, res) => res.json({ success: true }));
  app.delete('/api/v1/test', (_req, res) => res.json({ success: true }));
  app.get('/api/v1/test', (_req, res) => res.json({ success: true }));

  // Simulated webhook route (should bypass CSRF)
  app.post('/api/v1/channels/slack/events', (_req, res) => res.json({ ok: true }));

  // Error handler — csrf-csrf throws HttpError which Express needs to handle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || err.status || 500).json({
      message: err.message,
      code: err.code,
    });
  });

  return app;
}

describe('CSRF Protection', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('token endpoint', () => {
    it('should return a CSRF token', async () => {
      const res = await request(app)
        .get('/api/v1/csrf-token')
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
    });
  });

  describe('state-changing requests', () => {
    it('should reject POST without CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/test')
        .send({ data: 'test' });

      expect(res.status).toBe(403);
    });

    it('should reject PUT without CSRF token', async () => {
      const res = await request(app)
        .put('/api/v1/test')
        .send({ data: 'test' });

      expect(res.status).toBe(403);
    });

    it('should reject DELETE without CSRF token', async () => {
      const res = await request(app)
        .delete('/api/v1/test');

      expect(res.status).toBe(403);
    });

    it('should accept POST with valid CSRF token', async () => {
      const agent = request.agent(app);

      // Step 1: Get CSRF token (sets cookie)
      const tokenRes = await agent
        .get('/api/v1/csrf-token')
        .expect(200);

      const token = tokenRes.body.token;

      // Step 2: POST with the token header
      const res = await agent
        .post('/api/v1/test')
        .set('X-CSRF-Token', token)
        .send({ data: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject POST with invalid CSRF token', async () => {
      const agent = request.agent(app);

      // Get a valid session first
      await agent.get('/api/v1/csrf-token');

      const res = await agent
        .post('/api/v1/test')
        .set('X-CSRF-Token', 'invalid-token')
        .send({ data: 'test' });

      expect(res.status).toBe(403);
    });
  });

  describe('safe methods', () => {
    it('should allow GET requests without CSRF token', async () => {
      const res = await request(app)
        .get('/api/v1/test')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('webhook bypass', () => {
    it('should skip CSRF validation for channel webhook routes', async () => {
      const res = await request(app)
        .post('/api/v1/channels/slack/events')
        .send({ type: 'url_verification', challenge: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
