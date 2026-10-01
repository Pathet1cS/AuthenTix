import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { handleTicketTransferred } from './ticketTransferred.handler';
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

describe('handleTicketTransferred', () => {
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

  it('should update Ticket ownership and create Transaction record', async () => {
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
      eventName: 'TicketTransferred',
      args: {
        tokenId: 1n,
        from: '0xAlice',
        to: '0xBob',
      },
      blockNumber: 1050,
      blockHash: '0xdef',
      transactionHash: '0xtransfer',
      logIndex: 0,
    };

    await handleTicketTransferred(mockEvent, mockProvider);

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.ownerWallet).toBe('0xbob');
    expect(ticket?.lastTransferTxHash).toBe('0xtransfer');
    expect(ticket?.blockNumber).toBe(1050);
    expect(ticket?.isListed).toBe(false);
    expect(ticket?.resalePrice).toBeNull();
    expect(ticket?.listingTxHash).toBe('');

    const transaction = await Transaction.findOne({ txHash: '0xtransfer' });
    expect(transaction).toBeTruthy();
    expect(transaction?.type).toBe('transfer');
    expect(transaction?.fromWallet).toBe('0xalice');
    expect(transaction?.toWallet).toBe('0xbob');
    expect(transaction?.price).toBe(0);
    expect(transaction?.status).toBe('SUCCESS');
  });

  it('should skip processing if a Transaction with this txHash already exists (idempotency)', async () => {
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xbob',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
      lastTransferTxHash: '0xtransfer',
    });

    await Transaction.create({
      txHash: '0xtransfer',
      type: 'transfer',
      tokenId: '1',
      fromWallet: '0xalice',
      toWallet: '0xbob',
      price: 0,
      timestamp: new Date(),
      status: 'SUCCESS',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketTransferred',
      args: { tokenId: 1n, from: '0xAlice', to: '0xBob' },
      blockNumber: 1050,
      blockHash: '0xdef',
      transactionHash: '0xtransfer',
      logIndex: 0,
    };

    await handleTicketTransferred(mockEvent, mockProvider);

    const transactions = await Transaction.find({ txHash: '0xtransfer' });
    expect(transactions).toHaveLength(1);
  });

  it('should skip processing if the resale API already recorded this txHash as type "resell"', async () => {
    // Simulates the ListingSold + TicketTransferred emitted together by
    // buyResoldTicket, where the BE-07 API endpoint already synchronized
    // ownership and created the audit record before the listener catches up.
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xbob',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
      lastTransferTxHash: '0xresale',
    });

    await Transaction.create({
      txHash: '0xresale',
      type: 'resell',
      tokenId: '1',
      fromWallet: '0xalice',
      toWallet: '0xbob',
      price: 0.06,
      timestamp: new Date(),
      status: 'SUCCESS',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketTransferred',
      args: { tokenId: 1n, from: '0xAlice', to: '0xBob' },
      blockNumber: 1050,
      blockHash: '0xdef',
      transactionHash: '0xresale',
      logIndex: 1,
    };

    await handleTicketTransferred(mockEvent, mockProvider);

    const transactions = await Transaction.find({ txHash: '0xresale' });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('resell'); // Not overwritten with 'transfer'
  });

  it('should throw error if Ticket not found in database', async () => {
    const mockEvent: ParsedEventLog = {
      eventName: 'TicketTransferred',
      args: { tokenId: 999n, from: '0xAlice', to: '0xBob' },
      blockNumber: 1050,
      blockHash: '0xdef',
      transactionHash: '0xtransfer',
      logIndex: 0,
    };

    await expect(handleTicketTransferred(mockEvent, mockProvider)).rejects.toThrow(
      'Ticket 999 not found in database',
    );
  });

  it('should lowercase wallet addresses', async () => {
    const eventDoc = await createTestEvent();

    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0xalice',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0xmint',
      blockNumber: 1000,
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketTransferred',
      args: {
        tokenId: 1n,
        from: '0XALICE',
        to: '0XBOB',
      },
      blockNumber: 1050,
      blockHash: '0xdef',
      transactionHash: '0xtransfer',
      logIndex: 0,
    };

    await handleTicketTransferred(mockEvent, mockProvider);

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.ownerWallet).toBe('0xbob');

    const transaction = await Transaction.findOne({ txHash: '0xtransfer' });
    expect(transaction?.fromWallet).toBe('0xalice');
    expect(transaction?.toWallet).toBe('0xbob');
  });
});
