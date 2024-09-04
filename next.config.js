/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  },
};

module.exports = nextConfig;
