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

export interface GetMyTicketsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export async function getMyTicketsService(
  walletAddress: string,
  query: GetMyTicketsQuery,
) {
  const normalizedWallet = walletAddress.trim().toLowerCase();
  const filter: any = { ownerWallet: normalizedWallet };

  if (query.status === 'active') {
    filter.isUsed = false;
    filter.isListed = false;
  } else if (query.status === 'resale') {
    filter.isListed = true;
  } else if (query.status === 'used') {
    filter.isUsed = true;
  }

  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 10;
  const skip = (page - 1) * limit;

  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .populate('eventId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    tickets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export interface CreateResaleListingData {
  tokenId: string;
  price: number;
  txHash: string;
}

export async function createResaleListingService(
  sellerWallet: string,
  data: CreateResaleListingData,
) {
  const normalizedSeller = sellerWallet.trim().toLowerCase();

  const ticket = await Ticket.findOne({ tokenId: data.tokenId });
  if (!ticket) {
    throw createError('Ticket not found', 404);
  }

  if (ticket.ownerWallet !== normalizedSeller) {
    throw createError('You do not own this ticket', 403);
  }

  if (ticket.isUsed) {
    throw createError('Cannot list an already redeemed ticket', 400);
  }

  if (ticket.isListed) {
    throw createError('Ticket is already listed for resale', 409);
  }

  const event = await Event.findById(ticket.eventId);
  if (!event) {
    throw createError('Event not found', 404);
  }

  if (data.price > event.maxResalePrice) {
    throw createError(
      `Resale price exceeds maximum allowed cap of ${event.maxResalePrice} ETH`,
      400,
    );
  }

  if (new Date() > new Date(event.saleDeadline)) {
    throw createError('Event sale deadline has passed', 400);
  }

  const expectedPriceWei = ethers.parseEther(data.price.toString());
  await blockchainService.verifyListingCreatedOnChain({
    txHash: data.txHash,
    tokenId: data.tokenId,
    sellerWallet: normalizedSeller,
    expectedPriceWei,
  });

  const updatedTicket = await Ticket.findOneAndUpdate(
    { tokenId: data.tokenId, ownerWallet: normalizedSeller, isListed: false },
    { isListed: true, resalePrice: data.price, listingTxHash: data.txHash },
    { new: true },
  );

  if (!updatedTicket) {
    throw createError('Ticket is already listed for resale', 409);
  }

  await Transaction.create({
    txHash: data.txHash,
    type: 'resell',
    tokenId: data.tokenId,
    fromWallet: normalizedSeller,
    toWallet: ethers.ZeroAddress,
    price: data.price,
    timestamp: new Date(),
    status: 'SUCCESS',
  });

  return updatedTicket;
}

export async function cancelResaleListingService(
  sellerWallet: string,
  tokenId: string,
  txHash: string,
) {
  const normalizedSeller = sellerWallet.trim().toLowerCase();

  const ticket = await Ticket.findOne({ tokenId });
  if (!ticket) {
    throw createError('Ticket not found', 404);
  }

  if (ticket.ownerWallet !== normalizedSeller) {
    throw createError('You do not own this ticket', 403);
  }

  if (!ticket.isListed) {
    throw createError('Ticket is not currently listed for resale', 400);
  }

  await blockchainService.verifyListingCancelledOnChain({
    txHash,
    tokenId,
    sellerWallet: normalizedSeller,
  });

  const updatedTicket = await Ticket.findOneAndUpdate(
    { tokenId, ownerWallet: normalizedSeller, isListed: true },
    { isListed: false, resalePrice: null, listingTxHash: '' },
    { new: true },
  );

  if (!updatedTicket) {
    throw createError('Ticket is not currently listed for resale', 400);
  }

  return updatedTicket;
}

export interface FulfillResalePurchaseData {
  tokenId: string;
  txHash: string;
}

export async function fulfillResalePurchaseService(
  buyerWallet: string,
  data: FulfillResalePurchaseData,
) {
  const normalizedBuyer = buyerWallet.trim().toLowerCase();

  const ticket = await Ticket.findOne({ tokenId: data.tokenId });
  if (!ticket) {
    throw createError('Ticket not found', 404);
  }

  if (!ticket.isListed) {
    throw createError('Ticket is not listed for resale', 400);
  }

  const verifyResult = await blockchainService.verifyListingSoldOnChain({
    txHash: data.txHash,
    tokenId: data.tokenId,
    buyerWallet: normalizedBuyer,
  });

  const priceEth = Number(ethers.formatEther(verifyResult.priceWei));

  const updatedTicket = await Ticket.findOneAndUpdate(
    { tokenId: data.tokenId, isListed: true },
    {
      ownerWallet: normalizedBuyer,
      isListed: false,
      resalePrice: null,
      listingTxHash: '',
      lastTransferTxHash: data.txHash,
    },
    { new: true },
  );

  if (!updatedTicket) {
    throw createError('Ticket resale already fulfilled or inactive', 409);
  }

  await Transaction.create({
    txHash: data.txHash,
    type: 'resell',
    tokenId: data.tokenId,
    fromWallet: verifyResult.sellerWallet,
    toWallet: normalizedBuyer,
    price: priceEth,
    timestamp: new Date(),
    status: 'SUCCESS',
  });

  return updatedTicket;
}

export interface GetResaleMarketplaceQuery {
  eventId?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

export async function getResaleMarketplaceService(
  query: GetResaleMarketplaceQuery,
) {
  const filter: any = { isListed: true };
  if (query.eventId) {
    filter.eventId = query.eventId;
  }

  const sortOption: any = {};
  if (query.sortBy === 'price_asc') {
    sortOption.resalePrice = 1;
  } else if (query.sortBy === 'price_desc') {
    sortOption.resalePrice = -1;
  } else {
    sortOption.updatedAt = -1;
  }

  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 20;
  const skip = (page - 1) * limit;

  const total = await Ticket.countDocuments(filter);
  const listings = await Ticket.find(filter)
    .populate('eventId')
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  return {
    listings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

