/**
 * Chat action detection utilities
 *
 * Detects phone numbers and addresses in chat messages to enable
 * context-aware action buttons (call, directions).
 */

export interface PhoneMatch {
  /** Normalized phone number for tel: link (e.g., +34985123456) */
  number: string;
  /** Original display format from the text */
  display: string;
}

export interface AddressMatch {
  /** The detected address text */
  text: string;
  /** Google Maps search URL */
  mapsUrl: string;
}

export interface ChatActionsResult {
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
  const matches: AddressMatch[] = [];
  const seen = new Set<string>();

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
      // Clean up the match - trim and remove trailing punctuation
      let addressText = match[0].trim();

      // Remove trailing period if present
      if (addressText.endsWith(".")) {
        addressText = addressText.slice(0, -1);
      }

      // Normalize for deduplication (lowercase, remove extra spaces)
      const normalized = addressText.toLowerCase().replace(/\s+/g, " ");

      if (!seen.has(normalized)) {
        seen.add(normalized);
        matches.push({
          text: addressText,
          mapsUrl: generateMapsUrl(addressText),
        });
      }
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

      if (!seen.has(normalized)) {
        seen.add(normalized);
        matches.push({
          text: addressText,
          mapsUrl: generateMapsUrl(addressText),
        });
      }
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
 * Detect all actionable content in a chat message
 *
 * Combines phone and address detection into a single result
 * that can be used to render action buttons.
 */
export function detectChatActions(text: string): ChatActionsResult {
  const phones = detectPhoneNumbers(text);
  const addresses = detectAddresses(text);

  return {
    phones,
    addresses,
    hasActions: phones.length > 0 || addresses.length > 0,
  };
}
