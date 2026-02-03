import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legislative Red Team",
  description: "Legislative Red Team application",
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
      </body>
    </html>
  );
}
