import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { versionKey: false },
);

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

export async function getNextSequence(sequenceName: string): Promise<number> {
  const result = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return result!.seq;
}
