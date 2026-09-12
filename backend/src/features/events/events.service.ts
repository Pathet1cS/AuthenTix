import mongoose, { FilterQuery } from 'mongoose';
import { Event, IEvent } from '@/shared/models/event.model';
import { UploadFile, uploadJsonToIpfs } from '@/shared/utils/ipfs';
import { buildEventMetadata, uploadEventAssets } from './event.metadata';
import { createError } from '@/shared/utils/appError';

export interface CreateEventServiceParams {
  organizerId: string;
  name: string;
  description: string;
  eventDate: Date;
  saleDeadline: Date;
  ticketPrice: number;
  maxResalePrice: number;
  totalCapacity: number;
  posterCID?: string;
  posterFile?: UploadFile;
}

export async function createEventService(params: CreateEventServiceParams): Promise<IEvent> {
  let posterCID = params.posterCID;
  let metadataCID: string;

  if (params.posterFile) {
    const assets = await uploadEventAssets(params.posterFile, {
      name: params.name,
      description: params.description,
      eventDate: params.eventDate,
      saleDeadline: params.saleDeadline,
      ticketPrice: params.ticketPrice,
      maxResalePrice: params.maxResalePrice,
      totalCapacity: params.totalCapacity,
    });
    posterCID = assets.posterCID;
    metadataCID = assets.metadataCID;
  } else if (posterCID) {
    const metadata = buildEventMetadata({
      name: params.name,
      description: params.description,
      posterCID,
      eventDate: params.eventDate,
      saleDeadline: params.saleDeadline,
      ticketPrice: params.ticketPrice,
      maxResalePrice: params.maxResalePrice,
      totalCapacity: params.totalCapacity,
    });
    metadataCID = await uploadJsonToIpfs(metadata, 'metadata.json');
  } else {
    throw createError('Either poster file or posterCID must be provided', 400);
  }

  const newEvent = await Event.create({
    organizerId: new mongoose.Types.ObjectId(params.organizerId),
    name: params.name,
    description: params.description,
    eventDate: params.eventDate,
    ticketPrice: params.ticketPrice,
    maxResalePrice: params.maxResalePrice,
    saleDeadline: params.saleDeadline,
    totalCapacity: params.totalCapacity,
    remainingQuota: params.totalCapacity,
    posterCID,
    metadataCID,
    status: 'active',
  });

  return newEvent;
}

export interface GetEventsServiceQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'soldout' | 'ended' | 'all';
  search?: string;
}

export interface PaginatedEventsResult {
  events: IEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getEventsService(query: GetEventsServiceQuery): Promise<PaginatedEventsResult> {
  const filter: FilterQuery<IEvent> = {};

  const status = query.status ?? 'active';
  if (status !== 'all') {
    filter.status = status;
  }

  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [{ name: regex }, { description: regex }];
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(filter).sort({ eventDate: 1 }).skip(skip).limit(limit).exec(),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getEventByIdService(id: string): Promise<IEvent | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Invalid event ID format', 400);
  }

  const event = await Event.findById(id).exec();
  return event;
}
