import type { Metadata } from "next";
import config from "../../config.json";
import "./globals.css";

export const metadata: Metadata = {
  title: `${config.eventName} — Event folio`,
  description: config.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
