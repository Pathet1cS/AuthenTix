import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { Transaction } from './transaction.model';

beforeAll(async () => {
  await setupTestDB();
  await Transaction.init();
}, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('Transaction model', () => {
  const validTx = {
    txHash: '0xdeadbeef',
    type: 'mint' as const,
    tokenId: '1',
    fromWallet: '0x0000000000000000000000000000000000000000',
    toWallet: '0xAbCd0000000000000000000000000000000000FF',
    price: 50000,
    timestamp: new Date('2026-08-01'),
  };

  it('creates a transaction', async () => {
    const tx = await Transaction.create(validTx);
    expect(tx.txHash).toBe('0xdeadbeef');
    expect(tx.type).toBe('mint');
    expect(tx.tokenId).toBe('1');
    expect(tx.toWallet).toBe(validTx.toWallet.toLowerCase());
    expect(tx.price).toBe(50000);
    expect(tx.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique txHash', async () => {
    await Transaction.create(validTx);
    await expect(
      Transaction.create({ ...validTx, tokenId: '2' }),
    ).rejects.toThrow();
  });

  it('rejects invalid type', async () => {
    await expect(
      Transaction.create({ ...validTx, type: 'burn' }),
    ).rejects.toThrow();
  });

  it('requires txHash', async () => {
    const { txHash: _, ...noHash } = validTx;
    await expect(Transaction.create(noHash)).rejects.toThrow();
  });

  it('defaults price to 0', async () => {
    const { price: _, ...noPrice } = validTx;
    const tx = await Transaction.create(noPrice);
    expect(tx.price).toBe(0);
  });

  it('accepts all valid types', async () => {
    for (const type of ['mint', 'transfer', 'resell'] as const) {
      const tx = await Transaction.create({
        ...validTx,
        txHash: `0x${type}`,
        type,
      });
      expect(tx.type).toBe(type);
    }
  });
});
