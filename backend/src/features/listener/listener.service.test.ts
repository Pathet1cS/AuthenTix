import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ethers } from 'ethers';
import { ListenerService } from './listener.service';
import { SyncState } from '@/shared/models/syncState.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { Event } from '@/shared/models/event.model';

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
  await SyncState.deleteMany({});
  jest.restoreAllMocks();
});

/**
 * Builds a fake ethers.EventLog-shaped object for a given event name/args.
 * Only the fields read by ListenerService.parseEventLog / processEvent are populated.
 */
function fakeEventLog(params: {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}): any {
  return {
    eventName: params.eventName,
    args: params.args,
    blockNumber: params.blockNumber,
    blockHash: `0xblock${params.blockNumber}`,
    transactionHash: params.transactionHash,
    index: params.logIndex,
  };
}

describe('ListenerService.catchUpFromLastCheckpoint (private, exercised via start())', () => {
  it('replays historical events in chronological order and advances the checkpoint', async () => {
    // Seed a checkpoint below the mock events' block numbers so catch-up
    // actually has a range to process (CONTRACT_DEPLOYMENT_BLOCK in the test
    // .env is a large real-world value that would otherwise make fromBlock >= toBlock).
    await SyncState.create({ lastProcessedBlock: 10 });

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

    const service = new ListenerService();

    const mintedLog = fakeEventLog({
      eventName: 'TicketMinted',
      args: {
        tokenId: 1n,
        eventId: 1n,
        owner: '0xAlice',
        tokenURI: 'ipfs://token1',
      },
      blockNumber: 100,
      transactionHash: '0xmint',
      logIndex: 0,
    });

    const transferredLog = fakeEventLog({
      eventName: 'TicketTransferred',
      args: { tokenId: 1n, from: '0xAlice', to: '0xBob' },
      blockNumber: 105,
      transactionHash: '0xtransfer',
      logIndex: 0,
    });

    const usedLog = fakeEventLog({
      eventName: 'TicketUsed',
      args: { tokenId: 1n, eventId: 1n },
      blockNumber: 110,
      transactionHash: '0xused',
      logIndex: 0,
    });

    const mockContract = {
      queryFilter: jest.fn(async (eventName: string) => {
        if (eventName === 'TicketMinted') return [mintedLog];
        if (eventName === 'TicketTransferred') return [transferredLog];
        if (eventName === 'TicketUsed') return [usedLog];
        return [];
      }),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(110),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
    };

    // Inject mocks by bypassing connectProvider (private) via direct field assignment.
    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();
    (service as any).subscribeToEvents = jest.fn().mockResolvedValue(undefined);

    await service.start();

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.ownerWallet).toBe('0xbob'); // final owner after transfer
    expect(ticket?.isUsed).toBe(true);

    const transactions = await Transaction.find({ tokenId: '1' }).sort({ timestamp: 1 });
    expect(transactions.map((t) => t.type)).toEqual(['mint', 'transfer', 'redeem']);

    const syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(110);

    const updatedEvent = await Event.findById(eventDoc._id);
    expect(updatedEvent?.remainingQuota).toBe(99);
  });

  it('does not advance the checkpoint if an event in the batch fails to process', async () => {
    // No Ticket/Event fixtures created -> handleTicketTransferred will throw
    // because the referenced ticket does not exist.
    await SyncState.create({ lastProcessedBlock: 10 });

    const service = new ListenerService();

    const transferredLog = fakeEventLog({
      eventName: 'TicketTransferred',
      args: { tokenId: 999n, from: '0xAlice', to: '0xBob' },
      blockNumber: 50,
      transactionHash: '0xbadtransfer',
      logIndex: 0,
    });

    const mockContract = {
      queryFilter: jest.fn(async (eventName: string) => {
        if (eventName === 'TicketTransferred') return [transferredLog];
        return [];
      }),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(50),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();
    (service as any).subscribeToEvents = jest.fn().mockResolvedValue(undefined);

    await expect(service.start()).rejects.toThrow('Ticket 999 not found in database');

    const syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(10); // unchanged from seeded value
  });

  it('skips catch-up entirely if already at the latest block', async () => {
    await SyncState.create({ lastProcessedBlock: 200 });

    const service = new ListenerService();

    const mockContract = {
      queryFilter: jest.fn(),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(200),
      getBlock: jest.fn(),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();
    (service as any).subscribeToEvents = jest.fn().mockResolvedValue(undefined);

    await service.start();

    expect(mockContract.queryFilter).not.toHaveBeenCalled();
  });

  it('uses CONTRACT_DEPLOYMENT_BLOCK as the starting point when no SyncState exists', async () => {
    const service = new ListenerService();

    const mockContract = {
      queryFilter: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(5),
      getBlock: jest.fn(),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();
    (service as any).subscribeToEvents = jest.fn().mockResolvedValue(undefined);

    await service.start();

    // env.CONTRACT_DEPLOYMENT_BLOCK is 14325678 in the test .env, which is
    // far above the mocked current block (5), so no catch-up range exists
    // and queryFilter should never be called.
    expect(mockContract.queryFilter).not.toHaveBeenCalled();
  });
});

describe('ListenerService.subscribeToEvents (private, exercised via start())', () => {
  it('registers listeners for all three event types', async () => {
    await SyncState.create({ lastProcessedBlock: 200 });

    const service = new ListenerService();

    const mockContract = {
      queryFilter: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(200),
      getBlock: jest.fn(),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();

    await service.start();

    expect(mockContract.on).toHaveBeenCalledWith('TicketMinted', expect.any(Function));
    expect(mockContract.on).toHaveBeenCalledWith('TicketTransferred', expect.any(Function));
    expect(mockContract.on).toHaveBeenCalledWith('TicketUsed', expect.any(Function));
  });

  it('processes a live event through the real handler and updates the checkpoint on first event', async () => {
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
    void eventDoc;

    await SyncState.create({ lastProcessedBlock: 200 });

    const service = new ListenerService();

    let mintedCallback: ((...args: unknown[]) => Promise<void>) | undefined;
    const mockContract = {
      queryFilter: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn(),
      on: jest.fn((eventName: string, cb: (...args: unknown[]) => Promise<void>) => {
        if (eventName === 'TicketMinted') mintedCallback = cb;
      }),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(200),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();

    await service.start();
    expect(mintedCallback).toBeDefined();

    const liveLog = fakeEventLog({
      eventName: 'TicketMinted',
      args: { tokenId: 1n, eventId: 1n, owner: '0xAlice', tokenURI: 'ipfs://live' },
      blockNumber: 201,
      transactionHash: '0xlivemint',
      logIndex: 0,
    });

    // Real contract.on callbacks receive (...decodedArgs, eventLogObject);
    // simulate that shape with the eventLogObject as the final arg.
    await mintedCallback!(1n, 1n, '0xAlice', 'ipfs://live', liveLog);

    const ticket = await Ticket.findOne({ tokenId: '1' });
    expect(ticket?.ownerWallet).toBe('0xalice');

    // First event within the 30s throttle window should still write the
    // checkpoint immediately, since lastCheckpointUpdateAt starts at 0.
    const syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(201);
  });

  it('does not crash the process when a live handler throws', async () => {
    await SyncState.create({ lastProcessedBlock: 200 });

    const service = new ListenerService();

    let transferredCallback: ((...args: unknown[]) => Promise<void>) | undefined;
    const mockContract = {
      queryFilter: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn(),
      on: jest.fn((eventName: string, cb: (...args: unknown[]) => Promise<void>) => {
        if (eventName === 'TicketTransferred') transferredCallback = cb;
      }),
    };

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(200),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;
    (service as any).connectProvider = jest.fn();

    await service.start();
    expect(transferredCallback).toBeDefined();

    const liveLog = fakeEventLog({
      eventName: 'TicketTransferred',
      args: { tokenId: 999n, from: '0xAlice', to: '0xBob' }, // nonexistent ticket -> handler throws
      blockNumber: 202,
      transactionHash: '0xbadlivetransfer',
      logIndex: 0,
    });

    // Should not throw/reject -- errors are caught and logged internally.
    await expect(
      transferredCallback!(999n, '0xAlice', '0xBob', liveLog),
    ).resolves.toBeUndefined();

    // Checkpoint should not have advanced past the pre-seeded value since
    // the handler failed before updateCheckpointThrottled ran.
    const syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(200);
  });
});

describe('ListenerService end-to-end restart & recovery scenario', () => {
  it('resumes exactly where it left off after a simulated crash/restart, with no duplicate or missed events', async () => {
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

    await SyncState.create({ lastProcessedBlock: 10 });

    // --- First "run": processes 2 historical events, then simulates a crash
    // (no SyncState advancement beyond what catch-up wrote) ---
    const firstMint = fakeEventLog({
      eventName: 'TicketMinted',
      args: { tokenId: 1n, eventId: 1n, owner: '0xAlice', tokenURI: 'ipfs://token1' },
      blockNumber: 20,
      transactionHash: '0xmint1',
      logIndex: 0,
    });
    const secondMint = fakeEventLog({
      eventName: 'TicketMinted',
      args: { tokenId: 2n, eventId: 1n, owner: '0xBob', tokenURI: 'ipfs://token2' },
      blockNumber: 25,
      transactionHash: '0xmint2',
      logIndex: 0,
    });

    const serviceRun1 = new ListenerService();
    const mockContractRun1 = {
      queryFilter: jest.fn(async (eventName: string) => {
        if (eventName === 'TicketMinted') return [firstMint, secondMint];
        return [];
      }),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };
    const mockProviderRun1 = {
      getBlockNumber: jest.fn().mockResolvedValue(25),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696118400 }),
    };

    (serviceRun1 as any).contract = mockContractRun1;
    (serviceRun1 as any).provider = mockProviderRun1;
    (serviceRun1 as any).connectProvider = jest.fn();

    await serviceRun1.start(); // runs catch-up (blocks 11-25) + subscribes
    await serviceRun1.stop(); // simulate process shutdown ("crash")

    let syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(25);
    expect(await Ticket.countDocuments()).toBe(2);

    // --- Simulate downtime: 2 more events emitted on-chain while the
    // listener was down (blocks 30 and 35) ---
    const thirdMint = fakeEventLog({
      eventName: 'TicketMinted',
      args: { tokenId: 3n, eventId: 1n, owner: '0xCarol', tokenURI: 'ipfs://token3' },
      blockNumber: 30,
      transactionHash: '0xmint3',
      logIndex: 0,
    });
    const usedDuringDowntime = fakeEventLog({
      eventName: 'TicketUsed',
      args: { tokenId: 1n, eventId: 1n },
      blockNumber: 35,
      transactionHash: '0xused1',
      logIndex: 0,
    });

    // --- Second "run": a fresh ListenerService instance (as happens on
    // process restart) picks up from the persisted checkpoint ---
    const serviceRun2 = new ListenerService();
    const mockContractRun2 = {
      queryFilter: jest.fn(async (eventName: string) => {
        if (eventName === 'TicketMinted') return [thirdMint];
        if (eventName === 'TicketUsed') return [usedDuringDowntime];
        return [];
      }),
      removeAllListeners: jest.fn(),
      on: jest.fn(),
    };
    const mockProviderRun2 = {
      getBlockNumber: jest.fn().mockResolvedValue(35),
      getBlock: jest.fn().mockResolvedValue({ timestamp: 1696200000 }),
    };

    (serviceRun2 as any).contract = mockContractRun2;
    (serviceRun2 as any).provider = mockProviderRun2;
    (serviceRun2 as any).connectProvider = jest.fn();

    await serviceRun2.start();

    // Catch-up should have queried only the gap (26-35), not replayed 11-25.
    expect(mockContractRun2.queryFilter).toHaveBeenCalledWith('TicketMinted', 26, 35);
    expect(mockContractRun2.queryFilter).toHaveBeenCalledWith('TicketTransferred', 26, 35);
    expect(mockContractRun2.queryFilter).toHaveBeenCalledWith('TicketUsed', 26, 35);

    // All 3 tickets exist exactly once (no duplicates from re-processing).
    expect(await Ticket.countDocuments()).toBe(3);
    const ticket1 = await Ticket.findOne({ tokenId: '1' });
    expect(ticket1?.isUsed).toBe(true); // picked up the downtime TicketUsed event
    const ticket3 = await Ticket.findOne({ tokenId: '3' });
    expect(ticket3?.ownerWallet).toBe('0xcarol');

    // Checkpoint now reflects the full history, not just the second run's start.
    syncState = await SyncState.findOne({});
    expect(syncState?.lastProcessedBlock).toBe(35);

    const updatedEvent = await Event.findById(eventDoc._id);
    expect(updatedEvent?.remainingQuota).toBe(97); // 3 mints total across both runs

    await serviceRun2.stop();
  });
});

describe('ListenerService.stop', () => {
  it('removes contract listeners and destroys a WebSocket provider', async () => {
    const service = new ListenerService();

    const mockContract = {
      removeAllListeners: jest.fn().mockResolvedValue(undefined),
    };
    const mockProvider = {
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    (service as any).contract = mockContract;
    (service as any).provider = mockProvider;

    await service.stop();

    expect(mockContract.removeAllListeners).toHaveBeenCalled();
    expect(mockProvider.destroy).toHaveBeenCalled();
  });
});
