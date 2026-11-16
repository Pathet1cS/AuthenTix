import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ethers } from 'ethers';
import { handleTicketMinted } from './ticketMinted.handler';
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

describe('handleTicketMinted', () => {
  const mockProvider = {
    getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
  } as any;

  it('should create Ticket and Transaction records on first call', async () => {
    // Setup: Create Event document
    const eventDoc = await Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      onChainEventId: 1,
      name: 'Test Event',
      description: 'Test Description',
      eventDate: new Date('2026-12-01'),
      ticketPrice: 0.05,
      maxResalePrice: 0.075,
      saleDeadline: new Date('2026-11-30'),
      totalCapacity: 100,
      remainingQuota: 100,
      posterCID: 'ipfs://test',
      status: 'active',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketMinted',
      args: {
        tokenId: 1n,
        eventId: 1n,
        owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        tokenURI: 'ipfs://token1',
      },
      blockNumber: 1000,
      blockHash: '0xabc',
      transactionHash: '0x123',
      logIndex: 0,
    };

    await handleTicketMinted(mockEvent, mockProvider);

    // Verify Ticket created
    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket).toBeTruthy();
    expect(ticket?.ownerWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
    expect(ticket?.tokenURI).toBe('ipfs://token1');
    expect(ticket?.mintTxHash).toBe('0x123');
    expect(ticket?.blockNumber).toBe(1000);
    expect(ticket?.isUsed).toBe(false);
    expect(ticket?.isListed).toBe(false);

    // Verify Transaction created
    const transaction = await Transaction.findOne({ txHash: '0x123' });
    expect(transaction).toBeTruthy();
    expect(transaction?.type).toBe('mint');
    expect(transaction?.tokenId).toBe('1');
    expect(transaction?.fromWallet).toBe(ethers.ZeroAddress);
    expect(transaction?.toWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
    expect(transaction?.price).toBe(0);
    expect(transaction?.status).toBe('SUCCESS');

    // Verify Event remainingQuota decremented
    const updatedEvent = await Event.findById(eventDoc._id);
    expect(updatedEvent?.remainingQuota).toBe(99);
  });

  it('should skip processing if event already processed (idempotency)', async () => {
    const eventDoc = await Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      onChainEventId: 1,
      name: 'Test Event',
      description: 'Test Description',
      eventDate: new Date('2026-12-01'),
      ticketPrice: 0.05,
      maxResalePrice: 0.075,
      saleDeadline: new Date('2026-11-30'),
      totalCapacity: 100,
      remainingQuota: 100,
      posterCID: 'ipfs://test',
      status: 'active',
    });

    // Pre-create ticket (simulate already processed)
    await Ticket.create({
      tokenId: '1',
      eventId: eventDoc._id,
      ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      tokenURI: 'ipfs://token1',
      mintTxHash: '0x123',
      blockNumber: 1000,
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketMinted',
      args: {
        tokenId: 1n,
        eventId: 1n,
        owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        tokenURI: 'ipfs://token1',
      },
      blockNumber: 1000,
      blockHash: '0xabc',
      transactionHash: '0x123',
      logIndex: 0,
    };

    await handleTicketMinted(mockEvent, mockProvider);

    // Verify no duplicate tickets created
    const tickets = await Ticket.find({ tokenId: '1' });
    expect(tickets).toHaveLength(1);

    // Verify remainingQuota not decremented again
    const updatedEvent = await Event.findById(eventDoc._id);
    expect(updatedEvent?.remainingQuota).toBe(100);
  });

  it('should throw error if Event not found in database', async () => {
    const mockEvent: ParsedEventLog = {
      eventName: 'TicketMinted',
      args: {
        tokenId: 1n,
        eventId: 999n, // Non-existent event
        owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        tokenURI: 'ipfs://token1',
      },
      blockNumber: 1000,
      blockHash: '0xabc',
      transactionHash: '0x123',
      logIndex: 0,
    };

    await expect(handleTicketMinted(mockEvent, mockProvider)).rejects.toThrow(
      'Event 999 not found in database',
    );
  });

  it('should handle uppercase wallet addresses by lowercasing', async () => {
    const eventDoc = await Event.create({
      organizerId: new mongoose.Types.ObjectId(),
      onChainEventId: 1,
      name: 'Test Event',
      description: 'Test Description',
      eventDate: new Date('2026-12-01'),
      ticketPrice: 0.05,
      maxResalePrice: 0.075,
      saleDeadline: new Date('2026-11-30'),
      totalCapacity: 100,
      remainingQuota: 100,
      posterCID: 'ipfs://test',
      status: 'active',
    });

    const mockEvent: ParsedEventLog = {
      eventName: 'TicketMinted',
      args: {
        tokenId: 1n,
        eventId: 1n,
        owner: '0X70997970C51812DC3A010C7D01B50E0D17DC79C8', // UPPERCASE
        tokenURI: 'ipfs://token1',
      },
      blockNumber: 1000,
      blockHash: '0xabc',
      transactionHash: '0x123',
      logIndex: 0,
    };

    await handleTicketMinted(mockEvent, mockProvider);

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.ownerWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8'); // lowercase

    const transaction = await Transaction.findOne({ txHash: '0x123' });
    expect(transaction?.toWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8'); // lowercase
  });
});
