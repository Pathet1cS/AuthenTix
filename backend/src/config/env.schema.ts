import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  THIRDWEB_CLIENT_ID: z.string().min(1, 'THIRDWEB_CLIENT_ID is required'),
  THIRDWEB_SECRET_KEY: z.string().min(1, 'THIRDWEB_SECRET_KEY is required'),
  RELAYER_PRIVATE_KEY: z.string().min(1, 'RELAYER_PRIVATE_KEY is required'),
  PINATA_JWT: z.string().min(1, 'PINATA_JWT is required'),
  PINATA_GATEWAY: z.string().default(''),
  CONTRACT_ADDRESS: z.string().min(1, 'CONTRACT_ADDRESS is required'),
  RPC_URL: z.string().url('RPC_URL must be a valid URL'),
  AUTH_DOMAIN: z.string().min(1, 'AUTH_DOMAIN is required'),
  // Blockchain Event Listener Configuration
  WS_RPC_URL: z.string().url('WS_RPC_URL must be a valid URL').optional(),
  CONTRACT_DEPLOYMENT_BLOCK: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 0, {
      message: 'CONTRACT_DEPLOYMENT_BLOCK must be a valid non-negative number',
    }),
  LISTENER_BATCH_SIZE: z
    .string()
    .default('1000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 5000, {
      message: 'LISTENER_BATCH_SIZE must be between 1 and 5000',
    }),
  LISTENER_CHECKPOINT_INTERVAL: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'LISTENER_CHECKPOINT_INTERVAL must be a positive number',
    }),
});

export type Env = z.infer<typeof envSchema>;
