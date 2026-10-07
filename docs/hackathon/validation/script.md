# Tester script (unit 5b)

Five people try the booking journey alone, about ten minutes each (plan, Phase 5, unit 5b).
The owner runs the sessions; the agent summarizes them into `results.md` in this folder.

**Nothing here uses real money, real bookings or anyone's own account.** Testers book with
the fictitious demo merchant and pay with the PayPal **sandbox** buyer account.

## Before each session (owner)

- The demo runs on the owner's laptop (local Docker plus the real PayPal sandbox), or on
  the Phase 4b build over the tunnel. Check that a test booking reaches "Reserva
  confirmada" before the first tester arrives.
- A fresh voucher code for each tester (`scripts/booking/create-voucher.ts`, local target),
  opened at `/acceso` in a private window so earlier sessions do not carry over.
- The sandbox buyer card below, printed or on a second screen. The password is in
  1Password ("PayPal (Test Buyer)"); it is never written into this repository.
- A timer, and the observation sheet (`observation-sheet.md`), one row per tester.
- Ask: "¿Te importa que apunte lo que digas en voz alta? Si alguna frase me sirve para
  explicar el proyecto, te preguntaré antes de citarla."

## What the observer says (read it as written)

> Esto es una demo: nada es real, no vas a pagar nada de verdad y puedes equivocarte sin
> problema. Quiero ver cómo funciona para alguien que no lo conoce, así que no te voy a
> ayudar mientras lo haces. Si te atascas, dímelo y lo dejamos ahí; eso también me sirve.
> Piensa en voz alta si te sale natural.
>
> Tu tarea: **reserva una actividad para cuatro personas el sábado con un presupuesto de
> 120 € y una persona que necesita un recorrido sin escalones.**
>
> Cuando PayPal te pida entrar, usa la cuenta de prueba de esta tarjeta.

Then stay silent. **No hints**, no pointing at the screen, no "casi". If the tester asks a
question, answer only: "¿Qué harías si yo no estuviera aquí?" Note the question.

### Sandbox buyer card (hand it over)

> **Cuenta de prueba de PayPal (sandbox, sin dinero real)**
> Correo: la cuenta "PayPal (Test Buyer)" de 1Password
> Contraseña: la que te indique quien dirige la prueba

## Stop when

- the booking page shows "Reserva confirmada" (stop the timer: time to a confirmed
  booking), or
- the tester gives up or asks for help twice, or
- fifteen minutes pass.

## Afterwards: three questions (read as written, no help)

1. «¿Cuánto has pagado ahora?»
2. «¿Cuánto te queda por pagar, y cuándo?»
3. «¿Qué pasaría si mañana cancelaras?»

Write the answers in the tester's words. Then the correct answers, for scoring only (do not
tell the tester before they answer), for whatever activity they booked: the deposit on its
quote card (the coastal walk, the demo option that fits the task, is 120 € in total with a
30 € deposit; the canoe trip's deposit is 15 € and the 4x4 route's 50 €); the rest of the
total, paid on the day of the activity; a full refund of the deposit if cancelled more than
24 hours before the activity starts (the demo merchant's cancellation window), nothing after.

## After all sessions

- Fix the single largest friction before the Nov 3 freeze (plan step 4); anything not fixed
  becomes a known limitation in `results.md`.
- The agent writes `results.md`: counts, the friction, verbatim quotes the testers agreed to
  share, the provider tier reached, and the limits (five people, at most one provider, no
  comparator). No improvement percentage, no claim of broad demand.
