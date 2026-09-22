import type { Metadata, Viewport } from "next";
import { Lato, Libre_Baskerville } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast-provider";

import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Suga & Spies | Celebration pastries in Toronto",
    template: "%s | Suga & Spies",
  },
  description:
    "Celebration pastries with scheduled delivery across selected GTA areas.",
  applicationName: "Suga & Spies",
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffdf9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-CA"
      data-scroll-behavior="smooth"
      className={`${lato.variable} ${libreBaskerville.variable}`}
    >
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
