import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  purchaseTicketService,
  getMyTicketsService,
  createResaleListingService,
  cancelResaleListingService,
  fulfillResalePurchaseService,
  getResaleMarketplaceService,
  verifyTicketService,
} from './tickets.service';
import { VerifyTicketPayload } from './tickets.validation';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';
import { consumeNonce } from '@/shared/services/nonce.service';
import { verifyWalletSignature } from '@/shared/utils/signature';
import { ethers } from 'ethers';

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    mintTicketOnChain: jest.fn(),
    verifyListingCreatedOnChain: jest.fn(),
    verifyListingCancelledOnChain: jest.fn(),
    verifyListingSoldOnChain: jest.fn(),
    ownerOfOnChain: jest.fn(),
    markUsedOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
}));

jest.mock('@/shared/services/nonce.service', () => ({
  consumeNonce: jest.fn(),
}));

jest.mock('@/shared/utils/signature', () => ({
  verifyWalletSignature: jest.fn(),
}));

describe('Ticket Purchase Service', () => {
  let mongoServer: MongoMemoryServer;
  const buyerWallet = '0x1111111111111111111111111111111111111111';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Event.init();
    await Ticket.init();
    await Transaction.init();
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
      name: 'Test Concert',
      description: 'A great concert',
      eventDate: new Date(Date.now() + 86400000),
      ticketPrice: 0.05,
      maxResalePrice: 0.1,
      saleDeadline: new Date(Date.now() + 3600000),
      totalCapacity: 10,
      remainingQuota: 10,
      posterCID: 'QmPoster123',
      metadataCID: 'ipfs://QmMetadata123',
      onChainEventId: 1,
      status: 'active',
      ...overrides,
    });
  }

  it('should successfully purchase a ticket, decrement quota, mint NFT and create Ticket and Transaction records', async () => {
    const event = await createTestEvent({ remainingQuota: 5 });

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '101',
      txHash: '0xmintSuccessHash',
      blockNumber: 12345,
    });

    const result = await purchaseTicketService(buyerWallet, event._id.toString());

    expect(result.tokenId).toBe('101');
    expect(result.txHash).toBe('0xmintSuccessHash');

    // Verify quota decremented
    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent?.remainingQuota).toBe(4);

    // Verify Ticket created
    const ticket = await Ticket.findOne({ tokenId: '101' });
    expect(ticket).toBeTruthy();
    expect(ticket?.ownerWallet).toBe(buyerWallet.toLowerCase());
    expect(ticket?.tokenURI).toBe('ipfs://QmMetadata123');

    // Verify Transaction created
    const tx = await Transaction.findOne({ txHash: '0xmintSuccessHash' });
    expect(tx).toBeTruthy();
    expect(tx?.type).toBe('mint');
    expect(tx?.status).toBe('SUCCESS');
    expect(tx?.toWallet).toBe(buyerWallet.toLowerCase());
  });

  it('should update event status to soldout when remainingQuota reaches 0', async () => {
    const event = await createTestEvent({ remainingQuota: 1 });

    (withRetry as jest.Mock).mockResolvedValue({
      tokenId: '102',
      txHash: '0xlastTicketHash',
      blockNumber: 12346,
    });

    await purchaseTicketService(buyerWallet, event._id.toString());

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent?.remainingQuota).toBe(0);
    expect(updatedEvent?.status).toBe('soldout');
  });

  it('should reject purchase when event has remainingQuota = 0', async () => {
    const event = await createTestEvent({ remainingQuota: 0, status: 'soldout' });
    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow('Event is sold out');
  });

  it('should reject purchase when sale deadline has passed', async () => {
    const event = await createTestEvent({ saleDeadline: new Date(Date.now() - 1000) });
    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow('Ticket sale deadline has passed');
  });

  it('should handle failure recovery: record PENDING_MINT and log admin alert when mint fails all 3 times', async () => {
    const event = await createTestEvent({ remainingQuota: 2 });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    (withRetry as jest.Mock).mockRejectedValue(new Error('RPC Provider unavailable'));

    await expect(purchaseTicketService(buyerWallet, event._id.toString())).rejects.toThrow(
      'Minting failed after retries. Transaction queued as PENDING_MINT for recovery.',
    );

    // Verify admin alert logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ADMIN_ALERT_MINT_FAILED]'),
      expect.anything(),
    );

    // Verify PENDING_MINT transaction created
    const pendingTx = await Transaction.findOne({ status: 'PENDING_MINT' });
    expect(pendingTx).toBeTruthy();
    expect(pendingTx?.toWallet).toBe(buyerWallet.toLowerCase());

    consoleSpy.mockRestore();
  });

  describe('getMyTicketsService', () => {
    it('should return paginated tickets owned by the wallet and populate event details', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '101',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm101',
        mintTxHash: '0xmint101',
        blockNumber: 1,
        isUsed: false,
        isListed: false,
      });

      const res = await getMyTicketsService(buyerWallet, { status: 'all', page: 1, limit: 10 });
      expect(res.tickets.length).toBe(1);
      expect(res.tickets[0].tokenId).toBe('101');
      expect((res.tickets[0].eventId as any).name).toBe('Test Concert');
      expect(res.pagination.total).toBe(1);
    });

    it('should filter tickets accurately by status: active, resale, used', async () => {
      const event = await createTestEvent();
      await Ticket.create([
        {
          tokenId: '201',
          eventId: event._id,
          ownerWallet: buyerWallet,
          tokenURI: 'ipfs://Qm201',
          mintTxHash: '0xmint201',
          blockNumber: 1,
          isUsed: false,
          isListed: false,
        },
        {
          tokenId: '202',
          eventId: event._id,
          ownerWallet: buyerWallet,
          tokenURI: 'ipfs://Qm202',
          mintTxHash: '0xmint202',
          blockNumber: 1,
          isUsed: false,
          isListed: true,
          resalePrice: 0.08,
        },
        {
          tokenId: '203',
          eventId: event._id,
          ownerWallet: buyerWallet,
          tokenURI: 'ipfs://Qm203',
          mintTxHash: '0xmint203',
          blockNumber: 1,
          isUsed: true,
          usedAt: new Date(),
          isListed: false,
        },
      ]);

      const activeRes = await getMyTicketsService(buyerWallet, { status: 'active' });
      expect(activeRes.tickets.map((t: any) => t.tokenId)).toEqual(['201']);

      const resaleRes = await getMyTicketsService(buyerWallet, { status: 'resale' });
      expect(resaleRes.tickets.map((t: any) => t.tokenId)).toEqual(['202']);

      const usedRes = await getMyTicketsService(buyerWallet, { status: 'used' });
      expect(usedRes.tickets.map((t: any) => t.tokenId)).toEqual(['203']);
    });
  });

  describe('createResaleListingService', () => {
    it('should successfully list a ticket for resale after on-chain verification', async () => {
      const event = await createTestEvent({ maxResalePrice: 0.1 });
      const ticket = await Ticket.create({
        tokenId: '301',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm301',
        mintTxHash: '0xmint301',
        blockNumber: 1,
        isUsed: false,
        isListed: false,
      });

      (blockchainService.verifyListingCreatedOnChain as jest.Mock).mockResolvedValue({ blockNumber: 50 });

      const res = await createResaleListingService(buyerWallet, {
        tokenId: '301',
        price: 0.08,
        txHash: '0x301listtx',
      });

      expect(res.isListed).toBe(true);
      expect(res.resalePrice).toBe(0.08);

      const updatedTicket = await Ticket.findById(ticket._id);
      expect(updatedTicket?.isListed).toBe(true);
      expect(updatedTicket?.resalePrice).toBe(0.08);

      const tx = await Transaction.findOne({ txHash: '0x301listtx' });
      expect(tx).toBeTruthy();
      expect(tx?.type).toBe('resell');
      expect(tx?.price).toBe(0.08);
      expect(tx?.toWallet).toBe(ethers.ZeroAddress);
    });

    it('should throw 403 if user is not ticket owner', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '302',
        eventId: event._id,
        ownerWallet: '0xdifferentowner',
        tokenURI: 'ipfs://Qm302',
        mintTxHash: '0xmint302',
        blockNumber: 1,
      });

      await expect(
        createResaleListingService(buyerWallet, { tokenId: '302', price: 0.08, txHash: '0xtx' }),
      ).rejects.toThrow('You do not own this ticket');
    });

    it('should throw 400 if ticket is already used', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '303',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm303',
        mintTxHash: '0xmint303',
        blockNumber: 1,
        isUsed: true,
      });

      await expect(
        createResaleListingService(buyerWallet, { tokenId: '303', price: 0.08, txHash: '0xtx' }),
      ).rejects.toThrow('Cannot list an already redeemed ticket');
    });

    it('should throw 409 if ticket is already listed', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '304',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm304',
        mintTxHash: '0xmint304',
        blockNumber: 1,
        isListed: true,
        resalePrice: 0.08,
      });

      await expect(
        createResaleListingService(buyerWallet, { tokenId: '304', price: 0.08, txHash: '0xtx' }),
      ).rejects.toThrow('Ticket is already listed for resale');
    });

    it('should throw 400 if price exceeds maxResalePrice cap', async () => {
      const event = await createTestEvent({ maxResalePrice: 0.05 });
      await Ticket.create({
        tokenId: '305',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm305',
        mintTxHash: '0xmint305',
        blockNumber: 1,
      });

      await expect(
        createResaleListingService(buyerWallet, { tokenId: '305', price: 0.08, txHash: '0xtx' }),
      ).rejects.toThrow('Resale price exceeds maximum allowed cap of 0.05 ETH');
    });

    it('should throw 400 if saleDeadline has passed', async () => {
      const event = await createTestEvent({ saleDeadline: new Date(Date.now() - 3600000) });
      await Ticket.create({
        tokenId: '306',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm306',
        mintTxHash: '0xmint306',
        blockNumber: 1,
      });

      await expect(
        createResaleListingService(buyerWallet, { tokenId: '306', price: 0.05, txHash: '0xtx' }),
      ).rejects.toThrow('Event sale deadline has passed');
    });
  });

  describe('cancelResaleListingService', () => {
    it('should cancel active resale listing and reset ticket state', async () => {
      const event = await createTestEvent();
      const ticket = await Ticket.create({
        tokenId: '401',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm401',
        mintTxHash: '0xmint401',
        blockNumber: 1,
        isListed: true,
        resalePrice: 0.08,
        listingTxHash: '0xlisttx',
      });

      (blockchainService.verifyListingCancelledOnChain as jest.Mock).mockResolvedValue({ blockNumber: 60 });

      const res = await cancelResaleListingService(buyerWallet, '401', '0xcanceltx');
      expect(res.isListed).toBe(false);
      expect(res.resalePrice).toBeNull();

      const updated = await Ticket.findById(ticket._id);
      expect(updated?.isListed).toBe(false);
      expect(updated?.resalePrice).toBeNull();
      expect(updated?.listingTxHash).toBe('');
    });

    it('should throw 400 if ticket is not listed', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '402',
        eventId: event._id,
        ownerWallet: buyerWallet,
        tokenURI: 'ipfs://Qm402',
        mintTxHash: '0xmint402',
        blockNumber: 1,
        isListed: false,
      });

      await expect(cancelResaleListingService(buyerWallet, '402', '0xcanceltx')).rejects.toThrow(
        'Ticket is not currently listed for resale',
      );
    });
  });

  describe('fulfillResalePurchaseService', () => {
    it('should transfer ownership to buyer and log resell transaction', async () => {
      const sellerWallet = '0x9999999999999999999999999999999999999999';
      const event = await createTestEvent();
      const ticket = await Ticket.create({
        tokenId: '501',
        eventId: event._id,
        ownerWallet: sellerWallet,
        tokenURI: 'ipfs://Qm501',
        mintTxHash: '0xmint501',
        blockNumber: 1,
        isListed: true,
        resalePrice: 0.08,
      });

      (blockchainService.verifyListingSoldOnChain as jest.Mock).mockResolvedValue({
        sellerWallet,
        priceWei: ethers.parseEther('0.08'),
        blockNumber: 70,
      });

      const res = await fulfillResalePurchaseService(buyerWallet, {
        tokenId: '501',
        txHash: '0xbuytx501',
      });

      expect(res.ownerWallet).toBe(buyerWallet.toLowerCase());
      expect(res.isListed).toBe(false);

      const updated = await Ticket.findById(ticket._id);
      expect(updated?.ownerWallet).toBe(buyerWallet.toLowerCase());
      expect(updated?.isListed).toBe(false);
      expect(updated?.resalePrice).toBeNull();
      expect(updated?.lastTransferTxHash).toBe('0xbuytx501');

      const tx = await Transaction.findOne({ txHash: '0xbuytx501' });
      expect(tx).toBeTruthy();
      expect(tx?.type).toBe('resell');
      expect(tx?.fromWallet).toBe(sellerWallet.toLowerCase());
      expect(tx?.toWallet).toBe(buyerWallet.toLowerCase());
      expect(tx?.price).toBe(0.08);
    });

    it('should throw 400 if ticket is not listed', async () => {
      const event = await createTestEvent();
      await Ticket.create({
        tokenId: '502',
        eventId: event._id,
        ownerWallet: '0xseller',
        tokenURI: 'ipfs://Qm502',
        mintTxHash: '0xmint502',
        blockNumber: 1,
        isListed: false,
      });

      await expect(
        fulfillResalePurchaseService(buyerWallet, { tokenId: '502', txHash: '0xtx' }),
      ).rejects.toThrow('Ticket is not listed for resale');
    });
  });

  describe('getResaleMarketplaceService', () => {
    it('should return only active listings with event details and support sorting', async () => {
      const event1 = await createTestEvent({ name: 'Event A', onChainEventId: 601 });
      const event2 = await createTestEvent({ name: 'Event B', onChainEventId: 602 });

      await Ticket.create([
        {
          tokenId: '601',
          eventId: event1._id,
          ownerWallet: '0xwallet1',
          tokenURI: 'ipfs://Qm601',
          mintTxHash: '0x1',
          blockNumber: 1,
          isListed: true,
          resalePrice: 0.05,
        },
        {
          tokenId: '602',
          eventId: event1._id,
          ownerWallet: '0xwallet2',
          tokenURI: 'ipfs://Qm602',
          mintTxHash: '0x2',
          blockNumber: 1,
          isListed: true,
          resalePrice: 0.08,
        },
        {
          tokenId: '603',
          eventId: event2._id,
          ownerWallet: '0xwallet3',
          tokenURI: 'ipfs://Qm603',
          mintTxHash: '0x3',
          blockNumber: 1,
          isListed: false,
        },
      ]);

      const allResale = await getResaleMarketplaceService({ sortBy: 'price_desc' });
      expect(allResale.listings.length).toBe(2);
      expect(allResale.listings[0].resalePrice).toBe(0.08);
      expect(allResale.listings[1].resalePrice).toBe(0.05);

      const filtered = await getResaleMarketplaceService({ eventId: event1._id.toString() });
      expect(filtered.listings.length).toBe(2);
    });
  });

  describe('verifyTicketService', () => {
    const holderWallet = '0x4444444444444444444444444444444444444444';

    function buildPayload(overrides: Partial<VerifyTicketPayload> = {}): VerifyTicketPayload {
      return {
        tokenId: '900',
        walletAddress: holderWallet,
        nonce: 'qr-nonce-1',
        expiresAt: Math.floor((Date.now() + 10_000) / 1000),
        signature: '0xsig',
        ...overrides,
      };
    }

    async function createTestTicket(overrides = {}) {
      const event = await createTestEvent();
      return Ticket.create({
        tokenId: '900',
        eventId: event._id,
        ownerWallet: holderWallet,
        tokenURI: 'ipfs://Qm900',
        mintTxHash: '0xmint900',
        blockNumber: 100,
        isUsed: false,
        ...overrides,
      });
    }

    beforeEach(() => {
      (consumeNonce as jest.Mock).mockResolvedValue(undefined);
      (verifyWalletSignature as jest.Mock).mockResolvedValue(true);
      (blockchainService.ownerOfOnChain as jest.Mock).mockResolvedValue(holderWallet);
    });

    it('should reject an expired QR payload', async () => {
      await createTestTicket();
      const payload = buildPayload({ expiresAt: Math.floor((Date.now() - 1000) / 1000) });

      await expect(verifyTicketService(payload)).rejects.toMatchObject({
        message: 'QR code has expired',
        statusCode: 401,
      });
    });

    it('should reject a QR payload signed too far in the future', async () => {
      await createTestTicket();
      const payload = buildPayload({ expiresAt: Math.floor((Date.now() + 60_000) / 1000) });

      await expect(verifyTicketService(payload)).rejects.toMatchObject({
        message: 'Invalid QR code timestamp',
        statusCode: 401,
      });
    });

    it('should reject a replayed nonce', async () => {
      await createTestTicket();
      (consumeNonce as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Nonce has already been used'), { statusCode: 401 }),
      );

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        message: 'Nonce has already been used',
      });
    });

    it('should reject an invalid signature', async () => {
      await createTestTicket();
      (verifyWalletSignature as jest.Mock).mockResolvedValue(false);

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        message: 'Invalid signature',
        statusCode: 401,
      });
    });

    it('should return 404 when the ticket does not exist', async () => {
      await expect(verifyTicketService(buildPayload({ tokenId: 'missing' }))).rejects.toMatchObject({
        message: 'Ticket not found',
        statusCode: 404,
      });
    });

    it('should return 409 when the ticket is already used (fast path)', async () => {
      await createTestTicket({ isUsed: true, usedAt: new Date() });

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(blockchainService.ownerOfOnChain).not.toHaveBeenCalled();
    });

    it('should return 409 on a concurrent double-scan race and not reach the chain', async () => {
      await createTestTicket();
      jest.spyOn(Ticket, 'findOneAndUpdate').mockResolvedValueOnce(null as any);

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(blockchainService.ownerOfOnChain).not.toHaveBeenCalled();
    });

    it('should roll back and reject when the on-chain owner does not match', async () => {
      await createTestTicket();
      (blockchainService.ownerOfOnChain as jest.Mock).mockResolvedValue(
        '0x9999999999999999999999999999999999999999',
      );

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        message: 'On-chain owner does not match ticket holder',
        statusCode: 403,
      });

      const ticket = await Ticket.findOne({ tokenId: '900' });
      expect(ticket?.isUsed).toBe(false);
      expect(ticket?.usedAt).toBeNull();
    });

    it('should roll back, log a FAILED transaction, and reject when redemption is exhausted', async () => {
      await createTestTicket();
      (withRetry as jest.Mock).mockRejectedValue(new Error('RPC unavailable'));

      await expect(verifyTicketService(buildPayload())).rejects.toMatchObject({
        message: 'Failed to record redemption on-chain after retries',
        statusCode: 502,
      });

      const ticket = await Ticket.findOne({ tokenId: '900' });
      expect(ticket?.isUsed).toBe(false);
      expect(ticket?.usedAt).toBeNull();

      const failedTx = await Transaction.findOne({ tokenId: '900', status: 'FAILED' });
      expect(failedTx).toBeTruthy();
      expect(failedTx?.type).toBe('redeem');
    });

    it('should redeem the ticket, call markUsed on-chain, and log a SUCCESS transaction', async () => {
      await createTestTicket();
      (withRetry as jest.Mock).mockResolvedValue({
        txHash: '0xredeemTxHash',
        blockNumber: 555,
        alreadyUsed: false,
      });

      const result = await verifyTicketService(buildPayload());

      expect(result.tokenId).toBe('900');
      expect(result.isUsed).toBe(true);
      expect(result.txHash).toBe('0xredeemTxHash');

      const ticket = await Ticket.findOne({ tokenId: '900' });
      expect(ticket?.isUsed).toBe(true);
      expect(ticket?.usedAt).toBeInstanceOf(Date);

      const tx = await Transaction.findOne({ txHash: '0xredeemTxHash' });
      expect(tx).toBeTruthy();
      expect(tx?.type).toBe('redeem');
      expect(tx?.status).toBe('SUCCESS');
    });

    it('should succeed without a duplicate transaction when markUsed reports alreadyUsed', async () => {
      await createTestTicket();
      (withRetry as jest.Mock).mockResolvedValue({
        txHash: '',
        blockNumber: 0,
        alreadyUsed: true,
      });

      const result = await verifyTicketService(buildPayload());

      expect(result.isUsed).toBe(true);
      expect(await Transaction.countDocuments({ tokenId: '900' })).toBe(0);

      const ticket = await Ticket.findOne({ tokenId: '900' });
      expect(ticket?.isUsed).toBe(true);
    });
  });
});
