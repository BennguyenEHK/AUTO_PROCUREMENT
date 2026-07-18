import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuoteFlow Workboard",
  description: "Local procurement workboard for signup, RFQ reports, pricing, and document previews."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
