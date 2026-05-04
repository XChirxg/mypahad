/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'khbotkadtbkwqxjxlyhm.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Incremental Static Regeneration — pages rebuild every 60s in production
  // This means new businesses/products show up on Google within an hour
  experimental: {
    // ISR on-demand revalidation support
  },
}

module.exports = nextConfig
