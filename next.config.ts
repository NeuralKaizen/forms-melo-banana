import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/.well-known/oauth-protected-resource', destination: '/well-known/oauth-protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/well-known/oauth-authorization-server' },
      // Algunos clientes prueban el documento del recurso colgando el path del MCP.
      { source: '/.well-known/oauth-protected-resource/api/mcp', destination: '/well-known/oauth-protected-resource' },
    ]
  },
};

export default nextConfig;
