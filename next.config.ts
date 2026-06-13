import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Use "standalone" for Docker/VPS deployments, omit for Vercel
  // Vercel auto-detects and builds optimally without "output" setting
  ...(process.env.VERCEL ? {} : { output: "standalone" }),

  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Prisma requires serverExternalPackages for optimal performance
  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // OOM Prevention: limit concurrent workers during build to reduce peak memory
  // Default is cpu.count - 1 which can exhaust memory on large projects
  staticPageGenerationTimeout: 120,
};

export default withNextIntl(nextConfig);
