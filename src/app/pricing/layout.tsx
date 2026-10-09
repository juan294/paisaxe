import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}<SiteFooter variant="flow" /></>;
}
