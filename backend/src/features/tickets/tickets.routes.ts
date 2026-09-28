import { Router } from 'express';
import {
  purchaseTicketController,
  getMyTicketsController,
  createResaleListingController,
  cancelResaleListingController,
  fulfillResalePurchaseController,
  getResaleMarketplaceController,
  verifyTicketController,
} from './tickets.controller';
import { authenticateJWT } from '@/shared/middleware/authenticateJWT';
import { authorizeRole } from '@/shared/middleware/authorizeRole';

export const ticketsRouter = Router();

// Primary purchase (TASK-BE-06)
ticketsRouter.post('/purchase', authenticateJWT, purchaseTicketController);

// User's tickets (TASK-BE-07)
ticketsRouter.get('/my', authenticateJWT, getMyTicketsController);

// Dynamic QR verification (TASK-BE-08) - scanned by organizer/admin gate staff
ticketsRouter.post(
  '/verify',
  authenticateJWT,
  authorizeRole('organizer', 'admin'),
  verifyTicketController,
);

// Resale marketplace (TASK-BE-07) - Public endpoint
ticketsRouter.get('/resale', getResaleMarketplaceController);

// Resale lifecycle (TASK-BE-07)
ticketsRouter.post('/resell/purchase', authenticateJWT, fulfillResalePurchaseController);
ticketsRouter.post('/resell', authenticateJWT, createResaleListingController);
ticketsRouter.delete('/resell/:tokenId', authenticateJWT, cancelResaleListingController);

