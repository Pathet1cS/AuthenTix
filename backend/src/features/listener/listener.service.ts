import { ethers } from 'ethers';
import { env } from '@/config/env';
import { SyncState } from '@/shared/models/syncState.model';
import { EVENT_TICKET_NFT_ABI } from '@/shared/services/blockchain.service';
import { handleTicketMinted } from './handlers/ticketMinted.handler';
import { handleTicketTransferred } from './handlers/ticketTransferred.handler';
import { handleTicketUsed } from './handlers/ticketUsed.handler';
import { ParsedEventLog } from './listener.types';

const KNOWN_EVENT_NAMES = ['TicketMinted', 'TicketTransferred', 'TicketUsed'] as const;

/**
 * ListenerService orchestrates blockchain event synchronization:
 * - On startup, catches up on all events missed since the last checkpoint.
 * - After catch-up, subscribes to live events for real-time processing.
 *
 * See design spec: docs/superpowers/specs/2026-10-01-task-be-09-event-listener-design.md
 */
export class ListenerService {
  private provider!: ethers.WebSocketProvider | ethers.JsonRpcProvider;
  private contract!: ethers.Contract;
  private isListening = false;

  async start(): Promise<void> {
    console.log('[Listener] Starting Event Listener Service...');

    this.connectProvider();
    await this.catchUpFromLastCheckpoint();
    await this.subscribeToEvents();

    console.log('[Listener] Service is now running and listening for events.');
  }

  private connectProvider(): void {
    try {
      if (env.WS_RPC_URL) {
        this.provider = new ethers.WebSocketProvider(env.WS_RPC_URL);
        console.log('[Listener] Using WebSocket provider for real-time events.');
      } else {
        this.provider = new ethers.JsonRpcProvider(env.RPC_URL);
        console.log('[Listener] WS_RPC_URL not set, using HTTP polling provider.');
      }

      this.contract = new ethers.Contract(
        env.CONTRACT_ADDRESS,
        EVENT_TICKET_NFT_ABI,
        this.provider,
      );
    } catch (error) {
      console.error('[Listener] Failed to initialize provider:', error);
      throw error;
    }
  }

  /**
   * Replays all historical events between the last recorded checkpoint
   * (`SyncState.lastProcessedBlock`) and the current chain head, in
   * chronological order, before real-time subscription begins. This is
   * what allows the service to recover state after any amount of downtime.
   */
  private async catchUpFromLastCheckpoint(): Promise<void> {
    console.log('[Listener] Starting catch-up from last checkpoint...');

    const syncState = await SyncState.findOne({});
    const fromBlock = syncState?.lastProcessedBlock ?? env.CONTRACT_DEPLOYMENT_BLOCK;
    const toBlock = await this.provider.getBlockNumber();

    console.log(`[Listener] Catch-up range: block ${fromBlock} to ${toBlock}`);

    if (fromBlock >= toBlock) {
      console.log('[Listener] Already up-to-date, no catch-up needed.');
      return;
    }

    const batchSize = env.LISTENER_BATCH_SIZE;

    for (let start = fromBlock + 1; start <= toBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, toBlock);

      console.log(`[Listener] Querying logs from block ${start} to ${end}...`);

      const [mintedLogs, transferredLogs, usedLogs] = await Promise.all([
        this.contract.queryFilter('TicketMinted', start, end),
        this.contract.queryFilter('TicketTransferred', start, end),
        this.contract.queryFilter('TicketUsed', start, end),
      ]);

      const allLogs = [...mintedLogs, ...transferredLogs, ...usedLogs]
        .filter((log): log is ethers.EventLog => 'args' in log)
        .map((log) => this.parseEventLog(log))
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
          return a.logIndex - b.logIndex;
        });

      console.log(`[Listener] Processing ${allLogs.length} events...`);

      for (const log of allLogs) {
        await this.processEvent(log);
      }

      // Checkpoint is only advanced after every event in the batch has been
      // processed successfully. If processEvent throws, this line is never
      // reached, so a restart will safely retry the same range (idempotent
      // handlers make this safe) rather than silently skipping failed events.
      await SyncState.findOneAndUpdate({}, { lastProcessedBlock: end }, { upsert: true });

      console.log(`[Listener] Checkpoint updated to block ${end}`);
    }

    console.log('[Listener] Catch-up complete.');
  }

  private parseEventLog(log: ethers.EventLog): ParsedEventLog {
    return {
      eventName: log.eventName,
      args: log.args as unknown as ParsedEventLog['args'],
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };
  }

  private async processEvent(log: ParsedEventLog): Promise<void> {
    if (!KNOWN_EVENT_NAMES.includes(log.eventName as (typeof KNOWN_EVENT_NAMES)[number])) {
      return;
    }

    try {
      if (log.eventName === 'TicketMinted') {
        await handleTicketMinted(log, this.provider);
      } else if (log.eventName === 'TicketTransferred') {
        await handleTicketTransferred(log, this.provider);
      } else if (log.eventName === 'TicketUsed') {
        await handleTicketUsed(log, this.provider);
      }
    } catch (error) {
      console.error(`[Listener] Error processing ${log.eventName} event:`, error);
      throw error;
    }
  }

  private async subscribeToEvents(): Promise<void> {
    // Implemented in Task 7.
    console.log('[Listener] Real-time subscription not yet implemented.');
  }

  async stop(): Promise<void> {
    console.log('[Listener] Stopping listener service...');

    if (this.contract) {
      await this.contract.removeAllListeners();
    }

    if (this.provider && 'destroy' in this.provider) {
      await (this.provider as ethers.WebSocketProvider).destroy();
    }

    this.isListening = false;
    console.log('[Listener] Listener service stopped.');
  }
}
