import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ethers } from 'ethers';
import request from 'supertest';

// Pinata is the only external service mocked; chain, Mongo, API and listener are real.
jest.mock('@/shared/utils/ipfs', () => ({
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
  uploadJsonToIpfs: jest.fn().mockResolvedValue('bafyE2EMetadata'),
  uploadFile: jest.fn().mockResolvedValue('bafyE2EPoster'),
}));

import { app } from '@/app';
import { env } from '@/config/env';
import { User } from '@/shared/models/user.model';
import { Event } from '@/shared/models/event.model';
import { Ticket } from '@/shared/models/ticket.model';
import { Transaction } from '@/shared/models/transaction.model';
import { SyncState } from '@/shared/models/syncState.model';
import { signToken } from '@/shared/utils/jwt';
import { ListenerService } from '@/features/listener/listener.service';
import { serializeQrPayload } from '@/features/tickets/tickets.validation';

const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts');
const RPC = env.RPC_URL;
// Publicly known Hardhat test keys (accounts #0, #2, #3, #4).
const KEYS = {
  relayer: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  buyer1: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  buyer2: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  organizer: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
};

let node: ChildProcess;
let mongo: MongoMemoryServer;
let provider: ethers.JsonRpcProvider;
let contract: ethers.Contract;
const wallets = {} as Record<keyof typeof KEYS, ethers.Wallet>;
const tokens: Record<string, string> = {};
let listener: ListenerService | undefined;
let eventId: string;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function eventually<T>(fn: () => Promise<T | false | null | undefined>, ms = 30000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('eventually() timed out');
    await sleep(500);
  }
}
const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

async function startListener(): Promise<ListenerService> {
  const l = new ListenerService();
  await l.start();
  return l;
}

beforeAll(async () => {
  node = spawn('npx', ['hardhat', 'node', '--port', '8546'], { cwd: CONTRACTS_DIR, shell: true });
  await eventually(async () => {
    try {
      return (await new ethers.JsonRpcProvider(RPC).getBlockNumber()) >= 0;
    } catch {
      return false;
    }
  }, 60000);

  provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  for (const k of Object.keys(KEYS) as (keyof typeof KEYS)[]) wallets[k] = new ethers.Wallet(KEYS[k], provider);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const artifact = require(path.join(CONTRACTS_DIR, 'artifacts/src/EventTicketNFT.sol/EventTicketNFT.json'));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallets.relayer);
  const deployed = await factory.deploy(wallets.relayer.address, wallets.relayer.address);
  await deployed.waitForDeployment();
  const address = await deployed.getAddress();
  const deployBlock = (await deployed.deploymentTransaction()!.wait())!.blockNumber;
  contract = new ethers.Contract(address, artifact.abi, provider);
  // env is a plain parsed object, so the already-imported config can be patched.
  (env as any).CONTRACT_ADDRESS = address;
  (env as any).CONTRACT_DEPLOYMENT_BLOCK = deployBlock;

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  for (const [who, role] of [['buyer1', 'buyer'], ['buyer2', 'buyer'], ['organizer', 'organizer']] as const) {
    const u = await User.create({ walletAddress: wallets[who].address, email: `${who}@e2e.test`, name: who, role });
    tokens[who] = signToken({ sub: String(u._id), walletAddress: u.walletAddress, role: u.role });
  }
}, 120000);

afterAll(async () => {
  await listener?.stop();
  await mongoose.disconnect();
  await mongo?.stop();
  if (node?.pid) spawn('taskkill', ['/pid', String(node.pid), '/T', '/F'], { shell: true });
});

