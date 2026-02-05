import type { NextConfig } from "next";
import { NormalModuleReplacementPlugin } from "webpack";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    
    // Fix for walletconnect nested viem dependency conflict
    // Replace the broken nested viem module with the root viem
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^viem$/,
        (resource) => {
          // If this is being resolved from the nested walletconnect location, use root viem
          if (resource.context?.includes('@walletconnect/utils')) {
            resource.request = require.resolve('viem')
          }
        }
      )
    )
    
    // Ensure root node_modules is resolved first
    config.resolve.modules = ['node_modules', ...(config.resolve.modules || [])]
    
    return config
  }
};

export default nextConfig;
