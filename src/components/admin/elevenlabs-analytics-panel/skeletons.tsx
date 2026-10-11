export function SkeletonVoiceDashboard() {
  return (
    <>
      {/* Active Calls Widget Skeleton */}
      <div className="inline-flex items-center gap-3 rounded-full bg-admin-paper px-4 py-2 dark:bg-admin-depth">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-admin-skeleton-dot dark:bg-admin-secondary" />
        <div className="h-4 w-24 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
      </div>

      {/* Summary Stats Skeleton */}
      <section className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
        <SkeletonStatCard color="blue" />
        <SkeletonStatCard color="emerald" />
        <SkeletonStatCard color="stone" />
        <SkeletonStatCard color="violet" />
        <SkeletonStatCard color="amber" />
        <SkeletonStatCard color="yellow" />
      </section>

      {/* Breakdown Tables Skeleton */}
      <div className="grid gap-12 lg:grid-cols-2">
        <SkeletonBreakdownTable number="01" title="By Agent" />
        <SkeletonBreakdownTable number="02" title="By Language" />
        <SkeletonBreakdownTable number="03" title="By Status" />
        <SkeletonRecentConversations number="04" />
      </div>
    </>
  );
}

const skeletonColorClasses: Record<string, string> = {
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
  amber: "bg-amber-200 dark:bg-amber-900/30",
  rose: "bg-rose-200 dark:bg-rose-900/30",
  violet: "bg-violet-200 dark:bg-violet-900/30",
  yellow: "bg-yellow-200 dark:bg-yellow-900/30",
  stone: "bg-admin-line dark:bg-admin-depth",
};

function SkeletonStatCard({ color }: { color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
        <div className="h-3 w-20 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
      </div>
      <div className={`h-9 w-16 animate-pulse rounded ${skeletonColorClasses[color] || skeletonColorClasses.stone}`} />
    </div>
  );
}

function SkeletonBreakdownTable({ number, title }: { number: string; title: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
        {number} — {title}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-line text-left dark:border-admin-depth">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">Name</th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {[1, 2, 3].map((idx) => (
            <tr key={idx}>
              <td className="py-2 font-mono text-sm tabular-nums text-admin-subtle">
                {String(idx).padStart(2, "0")}
              </td>
              <td className="py-2">
                <div
                  className="h-4 animate-pulse rounded bg-admin-line dark:bg-admin-depth"
                  style={{ width: `${65 - idx * 10}%` }}
                />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-10 animate-pulse rounded bg-sky-200 dark:bg-sky-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SkeletonRecentConversations({ number }: { number: string }) {
  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
        {number} — Recent Conversations
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-line text-left dark:border-admin-depth">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">Time</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">Status</th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {[1, 2, 3, 4, 5].map((idx) => (
            <tr key={idx}>
              <td className="py-2">
                <div className="h-3 w-28 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
              </td>
              <td className="py-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
              </td>
              <td className="py-2 text-right">
                <div className="ml-auto h-4 w-8 animate-pulse rounded bg-amber-200 dark:bg-amber-900/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
