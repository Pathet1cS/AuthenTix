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

    describe('resale receipt verification methods', () => {
      let mockProvider: any;

      beforeEach(() => {
        mockProvider = {
          getTransactionReceipt: jest.fn(),
        };
        mockContract.runner = { provider: mockProvider };
      });

      describe('verifyListingCreatedOnChain', () => {
        it('should successfully verify a valid ListingCreated transaction', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54321,
            logs: [{ topics: ['0xtopic'], data: '0xdata' }],
          });

          mockContract.interface.parseLog.mockReturnValue({
            name: 'ListingCreated',
            args: {
              tokenId: BigInt(1),
              seller: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              price: ethers.parseEther('0.06'),
            },
          });

          const result = await service.verifyListingCreatedOnChain({
            txHash: '0xlistTx',
            tokenId: '1',
            sellerWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            expectedPriceWei: ethers.parseEther('0.06'),
          });

          expect(result.blockNumber).toBe(54321);
          expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith('0xlistTx');
        });

        it('should throw 502 if transaction was not mined or reverted', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({ status: 0 });

          await expect(
            service.verifyListingCreatedOnChain({
              txHash: '0xrevertedTx',
              tokenId: '1',
              sellerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              expectedPriceWei: ethers.parseEther('0.06'),
            }),
          ).rejects.toThrow('Transaction failed or was not mined on-chain');
        });

        it('should throw 400 if listing price in log does not match expected price', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54321,
            logs: [{ topics: ['0xtopic'], data: '0xdata' }],
          });

          mockContract.interface.parseLog.mockReturnValue({
            name: 'ListingCreated',
            args: {
              tokenId: BigInt(1),
              seller: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              price: ethers.parseEther('0.07'),
            },
          });

          await expect(
            service.verifyListingCreatedOnChain({
              txHash: '0xlistTx',
              tokenId: '1',
              sellerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              expectedPriceWei: ethers.parseEther('0.06'),
            }),
          ).rejects.toThrow('On-chain listing price does not match specified price');
        });

        it('should throw 502 if ListingCreated log not found for tokenId and seller', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54321,
            logs: [{ topics: ['0xtopic'], data: '0xdata' }],
          });

          mockContract.interface.parseLog.mockReturnValue(null);

          await expect(
            service.verifyListingCreatedOnChain({
              txHash: '0xlistTx',
              tokenId: '1',
              sellerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              expectedPriceWei: ethers.parseEther('0.06'),
            }),
          ).rejects.toThrow('ListingCreated event not found or parameters do not match');
        });
      });

      describe('verifyListingCancelledOnChain', () => {
        it('should successfully verify a valid ListingCancelled transaction', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54322,
            logs: [{ topics: ['0xtopic'], data: '0xdata' }],
          });

          mockContract.interface.parseLog.mockReturnValue({
            name: 'ListingCancelled',
            args: {
              tokenId: BigInt(1),
              seller: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            },
          });

          const result = await service.verifyListingCancelledOnChain({
            txHash: '0xcancelTx',
            tokenId: '1',
            sellerWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          });

          expect(result.blockNumber).toBe(54322);
        });

        it('should throw 502 if ListingCancelled event not found or seller mismatch', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54322,
            logs: [{ topics: ['0xtopic'], data: '0xdata' }],
          });

          mockContract.interface.parseLog.mockReturnValue({
            name: 'ListingCancelled',
            args: {
              tokenId: BigInt(1),
              seller: '0xdifferentSeller',
            },
          });

          await expect(
            service.verifyListingCancelledOnChain({
              txHash: '0xcancelTx',
              tokenId: '1',
              sellerWallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            }),
          ).rejects.toThrow('ListingCancelled event not found or parameters do not match');
        });
      });

      describe('verifyListingSoldOnChain', () => {
        it('should successfully verify a valid ListingSold & TicketTransferred transaction', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54323,
            logs: [
              { topics: ['0xtopic1'], data: '0xdata1' },
              { topics: ['0xtopic2'], data: '0xdata2' },
            ],
          });

          mockContract.interface.parseLog
            .mockReturnValueOnce({
              name: 'ListingSold',
              args: {
                tokenId: BigInt(1),
                seller: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                buyer: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
                price: ethers.parseEther('0.06'),
              },
            })
            .mockReturnValueOnce({
              name: 'TicketTransferred',
              args: {
                tokenId: BigInt(1),
                from: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
                to: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
              },
            });

          const result = await service.verifyListingSoldOnChain({
            txHash: '0xbuyTx',
            tokenId: '1',
            buyerWallet: '0x3C44CDDDB6A900FA2B585DD299E03D12FA4293BC',
          });

          expect(result.blockNumber).toBe(54323);
          expect(result.sellerWallet).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
          expect(result.priceWei).toBe(ethers.parseEther('0.06'));
        });

        it('should throw 502 if buyer does not match caller in ListingSold', async () => {
          mockProvider.getTransactionReceipt.mockResolvedValue({
            status: 1,
            blockNumber: 54323,
            logs: [{ topics: ['0xtopic1'], data: '0xdata1' }],
          });

          mockContract.interface.parseLog.mockReturnValue({
            name: 'ListingSold',
            args: {
              tokenId: BigInt(1),
              seller: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
              buyer: '0xdifferentBuyer',
              price: ethers.parseEther('0.06'),
            },
          });

          await expect(
            service.verifyListingSoldOnChain({
              txHash: '0xbuyTx',
              tokenId: '1',
              buyerWallet: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
            }),
          ).rejects.toThrow('ListingSold event not found or parameters do not match');
        });
      });
    });
  });
});
