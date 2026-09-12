import { z } from 'zod';

export const createEventBodySchema = z
  .object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(120, 'Name must be under 120 characters'),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description max 2000 chars'),
    eventDate: z
      .string()
      .datetime()
      .or(z.date())
      .transform((val) => new Date(val)),
    saleDeadline: z
      .string()
      .datetime()
      .or(z.date())
      .transform((val) => new Date(val)),
    ticketPrice: z.coerce.number().min(0, 'Ticket price must be >= 0'),
    maxResalePrice: z.coerce.number().min(0, 'Max resale price must be >= 0'),
    totalCapacity: z.coerce.number().int().min(1, 'Total capacity must be at least 1'),
    posterCID: z.string().optional(),
  })
  .refine((data) => data.maxResalePrice >= data.ticketPrice, {
    message: 'Max resale price cannot be less than ticket price',
    path: ['maxResalePrice'],
  })
  .refine((data) => data.saleDeadline <= data.eventDate, {
    message: 'Sale deadline cannot be after event date',
    path: ['saleDeadline'],
  });

export const getEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['active', 'soldout', 'ended', 'all']).default('active'),
  search: z.string().optional(),
});

export const getEventParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
});

export type CreateEventInput = z.infer<typeof createEventBodySchema>;
export type GetEventsQueryInput = z.infer<typeof getEventsQuerySchema>;
