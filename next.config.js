/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: [
      'localhost',
      'firebasestorage.googleapis.com', // Allow Firebase Storage
      'storage.googleapis.com'          // Alternative Firebase Storage domain
    ],
    remotePatterns: [
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
  },
  async rewrites() {
    return [
      {
        source: '/api/chat-stream',
        destination: '/api/chat-stream',
      },
    ];
  },
};

module.exports = nextConfig;