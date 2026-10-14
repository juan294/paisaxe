import { PaymentReceipt } from "paisaxe";

/** On the booking ticket (smoked frosted panel), after the deposit is captured. */
export const Captured = () => (
  <div className="p-6">
    <div className="rounded-2xl border border-white/20 bg-neutral-950/60 p-5 text-white backdrop-blur-xl" style={{ width: 400 }}>
      <PaymentReceipt payment={{ status: "captured", orderId: "5O190127TN364715T", captureId: "3C679366HH908993F", refundId: null }} />
    </div>
  </div>
);

/** After a cancellation: the refund id joins the order and capture ids. */
export const Refunded = () => (
  <div className="p-6">
    <div className="rounded-2xl border border-white/20 bg-neutral-950/60 p-5 text-white backdrop-blur-xl" style={{ width: 400 }}>
      <PaymentReceipt
        payment={{ status: "refunded", orderId: "5O190127TN364715T", captureId: "3C679366HH908993F", refundId: "1JU08902781691411" }}
      />
    </div>
  </div>
);
