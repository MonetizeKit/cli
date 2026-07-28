import { MonetizeKitProvider } from "@monetizekit/react";

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
