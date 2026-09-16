import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendSuccess, sendError } from '@/shared/utils/response';
import { createError } from '@/shared/utils/appError';
import { UploadFile } from '@/shared/utils/ipfs';
import {
  createEventBodySchema,
  getEventsQuerySchema,
  getEventParamsSchema,
} from './events.schema';
import {
  createEventService,
  getEventsService,
  getEventByIdService,
} from './events.service';

export async function createEventController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validatedBody = createEventBodySchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    let posterFile: UploadFile | undefined;
    if (req.file) {
      posterFile = {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      };
    }

    const event = await createEventService({
      ...validatedBody,
      organizerId: userId,
      posterFile,
    });

    sendSuccess(res, event, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      next(createError(error.errors[0]?.message || 'Validation error', 400));
      return;
    }
    next(error);
  }
}

export async function getEventsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = getEventsQuerySchema.parse(req.query);
    const result = await getEventsService(query);
    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof ZodError) {
      next(createError(error.errors[0]?.message || 'Validation error', 400));
      return;
    }
    next(error);
  }
}

export async function getEventByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = getEventParamsSchema.parse(req.params);
    const event = await getEventByIdService(id);

    if (!event) {
      sendError(res, 'Event not found', 404);
      return;
    }

    sendSuccess(res, event);
  } catch (error) {
    if (error instanceof ZodError) {
      next(createError(error.errors[0]?.message || 'Validation error', 400));
      return;
    }
    next(error);
  }
}
