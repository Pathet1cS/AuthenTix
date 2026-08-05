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

const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface ImageFormat {
  ext: string;
  hasSignature: (buffer: Buffer) => boolean;
}

// A Map (rather than a plain object) so an attacker-controlled mimeType like
// 'constructor' or '__proto__' can never resolve to an inherited
// Object.prototype member instead of `undefined`.
const ALLOWED_IMAGE_FORMATS = new Map<string, ImageFormat>([
  [
    'image/jpeg',
    {
      ext: 'jpg',
      hasSignature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
  ],
  [
    'image/png',
    {
      ext: 'png',
      hasSignature: (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG_SIGNATURE),
    },
  ],
  [
    'image/webp',
    {
      ext: 'webp',
      hasSignature: (b) =>
        b.length >= 12 &&
        b.subarray(0, 4).toString('ascii') === 'RIFF' &&
        b.subarray(8, 12).toString('ascii') === 'WEBP',
    },
  ],
]);

/**
 * The uploader controls `originalName`, and it becomes Pinata display metadata.
 * Reduce it to a conservative character set so nothing downstream has to treat
 * it as anything but a label.
 */
function safeFileName(originalName: string, ext: string): string {
  const cleaned = originalName.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 100);
  return cleaned.length > 0 ? cleaned : `poster.${ext}`;
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

export async function uploadImageToIpfs(file: UploadFile): Promise<string> {
  const format = ALLOWED_IMAGE_FORMATS.get(file.mimeType);
  if (!format) {
    throw createError('Unsupported poster format', 400);
  }

  if (file.buffer.length > MAX_POSTER_BYTES) {
    throw createError('Poster exceeds 5MB limit', 400);
  }

  // The declared MIME type comes from the client. Without this check an
  // organizer could pass a script-bearing SVG as image/png, and an IPFS
  // gateway would happily serve it.
  if (!format.hasSignature(file.buffer)) {
    throw createError('Unsupported poster format', 400);
  }

  const upload = new File([file.buffer], safeFileName(file.originalName, format.ext), {
    type: file.mimeType,
  });

  return pinFile(upload);
}
