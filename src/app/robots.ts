import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/mgmt-portal-x7k9", "/checkout", "/cart"],
      },
    ],
    sitemap: "https://rival.ps/sitemap.xml",
  };
}
