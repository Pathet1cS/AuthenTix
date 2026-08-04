import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from '@/features/auth/auth.routes';
import { eventsRouter } from '@/features/events/events.routes';
import { ticketsRouter } from '@/features/tickets/tickets.routes';
import { errorHandler, AppError } from '@/shared/middleware/errorHandler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);

app.use((_req, _res, next) => {
  const err: AppError = new Error('Route not found');
  err.statusCode = 404;
  next(err);
});

app.use(errorHandler);
