import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | null = null;

export async function setupTestDB(): Promise<void> {
  if (!mongo) {
    mongo = await MongoMemoryServer.create();
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongo.getUri());
  }
}

export async function teardownTestDB(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export const setupTestDb = setupTestDB;
export const teardownTestDb = teardownTestDB;
export const clearTestDb = clearCollections;

