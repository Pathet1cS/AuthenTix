import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  purchaseTicketService,
  getMyTicketsService,
  createResaleListingService,
  cancelResaleListingService,
  fulfillResalePurchaseService,
  getResaleMarketplaceService,
} from './tickets.service';
import {
  createResaleListingSchema,
  cancelResaleListingSchema,
  fulfillResalePurchaseSchema,
  myTicketsQuerySchema,
  resaleMarketplaceQuerySchema,
} from './tickets.validation';
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

export async function getMyTicketsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated buyer wallet required', 401);
    }

    const parsed = myTicketsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid query parameters', 400);
    }

    const result = await getMyTicketsService(req.user.walletAddress, parsed.data);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function createResaleListingController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated seller wallet required', 401);
    }

    const parsed = createResaleListingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid request body', 400);
    }

    const result = await createResaleListingService(req.user.walletAddress, parsed.data);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function cancelResaleListingController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated seller wallet required', 401);
    }

    const tokenId = req.params.tokenId;
    if (!tokenId) {
      throw createError('Token ID is required', 400);
    }

    const parsed = cancelResaleListingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid request body', 400);
    }

    const result = await cancelResaleListingService(
      req.user.walletAddress,
      tokenId,
      parsed.data.txHash,
    );
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function fulfillResalePurchaseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.user.walletAddress) {
      throw createError('Authenticated buyer wallet required', 401);
    }

    const parsed = fulfillResalePurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid request body', 400);
    }

    const result = await fulfillResalePurchaseService(req.user.walletAddress, parsed.data);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function getResaleMarketplaceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = resaleMarketplaceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid query parameters', 400);
    }

    const result = await getResaleMarketplaceService(parsed.data);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}
