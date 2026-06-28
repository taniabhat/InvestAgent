/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['langchain', '@langchain/core', '@langchain/openai', '@langchain/anthropic'],
  },
};

module.exports = nextConfig;
