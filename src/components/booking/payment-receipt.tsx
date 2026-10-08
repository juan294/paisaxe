"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { BookingPaymentView } from "@/types/booking-page";

type IdKey = "orderId" | "captureId" | "refundId";

/** Label key per PayPal id; the refund label predates the receipt and lives with the cancellation copy. */
const ID_LABEL: Record<IdKey, string> = {
  orderId: "booking.page.orderId",
  captureId: "booking.page.captureId",
  refundId: "booking.cancel.refundId",
};

const COPIED_MS = 2_000;

/**
 * The PayPal ids of a booking's payment, each with a copy button
 * (docs/plans/2026-10-07-booking-ui-polish.md, U10). When the browser refuses
 * the clipboard the id stays selectable and the visitor is told to select it.
 */
export function PaymentReceipt({ payment }: { payment: BookingPaymentView }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<IdKey | null>(null);
  const [failed, setFailed] = useState<IdKey | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const ids = (Object.keys(ID_LABEL) as IdKey[]).filter((key) => payment[key]);
  if (ids.length === 0) return null;

  const copy = async (key: IdKey, value: string) => {
    setFailed(null);
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setCopied(null);
      setFailed(key);
    }
  };

  return (
    <section className="space-y-2 border-t border-white/10 pt-4 text-sm">
      <h2 className="font-semibold">{t("booking.page.receiptTitle")}</h2>
      <dl className="space-y-2">
        {ids.map((key) => {
          const value = payment[key] as string;
          return (
            <div key={key}>
              <dt className="text-white/70">{t(ID_LABEL[key])}</dt>
              <dd className="flex items-center justify-between gap-2">
                <span className="select-all break-all font-mono">{value}</span>
                <Button
                  type="button"
                  variant="glass"
                  size="sm"
                  className="shrink-0 rounded-full"
                  aria-label={`${t("booking.page.copy")} ${t(ID_LABEL[key])}`}
                  onClick={() => void copy(key, value)}
                >
                  {copied === key ? t("booking.page.copied") : t("booking.page.copy")}
                </Button>
              </dd>
              {/* The button's name stays "Copiar …"; this announces the outcome. */}
              <p className={failed === key ? "text-amber-200" : "sr-only"} aria-live="polite">
                {failed === key ? t("booking.page.copyFailed") : copied === key ? t("booking.page.copied") : ""}
              </p>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
