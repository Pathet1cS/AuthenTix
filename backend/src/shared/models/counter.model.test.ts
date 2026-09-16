import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Counter, getNextSequence } from './counter.model';

describe('Counter Model & getNextSequence', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Counter.deleteMany({});
  });

  it('should start sequence at 1 when no counter exists', async () => {
    const seq = await getNextSequence('onChainEventId');
    expect(seq).toBe(1);
  });

  it('should atomically increment sequence on subsequent calls', async () => {
    const seq1 = await getNextSequence('onChainEventId');
    const seq2 = await getNextSequence('onChainEventId');
    const seq3 = await getNextSequence('onChainEventId');
    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(seq3).toBe(3);
  });

  it('should track separate sequences independently', async () => {
    const eventSeq = await getNextSequence('onChainEventId');
    const ticketSeq = await getNextSequence('otherSeq');
    expect(eventSeq).toBe(1);
    expect(ticketSeq).toBe(1);
  });
});
