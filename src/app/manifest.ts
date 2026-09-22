import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rival | ريفال",
    short_name: "Rival",
    description: "متجر ريفال للأناقة النسائية المختارة بعناية",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e9",
    theme_color: "#0b0a09",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/brand/rival-monogram.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
