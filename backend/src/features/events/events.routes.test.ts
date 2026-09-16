jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    THIRDWEB_SECRET_KEY: 'test-thirdweb-secret',
    AUTH_DOMAIN: 'localhost:3000',
    PINATA_JWT: 'test-pinata-jwt',
    PINATA_GATEWAY: 'test.mypinata.cloud',
  },
}));

jest.mock('@/shared/utils/ipfs', () => ({
  uploadImageToIpfs: jest.fn().mockResolvedValue('QmMockPosterCID'),
  uploadJsonToIpfs: jest.fn().mockResolvedValue('QmMockMetadataCID'),
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
}));

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '@/app';
import { setupTestDb, teardownTestDb, clearTestDb } from '@/shared/models/__tests__/setup';
import { User } from '@/shared/models/user.model';
import { Event } from '@/shared/models/event.model';
import { signToken } from '@/shared/utils/jwt';

describe('Events API Endpoints (/api/events)', () => {
  let organizerToken: string;
  let buyerToken: string;
  let organizerId: string;

  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();

    const organizer = await User.create({
      walletAddress: '0x1111111111111111111111111111111111111111',
      email: 'organizer@test.com',
      name: 'Test Organizer',
      role: 'organizer',
    });
    organizerId = organizer._id.toString();

    organizerToken = signToken({
      sub: organizerId,
      walletAddress: organizer.walletAddress,
      role: 'organizer',
    });

    const buyer = await User.create({
      walletAddress: '0x2222222222222222222222222222222222222222',
      email: 'buyer@test.com',
      name: 'Test Buyer',
      role: 'buyer',
    });

    buyerToken = signToken({
      sub: buyer._id.toString(),
      walletAddress: buyer.walletAddress,
      role: 'buyer',
    });
  });

  describe('POST /api/events', () => {
    it('returns 401 Unauthorized if no Bearer token is provided', async () => {
      const res = await request(app).post('/api/events').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 Forbidden if user role is buyer', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Unauthorized Event',
          description: 'Buyer trying to create event',
          eventDate: new Date(Date.now() + 86400000).toISOString(),
          saleDeadline: new Date(Date.now() + 43200000).toISOString(),
          ticketPrice: 0.1,
          maxResalePrice: 0.2,
          totalCapacity: 100,
          posterCID: 'QmPosterCID',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 201 Created when authenticated as organizer with JSON posterCID payload', async () => {
      const payload = {
        name: 'Optimism DevCon 2026',
        description: 'Official developer conference for Optimism ecosystem.',
        eventDate: new Date(Date.now() + 86400000).toISOString(),
        saleDeadline: new Date(Date.now() + 43200000).toISOString(),
        ticketPrice: 0.05,
        maxResalePrice: 0.1,
        totalCapacity: 500,
        posterCID: 'QmPosterCID123',
      };

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Optimism DevCon 2026');
      expect(res.body.data.posterCID).toBe('QmPosterCID123');
      expect(res.body.data.metadataCID).toBe('QmMockMetadataCID');
    });

    it('returns 201 Created when authenticated as organizer with multipart/form-data file upload (.attach("poster", ...))', async () => {
      const fakeImageBuffer = Buffer.from('fake-png-data');
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .field('name', 'ETHDenver 2026')
        .field('description', 'The largest Web3 developer conference.')
        .field('eventDate', new Date(Date.now() + 86400000).toISOString())
        .field('saleDeadline', new Date(Date.now() + 43200000).toISOString())
        .field('ticketPrice', '0.08')
        .field('maxResalePrice', '0.15')
        .field('totalCapacity', '800')
        .attach('poster', fakeImageBuffer, { filename: 'poster.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('ETHDenver 2026');
      expect(res.body.data.posterCID).toBe('QmMockPosterCID');
      expect(res.body.data.metadataCID).toBe('QmMockMetadataCID');
    });
  });

  describe('GET /api/events', () => {
    it('returns 200 OK with paginated events list and pagination object', async () => {
      await Event.create({
        organizerId: new mongoose.Types.ObjectId(organizerId),
        name: 'Active Fest',
        description: 'Fun event for everyone with music and tech.',
        eventDate: new Date(Date.now() + 86400000),
        ticketPrice: 0.01,
        maxResalePrice: 0.02,
        saleDeadline: new Date(Date.now() + 43200000),
        totalCapacity: 100,
        remainingQuota: 100,
        posterCID: 'QmPoster',
        metadataCID: 'QmMeta',
        status: 'active',
      });

      const res = await request(app).get('/api/events');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBe(1);
      expect(res.body.data.events[0].name).toBe('Active Fest');
      expect(res.body.data.pagination).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('GET /api/events/:id', () => {
    it('returns 200 OK with event payload for valid event ID', async () => {
      const event = await Event.create({
        organizerId: new mongoose.Types.ObjectId(organizerId),
        name: 'Single ID Event',
        description: 'Detailed description here for single event lookup.',
        eventDate: new Date(Date.now() + 86400000),
        ticketPrice: 0.01,
        maxResalePrice: 0.02,
        saleDeadline: new Date(Date.now() + 43200000),
        totalCapacity: 100,
        remainingQuota: 100,
        posterCID: 'QmPosterSingle',
        metadataCID: 'QmMetaSingle',
        status: 'active',
      });

      const res = await request(app).get(`/api/events/${event._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Single ID Event');
      expect(res.body.data._id).toBe(event._id.toString());
    });

    it('returns 404 Not Found if event ID does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/events/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Event not found');
    });

    it('returns 400 Bad Request if ID format is an invalid MongoDB ObjectId', async () => {
      const res = await request(app).get('/api/events/invalid-mongo-id');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
