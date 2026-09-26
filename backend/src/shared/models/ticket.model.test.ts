import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { Ticket } from './ticket.model';

beforeAll(async () => {
  await setupTestDB();
  await Ticket.init();
}, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('Ticket model', () => {
  const validTicket = {
    tokenId: '1',
    eventId: new mongoose.Types.ObjectId(),
    ownerWallet: '0xAbCd0000000000000000000000000000000000FF',
    tokenURI: 'ipfs://QmTestTokenURI',
    mintTxHash: '0xabc123',
    blockNumber: 12345,
  };

  it('creates a ticket with defaults', async () => {
    const ticket = await Ticket.create(validTicket);
    expect(ticket.tokenId).toBe('1');
    expect(ticket.ownerWallet).toBe(validTicket.ownerWallet.toLowerCase());
    expect(ticket.isUsed).toBe(false);
    expect(ticket.usedAt).toBeNull();
    expect(ticket.lastTransferTxHash).toBe('');
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique tokenId', async () => {
    await Ticket.create(validTicket);
    await expect(
      Ticket.create({ ...validTicket, ownerWallet: '0x0000000000000000000000000000000000000002' }),
    ).rejects.toThrow();
  });

  it('requires tokenId', async () => {
    const { tokenId: _, ...noTokenId } = validTicket;
    await expect(Ticket.create(noTokenId)).rejects.toThrow();
  });

  it('requires eventId', async () => {
    const { eventId: _, ...noEventId } = validTicket;
    await expect(Ticket.create(noEventId)).rejects.toThrow();
  });

  it('stores usedAt when ticket is marked used', async () => {
    const now = new Date();
    const ticket = await Ticket.create({ ...validTicket, isUsed: true, usedAt: now });
    expect(ticket.isUsed).toBe(true);
    expect(ticket.usedAt).toEqual(now);
  });

  it('lowercases ownerWallet', async () => {
    const ticket = await Ticket.create(validTicket);
    expect(ticket.ownerWallet).toBe('0xabcd0000000000000000000000000000000000ff');
  });

  it('should set default values for resale listing fields', async () => {
    const ticket = await Ticket.create({
      tokenId: '99',
      eventId: new mongoose.Types.ObjectId(),
      ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      tokenURI: 'ipfs://QmTest',
      mintTxHash: '0x123',
      blockNumber: 100,
    });

    expect(ticket.isListed).toBe(false);
    expect(ticket.resalePrice).toBeNull();
    expect(ticket.listingTxHash).toBe('');
  });

  it('should allow setting resale listing fields', async () => {
    const ticket = await Ticket.create({
      tokenId: '100',
      eventId: new mongoose.Types.ObjectId(),
      ownerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      tokenURI: 'ipfs://QmTest',
      mintTxHash: '0x123',
      blockNumber: 100,
      isListed: true,
      resalePrice: 0.06,
      listingTxHash: '0xabc',
    });

    expect(ticket.isListed).toBe(true);
    expect(ticket.resalePrice).toBe(0.06);
    expect(ticket.listingTxHash).toBe('0xabc');
  });
});
