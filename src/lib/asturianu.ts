/**
 * Asturianu vocabulary labels for UI elements.
 * When the asturianu_touches feature is enabled, these replace
 * the default Spanish labels in the interface.
 */
export const ASTURIANU_LABELS: Record<string, { es: string; ast: string }> = {
  ask_about: { es: "Preguntar sobre esto", ast: "Entrugame sobre esto" },
  saved: { es: "Guardados", ast: "Guardaos" },
  surprise: { es: "Sorpresa", ast: "Sorpresa" },
  share: { es: "Compartir", ast: "Compartir" },
  related: { es: "También te puede interesar", ast: "Tamién te pue interesar" },
  new_badge: { es: "Nuevo", ast: "Nuevu" },
  ask_placeholder: { es: "Escribe tu pregunta...", ast: "Escribi la to entruga..." },
  navigate: { es: "navegar", ast: "navegar" },
  show_hide: { es: "mostrar/ocultar", ast: "amosar/esconder" },
  next: { es: "siguiente", ast: "siguiente" },
};

/**
 * Get a label in either Spanish or Asturianu based on the feature flag.
 */
export function getLabel(key: string, asturianEnabled: boolean): string {
  const entry = ASTURIANU_LABELS[key];
  if (!entry) return key;
  return asturianEnabled ? entry.ast : entry.es;
}
