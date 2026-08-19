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
 * Applies to every payload, poster or metadata. A pin is permanent and billed,
 * and nothing upstream bounds an event name or description, so the cap has to
 * sit at the choke point rather than on the poster path alone.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * `PinataConfig` exposes neither a timeout nor a custom fetch, so the only
 * backstop is undici's ~300s default — long enough for one stalled upload to
 * hold an Express worker for five minutes.
 */
const UPLOAD_TIMEOUT_MS = 30_000;

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
 * The caller controls the name, and it becomes Pinata display metadata. Reduce
 * it to a conservative character set so nothing downstream has to treat it as
 * anything but a label. Node keeps `File.name` verbatim otherwise — newlines,
 * quotes and slashes included.
 */
function safeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 100);
  return cleaned.length > 0 ? cleaned : fallback;
}

interface PinRequest {
  /**
   * Deferred so serialisation happens inside pinFile: a payload that cannot be
   * stringified (a circular reference) then fails the same way a transport
   * error does, instead of escaping as a raw TypeError.
   */
  toBytes: () => Buffer;
  /** Caller-supplied label. Sanitised here, never trusted. */
  name: string;
  /** Used when sanitising `name` leaves nothing usable. */
  fallbackName: string;
  contentType: string;
}

/**
 * A stalled Pinata never rejects on its own within any useful window, so race
 * the call. The timer is cleared however the race settles — a dangling
 * setTimeout would keep the event loop alive.
 */
async function withUploadTimeout<T>(work: PromiseLike<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Pinata upload timed out after ${UPLOAD_TIMEOUT_MS}ms`)),
      UPLOAD_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The single path through which every byte reaches Pinata — and, because
 * serialisation, the size cap and name sanitisation all live here, the single
 * place those rules are enforced. Pinata's own errors can name the account and
 * key, so they are logged server-side and replaced with a flat message.
 */
async function pinFile(request: PinRequest): Promise<string> {
  let bytes: Buffer;

  try {
    bytes = request.toBytes();
  } catch (err) {
    console.error('IPFS payload serialisation failed:', err);
    throw createError('IPFS upload failed', 502);
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw createError('Upload exceeds 5MB limit', 400);
  }

  const file = new File([bytes], safeFileName(request.name, request.fallbackName), {
    type: request.contentType,
  });

  let response: { cid?: string };

  try {
    response = await withUploadTimeout(pinataClient.upload.public.file(file));
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
  return pinFile({
    toBytes: () => Buffer.from(JSON.stringify(data), 'utf8'),
    name,
    fallbackName: 'metadata.json',
    contentType: 'application/json',
  });
}

export async function uploadImageToIpfs(file: UploadFile): Promise<string> {
  const format = ALLOWED_IMAGE_FORMATS.get(file.mimeType);
  if (!format) {
    throw createError('Unsupported poster format', 400);
  }

  // Same limit pinFile enforces, kept here for the poster-specific message the
  // client contract documents. pinFile's cap is the backstop for every path.
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    throw createError('Poster exceeds 5MB limit', 400);
  }

  // The declared MIME type comes from the client. Without this check an
  // organizer could pass a script-bearing SVG as image/png, and an IPFS
  // gateway would happily serve it.
  if (!format.hasSignature(file.buffer)) {
    throw createError('Unsupported poster format', 400);
  }

  return pinFile({
    toBytes: () => file.buffer,
    name: file.originalName,
    fallbackName: `poster.${format.ext}`,
    contentType: file.mimeType,
  });
}
