# Demo video: shot list and voice-over script

The PayPal AI Hackathon video for Paisaxe. It must be public on YouTube and under three
minutes (official rules, as recorded in
[the webinar notes](../research/2026-10-07-paypal-webinar-submission-notes.md)). The target
is **about 2:40 to 2:45** (342 words of narration, about 2:17, plus pauses for on-screen action). Phase 7 sets the content rules
([phase-7.md](../plans/2026-10-03-paypal-hackathon-booking-phases/phase-7.md), step 5). The
video opens on the transaction. It shows one unsuitable option rejected with its reason
and one need the provider has not confirmed. Fixtures and sandbox money stay labelled, and
the video has English captions.

The five judging criteria carry equal weight: technical implementation, design, impact,
innovation and presentation. A separate prize goes to the best demo. The video therefore
tells one complete story: a traveler's needs, an honest answer, a PayPal deposit, a safe
refund, and the provider's view checked against PayPal. Each scene shows something only
this project does. The engineering is stated once and proved by the footage.

## How it is made

1. **Audio first.** Generate one ElevenLabs TTS file per scene from the narration below. Each
   file's length sets that scene's length.
2. **Record each scene to its audio.** The agent drives Chrome and records the screen one
   scene at a time (see "Recording plan"). Juan approves the PayPal sandbox payment himself.
3. **Adjust the narration to the take.** The assistant's wording varies between runs. After
   recording, check scenes 3 and 4 against the footage and regenerate any line that no
   longer matches what is on screen.
4. **Assemble in iMovie.** Lay the clips in order with their audio, export 1080p, then
   upload to YouTube as public with the captions file.

## Shot list

Times assume about 150 words a minute of narration plus short pauses for on-screen action.

| # | Time | Screen | On-screen text (lower third) |
| --- | --- | --- | --- |
| 1 | 0:00–0:12 | Booking page, "Booking confirmed": total €120, "Deposit paid €30", PayPal order and capture ids. Slow scroll down to the PayPal receipt. | "A real PayPal sandbox deposit" |
| 2 | 0:12–0:30 | Paisaxe home: an Asturias photo story (coast). Cut to the booking chat opening ("Opening the booking assistant…"). | "Paisaxe: a live guide to Asturias, Spain" |
| 3 | 0:30–1:02 | The traveler types the request. The "Available options" card appears: coastal walk "Fits what you are looking for"; canoe "Does not fit" (step-free access "Not met"); 4x4 route "Over budget" and step-free access "Not confirmed by the provider". Zoom on each badge as it is named. | "Claude + tools: catalog, availability, provider facts" |
| 4 | 1:02–1:20 | The offer card: total, "Deposit now", "Balance on the day", free cancellation, "Offer valid until". The traveler types "I've paid" and nothing changes. Then the "Accept offer" button. | "Prices come from the server. Only buttons move money." |
| 5 | 1:20–1:46 | "Deposit payment" card, "Pay with PayPal", the PayPal sandbox approval page, the return: "Payment received! Your booking is confirmed." | "PayPal Orders v2 through the official Server SDK" |
| 6 | 1:46–1:58 | The booking page with its status steps. Optional title card: return page, webhook and reconciliation job, all leading to "one capture". | "Webhook + reconciliation: no payment left stuck" |
| 7 | 1:58–2:14 | "I want to cancel", the preview "If you cancel now we refund €30.00", "Cancel and get €30.00", "Refund in progress", then "Refunded" with the PayPal refund id. | "PayPal Payments v2 refund, idempotent" |
| 8 | 2:14–2:32 | Operator panel "Rutas del Sella (demo, ficticio)": the four totals, the booking table, the "PayPal confirma" and "Reembolso en PayPal" chips, the line "PayPal confirma N de N depósitos". | "Each deposit checked with PayPal Transaction Search" |
| 9 | 2:32–2:45 | Closing card: Paisaxe logo, "Built with PayPal Server SDK + APIMatic Context Plugin", github.com/juan294/paisaxe, "Demo merchant · sandbox money". | — |

## Voice-over script

The TTS text spells numbers as words and writes the product name phonetically. Captions
use the normal spelling. "Paisaxe" is Asturian, pronounced *pai-SAH-sheh*; test
"Pai-sah-sheh" in the first generation and keep the spelling that sounds right.

**1. Cold open (about 12 s)**
> This booking started as a conversation. Four friends, one day in Asturias, a hundred and
> twenty euros, and one of them needs a step-free route. Here's how they got here.

**2. Context (about 18 s)**
> Pai-sah-sheh is a live guide to Asturias, in northern Spain: photo stories, a chat guide
> and a voice guide. Visitors kept asking: can we actually go? Small local providers rarely
> have a booking system. So for this hackathon, we built one into the conversation.

