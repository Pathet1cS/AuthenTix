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
    verifyListingCreatedOnChain: jest.fn(),
    verifyListingCancelledOnChain: jest.fn(),
    verifyListingSoldOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { app } from '@/app';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { env } from '@/config/env';
import { blockchainService } from '@/shared/services/blockchain.service';

describe('Tickets Resale & Management Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const userWallet = '0x2222222222222222222222222222222222222222';
  const otherWallet = '0x3333333333333333333333333333333333333333';
  let userToken: string;
  let otherToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Event.init();
    await Ticket.init();
    await Transaction.init();

    const userId = new mongoose.Types.ObjectId().toString();
    userToken = jwt.sign(
      {
        sub: userId,
        userId,
        walletAddress: userWallet,
        role: 'buyer',
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const otherId = new mongoose.Types.ObjectId().toString();
    otherToken = jwt.sign(
      {
        sub: otherId,
        userId: otherId,
        walletAddress: otherWallet,
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

  async function createTestEvent(overrides = {}) {
    return Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      name: 'Resale Fest 2026',
      description: 'An awesome music festival',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.05,
      maxResalePrice: 0.08,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 100,
      remainingQuota: 50,
      posterCID: 'QmPoster',
      metadataCID: 'ipfs://QmMetadata',
      onChainEventId: 10,
      status: 'active',
      ...overrides,
    });
  }

  describe('GET /api/tickets/my', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/tickets/my');
      expect(res.status).toBe(401);
    });

    it('should return tickets owned by authenticated user with populated event details', async () => {
      const event = await createTestEvent();
      await Ticket.create([
        {
          tokenId: '1',
          eventId: event._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm1',
          mintTxHash: '0xmint1',
          blockNumber: 100,
          isUsed: false,
          isListed: false,
        },
        {
          tokenId: '2',
          eventId: event._id,
          ownerWallet: otherWallet,
          tokenURI: 'ipfs://Qm2',
          mintTxHash: '0xmint2',
          blockNumber: 101,
          isUsed: false,
          isListed: false,
        },
      ]);

      const res = await request(app)
        .get('/api/tickets/my')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets.length).toBe(1);
      expect(res.body.data.tickets[0].tokenId).toBe('1');
      expect(res.body.data.tickets[0].eventId.name).toBe('Resale Fest 2026');
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('should filter by status parameter: active, resale, used', async () => {
      const event = await createTestEvent();
      await Ticket.create([
        {
          tokenId: '10',
          eventId: event._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm10',
          mintTxHash: '0x10',
          blockNumber: 100,
          isUsed: false,
          isListed: false,
        },
        {
          tokenId: '11',
          eventId: event._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm11',
          mintTxHash: '0x11',
          blockNumber: 100,
          isUsed: false,
          isListed: true,
          resalePrice: 0.07,
        },
        {
          tokenId: '12',
          eventId: event._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm12',
          mintTxHash: '0x12',
          blockNumber: 100,
          isUsed: true,
          usedAt: new Date(),
          isListed: false,
        },
      ]);

      const activeRes = await request(app)
        .get('/api/tickets/my?status=active')
        .set('Authorization', `Bearer ${userToken}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.tickets.length).toBe(1);
      expect(activeRes.body.data.tickets[0].tokenId).toBe('10');

      const resaleRes = await request(app)
        .get('/api/tickets/my?status=resale')
        .set('Authorization', `Bearer ${userToken}`);
      expect(resaleRes.status).toBe(200);
      expect(resaleRes.body.data.tickets.length).toBe(1);
      expect(resaleRes.body.data.tickets[0].tokenId).toBe('11');

      const usedRes = await request(app)
        .get('/api/tickets/my?status=used')
        .set('Authorization', `Bearer ${userToken}`);
      expect(usedRes.status).toBe(200);
      expect(usedRes.body.data.tickets.length).toBe(1);
      expect(usedRes.body.data.tickets[0].tokenId).toBe('12');
    });
  });

  describe('POST /api/tickets/resell', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/tickets/resell').send({
        tokenId: '1',
        price: 0.06,
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 on invalid payload', async () => {
      const res = await request(app)
        .post('/api/tickets/resell')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tokenId: '',
          price: -1,
          txHash: 'invalid-hash',
        });
      expect(res.status).toBe(400);
    });

    it('should successfully list ticket for resale upon valid receipt', async () => {
      const event = await createTestEvent({ maxResalePrice: 0.08 });
      await Ticket.create({
        tokenId: '20',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm20',
        mintTxHash: '0xmint20',
        blockNumber: 100,
        isUsed: false,
        isListed: false,
      });

      (blockchainService.verifyListingCreatedOnChain as jest.Mock).mockResolvedValue({
        blockNumber: 120,
      });

      const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const res = await request(app)
        .post('/api/tickets/resell')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tokenId: '20',
          price: 0.07,
          txHash,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isListed).toBe(true);
      expect(res.body.data.resalePrice).toBe(0.07);

      const ticketInDb = await Ticket.findOne({ tokenId: '20' });
      expect(ticketInDb?.isListed).toBe(true);
      expect(ticketInDb?.resalePrice).toBe(0.07);
      expect(ticketInDb?.listingTxHash).toBe(txHash);

      const txInDb = await Transaction.findOne({ txHash });
      expect(txInDb).toBeTruthy();
      expect(txInDb?.type).toBe('resell');
      expect(txInDb?.fromWallet).toBe(userWallet.toLowerCase());
      expect(txInDb?.price).toBe(0.07);
    });

    it('should return 403 when user does not own the ticket', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '21',
        eventId: event._id,
        ownerWallet: otherWallet,
        tokenURI: 'ipfs://Qm21',
        mintTxHash: '0xmint21',
        blockNumber: 100,
      });

      const res = await request(app)
        .post('/api/tickets/resell')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tokenId: '21',
          price: 0.06,
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 when price exceeds maxResalePrice cap', async () => {
      const event = await createTestEvent({ maxResalePrice: 0.06 });
      await Ticket.create({
        tokenId: '22',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm22',
        mintTxHash: '0xmint22',
        blockNumber: 100,
      });

      const res = await request(app)
        .post('/api/tickets/resell')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tokenId: '22',
          price: 0.09,
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Resale price exceeds maximum allowed cap');
    });

    it('should return 409 when ticket is already listed', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '23',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm23',
        mintTxHash: '0xmint23',
        blockNumber: 100,
        isListed: true,
        resalePrice: 0.06,
      });

      const res = await request(app)
        .post('/api/tickets/resell')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tokenId: '23',
          price: 0.06,
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/tickets/resell/:tokenId', () => {
    it('should successfully cancel resale listing and reset ticket state', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '30',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm30',
        mintTxHash: '0xmint30',
        blockNumber: 100,
        isListed: true,
        resalePrice: 0.07,
        listingTxHash: '0xlisttx30',
      });

      (blockchainService.verifyListingCancelledOnChain as jest.Mock).mockResolvedValue({
        blockNumber: 130,
      });

      const txHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const res = await request(app)
        .delete('/api/tickets/resell/30')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ txHash });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isListed).toBe(false);
      expect(res.body.data.resalePrice).toBeNull();

      const ticketInDb = await Ticket.findOne({ tokenId: '30' });
      expect(ticketInDb?.isListed).toBe(false);
      expect(ticketInDb?.resalePrice).toBeNull();
      expect(ticketInDb?.listingTxHash).toBe('');
    });

    it('should return 400 if ticket is not currently listed', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '31',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm31',
        mintTxHash: '0xmint31',
        blockNumber: 100,
        isListed: false,
      });

      const res = await request(app)
        .delete('/api/tickets/resell/31')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ txHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/tickets/resell/purchase', () => {
    it('should synchronize resale purchase, transfer owner, and create transaction audit log', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '40',
        eventId: event._id,
        ownerWallet: userWallet,
        tokenURI: 'ipfs://Qm40',
        mintTxHash: '0xmint40',
        blockNumber: 100,
        isListed: true,
        resalePrice: 0.07,
      });

      (blockchainService.verifyListingSoldOnChain as jest.Mock).mockResolvedValue({
        sellerWallet: userWallet,
        priceWei: ethers.parseEther('0.07'),
        blockNumber: 140,
      });

      const txHash = '0x9999999999999999999999999999999999999999999999999999999999999999';
      const res = await request(app)
        .post('/api/tickets/resell/purchase')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          tokenId: '40',
          txHash,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ownerWallet).toBe(otherWallet.toLowerCase());
      expect(res.body.data.isListed).toBe(false);

      const ticketInDb = await Ticket.findOne({ tokenId: '40' });
      expect(ticketInDb?.ownerWallet).toBe(otherWallet.toLowerCase());
      expect(ticketInDb?.isListed).toBe(false);
      expect(ticketInDb?.lastTransferTxHash).toBe(txHash);

      const txInDb = await Transaction.findOne({ txHash });
      expect(txInDb).toBeTruthy();
      expect(txInDb?.type).toBe('resell');
      expect(txInDb?.fromWallet).toBe(userWallet.toLowerCase());
      expect(txInDb?.toWallet).toBe(otherWallet.toLowerCase());
      expect(txInDb?.price).toBe(0.07);
    });
  });

  describe('GET /api/tickets/resale', () => {
    it('should be accessible publicly and return only active resale listings', async () => {
      const event1 = await createTestEvent({ name: 'Fest Alpha', onChainEventId: 1001 });
      const event2 = await createTestEvent({ name: 'Fest Beta', onChainEventId: 1002 });

      await Ticket.create([
        {
          tokenId: '50',
          eventId: event1._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm50',
          mintTxHash: '0x50',
          blockNumber: 100,
          isListed: true,
          resalePrice: 0.05,
        },
        {
          tokenId: '51',
          eventId: event1._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm51',
          mintTxHash: '0x51',
          blockNumber: 100,
          isListed: true,
          resalePrice: 0.08,
        },
        {
          tokenId: '52',
          eventId: event2._id,
          ownerWallet: userWallet,
          tokenURI: 'ipfs://Qm52',
          mintTxHash: '0x52',
          blockNumber: 100,
          isListed: false,
        },
      ]);

      const res = await request(app).get('/api/tickets/resale?sortBy=price_asc');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.listings.length).toBe(2);
      expect(res.body.data.listings[0].tokenId).toBe('50');
      expect(res.body.data.listings[1].tokenId).toBe('51');
      expect(res.body.data.listings[0].eventId.name).toBe('Fest Alpha');
    });
  });
});
