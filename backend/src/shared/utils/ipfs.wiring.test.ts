jest.mock('@/config/env', () => ({
  env: { PINATA_JWT: 'test-jwt', PINATA_GATEWAY: '' },
}));

const mockUploadFile = jest.fn();
jest.mock('pinata', () => ({
  PinataSDK: jest.fn().mockImplementation(() => ({
    upload: { public: { file: (...args: unknown[]) => mockUploadFile(...args) } },
  })),
}));

import { toIpfsUri, uploadJsonToIpfs } from './ipfs';

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
