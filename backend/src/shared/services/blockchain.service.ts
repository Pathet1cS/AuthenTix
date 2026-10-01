import { ethers } from 'ethers';
import { env } from '@/config/env';
import { createError } from '@/shared/utils/appError';

export const EVENT_TICKET_NFT_ABI = [
  'function createEvent(uint256 eventId, uint256 maxResalePrice, uint256 saleDeadline, uint256 totalSupply) external',
  'function mintTicket(address buyer, uint256 eventId, string calldata metadataURI) external returns (uint256)',
  'event TicketMinted(uint256 indexed tokenId, uint256 indexed eventId, address indexed owner, string tokenURI)',
  'event ListingCreated(uint256 indexed tokenId, address indexed seller, uint256 price)',
  'event ListingCancelled(uint256 indexed tokenId, address indexed seller)',
  'event ListingSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)',
  'event TicketTransferred(uint256 indexed tokenId, address indexed from, address indexed to)',
  'event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function resaleListings(uint256 tokenId) external view returns (address seller, uint256 price, bool isActive)',
  'function markUsed(uint256 tokenId) external',
  'event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId)',
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

  private get provider(): ethers.Provider {
    const runner = this.contract.runner as any;
    if (runner?.provider) return runner.provider;
    if (runner && typeof runner.getTransactionReceipt === 'function') return runner;
    return new ethers.JsonRpcProvider(env.RPC_URL);
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

  async ownerOfOnChain(tokenId: string): Promise<string> {
    try {
      const owner: string = await this.contract.ownerOf(tokenId);
      return owner.toLowerCase();
    } catch {
      throw createError('Failed to query ticket owner on-chain', 502);
    }
  }

  async markUsedOnChain(
    tokenId: string,
  ): Promise<{ txHash: string; blockNumber: number; alreadyUsed: boolean }> {
    let tx;
    try {
      tx = await this.contract.markUsed(tokenId);
    } catch (error: any) {
      const reason = error?.reason ?? error?.shortMessage ?? error?.message ?? '';
      // A retry can legitimately land here if a prior attempt's transaction
      // actually confirmed after the caller had already timed out waiting for
      // it — the contract's own double-redemption guard is proof the
      // redemption already happened, not a new failure.
      if (typeof reason === 'string' && reason.includes('Ticket already used')) {
        return { txHash: '', blockNumber: 0, alreadyUsed: true };
      }
      throw createError('Failed to submit redemption transaction', 500);
    }

    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction reverted on-chain', 500);
    }

    return { txHash: tx.hash, blockNumber: receipt.blockNumber, alreadyUsed: false };
  }

  async verifyListingCreatedOnChain(params: {
    txHash: string;
    tokenId: string;
    sellerWallet: string;
    expectedPriceWei: bigint;
  }): Promise<{ blockNumber: number }> {
    const receipt = await this.provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction failed or was not mined on-chain', 502);
    }

    let found = false;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed && parsed.name === 'ListingCreated') {
            const tokenIdStr = parsed.args.tokenId.toString();
            const seller = (parsed.args.seller as string).toLowerCase();
            const price = BigInt(parsed.args.price);

            if (tokenIdStr === params.tokenId && seller === params.sellerWallet.trim().toLowerCase()) {
              if (price !== params.expectedPriceWei) {
                throw createError('On-chain listing price does not match specified price', 400);
              }
              found = true;
              break;
            }
          }
        } catch (err: any) {
          if (err.statusCode) throw err;
        }
      }
    }

    if (!found) {
      throw createError('ListingCreated event not found or parameters do not match', 502);
    }

    return { blockNumber: receipt.blockNumber };
  }

  async verifyListingCancelledOnChain(params: {
    txHash: string;
    tokenId: string;
    sellerWallet: string;
  }): Promise<{ blockNumber: number }> {
    const receipt = await this.provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction failed or was not mined on-chain', 502);
    }

    let found = false;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed && parsed.name === 'ListingCancelled') {
            const tokenIdStr = parsed.args.tokenId.toString();
            const seller = (parsed.args.seller as string).trim().toLowerCase();

            if (tokenIdStr === params.tokenId && seller === params.sellerWallet.trim().toLowerCase()) {
              found = true;
              break;
            }
          }
        } catch {
          // Continue
        }
      }
    }

    if (!found) {
      throw createError('ListingCancelled event not found or parameters do not match', 502);
    }

    return { blockNumber: receipt.blockNumber };
  }

  async verifyListingSoldOnChain(params: {
    txHash: string;
    tokenId: string;
    buyerWallet: string;
  }): Promise<{ sellerWallet: string; priceWei: bigint; blockNumber: number }> {
    const receipt = await this.provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw createError('Transaction failed or was not mined on-chain', 502);
    }

    let sellerWallet: string | null = null;
    let priceWei: bigint | null = null;

    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          if (parsed && parsed.name === 'ListingSold') {
            const tokenIdStr = parsed.args.tokenId.toString();
            const buyer = (parsed.args.buyer as string).trim().toLowerCase();

            if (tokenIdStr === params.tokenId && buyer === params.buyerWallet.trim().toLowerCase()) {
              sellerWallet = (parsed.args.seller as string).trim().toLowerCase();
              priceWei = BigInt(parsed.args.price);
              break;
            }
          }
        } catch {
          // Continue
        }
      }
    }

    if (!sellerWallet || priceWei === null) {
      throw createError('ListingSold event not found or parameters do not match', 502);
    }

    return {
      sellerWallet,
      priceWei,
      blockNumber: receipt.blockNumber,
    };
  }
}

export const blockchainService = new BlockchainService();
