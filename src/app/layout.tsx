import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Briefz",
  description: "Project-based prestarts and supervisor handovers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <footer className="site-footer">Briefz - Built by Valeron</footer>
        <Analytics />
      </body>
    </html>
  );
}
