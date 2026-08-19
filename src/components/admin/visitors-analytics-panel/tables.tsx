import type { DataTableProps, UTMTableProps } from "./types";

export function DataTable<T>({ number, title, items, renderItem, getCount }: DataTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          {number} — {title}
        </h2>
        <p className="py-8 text-center font-mono text-xs text-[#a39e98]">No data available</p>
      </section>
    );
  }

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
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-3 text-sm capitalize text-[#4d4944] dark:text-[#a39e98]">
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
      <p className="py-8 text-center font-mono text-xs text-[#a39e98]">No UTM data available</p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            #
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Source
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Medium
          </th>
          <th className="pb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Campaign
          </th>
          <th className="pb-3 text-right font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Count
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
        {items.map((item, idx) => (
          <tr key={idx}>
            <td className="py-3 font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
              {String(idx + 1).padStart(2, "0")}
            </td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.source}</td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.medium}</td>
            <td className="py-3 text-sm text-[#4d4944] dark:text-[#a39e98]">{item.campaign}</td>
            <td className="py-3 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
              {item.count.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
