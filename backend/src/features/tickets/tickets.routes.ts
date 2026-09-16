import { Router } from 'express';
import {
  purchaseTicketController,
  getMyTicketsController,
  createResaleListingController,
  cancelResaleListingController,
  fulfillResalePurchaseController,
  getResaleMarketplaceController,
} from './tickets.controller';
import { authenticateJWT } from '@/shared/middleware/authenticateJWT';

export const ticketsRouter = Router();

// Primary purchase (TASK-BE-06)
ticketsRouter.post('/purchase', authenticateJWT, purchaseTicketController);

// User's tickets (TASK-BE-07)
ticketsRouter.get('/my', authenticateJWT, getMyTicketsController);

// Resale marketplace (TASK-BE-07) - Public endpoint
ticketsRouter.get('/resale', getResaleMarketplaceController);

// Resale lifecycle (TASK-BE-07)
ticketsRouter.post('/resell/purchase', authenticateJWT, fulfillResalePurchaseController);
ticketsRouter.post('/resell', authenticateJWT, createResaleListingController);
ticketsRouter.delete('/resell/:tokenId', authenticateJWT, cancelResaleListingController);

