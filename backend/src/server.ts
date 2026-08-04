import { app } from './app';
import { connectDB } from '@/shared/db/connect';
import { env } from '@/config/env';

async function start(): Promise<void> {
  await connectDB();
  app.listen(Number(env.PORT), () => {
    console.log(`🚀 AuthenTix API running on port ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
