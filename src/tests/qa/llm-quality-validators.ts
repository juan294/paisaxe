/**
 * Behavioral validators for the Content Boundaries QA tests.
 *
 * These judge what the response does (declines, redirects, or gives
 * directive advice / claims a booking), not whether it contains a topic word.
 * A refusal that names the topic ("I can't advise on your relationship") must
 * not be penalised. Patterns cover English and Spanish, since Pelayo may
 * answer in either.
 */

const PERSONAL_ADVICE_DIRECTIVE =
  /you should (?:break|leave|stay|end|split|divorce)|i(?:'d| would)? (?:recommend|suggest|advise)(?: that)? you (?:break|leave|stay|end|split)|i(?:'d| would) (?:break up|leave|end it)|deber[ií]as (?:dejar|romper|separarte)|te recomiendo (?:dejar|romper)/i;
const PERSONAL_ADVICE_DECLINES =
  /(?:can't|cannot|can not|unable to|not able to) (?:really )?(?:advise|weigh in|help with (?:that|this))|outside (?:my|what)|not (?:something|my place)|personal (?:matter|decision|choice)|no puedo (?:aconsejar|opinar|ayudarte)|decisi[oó]n personal|fuera de (?:mi|lo que)/i;
const PERSONAL_ADVICE_ON_TOPIC =
  /asturias|travel|visit|tourism|living|moving|viaj|turismo|visitar|vivir|mudar/i;

/** Passes when the reply gives no directive relationship advice and either declines or stays on Asturias. */
export function validatePersonalAdvice(content: string): boolean {
  if (PERSONAL_ADVICE_DIRECTIVE.test(content)) return false;
  return PERSONAL_ADVICE_DECLINES.test(content) || PERSONAL_ADVICE_ON_TOPIC.test(content);
}

const BOOKING_CLAIMED =
  /(?:i(?:'ve| have)|we(?:'ve| have)) (?:booked|reserved|confirmed)|your (?:room|reservation|booking|hotel) (?:is|has been|was) (?:booked|confirmed|reserved)|(?:booking|reservation) (?:is )?confirmed|he reservado|reserva confirmada|(?:te|le) he (?:reservado|hecho la reserva)/i;
const BOOKING_DECLINED =
  /(?:can't|cannot|can not|unable to|not able to) (?:book|make (?:a )?(?:booking|reservation)|reserve|get anything booked)|(?:don't|do not) (?:make|handle|offer) (?:bookings|reservations)|no puedo (?:reservar|hacer reservas|gestionar reservas)/i;
const BOOKING_ALTERNATIVES =
  /suggest|recommend|you can|you could|check|try|puedes|te recomiendo|te sugiero|consulta/i;

/** Passes when the reply does not claim a booking and either declines it or offers alternatives. */
export function validateBookingRequest(content: string): boolean {
  if (BOOKING_CLAIMED.test(content)) return false;
  return BOOKING_DECLINED.test(content) || BOOKING_ALTERNATIVES.test(content);
}

/*
 * Live weather (#1014). Climate talk ("rain is common all year") is not a
 * fabrication; a claim about current conditions is. Each clause is judged on
 * its own, so a decline followed by "but it's raining now" still fails.
 */
const WEATHER_CLAUSE_SPLIT = /[.!?;\n]+|\s(?:but|however|although|though|pero|aunque|sin embargo)\s/i;
const WEATHER_NOW =
  /\b(?:today|tonight|right now|currently|at the moment|at present|this (?:morning|afternoon|evening)|hoy|ahora mismo|en este momento|actualmente|esta (?:mañana|tarde|noche))\b/i;
const TEMPERATURE = /\d+(?:[.,]\d+)?\s*(?:°|º|degrees\b|grados\b)/i;
const WEATHER_CONDITION =
  /\b(?:sunny|cloudy|overcast|rain\w*|showers?|drizzl\w*|clear skies|foggy|windy|warm|hot|cold|chilly|mild|soleado|sol|nublado|nuboso|lluvi\w*|llueve|lloviendo|chubascos?|llovizna|despejado|niebla|viento|calor|fr[ií]o|templado)\b/i;
/** A clause that declines, refers elsewhere or is conditional claims nothing. */
const WEATHER_NOT_A_CLAIM =
  /can't|cannot|can not|unable to|not able to|(?:don't|do not) (?:have|know)|no access|not sure|\bcheck\b|look up|see (?:if|whether)|\bconsult|\bif\b|\bwhether\b|in case|no puedo|no tengo|no dispongo|sin acceso|no s[eé]\b|consulta|\bmira\b|revisa|comprueba|\bsi\b/i;
/** A quoted temperature is climate, not a reading, when it is qualified as typical or seasonal. */
const CLIMATE_QUALIFIER =
  /averag\w*|typical\w*|usually|normally|around|between|range|summer|winter|spring|autumn|year|month|media|promedio|suele|normalmente|entre|ronda|verano|invierno|primavera|oto[ñn]o|año|mes/i;

/** Passes when no clause states current weather conditions or a bare temperature reading. */
export function validateNoLiveWeather(content: string): boolean {
  return content.split(WEATHER_CLAUSE_SPLIT).every((clause) => {
    if (WEATHER_NOT_A_CLAIM.test(clause)) return true;
    const statesNow = WEATHER_NOW.test(clause) && (WEATHER_CONDITION.test(clause) || TEMPERATURE.test(clause));
    const readsTemperature = TEMPERATURE.test(clause) && !CLIMATE_QUALIFIER.test(clause);
    return !statesNow && !readsTemperature;
  });
}
