const skeletonColorClasses = {
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
  amber: "bg-amber-200 dark:bg-amber-900/30",
  rose: "bg-rose-200 dark:bg-rose-900/30",
};

function SkeletonStatCard({ color }: { color: "blue" | "emerald" | "amber" | "rose" }) {
  return (
    <div>
      <div className={`h-16 w-32 animate-pulse rounded lg:h-24 lg:w-48 ${skeletonColorClasses[color]}`} />
      <div className="mt-4 h-3 w-20 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="overflow-x-auto">
      <div className="relative h-[200px] w-full max-w-3xl">
        {/* Chart area placeholder */}
        <div className="absolute inset-0 animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]">
          {/* Grid lines */}
          <div className="absolute left-12 right-5 top-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-1/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-1/2 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-12 right-5 top-3/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute bottom-8 left-12 right-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="mt-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-blue-300 dark:bg-blue-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-blue-200 dark:bg-blue-900/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-emerald-300 dark:bg-emerald-800" />
          <div className="h-3 w-14 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
        </div>
      </div>
    </div>
  );
}

function SkeletonDataTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {number} — {title}
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              #
            </th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Name
            </th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3, 4, 5].map((idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {String(idx).padStart(2, "0")}
              </td>
              <td className="py-3">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${70 - idx * 8}%` }}
                />
              </td>
              <td className="py-3 text-right">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-sky-200 dark:bg-sky-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SkeletonBar() {
  return (
    <div className="space-y-4">
      {/* Bar */}
      <div className="flex h-10 overflow-hidden rounded">
        <div className="w-2/3 animate-pulse bg-violet-200 dark:bg-violet-900/30" />
        <div className="w-1/3 animate-pulse bg-teal-200 dark:bg-teal-900/30" />
      </div>

      {/* Labels */}
      <div className="flex justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-violet-300 dark:bg-violet-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-violet-200 dark:bg-violet-900/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-teal-300 dark:bg-teal-800" />
          <div className="h-3 w-20 animate-pulse rounded bg-teal-200 dark:bg-teal-900/30" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <>
      {/* Large Stats Skeleton */}
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        <SkeletonStatCard color="blue" />
        <SkeletonStatCard color="emerald" />
        <SkeletonStatCard color="amber" />
        <SkeletonStatCard color="rose" />
      </section>

      {/* Time Series Chart Skeleton */}
      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonChart />
      </section>

      {/* Data Tables Skeleton - Two Column Grid */}
      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="01" title="Top Pages" />
        <SkeletonDataTable number="02" title="Top Referrers" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="04" title="Countries" />
        <SkeletonDataTable number="05" title="Cities" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="06" title="Devices" />
        <SkeletonDataTable number="07" title="Browsers" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="08" title="Operating Systems" />
        <SkeletonDataTable number="09" title="Screen Sizes" />
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonDataTable number="10" title="Entry Pages" />
        <SkeletonDataTable number="11" title="Exit Pages" />
      </div>

      {/* New vs Returning Skeleton */}
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          12 — New vs Returning Visitors
        </h2>
        <SkeletonBar />
      </section>
    </>
  );
}
