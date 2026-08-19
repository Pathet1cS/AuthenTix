import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/response';
import { createError } from '@/shared/utils/appError';
import { loginRequestSchema } from './auth.schema';
import { login } from './auth.service';

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError('Invalid login payload', 400);
    }

    sendSuccess(res, await login(parsed.data));
  } catch (err) {
    next(err);
  }
}
