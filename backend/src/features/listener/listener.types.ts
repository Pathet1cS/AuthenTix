import { ethers } from 'ethers';

/**
 * TicketMinted event payload
 * Emitted when: Backend mints a new ticket via relayer
 */
export interface TicketMintedEvent {
  tokenId: bigint;
  eventId: bigint;
  owner: string;
  tokenURI: string;
}

/**
 * TicketTransferred event payload
 * Emitted when: User transfers ticket (resale or direct wallet transfer)
 */
export interface TicketTransferredEvent {
  tokenId: bigint;
  from: string;
  to: string;
}

/**
 * TicketUsed event payload
 * Emitted when: Organizer marks ticket as used (QR scan verification)
 */
export interface TicketUsedEvent {
  tokenId: bigint;
  eventId: bigint;
}

/**
 * Parsed event log with standardized structure
 * Used internally by listener service to process events uniformly
 */
export interface ParsedEventLog {
  eventName: string;
  args: TicketMintedEvent | TicketTransferredEvent | TicketUsedEvent;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
}
