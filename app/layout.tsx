import type { Metadata } from "next";
import "./globals.css";
import OfflineBanner from "./_components/OfflineBanner";

export const metadata: Metadata = {
  title: "Завози в секондах",
  description: "Трекер завозів у секонд-хендах",
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
