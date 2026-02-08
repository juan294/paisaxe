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
  "chat.call": "Llamar",
  "chat.directions": "Cómo llegar",
  "chat.copy_conversation": "Copiar conversación",
  "chat.copied": "Copiado",

  // Stories
  "stories.new_badge": "Nuevo",
  "stories.ambient": "Ambient",
  "stories.surprise": "Sorpréndeme",
  "stories.related": "También te puede interesar",
  "stories.no_results": "No hay historias con estos filtros",
  "stories.ambient_on": "Activar modo ambiente",
  "stories.ambient_off": "Desactivar modo ambiente",

  // Stories action
  "stories.ask_about": "Preguntar sobre esto",

  // Stories categories
  "stories.categories.nature": "Naturaleza",
  "stories.categories.cities": "Ciudades",
  "stories.categories.food": "Gastronomía",
  "stories.categories.culture": "Cultura",
  "stories.categories.activities": "Actividades",

  // Stories locations
  "stories.locations.eastern": "Asturias Oriental",
  "stories.locations.central": "Asturias Central",
  "stories.locations.western": "Asturias Occidental",

  // Stories durations
  "stories.durations.day-trip": "Excursión de un día",
  "stories.durations.weekend": "Fin de semana",
  "stories.durations.week": "Una semana",

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
  "nav.hint_previous": "Anterior",
  "nav.hint_next": "Siguiente",

  // Favorites
  "favorites.title": "Guardados",
  "favorites.bookmarks": "Guardados",
  "favorites.your_stories": "Tus Historias",
  "favorites.sign_in_to_save": "Inicia sesión para guardar",
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
  "favorites.local_only": "Tus guardados solo estan en este dispositivo",
  "favorites.local_only_description": "Si borras los datos del navegador o cambias de dispositivo, los perderas.",
  "favorites.sync_with_google": "Sincronizar con Google",

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
  "share.link_copied": "Enlace copiado",

  // Favorites toast
  "favorites.removed": "Eliminado de favoritos",
  "favorites.saved_toast": "Guardado en favoritos",

  // Fullscreen
  "fullscreen.toggle": "Pantalla completa",
  "fullscreen.install_title": "Experiencia completa",
  "fullscreen.install_description": "Añade Paisaxe a tu pantalla de inicio para una experiencia a pantalla completa.",
  "fullscreen.step_tap": "Toca el botón",
  "fullscreen.step_share": "compartir",
  "fullscreen.step_add_home": "Selecciona \"Añadir a pantalla de inicio\"",
  "fullscreen.step_open": "Abre Paisaxe desde tu pantalla de inicio",
  "fullscreen.got_it": "Entendido",

  // Author pill
  "author_pill.made_with_love": "hecho con \u2665 en Asturias",
  "author_pill.fueled_by_sidra": "alimentado por sidra",
  "author_pill.buen_camino": "\u00a1buen Camino!",
  "author_pill.probably_hiking": "seguramente \ud83c\udfd4\ufe0f rn",
  "author_pill.out_cycling": "seguramente \ud83d\udeb4 rn",
  "author_pill.scaling_rocks": "escalando alguna roca",
  "author_pill.sleep_not_found": "404: sue\u00f1o no encontrado",
  "author_pill.works_on_my_machine": "funciona en mi m\u00e1quina\u2122",
  "author_pill.bug_free": "sin bugs* (*casi)",

  // Accessibility
  "accessibility.language_switcher": "Cambiar idioma",
  "accessibility.related_stories": "Historias relacionadas",
  "accessibility.suggested_questions": "Preguntas sugeridas",
  "accessibility.skip_to_content": "Ir al contenido principal",
  "accessibility.previous_story": "Historia anterior",
  "accessibility.next_story": "Historia siguiente",
  "accessibility.play_stories": "Reproducir historias",
  "accessibility.pause_stories": "Pausar historias",
  "accessibility.story_counter": "Historia {current} de {total}",
  "accessibility.chat_dialog": "Chat sobre {title}",
  "accessibility.close_chat": "Cerrar chat",
  "accessibility.send_message": "Enviar mensaje",
  "accessibility.chat_messages": "Mensajes del chat",
  "accessibility.story_progress": "Progreso de historias",
  "accessibility.more_options": "Más opciones",
  "accessibility.story_controls": "Controles de historias",
};

export function createMockT() {
  return (key: string) => mockTranslations[key] || key;
}
