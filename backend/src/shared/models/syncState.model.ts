import mongoose, { Schema, Document } from 'mongoose';

export interface ISyncState extends Document {
  lastProcessedBlock: number;
  updatedAt: Date;
}

const syncStateSchema = new Schema<ISyncState>(
  {
    lastProcessedBlock: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true },
);

export const SyncState = mongoose.model<ISyncState>('SyncState', syncStateSchema);
