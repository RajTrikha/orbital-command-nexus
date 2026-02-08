import type { Metadata } from "next";
import TamboWrapper from "@/components/TamboWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbital Command Nexus",
  description: "Generative orbital operations command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TamboWrapper>{children}</TamboWrapper>
      </body>
    </html>
  );
}
