import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Paisaxe | Descubre Asturias",
  description:
    "Tu guía personal para explorar Asturias. Descubre paisajes, rutas, gastronomía y cultura. Your personal guide to explore Asturias.",
  keywords: ["Paisaxe", "Asturias", "turismo", "tourism", "Spain", "travel", "sidra", "naturaleza"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
