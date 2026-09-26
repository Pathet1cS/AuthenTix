import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { Event } from './event.model';

beforeAll(async () => {
  await setupTestDB();
  await Event.init();
}, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('Event model', () => {
  const validEvent = {
    organizerId: new mongoose.Types.ObjectId(),
    name: 'Web3 Conference',
    description: 'A conference about Web3 technologies',
    eventDate: new Date('2026-12-01'),
    ticketPrice: 50000,
    maxResalePrice: 75000,
    saleDeadline: new Date('2026-11-30'),
    totalCapacity: 500,
    remainingQuota: 500,
  };

  it('creates an event with default status "draft"', async () => {
    const event = await Event.create(validEvent);
    expect(event.name).toBe('Web3 Conference');
    expect(event.status).toBe('draft');
    expect(event.posterCID).toBe('');
    expect(event.totalCapacity).toBe(500);
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it('accepts explicit status', async () => {
    const event = await Event.create({ ...validEvent, status: 'active' });
    expect(event.status).toBe('active');
  });

  it('accepts soldout status', async () => {
    const event = await Event.create({ ...validEvent, status: 'soldout' });
    expect(event.status).toBe('soldout');
  });

  it('rejects invalid status', async () => {
    await expect(
      Event.create({ ...validEvent, status: 'deleted' }),
    ).rejects.toThrow();
  });

  it('requires name', async () => {
    const { name: _, ...noName } = validEvent;
    await expect(Event.create(noName)).rejects.toThrow();
  });

  it('requires organizerId', async () => {
    const { organizerId: _, ...noOrg } = validEvent;
    await expect(Event.create(noOrg)).rejects.toThrow();
  });

  it('rejects totalCapacity below 1', async () => {
    await expect(
      Event.create({ ...validEvent, totalCapacity: 0 }),
    ).rejects.toThrow();
  });

  it('rejects negative remainingQuota', async () => {
    await expect(
      Event.create({ ...validEvent, remainingQuota: -1 }),
    ).rejects.toThrow();
  });

  it('stores posterCID when provided', async () => {
    const event = await Event.create({ ...validEvent, posterCID: 'QmTestHash123' });
    expect(event.posterCID).toBe('QmTestHash123');
  });

  it('defaults metadataCID to an empty string', async () => {
    const event = await Event.create(validEvent);
    expect(event.metadataCID).toBe('');
  });

  it('persists an explicit metadataCID', async () => {
    const event = await Event.create({ ...validEvent, metadataCID: 'bafyMetadata' });
    const found = await Event.findById(event._id);
    expect(found?.metadataCID).toBe('bafyMetadata');
  });

  it('defaults onChainTxHash to empty string and allows optional onChainEventId', async () => {
    const event = await Event.create(validEvent);
    expect(event.onChainTxHash).toBe('');
    expect(event.onChainEventId).toBeUndefined();
  });

  it('stores onChainEventId and onChainTxHash when provided', async () => {
    const event = await Event.create({
      ...validEvent,
      onChainEventId: 42,
      onChainTxHash: '0xabc123',
    });
    const found = await Event.findById(event._id);
    expect(found?.onChainEventId).toBe(42);
    expect(found?.onChainTxHash).toBe('0xabc123');
  });

  it('enforces uniqueness on onChainEventId', async () => {
    await Event.create({
      ...validEvent,
      onChainEventId: 100,
      onChainTxHash: '0x111',
    });

    await expect(
      Event.create({
        ...validEvent,
        onChainEventId: 100,
        onChainTxHash: '0x222',
      }),
    ).rejects.toThrow();
  });

  it('allows multiple events with undefined onChainEventId due to sparse index', async () => {
    const event1 = await Event.create(validEvent);
    const event2 = await Event.create({ ...validEvent, name: 'Second Draft Event' });

    expect(event1.onChainEventId).toBeUndefined();
    expect(event2.onChainEventId).toBeUndefined();
  });
});

