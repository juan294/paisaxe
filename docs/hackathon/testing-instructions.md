# Testing instructions (Devpost private testing field)

Paste everything below the line into the Devpost "Testing instructions" field. Before
submitting, replace the four placeholders in «guillemets»: «VOUCHER_CODE»,
«SANDBOX_BUYER_EMAIL», «SANDBOX_BUYER_PASSWORD» and «OPERATOR_LINK». The values are kept
out of the repository on purpose.

---

PAISAXE: BOOK A LOCAL EXPERIENCE THROUGH CONVERSATION, WITH A PAYPAL SANDBOX DEPOSIT

Everything you book is fictitious and every payment is PayPal SANDBOX money. The merchant
"Rutas del Sella (demo, ficticio)" and its three experiences are demo fixtures; no real
provider is involved and nothing is charged. Booking cards show a "Demo" badge, and the
payment card says "PayPal sandbox: test payment, no real money".

Credentials:
- Voucher code: «VOUCHER_CODE»
- PayPal sandbox buyer: «SANDBOX_BUYER_EMAIL» / «SANDBOX_BUYER_PASSWORD»
- Operator (merchant) view: «OPERATOR_LINK»

The site follows your browser language (a language switcher is available), and the
assistant answers in the language you write in. The experience names and the operator view
are in Spanish.

1. GET IN
- Open https://paisaxe.es/acceso ("Booking access"), paste the voucher code and press
  "Enter". No account is needed: the site creates a guest session in this browser.
- You land in the text booking chat ("Welcome! Opening the booking assistant…").
- The same code works again later, and in another browser. It is valid until the end of
  the judging period.
- Each redemption includes 60 chat messages and 10 offer acceptances. If you run out, you
  see "You have used everything this code includes."

2. ASK FOR SOMETHING AND GET AN OFFER
Write a request in your own words. For example:
"We are four people, we'd like to do something the day after tomorrow at 10:00, our budget
is 120 euros, and one of us needs a step-free route."
- The assistant asks only what it is missing. Its tools check the catalog, availability
  and the provider's stated facts. You see an "Available options" card with each option
  marked "Fits what you are looking for", "May fit; some details are unconfirmed" or "Does
  not fit", with the reason (for example "Over budget", or "Not confirmed by the provider"
  for a fact the provider has not confirmed).
- The offer card shows the date, the number of people, the total, "Deposit now", "Balance
  on the day", the free-cancellation window (up to 24 h before the start) and "Offer valid
  until HH:MM" (20 minutes).
- Prices come only from the server. Telling the assistant a different price, or saying
  "I've paid" or "cancel it", does not change anything: only the buttons do.
- Tip: book at least two days ahead. Inside the 24-hour window a cancellation is
  correctly refunded €0, so you would not see the refund step.

3. ACCEPT AND PAY THE DEPOSIT (PAYPAL SANDBOX)
- Press "Accept offer". A booking card appears ("Booking <reference>", with "View
  booking"), and the place is held for 15 minutes. Without any further message from you,
  the assistant follows with a "Deposit payment" card: "Pay with PayPal", "Pay before
  HH:MM; after that the place is released". If that card does not appear, open "View
  booking" and use the "Pay with PayPal" button on the booking page instead.
- Press "Pay with PayPal". Log in on the PayPal sandbox page with the sandbox buyer above
  (never a real PayPal account) and approve the payment.
- PayPal sends you back to the site, which captures the payment: "Payment received! Your
  booking is confirmed." Press "View booking".
- If you close the browser after approving, the booking is still confirmed, by the PayPal
  webhook or by the reconciliation job (every 5 minutes). Open the booking link to see it.

4. THE BOOKING PAGE
- The booking link (/booking/<id>.<token>) needs no login and no voucher. It works in any
  browser for as long as the booking exists, so keep it. It shows "Your booking", the
  reference and status, the date, the people, the total, the deposit, the balance, and once
  confirmed "Booking confirmed" with the PayPal order and capture ids.
- If you lose the link, ask the assistant in the same browser about your booking: it shows
  the booking card again.

5. CANCEL AND GET THE REFUND
- On the booking page press "I want to cancel". Or ask the assistant to cancel: it shows a
  "Cancellation" card. This step only previews the cancellation, for example "If you cancel
  now we refund €30.00". Nothing changes until you press the button.
- Press "Cancel and get €…". The refund goes to the sandbox buyer through PayPal. The page
  shows "Refund in progress" with the PayPal refund id, then "Refunded" (usually within
  seconds; reconciliation also checks every 5 minutes).
- If the terms change between the preview and your click (for example, the 24-hour cutoff
  passes), the site shows the new amount and asks you to confirm again. Pressing confirm a
  second time never refunds twice.

6. OPERATOR (MERCHANT) VIEW
- Open the operator link. "Panel de operador" for "Rutas del Sella (demo, ficticio)",
  marked "demo", shows:
  - upcoming bookings ("Próximas"), "Depósitos cobrados" (deposits collected), "Pendiente
    de cobro" (balance due) and "Incidencias" (exceptions, which also filters the list);
  - the booking tables with status and payment;
  - active holds, with "Liberar" to release one;
  - free places for the next 14 days.
- Your booking appears there with its deposit and status, and changes when you cancel.
- "Reemitir enlace" issues a new link for a booking and stops the old one from working, so
  use it only on a booking whose link you no longer need.
- The view shows only the fixture merchant's data, and nothing under /admin.

7. VOICE
If your voucher includes voice access (a 24-hour pass, renewed by entering the code
again), the chat header offers "Voice (discovery)". That is the existing Paisaxe voice
guide for exploring Asturias. It does not book: bookings, payments and cancellations happen
only in the text chat and on the booking page.

8. POSTMAN COLLECTION
The same journey over HTTP (session, voucher, quote acceptance, booking status, PayPal
deposit, cancellation, webhook), including the 404, 409 and 401 cases, is in the repository
at docs/hackathon/postman/: paisaxe-booking.postman_collection.json, an empty environment
template, and a README. The README covers the anonymous session, the CSRF headers, the
interactive PayPal sandbox approval step, and a fully local run with Newman against a PayPal
mock. Please run it against a local copy, not the live site, which is a shared demo.

The repository README (section "Hackathon") explains the design and how to run it locally,
lists the changes made during the hackathon, and states the known limitations.
