export function SkeletonGitHubDashboard() {
  return (
    <>
      <section className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
        {["blue", "violet", "emerald", "amber", "stone"].map((color) => (
          <div key={color} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
              <div className="h-3 w-20 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
            </div>
            <div className="h-9 w-16 animate-pulse rounded bg-admin-line dark:bg-admin-depth" />
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          Daily Traffic
        </h3>
        <div className="h-40 w-full animate-pulse rounded bg-admin-paper dark:bg-admin-depth" />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <SkeletonTable number="01" title="Top Referrers" />
        <SkeletonTable number="02" title="Popular Paths" />
      </div>
    </>
  );
}

function SkeletonTable({ number, title }: { number: string; title: string }) {
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
