/**
 * Chat action detection utilities
 *
 * Detects phone numbers and addresses in chat messages to enable
 * context-aware action buttons (call, directions).
 */

interface PhoneMatch {
  /** Normalized phone number for tel: link (e.g., +34985123456) */
  number: string;
  /** Original display format from the text */
  display: string;
}

interface AddressMatch {
  /** The detected address text */
  text: string;
  /** Google Maps search URL */
  mapsUrl: string;
}

interface ChatActionsResult {
  phones: PhoneMatch[];
  addresses: AddressMatch[];
  hasActions: boolean;
}

/**
 * Detect Spanish phone numbers in text
 *
 * Supported formats:
 * - +34 XXX XXX XXX (international with spaces)
 * - +34XXXXXXXXX (international without spaces)
 * - XXX XXX XXX (local 3-3-3 with spaces)
 * - XXX XX XX XX (local 3-2-2-2 with spaces)
 * - XXXXXXXXX (local without spaces)
 *
 * Spanish numbers start with:
 * - 9XX: landlines
 * - 6XX, 7XX: mobile
 * - 8XX: toll-free/special
 */
export function detectPhoneNumbers(text: string): PhoneMatch[] {
  const matches: PhoneMatch[] = [];
  const seen = new Set<string>();

  // Pattern 1: International format +34 with optional spaces (various groupings)
  const internationalRegex = /\+34\s?(\d{3})\s?(\d{2,3})\s?(\d{2,3})\s?(\d{0,2})/g;
  let match;

  while ((match = internationalRegex.exec(text)) !== null) {
    // Combine all digit groups
    const digits = match[1] + match[2] + match[3] + (match[4] || "");
    if (digits.length === 9) {
      const normalized = `+34${digits}`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        matches.push({
          number: normalized,
          display: match[0].trim(),
        });
      }
    }
  }

  // Pattern 2: Local Spanish numbers - 3-3-3 format (XXX XXX XXX)
  const local333Regex = /(?<!\d)([6-9]\d{2})\s(\d{3})\s(\d{3})(?!\d)/g;

  while ((match = local333Regex.exec(text)) !== null) {
    const normalized = `+34${match[1]}${match[2]}${match[3]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      matches.push({
        number: normalized,
        display: match[0],
      });
    }
  }

  // Pattern 3: Local Spanish numbers - 3-2-2-2 format (XXX XX XX XX)
  const local3222Regex = /(?<!\d)([6-9]\d{2})\s(\d{2})\s(\d{2})\s(\d{2})(?!\d)/g;

  while ((match = local3222Regex.exec(text)) !== null) {
    const normalized = `+34${match[1]}${match[2]}${match[3]}${match[4]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      matches.push({
        number: normalized,
        display: match[0],
      });
    }
  }

  // Pattern 4: Local Spanish numbers without spaces (9 consecutive digits)
  const localNoSpaceRegex = /(?<!\d)([6-9]\d{8})(?!\d)/g;

  while ((match = localNoSpaceRegex.exec(text)) !== null) {
    const normalized = `+34${match[1]}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      matches.push({
        number: normalized,
        display: match[0],
      });
    }
  }

  return matches;
}

/**
 * Generate a Google Maps search URL for an address
 */
function generateMapsUrl(address: string): string {
  const query = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Curated list of Asturian landmarks and places for detection
 *
 * These are popular locations that may appear in chat messages
 * but don't follow formal Spanish address patterns.
 */
const ASTURIAN_LANDMARKS = [
  // Natural landmarks
  "Lagos de Covadonga",
  "Picos de Europa",
  "Ruta del Cares",
  "Playa de Gulpiyuri",
  "Playa de Rodiles",
  "Playa de Torimbia",
  "Playa de Ballota",
  "Playa de Cuevas del Mar",
  "Playa del Silencio",
  "Playa de San Lorenzo",
  "Bufones de Pría",
  "Naranjo de Bulnes",
  "Picu Urriellu",
  "Senda del Oso",
  "Parque Natural de Somiedo",
  "Parque Natural de Redes",
  "Cabo Peñas",
  "Mirador del Fito",
  "Cascadas de Oneta",
  "Bosque de Muniellos",
  "Desfiladero de los Beyos",
  "Desfiladero de la Hermida",

  // Religious and historical
  "Basílica de Covadonga",
  "Basilica de Covadonga",
  "Santa Cueva de Covadonga",
  "Catedral de Oviedo",
  "Catedral de San Salvador",
  "Santa María del Naranco",
  "San Miguel de Lillo",
  "San Julián de los Prados",
  "Santullano",
  "Cámara Santa",
  "Monasterio de San Pedro de Villanueva",
  "Monasterio de Valdediós",

  // Cities and towns
  "Oviedo",
  "Gijón",
  "Avilés",
  "Cangas de Onís",
  "Llanes",
  "Ribadesella",
  "Luarca",
  "Cudillero",
  "Lastres",
  "Tazones",
  "Covadonga",
  "Arriondas",
  "Pola de Somiedo",
  "Taramundi",
  "Villaviciosa",

  // Museums and cultural sites
  "Museo del Jurásico",
  "MUJA",
  "Centro Niemeyer",
  "Laboral Ciudad de la Cultura",
  "Acuario de Gijón",
  "Jardín Botánico de Gijón",

  // Gastronomy locations
  "Mercado El Fontán",
  "Puerto de Cudillero",
  "Puerto de Lastres",
  "Puerto de Tazones",

  // Camino de Santiago
  "Camino Primitivo",
  "Camino del Norte",
  "Camino de la Costa",
];

/**
 * Detect Asturian landmark and place names in text
 *
 * Looks for known landmarks like "Lagos de Covadonga", "Picos de Europa", etc.
 * that don't follow formal address patterns but should still show a Maps button.
 */
export function detectPlaceNames(text: string): AddressMatch[] {
  const lowerText = text.toLowerCase();

  // Find all matches with their positions
  interface MatchCandidate {
    text: string;
    start: number;
    end: number;
  }

  const candidates: MatchCandidate[] = [];

  // Sort landmarks by length descending so longer matches are found first
  const sortedLandmarks = [...ASTURIAN_LANDMARKS].sort(
    (a, b) => b.length - a.length
  );

  for (const landmark of sortedLandmarks) {
    const lowerLandmark = landmark.toLowerCase();

    // Find all occurrences of this landmark in the text (case-insensitive)
    let searchStart = 0;
    while (true) {
      const index = lowerText.indexOf(lowerLandmark, searchStart);
      if (index === -1) break;

      // Extract the actual text as it appears in the original
      const actualText = text.slice(index, index + landmark.length);

      candidates.push({
        text: actualText,
        start: index,
        end: index + landmark.length,
      });

      searchStart = index + 1;
    }
  }

  // Sort by start position, then by length (longest first)
  candidates.sort((a, b) => a.start - b.start || b.text.length - a.text.length);

  // Remove overlapping matches (keep the longer one)
  const matches: AddressMatch[] = [];
  const seen = new Set<string>();
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const candidate of candidates) {
    // Check if this candidate overlaps with any already-added match
    const overlaps = usedRanges.some(
      (range) =>
        (candidate.start >= range.start && candidate.start < range.end) ||
        (candidate.end > range.start && candidate.end <= range.end) ||
        (candidate.start <= range.start && candidate.end >= range.end)
    );

    if (overlaps) continue;

    const normalized = candidate.text.toLowerCase();

    // Always mark this range as used (even for duplicate text)
    // This prevents shorter landmarks within this range from being detected
    usedRanges.push({ start: candidate.start, end: candidate.end });

    // Skip if we've already added this text to results
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    matches.push({
      text: candidate.text,
      mapsUrl: generateMapsUrl(candidate.text + ", Asturias, Spain"),
    });
  }

  return matches;
}

/**
 * Detect Spanish addresses in text
 *
 * Looks for common address patterns:
 * - Calle/C. + name
 * - Avenida/Av. + name
 * - Plaza/Pl. + name
 * - Paseo + name
 * - Carretera + name
 * - Postal codes (5 digits) + city names
 */
export function detectAddresses(text: string): AddressMatch[] {
  const candidates: Array<{ text: string; normalized: string; start: number; end: number }> = [];

  // Address prefixes and their patterns
  const streetPatterns = [
    // Calle/C.
    /(?:Calle|C\.)\s+[A-Za-zÀ-ÿ\s]+(?:,\s*\d+)?(?:,\s*[A-Za-zÀ-ÿ\s]+)?/gi,
    // Avenida/Av.
    /(?:Avenida|Av\.)\s+[A-Za-zÀ-ÿ\s]+(?:,\s*\d+)?(?:,\s*[A-Za-zÀ-ÿ\s]+)?/gi,
    // Plaza/Pl.
    /(?:Plaza|Pl\.)\s+[A-Za-zÀ-ÿ\s]+(?:,\s*\d+)?(?:,\s*[A-Za-zÀ-ÿ\s]+)?/gi,
    // Paseo
    /Paseo\s+[A-Za-zÀ-ÿ\s]+(?:,\s*(?:\d+|[A-Za-zÀ-ÿ\s]+))?/gi,
    // Carretera
    /Carretera\s+[A-Za-zÀ-ÿ\s]+(?:,\s*(?:km\s*\d+|\d+))?(?:,\s*[A-Za-zÀ-ÿ\s]+)?/gi,
  ];

  // Process street patterns
  for (const pattern of streetPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Clean up the match - trim
      const addressText = match[0].trim();

      // Normalize for deduplication (lowercase, remove extra spaces)
      const normalized = addressText.toLowerCase().replace(/\s+/g, " ");

      candidates.push({
        text: addressText,
        normalized,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Pattern for postal codes with city names (Asturian cities)
  const postalCodePattern =
    /(\d{5})\s+([A-Za-zÀ-ÿ]+)(?:,?\s*(?:Asturias|Oviedo|Gijón|Avilés))?/gi;
  let match;

  while ((match = postalCodePattern.exec(text)) !== null) {
    const postalCode = match[1];
    // Only match Asturian postal codes (33XXX)
    if (postalCode.startsWith("33")) {
      const addressText = match[0].trim();
      const normalized = addressText.toLowerCase().replace(/\s+/g, " ");

      candidates.push({
        text: addressText,
        normalized,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Deduplicate: remove addresses that overlap or are adjacent to longer addresses
  const seen = new Set<string>();
  const matches: AddressMatch[] = [];

  // Sort by start position, then by length (longest first for same start)
  candidates.sort((a, b) => a.start - b.start || b.text.length - a.text.length);

  // Merge adjacent candidates that are close to each other (within 5 chars)
  const ADJACENCY_THRESHOLD = 5;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    // Skip if we've already seen this normalized address
    if (seen.has(candidate.normalized)) continue;

    // Check if this candidate overlaps or is adjacent to an already-added address
    const conflictsWithExisting = matches.some((existing) => {
      const existingCandidate = candidates.find((c) => c.text === existing.text);
      if (!existingCandidate) return false;

      // Check if ranges overlap or are adjacent
      const overlaps =
        (candidate.start >= existingCandidate.start && candidate.start < existingCandidate.end) ||
        (candidate.end > existingCandidate.start && candidate.end <= existingCandidate.end) ||
        (candidate.start <= existingCandidate.start && candidate.end >= existingCandidate.end);

      // Check if adjacent (within threshold chars)
      const adjacent =
        Math.abs(candidate.start - existingCandidate.end) <= ADJACENCY_THRESHOLD ||
        Math.abs(existingCandidate.start - candidate.end) <= ADJACENCY_THRESHOLD;

      return overlaps || adjacent;
    });

    if (conflictsWithExisting) continue;

    seen.add(candidate.normalized);
    matches.push({
      text: candidate.text,
      mapsUrl: generateMapsUrl(candidate.text),
    });
  }

  return matches;
}

/**
 * Detect all actionable content in a chat message
 *
 * Combines phone, address, and landmark detection into a single result
 * that can be used to render action buttons.
 */
export function detectChatActions(text: string): ChatActionsResult {
  const phones = detectPhoneNumbers(text);
  const addresses = detectAddresses(text);
  const places = detectPlaceNames(text);

  // Merge addresses and places, deduplicating by normalized text
  const seenTexts = new Set<string>();
  const allAddresses: AddressMatch[] = [];

  // Add street addresses first (they're more specific)
  for (const addr of addresses) {
    const normalized = addr.text.toLowerCase();
    if (!seenTexts.has(normalized)) {
      seenTexts.add(normalized);
      allAddresses.push(addr);
    }
  }

  // Add place names that weren't already found as addresses
  for (const place of places) {
    const normalized = place.text.toLowerCase();
    // Check if this place is already covered by an address
    const alreadyCovered = allAddresses.some((addr) =>
      addr.text.toLowerCase().includes(normalized) ||
      normalized.includes(addr.text.toLowerCase())
    );
    if (!alreadyCovered && !seenTexts.has(normalized)) {
      seenTexts.add(normalized);
      allAddresses.push(place);
    }
  }

  return {
    phones,
    addresses: allAddresses,
    hasActions: phones.length > 0 || allAddresses.length > 0,
  };
}
