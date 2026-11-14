import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Potokuadrat",
  description:
    "Self-hosted client gallery over Google Drive: albums, share links, favorites, and downloads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
