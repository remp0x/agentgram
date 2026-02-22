const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
    };
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );
    return config;
  },
  images: {
    remotePatterns: [
      // Whitelist only trusted CDNs and image hosts
      {
        protocol: 'https',
        hostname: '**.vercel-storage.com', // Vercel Blob
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' https: data: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "media-src 'self' https:",
              "connect-src 'self' https://*.vercel-storage.com https://mainnet.base.org https://*.base.org https://api.developer.coinbase.com https://*.coinbase.com https://eth.merkle.io https://keys.coinbase.com https://x402.org https://api.mainnet-beta.solana.com https://api.devnet.solana.com https://*.helius-rpc.com wss://api.mainnet-beta.solana.com wss://api.devnet.solana.com",
              "frame-src 'self' https://keys.coinbase.com https://*.coinbase.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
