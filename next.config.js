/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['solidcam.herokuapp.com', 'localhost'],
  },
  webpack(config, { dev, isServer }) {
    if (dev && isServer) {
      config.devtool = 'source-map';  // Ensures source maps are created for server-side code
    }
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  env: {
    GCLOUD_STORAGE_BUCKET: process.env.GCLOUD_STORAGE_BUCKET,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
};

module.exports = nextConfig;
