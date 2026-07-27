import type { Metadata } from "next";

import "./globals.css";
import { MonetizeKitProvider } from "@monetizekit/react";

export const metadata: Metadata = {
  title: "My App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <MonetizeKitProvider>
        <body>{children}</body>
      </MonetizeKitProvider>
    </html>
  );
}
