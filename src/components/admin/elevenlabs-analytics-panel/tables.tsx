import type { ElevenLabsConversation } from "@/types/elevenlabs-analytics";
import { formatStatus, formatTime } from "./formatters";

interface BreakdownTableProps<T> {
  number: string;
  title: string;
  items: T[];
  renderItem: (item: T) => string;
  getCount: (item: T) => number;
  getSecondary?: (item: T) => string;
}

export function BreakdownTable<T>({
  number,
  title,
  items,
  renderItem,
  getCount,
  getSecondary,
}: BreakdownTableProps<T>) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-admin-subtle">No data available</p>
      </section>
    );
  }

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
            {getSecondary && (
              <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
                Time
              </th>
            )}
            <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-admin-subtle">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-paper dark:divide-admin-depth">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-2 font-mono text-sm tabular-nums text-admin-subtle">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm capitalize text-admin-secondary dark:text-admin-subtle">
                {renderItem(item)}
              </td>
              {getSecondary && (
                <td className="py-2 text-right font-mono text-xs tabular-nums text-violet-500 dark:text-violet-400">
                  {getSecondary(item)}
                </td>
              )}
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400">
                {getCount(item).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface RecentConversationsTableProps {
  number: string;
  conversations: ElevenLabsConversation[];
}

export function RecentConversationsTable({ number, conversations }: RecentConversationsTableProps) {
  if (conversations.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-admin-subtle">
          {number} — Recent Conversations
        </h3>
        <p className="py-6 text-center font-mono text-xs text-admin-subtle">No conversations yet</p>
      </section>
    );
  }

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
          {conversations.map((conv) => (
            <tr key={conv.conversation_id}>
              <td className="py-2 font-mono text-xs tabular-nums text-admin-muted">
                {formatTime(conv.start_time_unix)}
              </td>
              <td className="py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                    conv.status === "done"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : conv.status === "failed"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      : "bg-admin-paper text-admin-muted dark:bg-admin-depth dark:text-admin-subtle"
                  }`}
                >
                  {formatStatus(conv.status)}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {conv.call_duration_secs ? `${conv.call_duration_secs}s` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

