import { connectDB } from '@/shared/db/connect';
import { ListenerService } from './listener.service';

/**
 * Standalone entry point for the Blockchain Event Listener service.
 *
 * Run with: `npm run listener` (production) or `npm run listener:watch` (dev).
 * This process is independent from the Express API (`src/server.ts`) and is
 * meant to run alongside it, continuously synchronizing on-chain ticket
 * events into MongoDB. See TASK-BE-09 design spec for details:
 * docs/superpowers/specs/2026-10-01-task-be-09-event-listener-design.md
 */
async function main(): Promise<void> {
  console.log('[Listener] Initializing Event Listener Service...');

  try {
    await connectDB();

    const listener = new ListenerService();
    await listener.start();

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n[Listener] Received ${signal}, shutting down gracefully...`);
      await listener.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Listener] Fatal error during initialization:', error);
    process.exit(1);
  }
}

void main();
