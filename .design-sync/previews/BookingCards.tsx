import { BookingCards } from "paisaxe";

const noop = () => {};
const inTwoDays = "2026-10-09";

export const Offer = () => (
  <div className="w-[420px] p-4 text-white">
    <BookingCards
      quoteStates={{}}
      onAccept={noop}
      onRequote={noop}
      cards={[
        {
          kind: "offer",
          options: [
            {
              experienceId: "11111111-1111-4111-8111-111111111111",
              title: "Paseo por la senda costera",
              priceCents: 12000,
              depositCents: 3000,
              currency: "EUR",
              maxParty: 8,
              suitability: "suitable",
              reasons: [],
              verdicts: [{ key: "step_free", verdict: "supported", detail: "Sendero de tierra compactada sin escalones", confirmedByProvider: true }],
              slots: [{ date: inTwoDays, startTime: "10:00", available: 6 }],
            },
            {
              experienceId: "22222222-2222-4222-8222-222222222222",
              title: "Descenso en canoa",
              priceCents: 6000,
              depositCents: 1500,
              currency: "EUR",
              maxParty: 6,
              suitability: "rejected",
              reasons: ["constraint_unsupported"],
              verdicts: [{ key: "step_free", verdict: "unsupported", detail: "El embarcadero tiene escalones", confirmedByProvider: true }],
              slots: [{ date: inTwoDays, startTime: "10:00", available: 4 }],
            },
            {
              experienceId: "33333333-3333-4333-8333-333333333333",
              title: "Ruta de miradores en 4x4",
              priceCents: 20000,
              depositCents: 5000,
              currency: "EUR",
              maxParty: 5,
              suitability: "unconfirmed",
              reasons: [],
              verdicts: [{ key: "step_free", verdict: "unknown", detail: null, confirmedByProvider: false }],
              slots: [{ date: inTwoDays, startTime: "10:00", available: 5 }],
            },
          ],
        },
      ]}
    />
  </div>
);

export const Quote = () => (
  <div className="w-[420px] p-4 text-white">
    <BookingCards
      quoteStates={{}}
      onAccept={noop}
      onRequote={noop}
      cards={[
        {
          kind: "quote",
          quoteId: "99999999-2222-4333-8444-555555555555",
          version: 1,
          experienceTitle: "Paseo por la senda costera",
          slotDate: inTwoDays,
          slotTime: "10:00",
          partySize: 4,
          totalCents: 12000,
          depositCents: 3000,
          balanceCents: 9000,
          currency: "EUR",
          cancellationWindowHours: 24,
          expiresAt: "2026-10-07T09:46:00.000Z",
          accepted: false,
        },
      ]}
    />
  </div>
);

export const BookingAndPayment = () => (
  <div className="w-[420px] p-4 text-white">
    <BookingCards
      quoteStates={{}}
      onAccept={noop}
      onRequote={noop}
      cards={[
        { kind: "booking", bookingId: "d1f35462-6a22-4381-8c74-9954d30881d7", reference: "RS-8295A6", status: "pending_payment", link: "#" },
        {
          kind: "payment",
          bookingId: "d1f35462-6a22-4381-8c74-9954d30881d7",
          approvalUrl: "#",
          amountCents: 3000,
          currency: "EUR",
          expiresAt: "2026-10-07T09:26:54.000Z",
        },
      ]}
    />
  </div>
);

export const BalanceInvoice = () => (
  <div className="w-[420px] p-4 text-white">
    <BookingCards
      quoteStates={{}}
      onAccept={noop}
      onRequote={noop}
      cards={[
        {
          kind: "invoice",
          bookingId: "d1f35462-6a22-4381-8c74-9954d30881d7",
          reference: "RS-8295A6",
          amountCents: 9000,
          currency: "EUR",
          dueDate: "2026-10-08",
          status: "sent",
          invoiceUrl: "#",
        },
      ]}
    />
  </div>
);
