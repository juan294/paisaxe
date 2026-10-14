"use client";

import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { BalanceInvoiceStatus } from "@/types/booking-page";

/** A balance is still due on these, so the payer link is offered. */
const PAYABLE = new Set<BalanceInvoiceStatus>(["sent", "partially_paid"]);

/**
 * The balance invoice's status and, while something is due, its PayPal link
 * (PayPal hackathon plan, Phase 8a). Used by the chat's invoice card and the
 * booking page; the link never reaches the model (F05).
 */
export function BalanceInvoiceStatusView({ status, url }: { status: BalanceInvoiceStatus; url: string | null }) {
  const { t } = useTranslation();
  return (
    <>
      <p className={status === "paid" ? "font-semibold text-emerald-300" : undefined}>{t(`booking.invoice.status.${status}`)}</p>
      {url && PAYABLE.has(status) && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "paypal", className: "mt-3 w-full" })}>
          {t("booking.invoice.pay")}
        </a>
      )}
    </>
  );
}
