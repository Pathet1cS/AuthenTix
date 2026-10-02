export interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

export function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
}
