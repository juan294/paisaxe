/** ISR: revalidate the privacy page every hour */
export const revalidate = 3600;

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
