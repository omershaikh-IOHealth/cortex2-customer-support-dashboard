/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pg-native is optional — tell webpack to ignore it
    config.externals = [...(config.externals || []), 'pg-native']
    return config
  },
}

module.exports = nextConfig
