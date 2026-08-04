import mongoose from 'mongoose';

jest.mock('mongoose');
jest.mock('@/config/env', () => ({
  env: { MONGO_URI: 'mongodb://localhost:27017/authentix' },
}));

import { connectDB } from './connect';

describe('connectDB', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls mongoose.connect with MONGO_URI', async () => {
    (mongoose.connect as jest.Mock).mockResolvedValueOnce(undefined);
    await connectDB();
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/authentix');
    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('retries once on failure and succeeds on second attempt', async () => {
    const origSetTimeout = global.setTimeout;
    (global as unknown as { setTimeout: (fn: () => void) => void }).setTimeout = (fn) => fn();

    (mongoose.connect as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(undefined);

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
    global.setTimeout = origSetTimeout;
  });
});
