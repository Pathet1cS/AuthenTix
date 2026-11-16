import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from '@/features/auth/auth.routes';
import { eventsRouter } from '@/features/events/events.routes';
import { ticketsRouter } from '@/features/tickets/tickets.routes';
import { errorHandler, AppError } from '@/shared/middleware/errorHandler';

export const app = express();

// shortcut: trust proxy not set; behind a reverse proxy/Docker ingress set app.set('trust proxy', 1) or all clients share one IP

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 100, // 100 requests per IP per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, error: { message: 'Too many requests, please try again later.' } }
});

app.use(limiter);
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
