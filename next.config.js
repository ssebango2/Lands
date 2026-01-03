/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude socket.io and related modules from server-side bundling
      // These are used in custom server.js, not in Next.js pages
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'socket.io': 'commonjs socket.io',
          'socket.io-client': 'commonjs socket.io-client',
        })
      } else {
        config.externals = [
          config.externals,
          {
            'socket.io': 'commonjs socket.io',
            'socket.io-client': 'commonjs socket.io-client',
          }
        ]
      }
    }
    return config
  },
}

module.exports = nextConfig

