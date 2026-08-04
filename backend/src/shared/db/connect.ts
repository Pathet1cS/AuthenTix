import mongoose from 'mongoose';
import { env } from '@/config/env';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed, retrying in 1s...', err);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ MongoDB connected (retry)');
  }
}
