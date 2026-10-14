import { BalanceInvoiceStatusView } from "paisaxe";

const panel = "rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white";

export const Statuses = () => (
  <div className="p-6">
    <div className="space-y-3" style={{ width: 340 }}>
      <div className={panel}>
        <BalanceInvoiceStatusView status="sent" url="#" />
      </div>
      <div className={panel}>
        <BalanceInvoiceStatusView status="partially_paid" url="#" />
      </div>
      <div className={panel}>
        <BalanceInvoiceStatusView status="paid" url="#" />
      </div>
      <div className={panel}>
        <BalanceInvoiceStatusView status="cancelled" url={null} />
      </div>
    </div>
  </div>
);
