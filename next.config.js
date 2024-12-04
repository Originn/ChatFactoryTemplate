/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: ['solidcam.herokuapp.com', 'localhost'],
  },
  webpack(config, { dev, isServer }) {
    if (dev) {
      config.devtool = isServer ? 'source-map' : 'inline-source-map';
    }
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  env: {
    GCLOUD_STORAGE_BUCKET: process.env.GCLOUD_STORAGE_BUCKET,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Or restrict to specific origins like 'http://127.0.0.1:5500'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
