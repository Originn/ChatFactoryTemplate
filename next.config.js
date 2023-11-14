/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['solidcam.herokuapp.com', 'localhost'],
},
webpack(config) {
config.experiments = { ...config.experiments, topLevelAwait: true };
return config;
},
};
module.exports = {
  env: {
    NEXT_PUBLIC_FILTER_SCORE: process.env.NEXT_PUBLIC_FILTER_SCORE,
  },
};
module.exports = nextConfig;