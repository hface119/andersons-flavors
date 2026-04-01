import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anderson's Flavor Calendar",
  description: "Manage daily custard flavors for all Anderson's locations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
