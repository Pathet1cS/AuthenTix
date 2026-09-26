import mongoose from 'mongoose';
import { ethers } from 'ethers';
import { setupTestDb, teardownTestDb, clearTestDb } from '@/shared/models/__tests__/setup';
import { Event } from '@/shared/models/event.model';
import { UploadFile } from '@/shared/utils/ipfs';
import { blockchainService } from '@/shared/services/blockchain.service';
import {
  createEventService,
  getEventsService,
  getEventByIdService,
} from './events.service';

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    registerEventOnChain: jest.fn().mockResolvedValue({ txHash: '0xmockCreateEventTx' }),
    mintTicketOnChain: jest.fn().mockResolvedValue({ tokenId: '1', txHash: '0xmockMintTx', blockNumber: 1 }),
  },
  withRetry: jest.fn().mockImplementation((fn) => fn()),
}));

jest.mock('@/shared/utils/ipfs', () => ({
  uploadImageToIpfs: jest.fn().mockResolvedValue('QmMockImageCID'),
  uploadJsonToIpfs: jest.fn().mockResolvedValue('QmMockMetadataCID'),
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
}));

describe('events.service', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();
  });

  describe('createEventService', () => {
    it('creates an event with posterCID supplied', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const eventData = {
        name: 'ETHDenver 2026',
        description: 'The largest Web3 developer conference.',
        eventDate: new Date(Date.now() + 86400000),
        saleDeadline: new Date(Date.now() + 43200000),
        ticketPrice: 0.1,
        maxResalePrice: 0.2,
        totalCapacity: 1000,
        posterCID: 'QmExistingPosterCID',
      };

      const event = await createEventService({ organizerId, ...eventData });

      expect(event._id).toBeDefined();
      expect(event.name).toBe('ETHDenver 2026');
      expect(event.description).toBe('The largest Web3 developer conference.');
      expect(event.remainingQuota).toBe(1000);
      expect(event.status).toBe('active');
      expect(event.posterCID).toBe('QmExistingPosterCID');
      expect(event.metadataCID).toBe('QmMockMetadataCID');
      expect(event.onChainEventId).toBe(1);
      expect(event.onChainTxHash).toBe('0xmockCreateEventTx');

      expect(blockchainService.registerEventOnChain).toHaveBeenCalledWith({
        onChainEventId: 1,
        maxResalePrice: ethers.parseEther('0.2'),
        saleDeadline: Math.floor(eventData.saleDeadline.getTime() / 1000),
        totalCapacity: 1000,
      });

      const saved = await Event.findById(event._id);
      expect(saved).not.toBeNull();
      expect(saved?.organizerId.toString()).toBe(organizerId);
      expect(saved?.onChainEventId).toBe(1);
      expect(saved?.onChainTxHash).toBe('0xmockCreateEventTx');
    });

    it('creates an event with posterFile supplied and pins both image and metadata to IPFS', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const mockPosterFile: UploadFile = {
        buffer: Buffer.from('fake-image-bytes'),
        originalName: 'poster.png',
        mimeType: 'image/png',
      };

      const eventData = {
        name: 'Devcon 2026',
        description: 'Ethereum builders gathering.',
        eventDate: new Date(Date.now() + 86400000),
        saleDeadline: new Date(Date.now() + 43200000),
        ticketPrice: 0.05,
        maxResalePrice: 0.1,
        totalCapacity: 500,
        posterFile: mockPosterFile,
      };

      const event = await createEventService({ organizerId, ...eventData });

      expect(event._id).toBeDefined();
      expect(event.name).toBe('Devcon 2026');
      expect(event.remainingQuota).toBe(500);
      expect(event.status).toBe('active');
      expect(event.posterCID).toBe('QmMockImageCID');
      expect(event.metadataCID).toBe('QmMockMetadataCID');
      expect(event.onChainEventId).toBe(1);
      expect(event.onChainTxHash).toBe('0xmockCreateEventTx');

      const saved = await Event.findById(event._id);
      expect(saved).not.toBeNull();
      expect(saved?.posterCID).toBe('QmMockImageCID');
      expect(saved?.onChainEventId).toBe(1);
      expect(saved?.onChainTxHash).toBe('0xmockCreateEventTx');
    });

    it('increments onChainEventId sequentially for subsequent events', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const baseData = {
        name: 'Event 1',
        description: 'First event',
        eventDate: new Date(Date.now() + 86400000),
        saleDeadline: new Date(Date.now() + 43200000),
        ticketPrice: 0.1,
        maxResalePrice: 0.2,
        totalCapacity: 100,
        posterCID: 'QmPoster1',
      };

      const event1 = await createEventService({ organizerId, ...baseData });
      const event2 = await createEventService({ organizerId, ...baseData, name: 'Event 2' });

      expect(event1.onChainEventId).toBe(1);
      expect(event2.onChainEventId).toBe(2);
    });

    it('throws 400 error when neither posterFile nor posterCID is provided', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const eventData = {
        name: 'No Poster Event',
        description: 'Event without any poster image or CID.',
        eventDate: new Date(Date.now() + 86400000),
        saleDeadline: new Date(Date.now() + 43200000),
        ticketPrice: 0.05,
        maxResalePrice: 0.1,
        totalCapacity: 100,
      };

      await expect(
        createEventService({ organizerId, ...eventData }),
      ).rejects.toMatchObject({
        message: 'Either poster file or posterCID must be provided',
        statusCode: 400,
      });
    });

    it('creates draft event first and leaves it as draft if on-chain registration fails', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const baseData = {
        name: 'Failing Blockchain Event',
        description: 'Testing blockchain failure handling',
        eventDate: new Date(Date.now() + 86400000),
        saleDeadline: new Date(Date.now() + 43200000),
        ticketPrice: 0.1,
        maxResalePrice: 0.2,
        totalCapacity: 100,
        posterCID: 'QmPosterFail',
      };

      (blockchainService.registerEventOnChain as jest.Mock).mockRejectedValueOnce(
        new Error('RPC Provider Timeout'),
      );

      await expect(
        createEventService({ organizerId, ...baseData }),
      ).rejects.toThrow('RPC Provider Timeout');

      const saved = await Event.findOne({ name: 'Failing Blockchain Event' });
      expect(saved).not.toBeNull();
      expect(saved?.status).toBe('draft');
      expect(saved?.onChainEventId).toBeUndefined();
    });
  });

  describe('getEventsService', () => {
    beforeEach(async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();

      await Event.create({
        organizerId,
        name: 'Solana Breakpoint',
        description: 'Solana ecosystem conference',
        eventDate: new Date(Date.now() + 86400000),
        ticketPrice: 1,
        maxResalePrice: 2,
        saleDeadline: new Date(Date.now() + 43200000),
        totalCapacity: 100,
        remainingQuota: 100,
        posterCID: 'QmPoster1',
        metadataCID: 'QmMeta1',
        status: 'active',
      });

      await Event.create({
        organizerId,
        name: 'Optimism Governance Summit',
        description: 'L2 Scaling and governance meetup',
        eventDate: new Date(Date.now() + 2 * 86400000),
        ticketPrice: 0.5,
        maxResalePrice: 1,
        saleDeadline: new Date(Date.now() + 86400000),
        totalCapacity: 200,
        remainingQuota: 200,
        posterCID: 'QmPoster2',
        metadataCID: 'QmMeta2',
        status: 'active',
      });

      await Event.create({
        organizerId,
        name: 'Arbitrum Hackathon',
        description: 'Build rollups on Arbitrum',
        eventDate: new Date(Date.now() + 3 * 86400000),
        ticketPrice: 0.2,
        maxResalePrice: 0.4,
        saleDeadline: new Date(Date.now() + 2 * 86400000),
        totalCapacity: 300,
        remainingQuota: 0,
        posterCID: 'QmPoster3',
        metadataCID: 'QmMeta3',
        status: 'soldout',
      });
    });

    it('returns paginated active events by default', async () => {
      const result = await getEventsService({ page: 1, limit: 10, status: 'active' });

      expect(result.events.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('filters by search regex in event name or description', async () => {
      const resultByName = await getEventsService({
        page: 1,
        limit: 10,
        status: 'active',
        search: 'Optimism',
      });
      expect(resultByName.events.length).toBe(1);
      expect(resultByName.events[0].name).toBe('Optimism Governance Summit');

      const resultByDesc = await getEventsService({
        page: 1,
        limit: 10,
        status: 'active',
        search: 'ecosystem',
      });
      expect(resultByDesc.events.length).toBe(1);
      expect(resultByDesc.events[0].name).toBe('Solana Breakpoint');
    });

    it('filters by status: soldout', async () => {
      const result = await getEventsService({ page: 1, limit: 10, status: 'soldout' });
      expect(result.events.length).toBe(1);
      expect(result.events[0].name).toBe('Arbitrum Hackathon');
    });

    it('returns all statuses when status is "all"', async () => {
      const result = await getEventsService({ page: 1, limit: 10, status: 'all' });
      expect(result.events.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });

    it('handles pagination with limit and pages correctly', async () => {
      const resultPage1 = await getEventsService({ page: 1, limit: 1, status: 'all' });
      expect(resultPage1.events.length).toBe(1);
      expect(resultPage1.pagination.total).toBe(3);
      expect(resultPage1.pagination.totalPages).toBe(3);

      const resultPage2 = await getEventsService({ page: 2, limit: 1, status: 'all' });
      expect(resultPage2.events.length).toBe(1);
      expect(resultPage2.events[0]._id).not.toEqual(resultPage1.events[0]._id);
    });
  });

  describe('getEventByIdService', () => {
    it('returns event by valid ObjectId', async () => {
      const organizerId = new mongoose.Types.ObjectId().toString();
      const created = await Event.create({
        organizerId,
        name: 'Single Event',
        description: 'Testing lookup by ID',
        eventDate: new Date(Date.now() + 86400000),
        ticketPrice: 0.1,
        maxResalePrice: 0.2,
        saleDeadline: new Date(Date.now() + 43200000),
        totalCapacity: 50,
        remainingQuota: 50,
        posterCID: 'QmPosterSingle',
        metadataCID: 'QmMetaSingle',
        status: 'active',
      });

      const event = await getEventByIdService(created._id.toString());
      expect(event).toBeDefined();
      expect(event?.name).toBe('Single Event');
      expect(event?._id.toString()).toBe(created._id.toString());
    });

    it('returns null if event is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const event = await getEventByIdService(nonExistentId);
      expect(event).toBeNull();
    });

    it('throws 400 error for invalid ObjectId format', async () => {
      await expect(getEventByIdService('invalid-object-id')).rejects.toMatchObject({
        message: 'Invalid event ID format',
        statusCode: 400,
      });

      await expect(getEventByIdService('12345')).rejects.toMatchObject({
        message: 'Invalid event ID format',
        statusCode: 400,
      });
    });
  });
});
