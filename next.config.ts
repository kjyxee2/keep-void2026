import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 홈 히어로 작업장 사진 등: 받는 브라우저에 맞춰 AVIF, 그다음 WebP
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
