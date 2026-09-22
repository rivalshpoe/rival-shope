import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic, Cormorant_Garamond } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const arabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rival.ps"),
  title: { default: "Rival | ريفال", template: "%s | Rival" },
  description: "وجهتك المختارة بعناية لأناقة نسائية استثنائية.",
  icons: { icon: "/brand/rival-monogram.svg" },
  openGraph: {
    title: "Rival | ريفال",
    description: "تفاصيل استثنائية، مختارة لكِ.",
    locale: "ar_PS",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0908",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${display.variable}`}>
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
