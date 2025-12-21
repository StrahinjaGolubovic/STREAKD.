/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Ensure better-sqlite3 is only used server-side
  serverExternalPackages: ['better-sqlite3'],
  // Configure webpack to properly handle native modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark better-sqlite3 as external to prevent bundling issues
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('better-sqlite3');
      } else {
        config.externals = [config.externals, 'better-sqlite3'];
      }
    }
    return config;
  },
  // Add empty turbopack config to silence the warning
  turbopack: {},
}

module.exports = nextConfig

