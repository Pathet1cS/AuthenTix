import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  THIRDWEB_CLIENT_ID: z.string().min(1, 'THIRDWEB_CLIENT_ID is required'),
  THIRDWEB_SECRET_KEY: z.string().min(1, 'THIRDWEB_SECRET_KEY is required'),
  RELAYER_PRIVATE_KEY: z.string().min(1, 'RELAYER_PRIVATE_KEY is required'),
  PINATA_API_KEY: z.string().min(1, 'PINATA_API_KEY is required'),
  PINATA_SECRET_KEY: z.string().min(1, 'PINATA_SECRET_KEY is required'),
  CONTRACT_ADDRESS: z.string().min(1, 'CONTRACT_ADDRESS is required'),
  RPC_URL: z.string().url('RPC_URL must be a valid URL'),
  AUTH_DOMAIN: z.string().min(1, 'AUTH_DOMAIN is required'),
});

export type Env = z.infer<typeof envSchema>;
