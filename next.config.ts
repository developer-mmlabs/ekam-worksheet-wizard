import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/assets/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bouquocyaneesufpxqqq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
