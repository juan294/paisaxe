/** ISR: revalidate the terms page every hour */
export const revalidate = 3600;

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
