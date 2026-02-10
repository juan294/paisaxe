/**
 * LOCATION-SPECIFIC: Central location configuration
 *
 * This file contains all location-specific data for the Paisaxe instance.
 * When replicating Paisaxe for a new location, update this file first.
 *
 * See REPLICATION.md for the complete guide.
 */

// =============================================================================
// LOCATION-SPECIFIC: Core location identity
// =============================================================================

export const LOCATION_CONFIG = {
  // Identity
  name: "Asturias",
  country: "Spain",
  countryCode: "ES",
  /** ISO language code for primary content language */
  primaryLanguage: "es",

  // Branding
  siteName: "Paisaxe",
  tagline: "Mira. Pregunta. Descubre.",
  taglineEn: "Look. Ask. Discover.",
  domain: "paisaxe.es",
  alternateDomain: "paisaxe.com",

  // Geographic center (for default map positioning)
  center: {
    lat: 43.3614,
    lng: -5.8593,
  },

  // Geographic regions
  regions: {
    eastern: {
      id: "eastern" as const,
      geo: { lat: 43.35, lng: -4.85 },
      // LOCATION-SPECIFIC: Key places in this region
      places: ["Llanes", "Cangas de Onís", "Picos de Europa"],
    },
    central: {
      id: "central" as const,
      geo: { lat: 43.36, lng: -5.85 },
      // LOCATION-SPECIFIC: Key places in this region
      places: ["Oviedo", "Gijón", "Avilés"],
    },
    western: {
      id: "western" as const,
      geo: { lat: 43.54, lng: -6.55 },
      // LOCATION-SPECIFIC: Key places in this region
      places: ["Cudillero", "Luarca", "Tapia de Casariego"],
    },
  },

  // Chat persona
  persona: {
    name: "Pelayo",
    role: "local tourism guide",
    // LOCATION-SPECIFIC: Areas of expertise
    expertise: ["places", "gastronomy", "nature", "culture", "activities"],
    // LOCATION-SPECIFIC: Local language/dialect
    localLanguage: "Asturianu",
    // LOCATION-SPECIFIC: Example local expressions
    localExpressions: [
      { word: "ye", meaning: "is" },
      { word: "guapu", meaning: "beautiful" },
      { word: "prestoso", meaning: "pleasant" },
      { word: "prau", meaning: "meadow" },
    ],
  },

  // SEO configuration
  seo: {
    // LOCATION-SPECIFIC: Keywords for search engines
    keywords: [
      "Asturias",
      "turismo",
      "Spain",
      "sidra",
      "Picos de Europa",
      "Oviedo",
      "Gijón",
      "naturaleza",
      "travel",
    ],
    locale: "es_ES",
    // LOCATION-SPECIFIC: Region description for meta tags
    description:
      "Descubre Asturias a través de historias visuales inmersivas. Paisajes, rutas, gastronomía y cultura del norte de España.",
    descriptionEn:
      "Discover Asturias through immersive visual stories. Landscapes, routes, gastronomy and culture of northern Spain.",
  },

  // Content categories specific to this location
  categories: {
    // LOCATION-SPECIFIC: Cuisine style for restaurant schema
    cuisineStyle: "Asturian",
    // LOCATION-SPECIFIC: Iconic dishes/products
    iconicDishes: ["fabada", "sidra", "cachopo", "cabrales"],
    // LOCATION-SPECIFIC: Natural features
    naturalFeatures: ["Picos de Europa", "Costa Verde", "Somiedo"],
    // LOCATION-SPECIFIC: Cultural highlights
    culturalHighlights: ["Pre-Romanesque architecture", "Camino de Santiago"],
  },

  // Containing geography (for structured data)
  containedIn: {
    type: "Country" as const,
    name: "España",
    nameEn: "Spain",
  },
} as const;

// =============================================================================
// Derived types from config
// =============================================================================

/** Region IDs derived from configuration */
type RegionId = keyof typeof LOCATION_CONFIG.regions;

/** Get all region IDs */
export function getRegionIds(): RegionId[] {
  return Object.keys(LOCATION_CONFIG.regions) as RegionId[];
}

/** Get region data by ID */
export function getRegion(id: RegionId) {
  return LOCATION_CONFIG.regions[id];
}

/** Get coordinates for a region (with fallback to central) */
export function getRegionCoordinates(id?: RegionId | null) {
  if (!id) return LOCATION_CONFIG.regions.central.geo;
  return LOCATION_CONFIG.regions[id]?.geo ?? LOCATION_CONFIG.regions.central.geo;
}
