const mockUploadImage = jest.fn();
const mockUploadJson = jest.fn();

jest.mock('@/shared/utils/ipfs', () => ({
  uploadImageToIpfs: (...args: unknown[]) => mockUploadImage(...args),
  uploadJsonToIpfs: (...args: unknown[]) => mockUploadJson(...args),
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
}));

import { buildEventMetadata } from './event.metadata';

const input = {
  name: 'Web3 Conference',
  description: 'A conference about Web3 technologies',
  posterCID: 'bafyPoster',
  eventDate: new Date('2026-12-01T00:00:00.000Z'),
  saleDeadline: new Date('2026-11-30T00:00:00.000Z'),
  ticketPrice: 50000,
  maxResalePrice: 75000,
  totalCapacity: 500,
};

describe('buildEventMetadata', () => {
  it('produces the documented ERC-721 shape', () => {
    expect(buildEventMetadata(input)).toEqual({
      name: 'Web3 Conference',
      description: 'A conference about Web3 technologies',
      image: 'ipfs://bafyPoster',
      attributes: [
        { trait_type: 'Event Date', display_type: 'date', value: 1796083200 },
        { trait_type: 'Sale Deadline', display_type: 'date', value: 1795996800 },
        { trait_type: 'Ticket Price', value: 50000 },
        { trait_type: 'Max Resale Price', value: 75000 },
        { trait_type: 'Total Capacity', value: 500 },
      ],
    });
  });

  it('references the poster through the ipfs scheme', () => {
    expect(buildEventMetadata({ ...input, posterCID: 'bafyOther' }).image).toBe('ipfs://bafyOther');
  });

  it('converts dates to Unix seconds, not milliseconds', () => {
    const metadata = buildEventMetadata(input);
    expect(metadata.attributes[0].value).toBe(input.eventDate.getTime() / 1000);
    expect(metadata.attributes[1].value).toBe(input.saleDeadline.getTime() / 1000);
  });
});
