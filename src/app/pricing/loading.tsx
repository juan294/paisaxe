import { Skeleton } from "@/components/ui/skeleton";

export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          {/* Sound bars icon placeholder */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-paisaxe-green-500/10 mb-6">
            <Skeleton className="h-6 w-6 rounded bg-paisaxe-green-500/20" />
          </div>
          {/* Title */}
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          {/* Subtitle */}
          <Skeleton className="h-5 w-48 mx-auto" />
        </div>

        {/* Pricing Card */}
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          {/* Price section */}
          <div className="p-6 text-center border-b border-neutral-800">
            <Skeleton className="h-3 w-28 mx-auto mb-3" />
            <Skeleton className="h-10 w-24 mx-auto" />
          </div>

          {/* Features list */}
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="p-6 pt-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-3 w-36 mx-auto mt-3" />
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 pt-8 border-t border-neutral-800/50">
          <Skeleton className="h-4 w-40 mb-6" />
          <div className="space-y-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-56 mb-1" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
