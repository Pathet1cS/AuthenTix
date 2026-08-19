const mockUploadImage = jest.fn();
const mockUploadJson = jest.fn();

jest.mock('@/shared/utils/ipfs', () => ({
  uploadImageToIpfs: (...args: unknown[]) => mockUploadImage(...args),
  uploadJsonToIpfs: (...args: unknown[]) => mockUploadJson(...args),
  toIpfsUri: (cid: string) => `ipfs://${cid}`,
}));

import { buildEventMetadata, uploadEventAssets } from './event.metadata';

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

beforeEach(() => {
  mockUploadImage.mockReset();
  mockUploadJson.mockReset();
});

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

  it('accepts the Unix epoch, which is falsy but valid', () => {
    const metadata = buildEventMetadata({ ...input, eventDate: new Date(0) });
    expect(metadata.attributes[0].value).toBe(0);
  });
});

describe('buildEventMetadata invalid dates', () => {
  function thrown(build: () => unknown): unknown {
    try {
      build();
    } catch (err) {
      return err;
    }
    return new Error('expected buildEventMetadata to throw');
  }

  it('rejects an Invalid Date event date rather than emitting a null attribute', () => {
    expect(thrown(() => buildEventMetadata({ ...input, eventDate: new Date('not a date') })))
      .toMatchObject({ message: 'Invalid event date', statusCode: 400 });
  });

  it('rejects an Invalid Date sale deadline', () => {
    expect(thrown(() => buildEventMetadata({ ...input, saleDeadline: new Date('nonsense') })))
      .toMatchObject({ message: 'Invalid sale deadline', statusCode: 400 });
  });

  it('never lets a NaN attribute reach JSON.stringify as null', () => {
    // The regression this guards: JSON.stringify(NaN) === 'null', which is not
    // a legal Erc721Attribute value and cannot be corrected once pinned.
    expect(() => JSON.stringify(buildEventMetadata({ ...input, eventDate: new Date(NaN) })))
      .toThrow('Invalid event date');
  });
});

describe('uploadEventAssets', () => {
  const poster = {
    buffer: Buffer.from([0xff, 0xd8, 0xff]),
    originalName: 'poster.jpg',
    mimeType: 'image/jpeg',
  };

  const { posterCID: _ignored, ...eventInput } = input;

  it('returns both CIDs', async () => {
    mockUploadImage.mockResolvedValue('bafyPoster');
    mockUploadJson.mockResolvedValue('bafyMetadata');

    await expect(uploadEventAssets(poster, eventInput)).resolves.toEqual({
      posterCID: 'bafyPoster',
      metadataCID: 'bafyMetadata',
    });
  });

  it('uploads metadata that references the poster CID just returned', async () => {
    mockUploadImage.mockResolvedValue('bafyFresh');
    mockUploadJson.mockResolvedValue('bafyMetadata');

    await uploadEventAssets(poster, eventInput);

    expect(mockUploadImage).toHaveBeenCalledWith(poster);
    const [metadata, name] = mockUploadJson.mock.calls[0];
    expect(metadata.image).toBe('ipfs://bafyFresh');
    expect(name).toBe('metadata.json');
  });

  it('does not attempt the metadata upload when the poster upload fails', async () => {
    mockUploadImage.mockRejectedValue(
      Object.assign(new Error('IPFS upload failed'), { statusCode: 502 }),
    );

    await expect(uploadEventAssets(poster, eventInput)).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });
    expect(mockUploadJson).not.toHaveBeenCalled();
  });

  it('propagates a metadata upload failure', async () => {
    mockUploadImage.mockResolvedValue('bafyPoster');
    mockUploadJson.mockRejectedValue(
      Object.assign(new Error('IPFS upload failed'), { statusCode: 502 }),
    );

    await expect(uploadEventAssets(poster, eventInput)).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('rejects an Invalid Date event date before uploading anything', async () => {
    await expect(
      uploadEventAssets(poster, { ...eventInput, eventDate: new Date('not a date') }),
    ).rejects.toMatchObject({ message: 'Invalid event date', statusCode: 400 });

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockUploadJson).not.toHaveBeenCalled();
  });

  it('rejects an Invalid Date sale deadline before uploading anything', async () => {
    await expect(
      uploadEventAssets(poster, { ...eventInput, saleDeadline: new Date('nonsense') }),
    ).rejects.toMatchObject({ message: 'Invalid sale deadline', statusCode: 400 });

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockUploadJson).not.toHaveBeenCalled();
  });
});
