import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { handleTicketUsed } from './ticketUsed.handler';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { Event } from '@/shared/models/event.model';
import { ParsedEventLog } from '../listener.types';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Ticket.deleteMany({});
  await Transaction.deleteMany({});
  await Event.deleteMany({});
});

describe('handleTicketUsed', () => {
  const mockProvider = {
    getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
  } as any;

  async function createTestEvent() {
    return Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      onChainEventId: 1,
      name: 'Test Event',
      description: 'Test Description',
      eventDate: new Date('2026-12-01'),
      ticketPrice: 0.05,
      maxResalePrice: 0.075,
      saleDeadline: new Date('2026-11-30'),
      totalCapacity: 100,
      remainingQuota: 99,
      posterCID: 'ipfs://test',
      status: 'active',
    });
  }

  it('should mark Ticket as used and create a redeem Transaction', async () => {
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xalice',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
      isListed: true,
      resalePrice: 0.06,
      listingTxHash: '0xlisting',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketUsed',
      args: { tokenId: 1n, eventId: 1n },
      blockNumber: 2000,
      blockHash: '0xabc',
      transactionHash: '0xused',
      logIndex: 0,
    };

    await handleTicketUsed(mockEvent, mockProvider);

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.isUsed).toBe(true);
    expect(ticket?.usedAt).toEqual(new Date(1696118400 * 1000));
    expect(ticket?.isListed).toBe(false);
    expect(ticket?.resalePrice).toBeNull();
    expect(ticket?.listingTxHash).toBe('');

    const transaction = await Transaction.findOne({ txHash: '0xused' });
    expect(transaction).toBeTruthy();
    expect(transaction?.type).toBe('redeem');
    expect(transaction?.tokenId).toBe('1');
    expect(transaction?.fromWallet).toBe('0xalice');
    expect(transaction?.toWallet).toBe('0xalice');
    expect(transaction?.price).toBe(0);
    expect(transaction?.status).toBe('SUCCESS');
  });

  it('should skip processing if a redeem Transaction for this txHash already exists (idempotency)', async () => {
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xalice',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
      isUsed: true,
      usedAt: new Date('2026-10-01'),
    });

    await Transaction.create({
      txHash: '0xused',
      type: 'redeem',
      tokenId: '1',
      fromWallet: '0xalice',
      toWallet: '0xalice',
      price: 0,
      timestamp: new Date('2026-10-01'),
      status: 'SUCCESS',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketUsed',
      args: { tokenId: 1n, eventId: 1n },
      blockNumber: 2000,
      blockHash: '0xabc',
      transactionHash: '0xused',
      logIndex: 0,
    };

    await handleTicketUsed(mockEvent, mockProvider);

    const transactions = await Transaction.find({ txHash: '0xused' });
    expect(transactions).toHaveLength(1);
  });

  it('should reconcile a ticket already marked used by BE-08 API without duplicating the used flag update, but still record the redeem audit log', async () => {
    // Simulates: BE-08's /tickets/verify endpoint already set isUsed=true
    // synchronously, but its async on-chain markUsed call exhausted retries
    // (recorded as a FAILED Transaction for a different, now-stale attempt).
    // The listener later observes the real on-chain TicketUsed event (e.g. a
    // retried manual call) and must still create the SUCCESS audit record
    // for the real txHash.
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xalice',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
      isUsed: true,
      usedAt: new Date('2026-09-30'),
    });

    await Transaction.create({
      txHash: '0xusedattemptfailed',
      type: 'redeem',
      tokenId: '1',
      fromWallet: '0xalice',
      toWallet: '0xalice',
      price: 0,
      timestamp: new Date('2026-09-30'),
      status: 'FAILED',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketUsed',
      args: { tokenId: 1n, eventId: 1n },
      blockNumber: 2000,
      blockHash: '0xabc',
      transactionHash: '0xusedlater',
      logIndex: 0,
    };

    await handleTicketUsed(mockEvent, mockProvider);

    // usedAt should remain the original timestamp (not overwritten) because
    // isUsed was already true before this handler ran.
    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.isUsed).toBe(true);
    expect(ticket?.usedAt).toEqual(new Date('2026-09-30'));

    const successTx = await Transaction.findOne({ txHash: '0xusedlater' });
    expect(successTx).toBeTruthy();
    expect(successTx?.status).toBe('SUCCESS');

    const allRedeemTx = await Transaction.find({ tokenId: '1', type: 'redeem' });
    expect(allRedeemTx).toHaveLength(2); // original FAILED + new SUCCESS
  });

  it('should throw error if Ticket not found in database', async () => {
    const mockEvent: ParsedEventLog = {
      eventName: 'TicketUsed',
      args: { tokenId: 999n, eventId: 1n },
      blockNumber: 2000,
      blockHash: '0xabc',
      transactionHash: '0xused',
      logIndex: 0,
    };

    await expect(handleTicketUsed(mockEvent, mockProvider)).rejects.toThrow(
      'Ticket 999 not found in database',
    );
  });
});
