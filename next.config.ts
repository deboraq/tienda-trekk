import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { hostname: "localhost", pathname: "/**" },
      // Imágenes por URL externa (ImgBB, Imgur, etc.)
      { protocol: "https", hostname: "i.ibb.co", pathname: "/**" },
      { protocol: "https", hostname: "ibb.co", pathname: "/**" },
      { protocol: "https", hostname: "i.imgur.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
