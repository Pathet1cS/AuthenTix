import { Request, Response, NextFunction } from 'express';
import {
  createEventController,
  getEventsController,
  getEventByIdController,
} from './events.controller';
import * as eventsService from './events.service';

jest.mock('@/config/env', () => ({
  env: {
    PORT: '3001',
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long!',
    THIRDWEB_CLIENT_ID: 'test-client-id',
    THIRDWEB_SECRET_KEY: 'test-secret-key',
    RELAYER_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    PINATA_JWT: 'test-pinata-jwt',
    PINATA_GATEWAY: 'test.mypinata.cloud',
    CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
    RPC_URL: 'http://127.0.0.1:8545',
    AUTH_DOMAIN: 'localhost:3000',
  },
}));

jest.mock('@/shared/utils/ipfs', () => ({
  uploadImageToIpfs: jest.fn().mockResolvedValue('QmMockPosterCID'),
  uploadJsonToIpfs: jest.fn().mockResolvedValue('QmMockMetadataCID'),
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
}));

jest.mock('@/shared/services/blockchain.service', () => ({
  blockchainService: {
    registerEventOnChain: jest.fn().mockResolvedValue({ txHash: '0xmockCreateEventTx' }),
    mintTicketOnChain: jest.fn().mockResolvedValue({ tokenId: '1', txHash: '0xmockMintTx', blockNumber: 1 }),
  },
  withRetry: jest.fn().mockImplementation((fn) => fn()),
}));

jest.mock('./events.service');

describe('events.controller', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn();
  });

  const createMockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
  };

  describe('createEventController', () => {
    it('returns 401 Unauthorized if req.user is undefined', async () => {
      const req = {
        body: {
          name: 'Test Fest',
          description: 'Description test',
          eventDate: new Date(Date.now() + 86400000).toISOString(),
          saleDeadline: new Date(Date.now() + 43200000).toISOString(),
          ticketPrice: 0.1,
          maxResalePrice: 0.2,
          totalCapacity: 100,
          posterCID: 'QmTestCID',
        },
      } as unknown as Request;
      const res = createMockResponse();

      await createEventController(req, res, mockNext as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized',
        }),
      );
    });

    it('creates an event successfully and returns 201 with on-chain fields', async () => {
      const mockEvent = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Fest',
        onChainEventId: 1,
        onChainTxHash: '0xmockCreateEventTx',
      };
      (eventsService.createEventService as jest.Mock).mockResolvedValue(mockEvent);

      const req = {
        body: {
          name: 'Test Fest',
          description: 'Description test',
          eventDate: new Date(Date.now() + 86400000).toISOString(),
          saleDeadline: new Date(Date.now() + 43200000).toISOString(),
          ticketPrice: 0.1,
          maxResalePrice: 0.2,
          totalCapacity: 100,
          posterCID: 'QmTestCID',
        },
        user: { userId: '507f1f77bcf86cd799439012' },
      } as unknown as Request;
      const res = createMockResponse();

      await createEventController(req, res, mockNext as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockEvent,
        }),
      );
    });

    it('forwards validation error to next with 400 when body is invalid', async () => {
      const req = {
        body: { name: '' },
        user: { userId: '507f1f77bcf86cd799439012' },
      } as unknown as Request;
      const res = createMockResponse();

      await createEventController(req, res, mockNext as unknown as NextFunction);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
        }),
      );
    });
  });

  describe('getEventsController', () => {
    it('returns 200 with paginated events', async () => {
      const mockResult = {
        events: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      (eventsService.getEventsService as jest.Mock).mockResolvedValue(mockResult);

      const req = {
        query: { page: '1', limit: '10' },
      } as unknown as Request;
      const res = createMockResponse();

      await getEventsController(req, res, mockNext as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        }),
      );
    });
  });

  describe('getEventByIdController', () => {
    it('returns 200 with event when found', async () => {
      const mockEvent = { _id: '507f1f77bcf86cd799439011', name: 'Found Event' };
      (eventsService.getEventByIdService as jest.Mock).mockResolvedValue(mockEvent);

      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
      } as unknown as Request;
      const res = createMockResponse();

      await getEventByIdController(req, res, mockNext as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockEvent,
        }),
      );
    });

    it('returns 404 when event is not found', async () => {
      (eventsService.getEventByIdService as jest.Mock).mockResolvedValue(null);

      const req = {
        params: { id: '507f1f77bcf86cd799439011' },
      } as unknown as Request;
      const res = createMockResponse();

      await getEventByIdController(req, res, mockNext as unknown as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Event not found',
        }),
      );
    });
  });
});
