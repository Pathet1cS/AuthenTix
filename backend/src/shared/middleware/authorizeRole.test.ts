import { Request, Response, NextFunction } from 'express';
import { setupTestDB, teardownTestDB, clearCollections } from '@/shared/models/__tests__/setup';
import { User } from '@/shared/models';
import { authorizeRole } from './authorizeRole';

type Role = 'buyer' | 'organizer' | 'admin';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); jest.restoreAllMocks(); });

let seq = 0;

async function makeUser(role: Role) {
  seq += 1;
  return User.create({
    walletAddress: `0x${String(seq).padStart(40, '0')}`,
    email: `user${seq}@example.com`,
    name: `User ${seq}`,
    role,
  });
}

async function run(roles: Role[], user?: { userId: string; role: Role }) {
  const req = {
    user: user
      ? { userId: user.userId, walletAddress: '0xabc', role: user.role }
      : undefined,
  } as Request;
  const next = jest.fn() as unknown as NextFunction;
  await authorizeRole(...roles)(req, {} as Response, next);
  return next as unknown as jest.Mock;
}

describe('authorizeRole — claim-based gating', () => {
  it('calls next with no error when the role matches', async () => {
    const user = await makeUser('organizer');
    expect(await run(['organizer'], { userId: String(user._id), role: 'organizer' }))
      .toHaveBeenCalledWith();
  });

  it('rejects a role that is not permitted with 403', async () => {
    const user = await makeUser('buyer');
    expect(await run(['organizer'], { userId: String(user._id), role: 'buyer' }))
      .toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Insufficient permissions', statusCode: 403 }),
      );
  });

  it('accepts any of several permitted roles', async () => {
    const admin = await makeUser('admin');
    const organizer = await makeUser('organizer');
    expect(await run(['organizer', 'admin'], { userId: String(admin._id), role: 'admin' }))
      .toHaveBeenCalledWith();
    expect(
      await run(['organizer', 'admin'], { userId: String(organizer._id), role: 'organizer' }),
    ).toHaveBeenCalledWith();
  });

  it('rejects a role outside a multi-role list', async () => {
    const user = await makeUser('buyer');
    expect(await run(['organizer', 'admin'], { userId: String(user._id), role: 'buyer' }))
      .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects with 401 when authenticateJWT has not run', async () => {
    expect(await run(['organizer'])).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('rejects everything when the permitted list is empty', async () => {
    const user = await makeUser('admin');
    expect(await run([], { userId: String(user._id), role: 'admin' }))
      .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe('authorizeRole — privileged gates re-read the stored role', () => {
  it('denies a token claim that the database has since demoted', async () => {
    const user = await makeUser('organizer');
    await User.findByIdAndUpdate(user._id, { role: 'buyer' });

    // The 7-day token still claims organizer; the gate must not honour it.
    expect(await run(['organizer'], { userId: String(user._id), role: 'organizer' }))
      .toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Insufficient permissions', statusCode: 403 }),
      );
  });

  it('honours a promotion that happened after the token was issued', async () => {
    const user = await makeUser('buyer');
    await User.findByIdAndUpdate(user._id, { role: 'organizer' });

    expect(await run(['organizer'], { userId: String(user._id), role: 'buyer' }))
      .toHaveBeenCalledWith();
  });

  it('rejects with 401 when the user no longer exists', async () => {
    const user = await makeUser('organizer');
    const userId = String(user._id);
    await User.findByIdAndDelete(userId);

    expect(await run(['organizer'], { userId, role: 'organizer' })).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing authentication token', statusCode: 401 }),
    );
  });

  it('reads the database for an admin gate too', async () => {
    const user = await makeUser('buyer');
    const spy = jest.spyOn(User, 'findById');

    await run(['admin'], { userId: String(user._id), role: 'admin' });

    expect(spy).toHaveBeenCalledWith(String(user._id));
  });

  it('passes an unexpected database error to next instead of rejecting', async () => {
    const user = await makeUser('organizer');
    const boom = new Error('db down');
    jest.spyOn(User, 'findById').mockImplementation(() => {
      throw boom;
    });

    // Express 4 would not catch a rejection escaping an async handler.
    expect(await run(['organizer'], { userId: String(user._id), role: 'organizer' }))
      .toHaveBeenCalledWith(boom);
  });
});

describe('authorizeRole — buyer gates stay off the database', () => {
  it('does not query the database for a buyer-only gate', async () => {
    const user = await makeUser('buyer');
    const spy = jest.spyOn(User, 'findById');

    expect(await run(['buyer'], { userId: String(user._id), role: 'buyer' }))
      .toHaveBeenCalledWith();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not query the database when denying a buyer-only gate', async () => {
    const user = await makeUser('organizer');
    const spy = jest.spyOn(User, 'findById');

    expect(await run(['buyer'], { userId: String(user._id), role: 'organizer' }))
      .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(spy).not.toHaveBeenCalled();
  });
});
