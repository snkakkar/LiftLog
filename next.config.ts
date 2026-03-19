import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow tunnel origins (localhost.run, etc.) so the app works when accessed from phone
  experimental: {
    serverActions: {
      allowedOrigins: ["*.localhost.run", "localhost.run", "*.loca.lt", "loca.lt"],
    },
  },
};

export default nextConfig;
