import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Descubre Asturias | Discover Asturias",
  description:
    "Tu guia personal para explorar Asturias. Encuentra rutas, gastronomia, cultura y mas. Your personal guide to explore Asturias.",
  keywords: ["Asturias", "turismo", "tourism", "Spain", "travel", "sidra", "naturaleza"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
