/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
  },
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
