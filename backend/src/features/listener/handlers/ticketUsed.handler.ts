import { ethers } from 'ethers';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { TicketUsedEvent, ParsedEventLog } from '../listener.types';
import { getBlockTimestamp } from '../utils/blockTimestamp';

/**
 * Handler for TicketUsed blockchain events
 *
 * Responsibilities:
 * 1. Mark Ticket as used (isUsed, usedAt) if not already marked
 * 2. Clear any active resale listing (used tickets cannot be resold)
 * 3. Create Transaction audit log (type: 'redeem')
 * 4. Implement idempotency (skip if already recorded)
 *
 * Note: TASK-BE-08's `POST /api/tickets/verify` already marks the ticket as
 * used in MongoDB synchronously (the source of truth for the scanner) and
 * dispatches the on-chain `markUsed` call asynchronously, recording its own
 * `redeem` Transaction once that settles. This handler acts as the
 * authoritative fallback/reconciliation path: it is idempotent against a
 * ticket that is already `isUsed: true` (it will not overwrite `usedAt`
 * again), and it still records a `redeem` Transaction for the real on-chain
 * `TicketUsed` event even if the API's own on-chain write (or its retries)
 * never completed, as well as for `markUsed` calls made outside the API
 * (e.g., directly against the contract).
 *
 * @param event - Parsed TicketUsed event log
 * @param provider - Ethers provider for fetching block timestamp
 */
export async function handleTicketUsed(
  event: ParsedEventLog,
  provider: ethers.Provider,
): Promise<void> {
  const { tokenId, eventId } = event.args as TicketUsedEvent;
  const { transactionHash: txHash, blockNumber } = event;

  const tokenIdStr = tokenId.toString();

  // Idempotency check: skip if a 'redeem' Transaction already exists for this txHash
  const existingTx = await Transaction.findOne({ txHash, type: 'redeem' });
  if (existingTx) {
    console.log(`[TicketUsed] Already processed: tokenId=${tokenIdStr}, txHash=${txHash}`);
    return;
  }

  const ticket = await Ticket.findOne({ tokenId: tokenIdStr });
  if (!ticket) {
    console.error(`[TicketUsed] Ticket not found: tokenId=${tokenIdStr}`);
    throw new Error(`Ticket ${tokenIdStr} not found in database`);
  }

  // Get block timestamp for redemption/audit log timestamps
  const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

  // Mark ticket as used (idempotent: safe even if BE-08's API already did this)
  if (!ticket.isUsed) {
    await Ticket.findOneAndUpdate(
      { tokenId: tokenIdStr },
      {
        isUsed: true,
        usedAt: new Date(blockTimestamp * 1000),
        isListed: false,
        resalePrice: null,
        listingTxHash: '',
      },
    );
  }

  // Create Transaction audit log (type: 'redeem')
  await Transaction.create({
    txHash,
    type: 'redeem',
    tokenId: tokenIdStr,
    fromWallet: ticket.ownerWallet,
    toWallet: ticket.ownerWallet,
    price: 0,
    timestamp: new Date(blockTimestamp * 1000),
    status: 'SUCCESS',
  });

  console.log(
    `[TicketUsed] Processed: tokenId=${tokenIdStr}, eventId=${eventId}, block=${blockNumber}, txHash=${txHash}`,
  );
}