describe('local chain end-to-end', () => {
  it('creates an event through the API and registers it on-chain', async () => {
    const day = 24 * 3600 * 1000;
    const res = await request(app).post('/api/events').set(auth('organizer')).send({
      name: 'E2E Concert',
      description: 'End to end local chain concert',
      eventDate: new Date(Date.now() + 10 * day).toISOString(),
      saleDeadline: new Date(Date.now() + 5 * day).toISOString(),
      ticketPrice: 0.01,
      maxResalePrice: 0.02,
      totalCapacity: 5,
      posterCID: 'bafyE2EPoster',
    });
    expect(res.status).toBe(201);
    eventId = res.body.data._id ?? res.body.data.event?._id ?? res.body.data.id;
    const ev = await Event.findById(eventId);
    expect(ev?.status).toBe('active');
    const onChain = await contract.events(ev!.onChainEventId);
    expect(onChain.exists).toBe(true);
    expect(onChain.totalSupply).toBe(5n);
  });

  it('starts the listener (fresh DB, catch-up from the deployment block)', async () => {
    listener = await startListener();
    expect(listener).toBeDefined();
  });

  it('purchase: relayer mints on-chain, DB and listener agree (no double quota decrement)', async () => {
    const res = await request(app).post('/api/tickets/purchase').set(auth('buyer1')).send({ eventId });
    expect(res.status).toBe(201);
    const { tokenId, txHash } = res.body.data;
    expect((await contract.ownerOf(tokenId)).toLowerCase()).toBe(wallets.buyer1.address.toLowerCase());

    // Give the live listener time to see the same mint, then check nothing was duplicated.
    await sleep(8000);
    expect(await Ticket.countDocuments({ tokenId })).toBe(1);
    expect(await Transaction.countDocuments({ txHash })).toBe(1);
    expect(await Transaction.countDocuments({ status: 'PENDING_MINT' })).toBe(0);
    expect((await Event.findById(eventId))!.remainingQuota).toBe(4);
  });

  it('resale: listing + buy are verified on-chain and mirrored in Mongo', async () => {
    const tokenId = (await Ticket.findOne({}))!.tokenId;
    const price = ethers.parseEther('0.015');
    const listTx = await (contract.connect(wallets.buyer1) as ethers.Contract).createListing(tokenId, price);
    await listTx.wait();

    const list = await request(app).post('/api/tickets/resell').set(auth('buyer1'))
      .send({ tokenId, price: 0.015, txHash: listTx.hash });
    expect(list.status).toBe(200);

    const buyTx = await (contract.connect(wallets.buyer2) as ethers.Contract).buyResoldTicket(tokenId, { value: price });
    await buyTx.wait();
    const buy = await request(app).post('/api/tickets/resell/purchase').set(auth('buyer2'))
      .send({ tokenId, txHash: buyTx.hash });
    expect(buy.status).toBe(200);

    await sleep(8000);
    const t = await Ticket.findOne({ tokenId });
    expect(t?.ownerWallet).toBe(wallets.buyer2.address.toLowerCase());
    expect(await Transaction.countDocuments({ txHash: buyTx.hash })).toBe(1);
    expect((await Transaction.findOne({ txHash: buyTx.hash }))!.type).toBe('resell');
  });

  it('verify: gate scan with the owner-signed QR marks the ticket used on-chain', async () => {
    const tokenId = (await Ticket.findOne({}))!.tokenId;
    const payload = {
      tokenId,
      walletAddress: wallets.buyer2.address.toLowerCase(),
      nonce: `n-${Date.now()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 20,
    };
    const signature = await wallets.buyer2.signMessage(serializeQrPayload(payload as any));
    const res = await request(app).post('/api/tickets/verify').set(auth('organizer')).send({ ...payload, signature });
    expect(res.status).toBe(200);
    expect(await contract.isTicketUsed(tokenId)).toBe(true);
    expect((await Ticket.findOne({ tokenId }))!.isUsed).toBe(true);

    await sleep(8000);
    expect(await Transaction.countDocuments({ tokenId, type: 'redeem' })).toBe(1);
  });

  it('recovery: events emitted while the listener is down are replayed, only the missing blocks queried', async () => {
    await listener!.stop();
    listener = undefined;
    const before = (await SyncState.findOne({}))!.lastProcessedBlock;

    // Mint straight on-chain (bypassing the API) while no listener is running, then mine filler blocks.
    const ev = (await Event.findById(eventId))!;
    const relayer = contract.connect(wallets.relayer) as ethers.Contract;
    await (await relayer.mintTicket(wallets.buyer2.address, ev.onChainEventId, 'ipfs://direct')).wait();
    for (let i = 0; i < 5; i++) await provider.send('evm_mine', []);
    const head = parseInt(await provider.send('eth_blockNumber', []), 16); // raw: provider.getBlockNumber() is cached
    const quotaBefore = (await Event.findById(eventId))!.remainingQuota;

    const spy = jest.spyOn(ethers.Contract.prototype as any, 'queryFilter');
    listener = await startListener();
    const firsts = spy.mock.calls.map((c) => c[1] as number);
    expect(Math.min(...firsts)).toBeGreaterThan(before);
    spy.mockRestore();

    const direct = await Ticket.findOne({ tokenURI: 'ipfs://direct' });
    expect(direct?.ownerWallet).toBe(wallets.buyer2.address.toLowerCase());
    expect((await Event.findById(eventId))!.remainingQuota).toBe(quotaBefore - 1);
    expect((await SyncState.findOne({}))!.lastProcessedBlock).toBe(head);
  });
});
