import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { purchaseTicketService } from './tickets.service';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    mintTicketOnChain: jest.fn(),
  },
  withRetry: jest.fn(),
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
});
