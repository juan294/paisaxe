import type { Locale } from "@/lib/i18n/types";
import { toIntlLocale } from "@/lib/utils";

/** Integer cents as a localized currency amount. */
export function money(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency }).format(cents / 100);
}

/** HH:MM in Asturias time, for hold and quote expiries. */
export function clockTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(toIntlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}
