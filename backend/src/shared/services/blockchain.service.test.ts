jest.mock('@/config/env', () => ({
  env: {
    RPC_URL: 'https://sepolia.optimism.io',
    CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
    RELAYER_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
}));

import { withRetry, BlockchainService, blockchainService } from './blockchain.service';
import { ethers } from 'ethers';

describe('Blockchain Service & withRetry', () => {
  describe('withRetry', () => {
    it('should resolve immediately if operation succeeds on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry up to maxRetries times on failure and succeed if later attempt passes', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('RPC timeout'))
        .mockRejectedValueOnce(new Error('Nonce too low'))
        .mockResolvedValue('recovered');

      const result = await withRetry(mockFn, 3, 10);
      expect(result).toBe('recovered');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw last error when all retries are exhausted', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent RPC error'));
      await expect(withRetry(mockFn, 3, 10)).rejects.toThrow('Persistent RPC error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('BlockchainService contract calls', () => {
    let mockContract: any;
    let service: BlockchainService;

    beforeEach(() => {
      mockContract = {
        createEvent: jest.fn(),
        mintTicket: jest.fn(),
        interface: {
          parseLog: jest.fn(),
        },
      };

      service = new BlockchainService(mockContract);
    });

    it('should call contract.createEvent and return txHash', async () => {
      mockContract.createEvent.mockResolvedValue({
        hash: '0xcreateEventTxHash',
        wait: jest.fn().mockResolvedValue({ status: 1 }),
      });

      const res = await service.registerEventOnChain({
        onChainEventId: 1,
        maxResalePrice: ethers.parseEther('0.05'),
        saleDeadline: Math.floor(Date.now() / 1000) + 3600,
        totalCapacity: 100,
      });

      expect(res.txHash).toBe('0xcreateEventTxHash');
      expect(mockContract.createEvent).toHaveBeenCalledWith(
        1,
        ethers.parseEther('0.05'),
        expect.any(Number),
        100,
      );
    });

    it('should throw if createEvent transaction reverts', async () => {
      mockContract.createEvent.mockResolvedValue({
        hash: '0xfailedCreateEventTx',
        wait: jest.fn().mockResolvedValue({ status: 0 }),
      });

      await expect(
        service.registerEventOnChain({
          onChainEventId: 1,
          maxResalePrice: ethers.parseEther('0.05'),
          saleDeadline: Math.floor(Date.now() / 1000) + 3600,
          totalCapacity: 100,
        }),
      ).rejects.toThrow('Failed to register event on-chain: transaction reverted');
    });

    it('should call contract.mintTicket, parse TicketMinted event and return tokenId and txHash', async () => {
      const mockReceipt = {
        status: 1,
        hash: '0xmintTxHash',
        blockNumber: 123456,
        logs: [
          {
            topics: ['0xtopic'],
            data: '0xdata',
          },
        ],
      };

      mockContract.mintTicket.mockResolvedValue({
        hash: '0xmintTxHash',
        wait: jest.fn().mockResolvedValue(mockReceipt),
      });

      mockContract.interface.parseLog.mockReturnValue({
        name: 'TicketMinted',
        args: {
          tokenId: 42n,
          eventId: 1n,
          owner: '0x1234567890123456789012345678901234567890',
          tokenURI: 'ipfs://QmMetadata',
        },
      });

      const res = await service.mintTicketOnChain({
        buyerWallet: '0x1234567890123456789012345678901234567890',
        onChainEventId: 1,
        metadataURI: 'ipfs://QmMetadata',
      });

      expect(res.tokenId).toBe('42');
      expect(res.txHash).toBe('0xmintTxHash');
      expect(res.blockNumber).toBe(123456);
      expect(mockContract.mintTicket).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        1,
        'ipfs://QmMetadata',
      );
    });

    it('should throw if transaction reverts', async () => {
      mockContract.mintTicket.mockResolvedValue({
        hash: '0xfailedTx',
        wait: jest.fn().mockResolvedValue({ status: 0 }),
      });

      await expect(
        service.mintTicketOnChain({
          buyerWallet: '0x1234567890123456789012345678901234567890',
          onChainEventId: 1,
          metadataURI: 'ipfs://QmMetadata',
        }),
      ).rejects.toThrow('Transaction reverted on-chain');
    });

    it('should throw if TicketMinted event is not found in receipt logs', async () => {
      const mockReceipt = {
        status: 1,
        hash: '0xmintTxHash',
        blockNumber: 123456,
        logs: [
          {
            topics: ['0xtopic'],
            data: '0xdata',
          },
        ],
      };

      mockContract.mintTicket.mockResolvedValue({
        hash: '0xmintTxHash',
        wait: jest.fn().mockResolvedValue(mockReceipt),
      });

      mockContract.interface.parseLog.mockReturnValue(null);

      await expect(
        service.mintTicketOnChain({
          buyerWallet: '0x1234567890123456789012345678901234567890',
          onChainEventId: 1,
          metadataURI: 'ipfs://QmMetadata',
        }),
      ).rejects.toThrow('TicketMinted event not found in transaction logs');
    });

    it('should instantiate default BlockchainService instance without error', () => {
      expect(blockchainService).toBeInstanceOf(BlockchainService);
      const defaultService = new BlockchainService();
      expect(defaultService).toBeInstanceOf(BlockchainService);
    });
  });
});
