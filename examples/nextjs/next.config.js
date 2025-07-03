// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static export for Cloudflare Pages
    output: "export",

    // Disable image optimization for static export
    images: {
        unoptimized: true,
    },

    // Add base path and asset prefix for proper static hosting
    trailingSlash: true,

    // Add transpilePackages to ensure proper handling of ESM modules
    transpilePackages: ["esptool-react", "web-serial-polyfill"],

    // Enable experimental.esmExternals to fix ESM import issues
    experimental: {
        esmExternals: "loose",
    },
};

module.exports = nextConfig;
