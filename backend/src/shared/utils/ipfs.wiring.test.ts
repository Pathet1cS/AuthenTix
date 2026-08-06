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

  it('rejects a serialised payload over the 5MB limit', async () => {
    const oversize = { description: 'a'.repeat(5 * 1024 * 1024) };

    await expect(uploadJsonToIpfs(oversize, 'metadata.json')).rejects.toMatchObject({
      message: 'Upload exceeds 5MB limit',
      statusCode: 400,
    });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('measures the cap in bytes, not UTF-16 code units', async () => {
    // Just under the cap in characters, well over it once encoded.
    const oversize = { description: 'é'.repeat(3 * 1024 * 1024) };

    await expect(uploadJsonToIpfs(oversize, 'metadata.json')).rejects.toMatchObject({
      message: 'Upload exceeds 5MB limit',
      statusCode: 400,
    });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('accepts a payload just under the cap', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });
    // {"d":"aaa..."} — 8 bytes of envelope around the string.
    const nearLimit = { d: 'a'.repeat(5 * 1024 * 1024 - 8) };

    await expect(uploadJsonToIpfs(nearLimit, 'metadata.json')).resolves.toBe('bafyJson');
  });

  it('maps an unserialisable payload to a 502 without contacting Pinata', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(uploadJsonToIpfs(circular, 'metadata.json')).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('sanitises a caller-supplied file name', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });

    await uploadJsonToIpfs({ a: 1 }, '../../etc/pa ss"wd\n.json');

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toBe('....etcpasswd.json');
  });

  it('truncates an over-long file name to 100 characters', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });

    await uploadJsonToIpfs({ a: 1 }, `${'a'.repeat(200)}.json`);

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toHaveLength(100);
  });

  it('falls back to a default name when sanitising leaves nothing', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });

    await uploadJsonToIpfs({ a: 1 }, '???');

    const [fileArg] = mockUploadFile.mock.calls[0] as [File];
    expect(fileArg.name).toBe('metadata.json');
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

  it('rejects an Object.prototype key used as the MIME type', async () => {
    await expect(
      uploadImageToIpfs({
        buffer: png(),
        originalName: 'a.png',
        mimeType: 'constructor',
      }),
    ).rejects.toMatchObject({ message: 'Unsupported poster format', statusCode: 400 });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('rejects __proto__ used as the MIME type', async () => {
    await expect(
      uploadImageToIpfs({
        buffer: png(),
        originalName: 'a.png',
        mimeType: '__proto__',
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

describe('upload timeout', () => {
  // Fake timers throughout: a real 30s wait would be the whole suite's budget.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function neverSettles(): Promise<never> {
    return new Promise<never>(() => undefined);
  }

  it('rejects with a 502 once the upload has hung for 30 seconds', async () => {
    mockUploadFile.mockReturnValue(neverSettles());

    const pending = uploadJsonToIpfs({ a: 1 }, 'metadata.json');
    const settled = expect(pending).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });

    await jest.advanceTimersByTimeAsync(30_000);
    await settled;
  });

  it('does not reject before the 30 second mark', async () => {
    mockUploadFile.mockReturnValue(neverSettles());

    const pending = uploadJsonToIpfs({ a: 1 }, 'metadata.json');
    let outcome = 'pending';
    void pending.then(
      () => {
        outcome = 'resolved';
      },
      () => {
        outcome = 'rejected';
      },
    );

    await jest.advanceTimersByTimeAsync(29_999);
    expect(outcome).toBe('pending');
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(outcome).toBe('rejected');
  });

  it('applies the same timeout to the poster path', async () => {
    mockUploadFile.mockReturnValue(neverSettles());

    const pending = uploadImageToIpfs({
      buffer: png(),
      originalName: 'a.png',
      mimeType: 'image/png',
    });
    const settled = expect(pending).rejects.toMatchObject({
      message: 'IPFS upload failed',
      statusCode: 502,
    });

    await jest.advanceTimersByTimeAsync(30_000);
    await settled;
  });

  it('leaves no pending timer after a successful upload', async () => {
    mockUploadFile.mockResolvedValue({ cid: 'bafyJson' });

    await expect(uploadJsonToIpfs({ a: 1 }, 'metadata.json')).resolves.toBe('bafyJson');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves no pending timer after a failed upload', async () => {
    mockUploadFile.mockRejectedValue(new Error('gateway exploded'));

    await expect(uploadJsonToIpfs({ a: 1 }, 'metadata.json')).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves no pending timer after the timeout itself fires', async () => {
    mockUploadFile.mockReturnValue(neverSettles());

    const pending = uploadJsonToIpfs({ a: 1 }, 'metadata.json');
    const settled = expect(pending).rejects.toMatchObject({ statusCode: 502 });

    await jest.advanceTimersByTimeAsync(30_000);
    await settled;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts no timer when validation rejects the payload first', async () => {
    await expect(
      uploadJsonToIpfs({ description: 'a'.repeat(5 * 1024 * 1024) }, 'metadata.json'),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(jest.getTimerCount()).toBe(0);
  });
});
