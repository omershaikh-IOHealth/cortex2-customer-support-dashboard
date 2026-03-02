/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Don't bundle these heavy Node.js packages into each serverless function.
    // They'll be resolved from shared node_modules at runtime, keeping
    // individual function bundles small and staying within Vercel's limits.
    serverComponentsExternalPackages: ['pg', 'pg-native', 'pg-pool', 'bcryptjs'],
  },
  webpack: (config) => {
    // pg-native is optional — tell webpack to ignore it
    config.externals = [...(config.externals || []), 'pg-native']
    return config
  },
}

module.exports = nextConfig
