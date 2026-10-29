import { SupportNotificationsProvider } from "@/components/support-notifications";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./mobile.css";
import "./support.css";
import { brand, seoEnabled } from "@/lib/config";
import { Session } from "@/components/session";
import { Shell } from "@/components/shell";
import { DialogHost } from "@/components/ui/dialogs";
const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-manrope",
  weight: "400 800",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const metadata: Metadata = {
  metadataBase: new URL(brand.domain),
  title: {
    default: `${brand.name} | Your next ride starts here`,
    template: `%s | ${brand.name}`,
  },
  description: `${brand.name} brings dirt-bike classifieds, rider discussions, original news, events and stolen-bike awareness together. South Africa's off-road marketplace and community.`,
  openGraph: {
    siteName: brand.name,
    title: `${brand.name} | Off-road. All in.`,
    description:
      "The marketplace and community for dirt-bike and off-road motorcycle riders.",
  },
  robots: { index: seoEnabled, follow: seoEnabled },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <Session>
          <SupportNotificationsProvider><Shell>{children}</Shell></SupportNotificationsProvider>
          <DialogHost />
        </Session>
      </body>
    </html>
  );
}
