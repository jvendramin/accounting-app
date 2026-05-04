import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat the AWS SDK as a plain Node import on the server. Turbopack
  // otherwise wraps it in its own external-loader, which then trips
  // ERR_REQUIRE_ESM on the SDK's nested @nodable/entities (ESM-only)
  // dependency when the presign route runs in production/Lambda.
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
};

export default nextConfig;
