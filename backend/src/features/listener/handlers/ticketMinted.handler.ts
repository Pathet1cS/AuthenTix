import { ethers } from 'ethers';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { Event } from '@/shared/models/event.model';
import { TicketMintedEvent, ParsedEventLog } from '../listener.types';
import { getBlockTimestamp } from '../utils/blockTimestamp';

/**
 * Handler for TicketMinted blockchain events
 * 
 * Responsibilities:
 * 1. Create Ticket document in MongoDB
 * 2. Create Transaction audit log (type: 'mint')
 * 3. Decrement Event remainingQuota
 * 4. Implement idempotency (skip if already processed)
 * 
 * @param event - Parsed TicketMinted event log
 * @param provider - Ethers provider for fetching block timestamp
 */
export async function handleTicketMinted(
  event: ParsedEventLog,
  provider: ethers.Provider,
): Promise<void> {
  const { tokenId, eventId, owner, tokenURI } = event.args as TicketMintedEvent;
  const { transactionHash: txHash, blockNumber } = event;

  const tokenIdStr = tokenId.toString();
  const eventIdStr = eventId.toString();
  const ownerLower = owner.toLowerCase();

  // Idempotency check: skip if ticket already exists with same mintTxHash
  const existingTicket = await Ticket.findOne({ tokenId: tokenIdStr });
  if (existingTicket && existingTicket.mintTxHash === txHash) {
    console.log(
      `[TicketMinted] Already processed: tokenId=${tokenIdStr}, txHash=${txHash}`,
    );
    return;
  }

  // Fetch MongoDB Event document by onChainEventId
  const eventDoc = await Event.findOne({ onChainEventId: parseInt(eventIdStr) });
  if (!eventDoc) {
    console.error(
      `[TicketMinted] Event not found in database: onChainEventId=${eventIdStr}, tokenId=${tokenIdStr}`,
    );
    throw new Error(`Event ${eventIdStr} not found in database`);
  }

  // Get block timestamp for transaction audit log
  const blockTimestamp = await getBlockTimestamp(provider, blockNumber);

  // Upsert Ticket document
  await Ticket.findOneAndUpdate(
    { tokenId: tokenIdStr },
    {
      tokenId: tokenIdStr,
      eventId: eventDoc._id,
      ownerWallet: ownerLower,
      tokenURI,
      mintTxHash: txHash,
      blockNumber,
      isUsed: false,
      usedAt: null,
      isListed: false,
      resalePrice: null,
      listingTxHash: '',
      lastTransferTxHash: '',
    },
    { upsert: true, new: true },
  );

  // Upsert Transaction audit log
  await Transaction.findOneAndUpdate(
    { txHash },
    {
      txHash,
      type: 'mint',
      tokenId: tokenIdStr,
      fromWallet: ethers.ZeroAddress,
      toWallet: ownerLower,
      price: 0,
      timestamp: new Date(blockTimestamp * 1000),
      status: 'SUCCESS',
    },
    { upsert: true },
  );

  // Decrement event remaining quota
  await Event.findByIdAndUpdate(eventDoc._id, {
    $inc: { remainingQuota: -1 },
  });

  console.log(
    `[TicketMinted] Processed: tokenId=${tokenIdStr}, owner=${ownerLower}, block=${blockNumber}, txHash=${txHash}`,
  );
}
