import { z } from 'zod';

export const createResaleListingSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  price: z.number().positive('Resale price must be positive'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const cancelResaleListingSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const fulfillResalePurchaseSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid EVM transaction hash'),
});

export const myTicketsQuerySchema = z.object({
  status: z.enum(['all', 'active', 'resale', 'used']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const resaleMarketplaceQuerySchema = z.object({
  eventId: z.string().optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
