import { Router } from 'express';
import { purchaseTicketController } from './tickets.controller';
import { authenticateJWT } from '@/shared/middleware/authenticateJWT';

export const ticketsRouter = Router();

ticketsRouter.post('/purchase', authenticateJWT, purchaseTicketController);
