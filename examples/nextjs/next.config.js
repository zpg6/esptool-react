// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add transpilePackages to ensure proper handling of ESM modules
  transpilePackages: ['esptool-react', 'web-serial-polyfill'],
  // Enable experimental.esmExternals to fix ESM import issues
  experimental: {
    esmExternals: 'loose'
  }
};

module.exports = nextConfig;