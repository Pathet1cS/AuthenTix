export interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  date: string;
  time: string;
  category: 'Concerts' | 'Tech' | 'Gaming' | 'Festivals';
  ticketPriceEth: number;
  ticketPriceUsd: number;
  maxResalePriceEth: number;
  totalCapacity: number;
  remainingQuota: number;
  posterUrl: string;
  posterCid: string;
  organizerName: string;
  organizerWallet: string;
  status: 'UPCOMING' | 'ONGOING' | 'ENDED' | 'SOLD_OUT';
}

export interface ProvenanceEntry {
  event: 'MINT' | 'TRANSFER' | 'RESALE_LIST' | 'RESALE_BUY' | 'VERIFY';
  from: string;
  to: string;
  priceEth?: number;
  timestamp: string;
  txHash: string;
}

export interface TicketItem {
  tokenId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  ownerWallet: string;
  status: 'ACTIVE' | 'USED' | 'RESALE';
  resalePriceEth?: number;
  mintedAt: string;
  txHash: string;
  tokenURI: string;
  provenanceHistory: ProvenanceEntry[];
}

export interface TransactionItem {
  id: string;
  type: 'MINT' | 'TRANSFER' | 'RESALE' | 'VERIFY';
  txHash: string;
  tokenId: string;
  fromWallet: string;
  toWallet: string;
  priceEth: number;
  timestamp: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

export interface CheckInRecord {
  id: string;
  ticketId: string;
  eventTitle: string;
  attendeeWallet: string;
  timestamp: string;
  gateId: string;
}

export interface OrganizerAnalytics {
  totalRevenueEth: number;
  totalRevenueUsd: number;
  ticketsSold: number;
  attendanceRate: number;
  activeEventsCount: number;
  recentCheckIns: CheckInRecord[];
}

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 'evt-001',
    title: 'CyberPulse Synthwave Festival 2026',
    description: 'Immerse yourself in neon aesthetics, retrowave beats, and cutting-edge holographic live stage performances in Shibuya Arena.',
    venue: 'Shibuya Cyber Dome, Tokyo',
    date: '2026-09-15',
    time: '19:00 JST',
    category: 'Concerts',
    ticketPriceEth: 0.08,
    ticketPriceUsd: 272,
    maxResalePriceEth: 0.16,
    totalCapacity: 2500,
    remainingQuota: 342,
    posterUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    organizerName: 'Neon Wave Productions',
    organizerWallet: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    status: 'UPCOMING',
  },
  {
    id: 'evt-002',
    title: 'Web3 Horizon Developer Summit',
    description: 'The premier global conference for smart contract architects, zero-knowledge researchers, and Web3 infrastructure pioneers.',
    venue: 'Convention Center, San Francisco',
    date: '2026-10-04',
    time: '09:00 PST',
    category: 'Tech',
    ticketPriceEth: 0.15,
    ticketPriceUsd: 510,
    maxResalePriceEth: 0.30,
    totalCapacity: 1200,
    remainingQuota: 88,
    posterUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmZ4tj225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo',
    organizerName: 'DevCon Foundation',
    organizerWallet: '0x3C44CdD4591936576D3758362d22b826D4e803B6',
    status: 'UPCOMING',
  },
  {
    id: 'evt-003',
    title: 'Apex Legends Pro Global Invitational',
    description: 'Witness 40 world-class esports teams battle for supremacy in a state-of-the-art arena equipped with spatial audio and AR overlays.',
    venue: 'Esports Stadium, Seoul',
    date: '2026-09-28',
    time: '14:00 KST',
    category: 'Gaming',
    ticketPriceEth: 0.05,
    ticketPriceUsd: 170,
    maxResalePriceEth: 0.10,
    totalCapacity: 3000,
    remainingQuota: 0,
    posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmP9vQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo',
    organizerName: 'Global Esports League',
    organizerWallet: '0x8b3C19C91dCd0eB5D88A1F1eF5dD3D8E2A7b258E',
    status: 'SOLD_OUT',
  },
  {
    id: 'evt-004',
    title: 'NeoTokyo Decentralized Music Fest',
    description: 'A 3-day multi-stage open air electronic festival powered entirely by decentralized ticketing, dynamic NFT passes, and Web3 loyalty rewards.',
    venue: 'Odaiba Seaside Park, Tokyo',
    date: '2026-11-12',
    time: '16:00 JST',
    category: 'Festivals',
    ticketPriceEth: 0.20,
    ticketPriceUsd: 680,
    maxResalePriceEth: 0.40,
    totalCapacity: 5000,
    remainingQuota: 1450,
    posterUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmN7bQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo',
    organizerName: 'DecentralSound Collective',
    organizerWallet: '0x99655B7D10812C5927136326d794F3116514eB0C',
    status: 'UPCOMING',
  },
  {
    id: 'evt-005',
    title: 'Ethereum Zero-Knowledge Hackathon',
    description: '48-hour continuous coding sprint focusing on zk-SNARKs, rollup scalability, and private NFT dynamic verification implementations.',
    venue: 'ETH Hub, Berlin',
    date: '2026-08-25',
    time: '10:00 CEST',
    category: 'Tech',
    ticketPriceEth: 0.02,
    ticketPriceUsd: 68,
    maxResalePriceEth: 0.04,
    totalCapacity: 500,
    remainingQuota: 45,
    posterUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmK1aQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo',
    organizerName: 'ETH Berlin Guild',
    organizerWallet: '0x1234567890abcdef1234567890abcdef12345678',
    status: 'ONGOING',
  },
  {
    id: 'evt-006',
    title: 'Metaverse Soundscape Live',
    description: 'Dual-location hybrid concert broadcasting live across physical venue acoustics and spatial audio virtual reality streams.',
    venue: 'Royal Arena, London & Web3 VR World',
    date: '2026-12-01',
    time: '20:00 GMT',
    category: 'Concerts',
    ticketPriceEth: 0.10,
    ticketPriceUsd: 340,
    maxResalePriceEth: 0.20,
    totalCapacity: 4000,
    remainingQuota: 2100,
    posterUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop',
    posterCid: 'QmM8cQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo',
    organizerName: 'Vortex Audio Lab',
    organizerWallet: '0xFE3B557E8Fb62b89F4916B721be55ceB828dBd73',
    status: 'UPCOMING',
  },
];

