import type { NextConfig } from "next";

// thirdweb's ConnectButton bundles @coinbase/cdp-sdk, which imports the optional
// peer deps @x402/* (x402 payments, unused here). Turbopack fails to resolve
// them, so point them at an empty stub instead of installing unused packages.
const X402_STUB = "./src/lib/optionalPeerStub.js";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@x402/core/client": X402_STUB,
      "@x402/evm": X402_STUB,
      "@x402/evm/exact/client": X402_STUB,
      "@x402/evm/upto/client": X402_STUB,
      "@x402/svm/exact/client": X402_STUB,
    },
  },
};

export default nextConfig;
