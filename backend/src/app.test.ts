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