export const MOCK_TICKETS: TicketItem[] = [
  {
    tokenId: '#1042',
    eventId: 'evt-001',
    eventTitle: 'CyberPulse Synthwave Festival 2026',
    eventDate: '2026-09-15 19:00 JST',
    venue: 'Shibuya Cyber Dome, Tokyo',
    ownerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    status: 'ACTIVE',
    mintedAt: '2026-08-01 14:22 UTC',
    txHash: '0x9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d5c7b9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d',
    tokenURI: 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/1042.json',
    provenanceHistory: [
      {
        event: 'MINT',
        from: '0x0000000000000000000000000000000000000000',
        to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        priceEth: 0.08,
        timestamp: '2026-08-01 14:22 UTC',
        txHash: '0x9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d5c7b9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d',
      },
    ],
  },
  {
    tokenId: '#1043',
    eventId: 'evt-002',
    eventTitle: 'Web3 Horizon Developer Summit',
    eventDate: '2026-10-04 09:00 PST',
    venue: 'Convention Center, San Francisco',
    ownerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    status: 'RESALE',
    resalePriceEth: 0.18,
    mintedAt: '2026-08-05 09:10 UTC',
    txHash: '0x7b6c5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6',
    tokenURI: 'ipfs://QmZ4tj225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo/1043.json',
    provenanceHistory: [
      {
        event: 'MINT',
        from: '0x0000000000000000000000000000000000000000',
        to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        priceEth: 0.15,
        timestamp: '2026-08-05 09:10 UTC',
        txHash: '0x7b6c5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6',
      },
      {
        event: 'RESALE_BUY',
        from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        priceEth: 0.17,
        timestamp: '2026-08-10 11:45 UTC',
        txHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
      },
      {
        event: 'RESALE_LIST',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        to: 'AuthenTix Marketplace',
        priceEth: 0.18,
        timestamp: '2026-08-18 16:00 UTC',
        txHash: '0x3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2',
      },
    ],
  },
  {
    tokenId: '#1088',
    eventId: 'evt-003',
    eventTitle: 'Apex Legends Pro Global Invitational',
    eventDate: '2026-09-28 14:00 KST',
    venue: 'Esports Stadium, Seoul',
    ownerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    status: 'USED',
    mintedAt: '2026-07-20 18:30 UTC',
    txHash: '0x4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3',
    tokenURI: 'ipfs://QmP9vQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo/1088.json',
    provenanceHistory: [
      {
        event: 'MINT',
        from: '0x0000000000000000000000000000000000000000',
        to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        priceEth: 0.05,
        timestamp: '2026-07-20 18:30 UTC',
        txHash: '0x4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3',
      },
      {
        event: 'VERIFY',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        to: 'Gate #3 (Organizers)',
        timestamp: '2026-08-15 14:05 UTC',
        txHash: '0x8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
      },
    ],
  },
  {
    tokenId: '#1105',
    eventId: 'evt-004',
    eventTitle: 'NeoTokyo Decentralized Music Fest',
    eventDate: '2026-11-12 16:00 JST',
    venue: 'Odaiba Seaside Park, Tokyo',
    ownerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    status: 'ACTIVE',
    mintedAt: '2026-08-12 10:00 UTC',
    txHash: '0x2e1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1',
    tokenURI: 'ipfs://QmN7bQ225g68Vd67v64gTqZ18vB4uL9kR9WkZ4vP31mXWo/1105.json',
    provenanceHistory: [
      {
        event: 'MINT',
        from: '0x0000000000000000000000000000000000000000',
        to: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        priceEth: 0.20,
        timestamp: '2026-08-12 10:00 UTC',
        txHash: '0x2e1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1',
      },
    ],
  },
];

