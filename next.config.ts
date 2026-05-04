import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },

  transpilePackages: [
    "react-markdown",
    "mdast-util-to-hast",
    "remark-rehype",
    "@ungap/structured-clone",
  ],

  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      porto: false,
      "porto/internal": false,
      accounts: false,
    };

    // Fix for structured clone import
    config.resolve.alias = {
      ...config.resolve.alias,
      "@ungap/structured-clone": path.resolve(
        process.cwd(),
        "node_modules/@ungap/structured-clone/cjs/index.js"
      ),
      // Optional MetaMask connector dependency (not required for this demo build)
      "@metamask/connect-evm": false,
      accounts: false,
    };

    return config;
  },
};

export default nextConfig;