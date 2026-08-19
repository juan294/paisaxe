const skeletonColorClasses: Record<string, string> = {
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
  amber: "bg-amber-200 dark:bg-amber-900/30",
  violet: "bg-violet-200 dark:bg-violet-900/30",
  rose: "bg-rose-200 dark:bg-rose-900/30",
};

function SkeletonStatCard({ color }: { color: "blue" | "emerald" | "amber" | "violet" | "rose" }) {
  return (
    <div>
      <div className={`h-12 w-28 animate-pulse rounded lg:h-16 lg:w-36 ${skeletonColorClasses[color]}`} />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonRevenueChart() {
  return (
    <div className="overflow-x-auto">
      <div className="relative h-[200px] w-full max-w-3xl">
        {/* Chart area placeholder */}
        <div className="absolute inset-0 animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]">
          {/* Grid lines */}
          <div className="absolute left-14 right-5 top-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-1/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-1/2 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute left-14 right-5 top-3/4 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="absolute bottom-8 left-14 right-5 h-px bg-[#e5e3de] dark:bg-[#3d3a36]" />

          {/* Bar placeholders */}
          <div className="absolute bottom-8 left-16 flex items-end gap-2">
            {[60, 40, 80, 30, 70, 50, 90].map((height, i) => (
              <div
                key={i}
                className="w-6 rounded-t bg-emerald-200 dark:bg-emerald-900/30"
                style={{ height: `${height}%`, maxHeight: "140px" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded bg-emerald-300 dark:bg-emerald-800" />
        <div className="h-3 w-24 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
      </div>
    </div>
  );
}

function SkeletonProductTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Orders
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3].map((idx) => (
            <tr key={idx}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx).padStart(2, "0")}
              </td>
              <td className="py-2">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${70 - idx * 10}%` }}
                />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-8 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-14 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SkeletonOrdersTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">Date</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Product
            </th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Status
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
          {[1, 2, 3, 4, 5].map((idx) => (
            <tr key={idx}>
              <td className="py-2">
                <div className="h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
              </td>
              <td className="py-2">
                <div
                  className="h-4 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]"
                  style={{ width: `${60 - idx * 5}%` }}
                />
              </td>
              <td className="py-2">
                <div className="h-5 w-12 animate-pulse rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-emerald-200 dark:bg-emerald-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SkeletonRevenueDashboard() {
  return (
    <>
      {/* Summary Stats Skeleton */}
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        <SkeletonStatCard color="emerald" />
        <SkeletonStatCard color="rose" />
        <SkeletonStatCard color="blue" />
        <SkeletonStatCard color="amber" />
      </section>

      {/* Revenue Chart Skeleton */}
      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonRevenueChart />
      </section>

      {/* Data Tables Skeleton */}
      <div className="grid gap-16 lg:grid-cols-2">
        <SkeletonProductTable number="01" title="Revenue by Product" />
        <SkeletonOrdersTable number="02" title="Recent Orders" />
      </div>
    </>
  );
}
