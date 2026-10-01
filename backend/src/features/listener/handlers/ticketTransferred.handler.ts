import { ethers } from 'ethers';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { TicketTransferredEvent, ParsedEventLog } from '../listener.types';
import { getBlockTimestamp } from '../utils/blockTimestamp';

/**
 * Handler for TicketTransferred blockchain events
 *
 * Responsibilities:
 * 1. Update Ticket ownership (ownerWallet, lastTransferTxHash)
 * 2. Clear any active resale listing (a transfer invalidates it)
 * 3. Create Transaction audit log (type: 'transfer')
 * 4. Implement idempotency (skip if txHash already recorded)
 *
 * Note: When a resale purchase occurs via `buyResoldTicket`, both
 * `ListingSold` and `TicketTransferred` are emitted in the same transaction.
 * The resale API flow (TASK-BE-07) already creates a `Transaction` with
 * `type: 'resell'` and `txHash` set to that same hash. Because the
 * idempotency check here looks up `Transaction.findOne({ txHash })`
 * regardless of `type`, a resale-driven transfer is correctly skipped by
 * this handler (it was already synchronized by the API), while a direct
 * wallet-to-wallet transfer (no prior Transaction record) is recorded here
 * with `type: 'transfer'`.
 *
 * @param event - Parsed TicketTransferred event log
 * @param provider - Ethers provider for fetching block timestamp
 */
export async function handleTicketTransferred(
  event: ParsedEventLog,
  provider: ethers.Provider,
): Promise<void> {
  const { tokenId, from, to } = event.args as TicketTransferredEvent;
  const { transactionHash: txHash, blockNumber } = event;

  const tokenIdStr = tokenId.toString();
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();

  // Idempotency check: skip if a Transaction already exists for this txHash
  // (either already processed by this handler, or by the resale API flow)
  const existingTx = await Transaction.findOne({ txHash });
  if (existingTx) {
    console.log(
      `[TicketTransferred] Already processed: tokenId=${tokenIdStr}, txHash=${txHash}, type=${existingTx.type}`,
    );
    return;
  }

  // Get block timestamp for transaction audit log
  const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

  // Update Ticket ownership
  const ticket = await Ticket.findOneAndUpdate(
    { tokenId: tokenIdStr },
    {
      ownerWallet: toLower,
      lastTransferTxHash: txHash,
      blockNumber,
      isListed: false, // Transfer clears any active listing
      resalePrice: null,
      listingTxHash: '',
    },
    { new: true },
  );

  if (!ticket) {
    console.error(`[TicketTransferred] Ticket not found: tokenId=${tokenIdStr}`);
    throw new Error(`Ticket ${tokenIdStr} not found in database`);
  }

  // Create Transaction audit log (type: 'transfer' for direct wallet transfers)
  await Transaction.create({
    txHash,
    type: 'transfer',
    tokenId: tokenIdStr,
    fromWallet: fromLower,
    toWallet: toLower,
    price: 0,
    timestamp: new Date(blockTimestamp * 1000),
    status: 'SUCCESS',
  });

  console.log(
    `[TicketTransferred] Processed: tokenId=${tokenIdStr}, from=${fromLower}, to=${toLower}, block=${blockNumber}, txHash=${txHash}`,
  );
}
