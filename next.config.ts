import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Turbopack-specific configuration (now stable)
    resolveAlias: {
      // Add any Turbopack-specific aliases if needed
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude puppeteer from client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        tty: false,
        net: false,
        child_process: false,
      };
      
      config.externals = [
        ...(config.externals || []),
        'puppeteer',
        'puppeteer-core',
        '@puppeteer/browsers',
      ];
    }
    return config;
  },
  // Server-side externals for Node.js modules
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@puppeteer/browsers'],
};

export default nextConfig;
