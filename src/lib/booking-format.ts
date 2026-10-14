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

/** Day, month and HH:MM in Asturias time, for deadlines such as the refund cutoff. */
export function dateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(toIntlLocale(locale), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

/**
 * A slot's calendar date ("2026-10-24") as weekday, day and short month ("sáb, 24 oct").
 * Read at UTC midnight because it is a date, not an instant; anything else is returned unchanged.
 */
export function slotDay(date: string, locale: Locale): string {
  const day = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime())) return date;
  return new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(day);
}
