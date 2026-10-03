import mongoose, { Schema, Document } from 'mongoose';

export type NonceScope = 'login' | 'qr-verify';

export interface IUsedNonce extends Document {
  scope: NonceScope;
  nonce: string;
  walletAddress: string;
  expiresAt: Date;
  createdAt: Date;
}

const usedNonceSchema = new Schema<IUsedNonce>(
  {
    scope: {
      type: String,
      enum: ['login', 'qr-verify'],
      required: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Atomicity primitive: a second insert with the same (scope, nonce) hits this
// unique index, which is how replay is detected.
usedNonceSchema.index({ scope: 1, nonce: 1 }, { unique: true });
// A nonce is only meaningful up to its own payload's expiry, so MongoDB can
// reap the document itself once that time passes.
usedNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UsedNonce = mongoose.model<IUsedNonce>('UsedNonce', usedNonceSchema);
