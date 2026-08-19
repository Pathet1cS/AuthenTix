import { createError } from './appError';

describe('createError', () => {
  it('returns an Error carrying the given message and statusCode', () => {
    const err = createError('Invalid signature', 401);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Invalid signature');
    expect(err.statusCode).toBe(401);
  });
});
