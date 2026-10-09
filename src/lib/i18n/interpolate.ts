import { clientLogger } from "@/lib/client-logger";

/** Replace placeholders once, globally, treating replacement text literally. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, key: string) => {
    if (Object.hasOwn(values, key)) return String(values[key]);
    if (process.env.NODE_ENV === 'development') clientLogger.warn("[I18N_MISSING_VARIABLE]", { key });
    return placeholder;
  });
}