**3. The request and an honest answer (about 32 s)**
> The traveler just says what they need. Claude, using tools, checks the provider's
> catalog, live availability, and the facts the provider has confirmed. The coastal walk
> fits: the provider confirms it is step-free. The canoe trip doesn't, and says why. The
> four-by-four route is over budget, and its step-free access is marked as not confirmed,
> because the provider never said so. The assistant never invents a fact, or a price.

**4. The offer (about 18 s)**
> The offer comes from the server, not the model: a hundred and twenty euros, thirty now,
> ninety on the day, and free cancellation until twenty-four hours before. Telling the
> assistant "I've paid" changes nothing. Only the traveler's button can accept.

**5. PayPal deposit (about 26 s)**
> Accepting holds the places and creates a PayPal order through the official PayPal
> Server SDK. The traveler approves in the PayPal sandbox, comes back, and the deposit is
> captured. The booking link needs no account, and shows PayPal's own order and capture
> ids.

**6. Never stuck (about 12 s)**
> And if they close the browser right after approving? PayPal's webhook, or a
> reconciliation job every five minutes, completes the same capture. No payment is left
> stuck.

**7. Cancellation and refund (about 16 s)**
> Plans change. The preview shows exactly what comes back: thirty euros. Confirming
> refunds it through PayPal, and confirming twice never refunds twice.

**8. The provider's view (about 18 s)**
> The provider gets a panel of their own: upcoming bookings, deposits, the balance due,
> and every deposit checked against PayPal's own records with Transaction Search. Here,
> PayPal confirms the payment, and the refund.

**9. Close (about 13 s)**
> Built during the hackathon on our live site, with the APIMatic Context Plugin and the
> official PayPal SDK. A demo merchant, sandbox money, and open source code. Pai-sah-sheh:
> look, ask, and now, book.

## Recording plan

### Before recording day

These steps belong to Phase 7, and each needs Juan's authorization in the session that
runs it:

- Release the current `develop` to production. The Transaction Search panel and the
  official SDK are not live yet.
- Turn on the `experience_booking` flag in production.
- Create the owner voucher and the operator link for the fixture merchant.

The plan of record says to record on production. If the release slips, the fallback is
the local production build with the real PayPal sandbox, the same setup as the
2026-10-08 acceptance.

### Data for the take

- **Booking B (the panel's "PayPal confirma").** Book and pay at least **three hours**
  before recording scene 8, and leave it confirmed. PayPal lists movements up to three
  hours late (about two hours in our sandbox), so a fresh booking still shows "Pendiente
  en PayPal".
- **Booking A (scenes 1, 3 to 7).** The live take. Book it at least two days ahead, so
  the refund is the full €30.00. Record scene 1 right after scene 5, before cancelling.
- Record scene 8 at least three hours after booking A is refunded, so its chip reads
  "Reembolso en PayPal".

### Browser and capture

- A clean Chrome profile: English UI, no extensions, no bookmarks bar, light theme. The
  window is 1920×1080 at a page zoom of about 125%, so text stays readable on YouTube.
- **Hide the address bar.** Booking and operator URLs carry capability tokens; anyone who
  saw one could open the booking or the merchant panel. Record in a Chrome app window
  (`--app=<url>`) or crop the bar in iMovie. Never show the voucher code: start scene 2
  inside the chat, not on `/acceso`.
- Capture with macOS `screencapture -v` on the window's region, one file per scene, while
  the agent drives Chrome. Check first that the terminal has the Screen Recording
  permission. A dry run of scene 3 confirms legibility and pacing before the real take.
- Type the request at a human pace, not instantly. In iMovie, speed it up if needed.
- **PayPal approval (scene 5):** Juan logs in as the sandbox buyer and approves. The agent
  does not type the sandbox password. Logging in before the take keeps the shot short.

### The request to type (scene 3)

> We are four friends, we'd like to do something on Saturday at 10:00, our budget is 120
> euros, and one of us needs a step-free route.

Pick a date at least two days ahead. The fixture catalog gives the intended answer: the
coastal walk fits (€120, step-free access confirmed), the canoe does not fit (no
step-free access), and the 4x4 route is over budget with step-free access unconfirmed.

## Audio and captions

- One TTS file per scene, named `vo-01-cold-open.mp3` and so on. Choose the voice, model
  and settings at generation time and record them here.
- Write `paisaxe-demo.en.srt` from the final scene timings and the caption spellings, and
  upload it to YouTube with the video.
- Optional: quiet background music under the narration, ending at scene 9.

## YouTube

- Title: "Paisaxe: book a local experience through conversation, with PayPal (PayPal AI
  Hackathon)"
- Visibility: public. Add the link to the Devpost project's video field.
- Description: the pitch sentence, the repository link and "Demo merchant and PayPal
  sandbox money; no real payments."
