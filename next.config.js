/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', 
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ]
  },
  // Custom domain configuration
  async headers() {
    const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Custom-Domain-Configured',
            value: customDomain ? 'true' : 'false',
          },
          {
            key: 'X-Custom-Domain',
            value: customDomain || '',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  webpack(config, { dev, isServer }) {
    if (dev) {
      config.devtool = isServer ? 'source-map' : 'inline-source-map';
    }
    
    // Add top-level await support
    config.experiments = { 
      ...config.experiments, 
      topLevelAwait: true,
      asyncWebAssembly: true // Add WebAssembly support for farmhash
    };
    
    // Handle Node.js-specific modules in client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        http2: false,
        dns: false,
        child_process: false
      };
    }
    
    return config;
  },
  env: {
    GCLOUD_STORAGE_BUCKET: process.env.GCLOUD_STORAGE_BUCKET,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_CUSTOM_DOMAIN: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN,
  },

};

module.exports = nextConfig;