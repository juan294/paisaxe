import type {
  ProductBreakdownTableProps,
  RecentOrdersTableProps,
  StripeOrder,
} from "./types";

export function ProductBreakdownTable({ number, title, items }: ProductBreakdownTableProps) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No product data available</p>
      </section>
    );
  }

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
          {items.map((item, idx) => (
            <tr key={item.productId}>
              <td className="py-2 font-mono text-sm tabular-nums text-[#a39e98]">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                {item.productName}
              </td>
              <td className="py-2 text-right font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
                {item.orderCount}
              </td>
              <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {item.revenueFormatted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function RecentOrdersTable({ number, title, orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <section>
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
          {number} — {title}
        </h3>
        <p className="py-6 text-center font-mono text-xs text-[#a39e98]">No orders yet</p>
      </section>
    );
  }

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
          {orders.slice(0, 10).map((order) => (
            <tr key={order.id}>
              <td className="py-2 font-mono text-xs tabular-nums text-[#6b6560]">
                {formatOrderDate(order.createdAt)}
              </td>
              <td className="max-w-[150px] truncate py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
                {order.productName}
              </td>
              <td className="py-2">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="py-2 text-right font-mono text-sm tabular-nums">
                {order.refundedAmount > 0 ? (
                  <div>
                    <span className="text-[#a39e98] line-through">{order.totalFormatted}</span>
                    <span className="ml-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                      -{order.refundedAmountFormatted}
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {order.totalFormatted}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatOrderDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderStatusBadge({ status }: { status: StripeOrder["status"] }) {
  const styles: Record<
    StripeOrder["status"],
    { bg: string; text: string; label: string }
  > = {
    succeeded: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Paid",
    },
    pending: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      label: "Pending",
    },
    failed: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
      label: "Failed",
    },
    refunded: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
      label: "Refunded",
    },
    partially_refunded: {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
      label: "Partial",
    },
  };

  const style = styles[status] || styles.pending;

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
