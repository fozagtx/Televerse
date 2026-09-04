import type { Metadata } from "next";
import { Figtree, Fira_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-fig-tree",
  subsets: ["latin"],
});

const firaMono = Fira_Mono({
  variable: "--font-fira-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Televerse",
  description:
    "Teleport agents into isolated cloud desktops. Never stop coding to chase a rabbit hole.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${figtree.variable} ${firaMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
