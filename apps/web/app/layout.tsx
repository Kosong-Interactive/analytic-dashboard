import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Game Analytic",
  description:
    "Internal dashboard for mobile-game releases, momentum, and feature trends.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" className={cn("dark h-full antialiased", "font-sans", geist.variable, geistMono.variable)}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
