import { ethers } from 'ethers';
import { env } from '@/config/env';
import { createError } from '@/shared/utils/appError';

export const EVENT_TICKET_NFT_ABI = [
  'function createEvent(uint256 eventId, uint256 maxResalePrice, uint256 saleDeadline, uint256 totalSupply) external',
  'function mintTicket(address buyer, uint256 eventId, string calldata metadataURI) external returns (uint256)',
  'event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner, string tokenURI)',
];

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500,
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

export interface RegisterEventParams {
  onChainEventId: number;
  maxResalePrice: bigint;
  saleDeadline: number;
  totalCapacity: number;
}

export interface MintTicketParams {
  buyerWallet: string;
  onChainEventId: number;
  metadataURI: string;
}

export class BlockchainService {
  private _contract?: ethers.Contract;

  constructor(customContract?: ethers.Contract) {
    if (customContract) {
      this._contract = customContract;
    }
  }

  private get contract(): ethers.Contract {
    if (!this._contract) {
      const provider = new ethers.JsonRpcProvider(env.RPC_URL);
      const wallet = new ethers.Wallet(env.RELAYER_PRIVATE_KEY, provider);
      this._contract = new ethers.Contract(env.CONTRACT_ADDRESS, EVENT_TICKET_NFT_ABI, wallet);
    }
    return this._contract;
  }

  async registerEventOnChain(params: RegisterEventParams): Promise<{ txHash: string }> {
    const tx = await this.contract.createEvent(
      params.onChainEventId,
      params.maxResalePrice,
      params.saleDeadline,
      params.totalCapacity,
    );

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw createError('Failed to register event on-chain: transaction reverted', 500);
    }

    return { txHash: tx.hash };
  }

  async mintTicketOnChain(
    params: MintTicketParams,
  ): Promise<{ tokenId: string; txHash: string; blockNumber: number }> {
    const tx = await this.contract.mintTicket(
      params.buyerWallet,
      params.onChainEventId,
      params.metadataURI,
    );

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction reverted on-chain', 500);
    }

    let tokenId: string | null = null;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed && parsed.name === 'TicketMinted') {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Log not from this contract event interface, continue
        }
      }
    }

    if (!tokenId) {
      throw createError('TicketMinted event not found in transaction logs', 500);
    }

    return {
      tokenId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }
}

export const blockchainService = new BlockchainService();
