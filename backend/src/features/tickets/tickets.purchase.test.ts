jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long!!',
    THIRDWEB_SECRET_KEY: 'test-thirdweb-secret',
    AUTH_DOMAIN: 'localhost:3000',
    PINATA_JWT: 'test-pinata-jwt',
    PINATA_GATEWAY: 'test.mypinata.cloud',
    CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
    RELAYER_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    RPC_URL: 'http://127.0.0.1:8545',
  },
}));

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    mintTicketOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { app } from '@/app';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { env } from '@/config/env';
import { withRetry } from '@/shared/services/blockchain.service';

describe('POST /api/tickets/purchase Integration', () => {
  let mongoServer: MongoMemoryServer;
  const buyerWallet = '0x2222222222222222222222222222222222222222';
  let buyerToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Event.init();
    await Ticket.init();
    await Transaction.init();

    const userId = new mongoose.Types.ObjectId().toString();
    buyerToken = jwt.sign(
      {
        sub: userId,
        userId,
        walletAddress: buyerWallet,
        role: 'buyer',
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Event.deleteMany({});
    await Ticket.deleteMany({});
    await Transaction.deleteMany({});
    jest.clearAllMocks();
  });

  async function createEvent(remainingQuota = 5) {
    return Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      name: 'Festival 2026',
      description: 'Electric vibes',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.1,
      maxResalePrice: 0.2,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 10,
      remainingQuota,
      posterCID: 'QmPoster',
      metadataCID: 'ipfs://QmMeta',
      onChainEventId: 1,
      status: remainingQuota > 0 ? 'active' : 'soldout',
    });
  }

  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/tickets/purchase').send({ eventId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid eventId format', async () => {
    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: 'invalid-id' });

    expect(res.status).toBe(400);
  });

  it('should return 201 with tokenId and txHash upon successful purchase', async () => {
    const event = await createEvent(5);

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '1',
      txHash: '0xintegrationTxHash',
      blockNumber: 1000,
    });

    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: event._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokenId).toBe('1');
    expect(res.body.data.txHash).toBe('0xintegrationTxHash');
  });

  it('should return 400 if event is sold out', async () => {
    const event = await createEvent(0);

    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ eventId: event._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toContain('sold out');
  });
});
