import {
  createEventBodySchema,
  getEventsQuerySchema,
  getEventParamsSchema,
} from './events.schema';

describe('events.schema', () => {
  describe('createEventBodySchema', () => {
    it('passes with valid event input data', () => {
      const valid = {
        name: 'Web3 Hackathon 2026',
        description: 'Join us for a 48-hour builder festival on Optimism.',
        eventDate: new Date(Date.now() + 86400000).toISOString(),
        saleDeadline: new Date(Date.now() + 43200000).toISOString(),
        ticketPrice: 0.05,
        maxResalePrice: 0.1,
        totalCapacity: 500,
        posterCID: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      };
      const result = createEventBodySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('fails when maxResalePrice is less than ticketPrice', () => {
      const invalid = {
        name: 'Web3 Hackathon 2026',
        description: 'Join us for a 48-hour builder festival on Optimism.',
        eventDate: new Date(Date.now() + 86400000).toISOString(),
        saleDeadline: new Date(Date.now() + 43200000).toISOString(),
        ticketPrice: 0.1,
        maxResalePrice: 0.05,
        totalCapacity: 500,
        posterCID: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      };
      const result = createEventBodySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('fails when saleDeadline is after eventDate', () => {
      const invalid = {
        name: 'Web3 Hackathon 2026',
        description: 'Join us for a 48-hour builder festival on Optimism.',
        eventDate: new Date(Date.now() + 43200000).toISOString(),
        saleDeadline: new Date(Date.now() + 86400000).toISOString(),
        ticketPrice: 0.05,
        maxResalePrice: 0.1,
        totalCapacity: 500,
        posterCID: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      };
      const result = createEventBodySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('getEventsQuerySchema', () => {
    it('parses valid query string numbers and defaults', () => {
      const result = getEventsQuerySchema.safeParse({
        page: '2',
        limit: '20',
        status: 'active',
        search: 'hackathon',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(20);
        expect(result.data.status).toBe('active');
        expect(result.data.search).toBe('hackathon');
      }
    });

    it('applies default values when query params are omitted', () => {
      const result = getEventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.status).toBe('active');
        expect(result.data.search).toBeUndefined();
      }
    });
  });

  describe('getEventParamsSchema', () => {
    it('validates MongoDB ObjectId parameter', () => {
      const valid = getEventParamsSchema.safeParse({ id: '60c72b2f9b1d8b0015b5b4e1' });
      expect(valid.success).toBe(true);

      const invalid = getEventParamsSchema.safeParse({ id: 'invalid-id' });
      expect(invalid.success).toBe(false);
    });

    it('rejects an invalid hex length for MongoDB ObjectId', () => {
      const invalidShort = getEventParamsSchema.safeParse({ id: '60c72b2f' });
      expect(invalidShort.success).toBe(false);
    });
  });
});
