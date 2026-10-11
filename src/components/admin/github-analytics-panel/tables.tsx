import { Globe, FileText } from "lucide-react";
import type { GitHubTrafficReferrer, GitHubTrafficPath } from "@/types/github-analytics";

export function ReferrersTable({ number, referrers }: { number: string; referrers: GitHubTrafficReferrer[] }) {
  if (referrers.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          {number} — Top Referrers
        </h3>
        <p className="py-6 text-center font-mono text-xs text-admin-subtle">No referrer data</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
        {number} — Top Referrers
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-line text-left dark:border-admin-depth">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">
              <Globe className="inline h-3 w-3 mr-1" />
              Referrer
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Unique
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Views
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {referrers.map((ref, idx) => (
            <tr key={ref.referrer}>
              <td className="py-2 font-mono text-sm tabular-nums text-admin-subtle">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-admin-secondary dark:text-admin-subtle">
                {ref.referrer}
              </td>
              <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                {ref.uniques.toLocaleString()}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {ref.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PathsTable({ number, paths }: { number: string; paths: GitHubTrafficPath[] }) {
  if (paths.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          {number} — Popular Paths
        </h3>
        <p className="py-6 text-center font-mono text-xs text-admin-subtle">No path data</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
        {number} — Popular Paths
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-line text-left dark:border-admin-depth">
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">#</th>
            <th className="pb-2 font-mono text-xs uppercase tracking-widest text-admin-subtle">
              <FileText className="inline h-3 w-3 mr-1" />
              Path
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Unique
            </th>
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Views
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {paths.map((p, idx) => (
            <tr key={p.path}>
              <td className="py-2 font-mono text-sm tabular-nums text-admin-subtle">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-admin-secondary dark:text-admin-subtle">
                <span className="font-mono text-xs">{p.path}</span>
                {p.title && (
                  <span className="ml-2 text-xs text-admin-subtle">({p.title})</span>
                )}
              </td>
              <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                {p.uniques.toLocaleString()}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {p.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

