import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 홈 히어로 작업장 사진 등: 받는 브라우저에 맞춰 AVIF, 그다음 WebP
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // 글꼴 조각은 내용이 바뀌지 않는다(판을 올리면 폴더 이름을 바꿀 것). next/font가 붙이던 것과 같은 1년 캐시
        source: "/fonts/pretendard/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
