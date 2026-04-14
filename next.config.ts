import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    config.resolve.alias = {
      ...config.resolve.alias,
      'porto': false,
      '@react-native-async-storage/async-storage': false,
    }
    return config
  }
};

export default nextConfig;
