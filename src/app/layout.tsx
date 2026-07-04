import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

// The UI is entirely Korean copy, so a Latin-only font (the previous
// Plus Jakarta Sans) never actually rendered for body text — every Hangul
// glyph silently fell back to whatever sans-serif the OS shipped, making
// the app look different (and less designed) on Mac vs. Windows vs. Linux.
// Noto Sans/Serif KR cover Hangul directly, so the typography is consistent
// everywhere and the serif is available as a deliberate display accent.
const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans"
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Academy Care — 스마트 학원 관리",
  description: "학원 관리 및 학부모 소통 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} ${notoSerifKr.variable} ${notoSansKr.className}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
