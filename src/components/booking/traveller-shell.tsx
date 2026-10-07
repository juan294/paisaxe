import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/**
 * The page frame of the visitor's booking screens (voucher, booking, PayPal
 * return): the experience photo under the immersive gradient, the Paisaxe mark
 * home, and one centred column (docs/plans/2026-10-07-booking-ui-polish.md).
 * Without a photo the page is plain bg-neutral-950, which is also what shows
 * if the photo fails to load.
 */
export function TravellerShell({ photo, children }: { photo?: string; children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh bg-neutral-950 text-white">
      {photo && (
        <div className="fixed inset-0" aria-hidden="true">
          <Image src={photo} alt="" fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
        </div>
      )}
      <div className="relative flex min-h-dvh flex-col px-4 py-6">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          <span className="size-6" aria-hidden="true">
            <Logo />
          </span>
          Paisaxe
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">{children}</div>
      </div>
    </main>
  );
}

/** The frosted panel the booking content sits on. */
export function TicketCard({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">{children}</div>;
}
