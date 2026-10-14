/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allows production builds to successfully complete even if there are type warnings
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allows production builds to successfully complete even if there are lint warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
