import { Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '@/shared/middleware/authenticateJWT';
import { authorizeRole } from '@/shared/middleware/authorizeRole';
import {
  createEventController,
  getEventsController,
  getEventByIdController,
} from './events.controller';

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const eventsRouter = Router();

eventsRouter.post(
  '/',
  authenticateJWT,
  authorizeRole('organizer', 'admin'),
  upload.single('poster'),
  createEventController,
);

eventsRouter.get('/', getEventsController);
eventsRouter.get('/:id', getEventByIdController);
