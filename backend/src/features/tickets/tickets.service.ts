import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { blockchainService, withRetry } from '@/shared/services/blockchain.service';
import { createError } from '@/shared/utils/appError';
import { ethers } from 'ethers';

export interface PurchaseTicketResult {
  tokenId: string;
  txHash: string;
}

export async function purchaseTicketService(
  buyerWallet: string,
  eventId: string,
): Promise<PurchaseTicketResult> {
  const normalizedWallet = buyerWallet.trim().toLowerCase();

  const event = await Event.findById(eventId);
  if (!event) {
    throw createError('Event not found', 404);
  }

  if (event.status === 'soldout' || event.remainingQuota <= 0) {
    throw createError('Event is sold out', 400);
  }

  if (event.status !== 'active') {
    throw createError('Event is not active for ticket purchase', 400);
  }

  if (new Date() > new Date(event.saleDeadline)) {
    throw createError('Ticket sale deadline has passed', 400);
  }

  if (event.onChainEventId === undefined || event.onChainEventId === null) {
    throw createError('Event is not yet registered on-chain', 500);
  }

  // Atomically decrement quota
  const updatedEvent = await Event.findOneAndUpdate(
    { _id: event._id, remainingQuota: { $gt: 0 } },
    { $inc: { remainingQuota: -1 } },
    { new: true },
  );

  if (!updatedEvent) {
    throw createError('Event is sold out', 400);
  }

  // If quota reaches 0, mark as soldout
  if (updatedEvent.remainingQuota === 0) {
    await Event.findByIdAndUpdate(event._id, { status: 'soldout' });
  }

  // Execute relayer mint with retry
  try {
    const mintResult = await withRetry(
      () =>
        blockchainService.mintTicketOnChain({
          buyerWallet: normalizedWallet,
          onChainEventId: event.onChainEventId!,
          metadataURI: event.metadataCID,
        }),
      3,
      500,
    );

    // Success persistence
    await Ticket.create({
      tokenId: mintResult.tokenId,
      eventId: event._id,
      ownerWallet: normalizedWallet,
      tokenURI: event.metadataCID,
      mintTxHash: mintResult.txHash,
      lastTransferTxHash: '',
      blockNumber: mintResult.blockNumber,
      isUsed: false,
      usedAt: null,
    });

    await Transaction.create({
      txHash: mintResult.txHash,
      type: 'mint',
      tokenId: mintResult.tokenId,
      fromWallet: ethers.ZeroAddress,
      toWallet: normalizedWallet,
      price: event.ticketPrice,
      timestamp: new Date(),
      status: 'SUCCESS',
    });

    return {
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
    };
  } catch (error: any) {
    // PRD Section 13 Failure Recovery
    const placeholderTxHash = `pending_mint_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

    console.error('[ADMIN_ALERT_MINT_FAILED] Relayer failed to mint ticket after 3 retries:', {
      buyerWallet: normalizedWallet,
      eventId: event._id.toString(),
      onChainEventId: event.onChainEventId,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
      placeholderTxHash,
    });

    await Transaction.create({
      txHash: placeholderTxHash,
      type: 'mint',
      tokenId: '0',
      fromWallet: ethers.ZeroAddress,
      toWallet: normalizedWallet,
      price: event.ticketPrice,
      timestamp: new Date(),
      status: 'PENDING_MINT',
    });

    throw createError(
      'Minting failed after retries. Transaction queued as PENDING_MINT for recovery.',
      500,
    );
  }
}
