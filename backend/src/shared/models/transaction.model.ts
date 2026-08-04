import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  txHash: string;
  type: 'mint' | 'transfer' | 'resell';
  tokenId: number;
  fromWallet: string;
  toWallet: string;
  price: string;
  timestamp: Date;
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
      enum: ['mint', 'transfer', 'resell'],
      required: true,
    },
    tokenId: {
      type: Number,
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
      type: String,
      default: '0',
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ tokenId: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
