import type { DataTableProps, UTMTableProps } from "./types";

export function DataTable<T>({ number, title, items, renderItem, getCount }: DataTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
          {number} — {title}
        </h2>
        <p className="py-8 text-center font-mono text-xs text-admin-subtle">No data available</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
        {number} — {title}
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b border-admin-line text-left dark:border-admin-depth">
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              #
            </th>
            <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Name
            </th>
            <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-admin-muted dark:text-admin-subtle">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-3 text-sm capitalize text-admin-secondary dark:text-admin-subtle">
                {renderItem(item)}
              </td>
              <td className="py-3 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {getCount(item).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function UTMTable({ items }: UTMTableProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-admin-subtle">No UTM data available</p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-admin-line text-left dark:border-admin-depth">
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            #
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Source
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Medium
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Campaign
          </th>
          <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Count
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
        {items.map((item, idx) => (
          <tr key={idx}>
            <td className="py-3 font-mono text-sm tabular-nums text-admin-muted dark:text-admin-subtle">
              {String(idx + 1).padStart(2, "0")}
            </td>
            <td className="py-3 text-sm text-admin-secondary dark:text-admin-subtle">{item.source}</td>
            <td className="py-3 text-sm text-admin-secondary dark:text-admin-subtle">{item.medium}</td>
            <td className="py-3 text-sm text-admin-secondary dark:text-admin-subtle">{item.campaign}</td>
            <td className="py-3 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
              {item.count.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
