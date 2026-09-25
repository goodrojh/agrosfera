import type { NextConfig } from "next";

// Для GitHub Pages сайт живёт по пути /<repo>, поэтому basePath задаётся при сборке.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
