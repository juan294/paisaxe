// Shared i18n mock translations for tests
// Maps translation keys to Spanish strings (the original hardcoded values)
export const mockTranslations: Record<string, string> = {
  // Common
  "common.loading": "Cargando...",
  "common.close": "Cerrar",
  "common.error": "Error",

  // Chat
  "chat.placeholder": "Escribe tu pregunta...",
  "chat.listening": "Escuchando...",
  "chat.thinking": "Pensando...",
  "chat.empty_state": "Pregunta lo que quieras sobre este lugar",
  "chat.speech_hint": "Puedes usar el micrófono para hablar",
  "chat.error_generic": "Lo siento, hubo un error. Intenta de nuevo.",
  "chat.error_processing": "Lo siento, no pude procesar tu pregunta.",
  "chat.privacy_notice": "Tus preguntas se procesan con inteligencia artificial. No guardamos tus conversaciones.",
  "chat.understood": "Entendido",
  "chat.source": "Fuente",
  "chat.image_alt": "Imagen relacionada",

  // Stories
  "stories.new_badge": "Nuevo",
  "stories.ambient": "Ambient",
  "stories.surprise": "Sorpréndeme",
  "stories.related": "También te puede interesar",
  "stories.no_results": "No hay historias con estos filtros",
  "stories.ambient_on": "Activar modo ambiente",
  "stories.ambient_off": "Desactivar modo ambiente",

  // Stories filters
  "stories.filters.title": "Filtros",
  "stories.filters.category": "Categoría",
  "stories.filters.location": "Zona",
  "stories.filters.duration": "Duración",
  "stories.filters.clear": "Limpiar filtros",

  // Navigation
  "nav.navigate": "navegar",
  "nav.show_hide": "mostrar/ocultar",
  "nav.space": "espacio",
  "nav.next": "siguiente",

  // Favorites
  "favorites.title": "Guardados",
  "favorites.save": "Guardar",
  "favorites.saved": "Guardado",
  "favorites.add": "Agregar a favoritos",
  "favorites.remove": "Quitar de favoritos",
  "favorites.add_saved": "Guardar",
  "favorites.remove_saved": "Quitar de guardados",
  "favorites.remove_from_saved": "Quitar de guardados",
  "favorites.place_singular": "lugar",
  "favorites.place_plural": "lugares",
  "favorites.empty_title": "No tienes guardados todavía",
  "favorites.empty_description": "Explora las historias de Asturias y guarda las que más te gusten para verlas después.",
  "favorites.explore": "Explorar historias",
  "favorites.loading_more": "Cargando más...",
  "favorites.all_viewed": "Has visto todos tus guardados",

  // Auth
  "auth.sign_in": "Entrar",
  "auth.sign_out": "Cerrar sesion",
  "auth.user": "Usuario",
  "auth.sync_favorites_title": "Sincroniza tus favoritos",
  "auth.sync_favorites_description": "Inicia sesion para guardar tus favoritos en la nube y acceder desde cualquier dispositivo.",
  "auth.continue_with_google": "Continuar con Google",
  "auth.maybe_later": "Quiza mas tarde",

  // Mood
  "mood.title": "¿Qué te apetece?",
  "mood.subtitle": "Elige un estado de ánimo y te mostramos lo mejor",
  "mood.relaxing": "Relajante",
  "mood.adventurous": "Aventurero",
  "mood.cultural": "Cultural",
  "mood.delicious": "Delicioso",
  "mood.show_all": "Mostrar todo",

  // Share
  "share.share": "Compartir",

  // Accessibility
  "accessibility.language_switcher": "Cambiar idioma",
  "accessibility.related_stories": "Historias relacionadas",
  "accessibility.suggested_questions": "Preguntas sugeridas",
};

export function createMockT() {
  return (key: string) => mockTranslations[key] || key;
}
