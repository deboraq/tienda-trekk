import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { hostname: "localhost", pathname: "/**" },
    ],
  },
};

export default nextConfig;
