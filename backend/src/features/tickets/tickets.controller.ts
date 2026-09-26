import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { purchaseTicketService } from './tickets.service';
import { sendSuccess } from '@/shared/utils/response';
import { createError } from '@/shared/utils/appError';

const purchaseSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
});

export async function purchaseTicketController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid request body', 400);
    }

    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated buyer wallet required', 401);
    }

    const result = await purchaseTicketService(req.user.walletAddress, parsed.data.eventId);

    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}
