/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for React
  reactStrictMode: true,
  // Opt server-only packages out of the browser bundle
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-parse',
      'mammoth',
      'langfuse',
    ],
  },
};

export default nextConfig;
