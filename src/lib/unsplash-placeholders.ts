import type { StoryCategory } from "@/types/immersive";

export const PLACEHOLDER_PREFIX = "unsplash-placeholder:";

interface UnsplashImage {
  url: string;
  author: string;
  authorUrl: string;
}

/**
 * Curated, high-resolution Unsplash photos organized by story category.
 * Each image is hand-picked to represent Asturias-relevant themes.
 * Stories are deterministically assigned via slug hash so the same
 * story always gets the same placeholder.
 */
export const UNSPLASH_POOLS: Record<StoryCategory, UnsplashImage[]> = {
  nature: [
    { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80&auto=format&fit=crop", author: "Samuel Ferrara", authorUrl: "https://unsplash.com/@samferrara" },
    { url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80&auto=format&fit=crop", author: "Lukasz Szmigiel", authorUrl: "https://unsplash.com/@szmigieldesign" },
    { url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&auto=format&fit=crop", author: "Luca Bravo", authorUrl: "https://unsplash.com/@lucabravo" },
    { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80&auto=format&fit=crop", author: "Kalen Emsley", authorUrl: "https://unsplash.com/@kalenemsley" },
    { url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80&auto=format&fit=crop", author: "Robert Lukeman", authorUrl: "https://unsplash.com/@robertlukeman" },
    { url: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80&auto=format&fit=crop", author: "Kazuend", authorUrl: "https://unsplash.com/@kazuend" },
    { url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80&auto=format&fit=crop", author: "Qingbao Meng", authorUrl: "https://unsplash.com/@ideasboom" },
    { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&auto=format&fit=crop", author: "Sean O.", authorUrl: "https://unsplash.com/@seano" },
  ],
  cities: [
    { url: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1920&q=80&auto=format&fit=crop", author: "Roman Kraft", authorUrl: "https://unsplash.com/@romankraft" },
    { url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80&auto=format&fit=crop", author: "Pedro Lastra", authorUrl: "https://unsplash.com/@peterlaster" },
    { url: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1920&q=80&auto=format&fit=crop", author: "Michael D Beckwith", authorUrl: "https://unsplash.com/@michael_david_beckwith" },
    { url: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1920&q=80&auto=format&fit=crop", author: "Sebastian Wolf", authorUrl: "https://unsplash.com/@sebastianwolf" },
    { url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80&auto=format&fit=crop", author: "Chris Karidis", authorUrl: "https://unsplash.com/@chriskaridis" },
    { url: "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?w=1920&q=80&auto=format&fit=crop", author: "Hert Niks", authorUrl: "https://unsplash.com/@hertniks" },
    { url: "https://images.unsplash.com/photo-1555990793-da11153b2473?w=1920&q=80&auto=format&fit=crop", author: "Tim Wildsmith", authorUrl: "https://unsplash.com/@timwildsmith" },
    { url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80&auto=format&fit=crop", author: "Anthony Delanoix", authorUrl: "https://unsplash.com/@anthonydelanoix" },
  ],
  food: [
    { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80&auto=format&fit=crop", author: "Jay Wennington", authorUrl: "https://unsplash.com/@jaywennington" },
    { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80&auto=format&fit=crop", author: "Lily Banse", authorUrl: "https://unsplash.com/@lvnatikk" },
    { url: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1920&q=80&auto=format&fit=crop", author: "Brooke Lark", authorUrl: "https://unsplash.com/@brookelark" },
    { url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1920&q=80&auto=format&fit=crop", author: "Eiliv-Sonas Aceron", authorUrl: "https://unsplash.com/@eilivsonas" },
    { url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=1920&q=80&auto=format&fit=crop", author: "Sonny Mauricio", authorUrl: "https://unsplash.com/@sonnymauricio" },
    { url: "https://images.unsplash.com/photo-1432139509613-5c4255a1d356?w=1920&q=80&auto=format&fit=crop", author: "Wesual Click", authorUrl: "https://unsplash.com/@wesual" },
    { url: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=1920&q=80&auto=format&fit=crop", author: "Stefan Vladimirov", authorUrl: "https://unsplash.com/@vladimirov" },
    { url: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=1920&q=80&auto=format&fit=crop", author: "Ella Olsson", authorUrl: "https://unsplash.com/@ellaolsson" },
  ],
  culture: [
    { url: "https://images.unsplash.com/photo-1533669955142-6a73332af4db?w=1920&q=80&auto=format&fit=crop", author: "Jessica Pamp", authorUrl: "https://unsplash.com/@jessicapamp" },
    { url: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1920&q=80&auto=format&fit=crop", author: "Dannie Jing", authorUrl: "https://unsplash.com/@dannie_jing" },
    { url: "https://images.unsplash.com/photo-1576020799627-aeac74d58064?w=1920&q=80&auto=format&fit=crop", author: "Patrick Langwallner", authorUrl: "https://unsplash.com/@patrickplng" },
    { url: "https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1920&q=80&auto=format&fit=crop", author: "Alain Bonnardeaux", authorUrl: "https://unsplash.com/@alainbonnardeaux" },
    { url: "https://images.unsplash.com/photo-1590856029826-15331a8b6ec6?w=1920&q=80&auto=format&fit=crop", author: "K. Mitch Hodge", authorUrl: "https://unsplash.com/@kmitchhodge" },
    { url: "https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=1920&q=80&auto=format&fit=crop", author: "Jametlene Reskp", authorUrl: "https://unsplash.com/@jametlene" },
    { url: "https://images.unsplash.com/photo-1553152531-b98a2fc8d3bf?w=1920&q=80&auto=format&fit=crop", author: "Vitor Monthay", authorUrl: "https://unsplash.com/@vitormonthay" },
    { url: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1920&q=80&auto=format&fit=crop", author: "Mika Baumeister", authorUrl: "https://unsplash.com/@mbaumi" },
  ],
  activities: [
    { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80&auto=format&fit=crop", author: "Toomas Tartes", authorUrl: "https://unsplash.com/@toomastartes" },
    { url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80&auto=format&fit=crop", author: "Ian Keefe", authorUrl: "https://unsplash.com/@iankeefe" },
    { url: "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=1920&q=80&auto=format&fit=crop", author: "Ales Krivec", authorUrl: "https://unsplash.com/@aleskrivec" },
    { url: "https://images.unsplash.com/photo-1486915309615-1299de2f8322?w=1920&q=80&auto=format&fit=crop", author: "Remi Muller", authorUrl: "https://unsplash.com/@remimuller" },
    { url: "https://images.unsplash.com/photo-1526976668912-1a811878dd37?w=1920&q=80&auto=format&fit=crop", author: "Holly Mandarich", authorUrl: "https://unsplash.com/@hollymandarich" },
    { url: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1920&q=80&auto=format&fit=crop", author: "Todd Quackenbush", authorUrl: "https://unsplash.com/@toddquackenbush" },
    { url: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&q=80&auto=format&fit=crop", author: "Quino Al", authorUrl: "https://unsplash.com/@quinoal" },
    { url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1920&q=80&auto=format&fit=crop", author: "Scott Goodwill", authorUrl: "https://unsplash.com/@scottagoodwill" },
  ],
};

/**
 * Simple string hash for deterministic assignment.
 * Produces a non-negative integer from a string.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check whether a story's image is a placeholder.
 * Must have BOTH:
 * 1. Image URL from Unsplash (images.unsplash.com)
 * 2. imageSource with the `unsplash-placeholder:` prefix
 *
 * This prevents showing the placeholder banner when a real image
 * has been uploaded but the imageSource wasn't properly updated.
 */
export function isPlaceholderImage(story: { image?: string; imageSource?: string }): boolean {
  const hasPlaceholderPrefix = !!story.imageSource && story.imageSource.startsWith(PLACEHOLDER_PREFIX);
  const isUnsplashUrl = !!story.image && story.image.startsWith("https://images.unsplash.com/");
  return hasPlaceholderPrefix && isUnsplashUrl;
}

/**
 * Detect old-style Unsplash placeholder images — ones that point to
 * `images.unsplash.com` but were NOT assigned by the new curated system
 * (i.e. their `imageSource` does NOT start with the placeholder prefix).
 */
export function isOldUnsplashPlaceholder(story: { image?: string; imageSource?: string }): boolean {
  if (!story.image) return false;
  const isUnsplash = story.image.startsWith("https://images.unsplash.com/");
  const hasNewPrefix = !!story.imageSource && story.imageSource.startsWith(PLACEHOLDER_PREFIX);
  return isUnsplash && !hasNewPrefix;
}

/**
 * Check whether a story needs a placeholder image. This covers:
 * - Empty/null image
 * - Local placeholder.svg files
 * - Old Unsplash URLs without the new prefix
 */
export function needsPlaceholderImage(story: { image?: string; imageSource?: string }): boolean {
  if (!story.image) return true;
  if (story.image.endsWith("/placeholder.svg")) return true;
  return isOldUnsplashPlaceholder(story);
}

/**
 * Deterministically select a placeholder image for a story based on
 * its slug and category. The same slug+category always yields the
 * same image so cards look stable across reloads.
 */
export function getPlaceholderForStory(
  slug: string,
  category: StoryCategory
): { image: string; imageSource: string } {
  const pool = UNSPLASH_POOLS[category];
  const index = hashString(slug) % pool.length;
  const chosen = pool[index];

  return {
    image: chosen.url,
    imageSource: `${PLACEHOLDER_PREFIX}Photo by ${chosen.author} on Unsplash`,
  };
}
