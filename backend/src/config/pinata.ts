import { PinataSDK } from 'pinata';
import { env } from './env';

export const pinataClient = new PinataSDK({
  pinataJwt: env.PINATA_JWT,
  pinataGateway: env.PINATA_GATEWAY,
});
