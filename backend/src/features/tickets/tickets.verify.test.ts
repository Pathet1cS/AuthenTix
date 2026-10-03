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
    ownerOfOnChain: jest.fn(),
    markUsedOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

import request from 'supertest';
import { Wallet } from 'ethers';
import { app } from '@/app';
import { setupTestDb, teardownTestDb, clearTestDb } from '@/shared/models/__tests__/setup';
import { User } from '@/shared/models/user.model';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { signToken } from '@/shared/utils/jwt';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';
import { serializeQrPayload } from './tickets.validation';
import mongoose from 'mongoose';

describe('POST /api/tickets/verify', () => {
  let organizerToken: string;
  let buyerToken: string;
  const holderWallet = Wallet.createRandom();

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
    organizerToken = signToken({
      sub: organizer._id.toString(),
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

  async function createTestTicket(tokenId: string, overrides = {}) {
    const event = await Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      name: 'Gate Test Fest',
      description: 'A concert to scan tickets at',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.05,
      maxResalePrice: 0.08,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 100,
      remainingQuota: 50,
      posterCID: 'QmPoster',
      metadataCID: 'ipfs://QmMetadata',
      onChainEventId: 1,
      status: 'active',
    });

    return Ticket.create({
      tokenId,
      eventId: event._id,
      ownerWallet: holderWallet.address,
      tokenURI: 'ipfs://QmTicket',
      mintTxHash: '0xminttx',
      blockNumber: 100,
      isUsed: false,
      ...overrides,
    });
  }

  async function buildSignedPayload(overrides: Record<string, unknown> = {}) {
    const payload = {
      tokenId: '900',
      walletAddress: holderWallet.address,
      nonce: `nonce-${Math.random().toString(36).slice(2)}`,
      expiresAt: Math.floor((Date.now() + 10_000) / 1000),
      ...overrides,
    };
    const signature = await holderWallet.signMessage(
      serializeQrPayload(payload as any),
    );
    return { ...payload, signature };
  }

  it('should return 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/tickets/verify').send(await buildSignedPayload());
    expect(res.status).toBe(401);
  });

  it('should return 403 when the caller is a buyer, not an organizer/admin', async () => {
    await createTestTicket('900');
    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(await buildSignedPayload());

    expect(res.status).toBe(403);
  });

  it('should return 400 on a malformed body', async () => {
    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ tokenId: '', walletAddress: 'not-an-address' });

    expect(res.status).toBe(400);
  });

  it('should redeem a valid ticket when scanned by an organizer', async () => {
    await createTestTicket('900');
    (blockchainService.ownerOfOnChain as jest.Mock).mockResolvedValue(
      holderWallet.address.toLowerCase(),
    );
    (withRetry as jest.Mock).mockResolvedValue({
      txHash: '0xredeemtx',
      blockNumber: 555,
      alreadyUsed: false,
    });

    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(await buildSignedPayload());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isUsed).toBe(true);
    expect(res.body.data.txHash).toBe('0xredeemtx');

    const ticket = await Ticket.findOne({ tokenId: '900' });
    expect(ticket?.isUsed).toBe(true);
  });

  it('should return 409 when the ticket was already used', async () => {
    await createTestTicket('900', { isUsed: true, usedAt: new Date() });

    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(await buildSignedPayload());

    expect(res.status).toBe(409);
  });

  it('should return 401 when the QR code has expired', async () => {
    await createTestTicket('900');

    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(await buildSignedPayload({ expiresAt: Math.floor((Date.now() - 1000) / 1000) }));

    expect(res.status).toBe(401);
  });

  it('should return 401 when the same nonce is replayed', async () => {
    await createTestTicket('900');
    (blockchainService.ownerOfOnChain as jest.Mock).mockResolvedValue(
      holderWallet.address.toLowerCase(),
    );
    (withRetry as jest.Mock).mockResolvedValue({
      txHash: '0xredeemtx',
      blockNumber: 555,
      alreadyUsed: false,
    });

    const payload = await buildSignedPayload();

    const first = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(payload);
    expect(first.status).toBe(200);

    // Reset the ticket so a replay would otherwise succeed on every check
    // except the nonce, isolating what we're asserting.
    await Ticket.findOneAndUpdate({ tokenId: '900' }, { isUsed: false, usedAt: null });

    const second = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send(payload);
    expect(second.status).toBe(401);
  });

  it('should return 403 when the signature does not match the wallet claimed', async () => {
    await createTestTicket('900');
    const otherWallet = Wallet.createRandom();
    const payload = await buildSignedPayload();
    // Swap in a signature from a different wallet than the one claimed.
    const forgedSignature = await otherWallet.signMessage(
      serializeQrPayload(payload as any),
    );

    const res = await request(app)
      .post('/api/tickets/verify')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ ...payload, signature: forgedSignature });

    expect(res.status).toBe(401);
  });
});
