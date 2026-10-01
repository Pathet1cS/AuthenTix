import { ethers } from 'ethers';

/**
 * In-memory cache for block timestamps
 * Reduces redundant RPC calls when processing multiple events from the same block
 */
const blockTimestampCache = new Map<number, number>();

/**
 * Fetch block timestamp with caching
 * 
 * @param provider - Ethers provider instance
 * @param blockNumber - Block number to fetch timestamp for
 * @returns Unix timestamp (seconds since epoch)
 * @throws Error if block not found
 */
export async function getBlockTimestamp(
  provider: ethers.Provider,
  blockNumber: number,
): Promise<number> {
  // Check cache first
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber)!;
  }

  // Fetch from blockchain
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    throw new Error(`Block ${blockNumber} not found`);
  }

  // Cache and return
  blockTimestampCache.set(blockNumber, block.timestamp);
  return block.timestamp;
}

/**
 * Clear the timestamp cache (useful for testing or memory management)
 */
export function clearBlockTimestampCache(): void {
  blockTimestampCache.clear();
}
