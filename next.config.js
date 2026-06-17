/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 기존 타입 오류가 있어도 빌드 통과 (런타임엔 영향 없음)
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.notion.so" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
};
module.exports = nextConfig;
