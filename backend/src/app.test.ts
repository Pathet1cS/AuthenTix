// The app's import graph reaches @/config/env, which exits the process on an
// incomplete environment. Mock it so the suite never depends on a local .env.
jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    THIRDWEB_SECRET_KEY: 'test-thirdweb-secret',
    AUTH_DOMAIN: 'localhost:3000',
  },
}));

import request from 'supertest';
import { app } from './app';

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});

describe('unknown routes', () => {
  it('returns 404 with error shape', async () => {
    const res = await request(app).get('/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: expect.any(String) });
  });
});
