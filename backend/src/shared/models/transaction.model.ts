import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  txHash: string;
  type: 'mint' | 'transfer' | 'resell' | 'redeem';
  tokenId: string;
  fromWallet: string;
  toWallet: string;
  price: number;
  timestamp: Date;
  status: 'SUCCESS' | 'PENDING_MINT' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    txHash: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['mint', 'transfer', 'resell', 'redeem'],
      required: true,
    },
    tokenId: {
      type: String,
      required: true,
    },
    fromWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    toWallet: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PENDING_MINT', 'FAILED'],
      default: 'SUCCESS',
      required: true,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ tokenId: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
