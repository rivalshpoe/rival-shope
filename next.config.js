/** @type {import('next').NextConfig} */
const uploadsOrigin = process.env.UPLOADS_ORIGIN || "http://127.0.0.1:5000";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    // Admin uploads are stored on the API. When the request reaches Next (local dev, or a
    // proxy that does not route /uploads itself), forward it to the API.
    return [{ source: "/uploads/:path*", destination: `${uploadsOrigin}/uploads/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; img-src 'self' data: blob: https://images.unsplash.com https://images.pexels.com; media-src 'self' https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      },
    ];

    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/mgmt-portal-x7k9/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

module.exports = nextConfig;
