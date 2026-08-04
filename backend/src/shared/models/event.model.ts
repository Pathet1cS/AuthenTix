import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  organizerId: Types.ObjectId;
  name: string;
  description: string;
  eventDate: Date;
  ticketPrice: string;
  maxResalePrice: string;
  saleDeadline: Date;
  totalCapacity: number;
  remainingQuota: number;
  posterCID: string;
  status: 'draft' | 'active' | 'ended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    ticketPrice: {
      type: String,
      required: true,
    },
    maxResalePrice: {
      type: String,
      required: true,
    },
    saleDeadline: {
      type: Date,
      required: true,
    },
    totalCapacity: {
      type: Number,
      required: true,
      min: 1,
    },
    remainingQuota: {
      type: Number,
      required: true,
      min: 0,
    },
    posterCID: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'ended', 'cancelled'],
      default: 'draft',
    },
  },
  { timestamps: true },
);

eventSchema.index({ status: 1, eventDate: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
