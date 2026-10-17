import type { Metadata } from "next";
import "./globals.css";
import OfflineBanner from "./_components/OfflineBanner";

export const metadata: Metadata = {
  title: "Second-hand tracker",
  description: "Трекер поставок секонд-хенду",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
