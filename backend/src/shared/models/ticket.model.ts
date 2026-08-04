import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITicket extends Document {
  tokenId: number;
  eventId: Types.ObjectId;
  ownerWallet: string;
  tokenURI: string;
  mintTxHash: string;
  lastTransferTxHash: string;
  blockNumber: number;
  isUsed: boolean;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    tokenId: {
      type: Number,
      required: true,
      unique: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    ownerWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    tokenURI: {
      type: String,
      required: true,
    },
    mintTxHash: {
      type: String,
      required: true,
    },
    lastTransferTxHash: {
      type: String,
      default: '',
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

ticketSchema.index({ eventId: 1, ownerWallet: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
