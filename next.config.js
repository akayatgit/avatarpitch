/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow large local reference images sent as base64 data URLs
    serverActions: {
      bodySizeLimit: '30mb',
    },
    // Keep native image libs out of the webpack/client bundle (Next 14)
    serverComponentsExternalPackages: ['sharp'],
  },
};

module.exports = nextConfig;
