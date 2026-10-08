import { CancellationConfirm } from "paisaxe";

const panel = "rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white";

export const WithRefund = () => (
  <div className="p-6">
    <div className={panel} style={{ width: 380 }}>
      <CancellationConfirm
        capability="d1f35462-6a22-4381-8c74-9954d30881d7.preview"
        terms={{
          refundCents: 3000,
          depositCents: 3000,
          currency: "EUR",
          cancellationWindowHours: 24,
          slotStart: "2026-10-09T08:00:00.000Z",
          termsValidUntil: "2026-10-08T08:00:00.000Z",
        }}
      />
    </div>
  </div>
);

export const NoRefund = () => (
  <div className="p-6">
    <div className={panel} style={{ width: 380 }}>
      <CancellationConfirm
        capability="d1f35462-6a22-4381-8c74-9954d30881d7.preview"
        terms={{
          refundCents: 0,
          depositCents: 3000,
          currency: "EUR",
          cancellationWindowHours: 24,
          slotStart: "2026-10-09T08:00:00.000Z",
          termsValidUntil: null,
        }}
      />
    </div>
  </div>
);
