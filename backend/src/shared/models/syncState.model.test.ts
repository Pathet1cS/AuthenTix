import { setupTestDB, teardownTestDB, clearCollections } from './__tests__/setup';
import { SyncState } from './syncState.model';

beforeAll(async () => { await setupTestDB(); }, 30_000);
afterAll(async () => { await teardownTestDB(); });
afterEach(async () => { await clearCollections(); });

describe('SyncState model', () => {
  it('creates with default lastProcessedBlock of 0', async () => {
    const state = await SyncState.create({});
    expect(state.lastProcessedBlock).toBe(0);
    expect(state.updatedAt).toBeInstanceOf(Date);
  });

  it('stores explicit block number', async () => {
    const state = await SyncState.create({ lastProcessedBlock: 42000 });
    expect(state.lastProcessedBlock).toBe(42000);
  });

  it('updates lastProcessedBlock', async () => {
    const state = await SyncState.create({ lastProcessedBlock: 100 });
    state.lastProcessedBlock = 200;
    await state.save();
    const updated = await SyncState.findById(state._id);
    expect(updated!.lastProcessedBlock).toBe(200);
  });
});
