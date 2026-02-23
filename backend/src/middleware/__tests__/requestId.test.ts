import express from 'express';
import request from 'supertest';
import { requestIdMiddleware } from '../requestId';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createApp(): express.Application {
  const app = express();
  app.use(requestIdMiddleware);
  app.get('/test', (req, res) => {
    res.json({ requestId: req.requestId });
  });
  return app;
}

describe('requestIdMiddleware', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  it('should generate a UUID v4 when no X-Request-ID header is provided', async () => {
    const res = await request(app).get('/test').expect(200);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('should reuse a valid UUID from X-Request-ID header', async () => {
    const upstreamId = '550e8400-e29b-41d4-a716-446655440000';

    const res = await request(app)
      .get('/test')
      .set('X-Request-ID', upstreamId)
      .expect(200);

    expect(res.headers['x-request-id']).toBe(upstreamId);
    expect(res.body.requestId).toBe(upstreamId);
  });

  it('should reject non-UUID X-Request-ID and generate a new one', async () => {
    const res = await request(app)
      .get('/test')
      .set('X-Request-ID', 'not-a-uuid')
      .expect(200);

    expect(res.headers['x-request-id']).not.toBe('not-a-uuid');
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('should reject X-Request-ID with injection attempt', async () => {
    const res = await request(app)
      .get('/test')
      .set('X-Request-ID', '<script>alert(1)</script>')
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(UUID_RE);
    expect(res.headers['x-request-id']).not.toContain('<script>');
  });

  it('should generate unique IDs for different requests', async () => {
    const res1 = await request(app).get('/test').expect(200);
    const res2 = await request(app).get('/test').expect(200);

    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});
