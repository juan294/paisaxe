/**
 * Curated design-system entry for /design-sync (Claude Design).
 *
 * Paisaxe is a Next.js app, not a component package: there is no dist/ to
 * bundle, and the converter's synth mode would re-export every file under
 * src/ (pages, server-only modules). This barrel re-exports exactly the scope
 * agreed with the owner on 2026-10-07, from the app's own source files.
 * Components that need the Next.js runtime (next/link, next/image, the
 * router) are left out: StoryViewer, RelatedStories, BookmarkButton,
 * ChatHeader, ChatMessageList, ChatUpsellCTA.
 */
import type { ReactNode } from "react";
import { LanguageProvider } from "../../src/lib/i18n/provider";
import type { Locale } from "../../src/lib/i18n/types";

// UI primitives (shadcn/ui pattern: Radix + class-variance-authority + Tailwind)
export { Button, buttonVariants } from "../../src/components/ui/button";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "../../src/components/ui/card";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../../src/components/ui/dialog";
export { Input } from "../../src/components/ui/input";
export { Label } from "../../src/components/ui/label";
export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "../../src/components/ui/select";
export { Skeleton } from "../../src/components/ui/skeleton";
export { StatCard } from "../../src/components/ui/stat-card";
export { Textarea } from "../../src/components/ui/textarea";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../../src/components/ui/tooltip";
export { Logo } from "../../src/components/ui/logo";

// Booking and chat
export { BookingCards } from "../../src/components/immersive/voice-chat/booking-cards";
export { BalanceInvoiceStatusView } from "../../src/components/booking/balance-invoice";
export { CancellationConfirm } from "../../src/components/booking/cancellation-confirm";
export { ChatComposer } from "../../src/components/immersive/voice-chat/chat-composer";
export { ChatErrorBanner } from "../../src/components/immersive/voice-chat/chat-error-banner";
export { ChatMarkdown } from "../../src/components/immersive/voice-chat/chat-markdown";
export { QuestionPrompts } from "../../src/components/immersive/question-prompts";

// Story UI
export { StoryInfoPanel } from "../../src/components/immersive/story-info-panel";
export { StoryProgressBar } from "../../src/components/immersive/story-progress-bar";
export { CategoryFilterBadge } from "../../src/components/immersive/category-filter-badge";
export { FreshnessBadge } from "../../src/components/immersive/freshness-badge";
export { UserSubmittedBadge } from "../../src/components/immersive/user-submitted-badge";
export { StoryCardSkeleton } from "../../src/components/immersive/skeleton-story-card";
export { ChatMessageSkeleton } from "../../src/components/immersive/skeleton-chat-message";
export { LanguageSwitcher } from "../../src/components/immersive/language-switcher";
export { ShareButton } from "../../src/components/immersive/share-button";
export { SurpriseMeButton } from "../../src/components/immersive/surprise-me-button";
export { PrivacyNotice } from "../../src/components/immersive/privacy-notice";

export { LanguageProvider };

/**
 * The app shell every Paisaxe screen renders inside: the translation provider
 * (most app components call useTranslation) and the root `<body>` classes from
 * src/app/layout.tsx (`font-sans antialiased bg-neutral-950`). Wrap every
 * design in it.
 */
export function PaisaxeRoot({ children, locale = "es" }: { children: ReactNode; locale?: Locale }) {
  return (
    <LanguageProvider initialLocale={locale}>
      <div className="font-sans antialiased bg-neutral-950 min-h-full">{children}</div>
    </LanguageProvider>
  );
}
