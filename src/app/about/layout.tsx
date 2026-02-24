/** ISR: revalidate the about page every hour */
export const revalidate = 3600;

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
