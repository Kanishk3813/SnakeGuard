import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'snakeguard.jiobase.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Allow placeholder URLs for testing (remove in production)
      {
        protocol: 'https',
        hostname: 'your-storage-url.com',
      },
    ],
    // Allow unoptimized images as fallback for invalid URLs
    unoptimized: false,
  },
};

export default nextConfig;
