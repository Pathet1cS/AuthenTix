import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { User } from './user.model';

beforeAll(async () => {
  await setupTestDB();
  await User.init();
}, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('User model', () => {
  const validUser = {
    walletAddress: '0xAbC1230000000000000000000000000000000001',
    email: 'alice@example.com',
    name: 'Alice',
  };

  it('creates a user with default role "buyer"', async () => {
    const user = await User.create(validUser);
    expect(user.walletAddress).toBe(validUser.walletAddress.toLowerCase());
    expect(user.email).toBe(validUser.email);
    expect(user.name).toBe('Alice');
    expect(user.role).toBe('buyer');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('accepts explicit role', async () => {
    const user = await User.create({ ...validUser, role: 'organizer' });
    expect(user.role).toBe('organizer');
  });

  it('rejects invalid role', async () => {
    await expect(
      User.create({ ...validUser, role: 'superadmin' }),
    ).rejects.toThrow();
  });

  it('requires walletAddress', async () => {
    const { walletAddress: _, ...noWallet } = validUser;
    await expect(User.create(noWallet)).rejects.toThrow();
  });

  it('requires email', async () => {
    const { email: _, ...noEmail } = validUser;
    await expect(User.create(noEmail)).rejects.toThrow();
  });

  it('enforces unique walletAddress', async () => {
    await User.create(validUser);
    await expect(
      User.create({ ...validUser, email: 'other@example.com' }),
    ).rejects.toThrow();
  });

  it('enforces unique email', async () => {
    await User.create(validUser);
    await expect(
      User.create({ ...validUser, walletAddress: '0x0000000000000000000000000000000000000002' }),
    ).rejects.toThrow();
  });

  it('lowercases walletAddress and email', async () => {
    const user = await User.create({
      walletAddress: '0xABCDEF0000000000000000000000000000000001',
      email: 'UPPER@EXAMPLE.COM',
      name: 'Test',
    });
    expect(user.walletAddress).toBe('0xabcdef0000000000000000000000000000000001');
    expect(user.email).toBe('upper@example.com');
  });
});
