jest.mock('@/config/env', () => ({
  env: { PINATA_JWT: 'test-jwt', PINATA_GATEWAY: '' },
}));

const mockUploadFile = jest.fn();
jest.mock('pinata', () => ({
  PinataSDK: jest.fn().mockImplementation(() => ({
    upload: { public: { file: (...args: unknown[]) => mockUploadFile(...args) } },
  })),
}));

import { toIpfsUri, uploadImageToIpfs, uploadJsonToIpfs } from './ipfs';

beforeEach(() => {
  mockUploadFile.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('toIpfsUri', () => {
  it('prefixes the CID with the ipfs scheme', () => {
    expect(toIpfsUri('bafyabc')).toBe('ipfs://bafyabc');
  });
});

describe('uploadJsonToIpfs', () => {
  it('uploads the serialised payload as a named JSON file', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });

    await uploadJsonToIpfs({ a: 1 }, 'metadata.json');

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toBe('metadata.json');
    expect(fileArg.type).toBe('application/json');
    await expect(fileArg.text()).resolves.toBe('{"a":1}');
  });

  it('returns the CID from the SDK response', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });
    await expect(uploadJsonToIpfs({ a: 1 }, 'metadata.json')).resolves.toBe('bafyJson');
  });

  it('maps an SDK failure to a 502 without leaking the original message', async () => {
    mockUploadFile.mockRejectedValue(new Error('PINATA_JWT abcdef is invalid'));

    await expect(uploadJsonToIpfs({ a: 1 }, 'metadata.json')).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });
  });

  it('maps a response with no CID to a 502', async () => {
    mockUploadFile.mockResolvedValue({ id: 'x' });

    await expect(uploadJsonToIpfs({ a: 1 }, 'metadata.json')).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });
  });
});

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function jpeg(): Buffer {
  return Buffer.from([...JPEG_MAGIC, 0x00, 0x11, 0x22]);
}

function png(): Buffer {
  return Buffer.from([...PNG_MAGIC, 0x00, 0x11, 0x22]);
}

function webp(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(8, 4);
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

describe('uploadImageToIpfs', () => {
  it('uploads a JPEG and returns its CID', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJpeg' });

    const cid = await uploadImageToIpfs({
      buffer: jpeg(),
      originalName: 'poster.jpg',
      mimeType: 'image/jpeg',
    });

    expect(cid).toBe('bafyJpeg');
    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.type).toBe('image/jpeg');
    expect(fileArg.name).toBe('poster.jpg');
  });

  it('accepts a PNG', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyPng' });
    await expect(
      uploadImageToIpfs({ buffer: png(), originalName: 'a.png', mimeType: 'image/png' }),
    ).resolves.toBe('bafyPng');
  });

  it('accepts a WebP', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyWebp' });
    await expect(
      uploadImageToIpfs({ buffer: webp(), originalName: 'a.webp', mimeType: 'image/webp' }),
    ).resolves.toBe('bafyWebp');
  });

  it('rejects a MIME type outside the allowlist', async () => {
    await expect(
      uploadImageToIpfs({
        buffer: Buffer.from('<svg/>'),
        originalName: 'a.svg',
        mimeType: 'image/svg+xml',
      }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects a buffer over the 5MB limit', async () => {
    const oversize = Buffer.concat([Buffer.from(PNG_MAGIC), Buffer.alloc(5 * 1024 * 1024)]);

    await expect(
      uploadImageToIpfs({ buffer: oversize, originalName: 'a.png', mimeType: 'image/png' }),
    ).rejects.toMatchObject({ message: 'Poster exceeds 5MB limit', statusCode: 400 });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects a payload whose magic bytes contradict the declared PNG type', async () => {
    await expect(
      uploadImageToIpfs({
        buffer: Buffer.from('<svg onload="alert(1)"/>'),
        originalName: 'a.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects a PNG buffer declared as JPEG', async () => {
    await expect(
      uploadImageToIpfs({ buffer: png(), originalName: 'a.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
  });

  it('rejects a JPEG buffer declared as WebP', async () => {
    await expect(
      uploadImageToIpfs({ buffer: jpeg(), originalName: 'a.webp', mimeType: 'image/webp' }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
  });

  it('rejects a truncated WebP header', async () => {
    await expect(
      uploadImageToIpfs({
        buffer: Buffer.from('RIFF'),
        originalName: 'a.webp',
        mimeType: 'image/webp',
      }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
  });

  it('strips characters outside the safe set from the file name', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyPng' });

    await uploadImageToIpfs({
      buffer: png(),
      originalName: '../../etc/pass wd!.png',
      mimeType: 'image/png',
    });

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toBe('....etcpasswd.png');
  });

  it('truncates an over-long file name to 100 characters', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyPng' });

    await uploadImageToIpfs({
      buffer: png(),
      originalName: `${'a'.repeat(200)}.png`,
      mimeType: 'image/png',
    });

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toHaveLength(100);
  });

  it('falls back to a default name when sanitising leaves nothing', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyPng' });

    await uploadImageToIpfs({ buffer: png(), originalName: '???', mimeType: 'image/png' });

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toBe('poster.png');
  });

  it('maps an SDK failure to a 502', async () => {
    mockUploadFile.mockRejectedValue(new Error('gateway exploded'));

    await expect(
      uploadImageToIpfs({ buffer: png(), originalName: 'a.png', mimeType: 'image/png' }),
    ).rejects.toMatchObject({ message: 'IPFS upload failed', statusCode: 502 });
  });
});
