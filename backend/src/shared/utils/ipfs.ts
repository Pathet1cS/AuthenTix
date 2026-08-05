import { pinataClient } from '@/config/pinata';
import { createError } from './appError';

export interface UploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export function toIpfsUri(cid: string): string {
  return `ipfs://${cid}`;
}

/**
 * Single path through which every byte reaches Pinata. Pinata's own errors can
 * name the account and key, so they are logged server-side and replaced with a
 * flat message for the client.
 */
async function pinFile(file: File): Promise<string> {
  let response: { cid?: string };

  try {
    response = await pinataClient.upload.public.file(file);
  } catch (err) {
    console.error('Pinata upload failed:', err);
    throw createError('IPFS upload failed', 502);
  }

  if (!response?.cid) {
    console.error('Pinata upload returned no CID:', response);
    throw createError('IPFS upload failed', 502);
  }

  return response.cid;
}

export async function uploadJsonToIpfs(data: unknown, name: string): Promise<string> {
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  return pinFile(file);
}