export const MOCK_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-001',
    type: 'MINT',
    txHash: '0x9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d5c7b9a8f4c2e1b3d5a7f9e8c6b4a2f1e3d',
    tokenId: '#1042',
    fromWallet: '0x0000000000000000000000000000000000000000',
    toWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    priceEth: 0.08,
    timestamp: '2026-08-01 14:22:10',
    status: 'SUCCESS',
  },
  {
    id: 'tx-002',
    type: 'MINT',
    txHash: '0x7b6c5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6',
    tokenId: '#1043',
    fromWallet: '0x0000000000000000000000000000000000000000',
    toWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    priceEth: 0.15,
    timestamp: '2026-08-05 09:10:44',
    status: 'SUCCESS',
  },
  {
    id: 'tx-003',
    type: 'RESALE',
    txHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    tokenId: '#1043',
    fromWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    toWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    priceEth: 0.17,
    timestamp: '2026-08-10 11:45:02',
    status: 'SUCCESS',
  },
  {
    id: 'tx-004',
    type: 'TRANSFER',
    txHash: '0x5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d',
    tokenId: '#1050',
    fromWallet: '0x3C44CdD4591936576D3758362d22b826D4e803B6',
    toWallet: '0x90F79bf6EB2c4f80806535228C2329A264bc591B',
    priceEth: 0.00,
    timestamp: '2026-08-12 15:30:19',
    status: 'SUCCESS',
  },
  {
    id: 'tx-005',
    type: 'VERIFY',
    txHash: '0x8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
    tokenId: '#1088',
    fromWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    toWallet: '0x0000...GATE3',
    priceEth: 0.00,
    timestamp: '2026-08-15 14:05:00',
    status: 'SUCCESS',
  },
  {
    id: 'tx-006',
    type: 'MINT',
    txHash: '0x2e1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1',
    tokenId: '#1105',
    fromWallet: '0x0000000000000000000000000000000000000000',
    toWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    priceEth: 0.20,
    timestamp: '2026-08-16 10:00:00',
    status: 'SUCCESS',
  },
];

export const MOCK_ANALYTICS: OrganizerAnalytics = {
  totalRevenueEth: 48.75,
  totalRevenueUsd: 165750,
  ticketsSold: 1240,
  attendanceRate: 94.2,
  activeEventsCount: 4,
  recentCheckIns: [
    {
      id: 'chk-01',
      ticketId: '#1088',
      eventTitle: 'Apex Legends Pro Global Invitational',
      attendeeWallet: '0xf39F...2266',
      timestamp: '2 mins ago',
      gateId: 'Gate A - VIP',
    },
    {
      id: 'chk-02',
      ticketId: '#1012',
      eventTitle: 'Apex Legends Pro Global Invitational',
      attendeeWallet: '0x7099...79C8',
      timestamp: '5 mins ago',
      gateId: 'Gate B - Standard',
    },
    {
      id: 'chk-03',
      ticketId: '#1005',
      eventTitle: 'Ethereum Zero-Knowledge Hackathon',
      attendeeWallet: '0x3C44...03B6',
      timestamp: '12 mins ago',
      gateId: 'Gate Main',
    },
    {
      id: 'chk-04',
      ticketId: '#1099',
      eventTitle: 'Apex Legends Pro Global Invitational',
      attendeeWallet: '0x90F7...591B',
      timestamp: '18 mins ago',
      gateId: 'Gate A - VIP',
    },
    {
      id: 'chk-05',
      ticketId: '#1002',
      eventTitle: 'Ethereum Zero-Knowledge Hackathon',
      attendeeWallet: '0x15d3...2d19',
      timestamp: '25 mins ago',
      gateId: 'Gate Main',
    },
  ],
};
