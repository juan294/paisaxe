import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guardados | Paisaxe",
  description: "Tus lugares guardados de Asturias.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://paisaxe.es/favorites",
  },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
