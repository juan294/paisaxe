# Demo video: shot list and voice-over script

Recording copy checked against the English UI shipped in [v1.13.0](https://github.com/juan294/paisaxe/releases/tag/v1.13.0) on 2026-10-31. The live rehearsal, footage and audio timings are still to be completed.

The PayPal AI Hackathon video for Paisaxe. It must be public on YouTube and under three
minutes (official rules, as recorded in
[the webinar notes](../research/2026-10-07-paypal-webinar-submission-notes.md)). The target
is **about 2:40 to 2:45** (334 words of narration, about 2:14 at 150 words a minute, plus pauses for on-screen action). Phase 7 sets the content rules
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

1. **Audio first.** Record the English narration below, one file per scene, or use
   ElevenLabs TTS if that is the chosen voice-over method. Each file's length sets that
   scene's length.
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
| 3 | 0:30–1:02 | The traveler types the request. The "Available options" card appears: "Coastal path walk" — "Fits what you are looking for"; "Canoe descent" — "Does not fit" (step-free access "Not met"); "4x4 viewpoint tour" — "Over budget" and step-free access "Not confirmed by the provider". Zoom on each badge as it is named. | "AI + tools: catalog, availability, provider facts" |
| 4 | 1:02–1:20 | The offer card: total, "Deposit now", "Balance on the day", free cancellation, "Offer valid until". Type "I've paid"; show that the offer still requires "Accept offer". Then select that button. | "Server-set prices. Explicit payment approval." |
| 5 | 1:20–1:46 | "Deposit payment" card, "Pay with PayPal", the PayPal sandbox approval page, the return: "Payment received! Your booking is confirmed." | "PayPal Orders v2 through the official Server SDK" |
| 6 | 1:46–1:58 | The booking page with its status steps. Optional explanatory title card: return page, webhook and reconciliation job, all leading to "one capture". | "One order. Idempotent capture." |
| 7 | 1:58–2:14 | "I want to cancel", the preview "If you cancel now we refund €30.00", "Cancel and get €30.00", "Refund in progress", then "Refunded" with the PayPal refund id. | "PayPal Payments v2 refund, idempotent" |
| 8 | 2:14–2:32 | Operator dashboard "Rutas del Sella (fictional demo)": "Upcoming", "Deposits collected", "Balance due" and "Exceptions"; the booking table; "PayPal confirms" and "Refunded in PayPal" chips; the confirmed-deposit summary. | "Each deposit checked with PayPal Transaction Search" |
| 9 | 2:32–2:45 | Closing card: Paisaxe logo, "Built with PayPal Server SDK + APIMatic Context Plugin", github.com/juan294/paisaxe, "Demo merchant · sandbox money". | — |

## Voice-over script

The narration spells numbers as words and writes the product name phonetically. Captions
use the normal spelling. "Paisaxe" is Asturian, pronounced *pai-SAH-sheh*; test
"Pai-sah-sheh" in the first take or TTS generation and keep the pronunciation that sounds right.

**1. Cold open (about 12 s)**
> This booking started as a conversation. Four friends, one day in Asturias, a hundred and
> twenty euros, and one of them needs a step-free route. Here's how they got here.

**2. Context (about 18 s)**
> Pai-sah-sheh is a live guide to Asturias, in northern Spain: photo stories, a chat guide
> and a voice guide. For this hackathon, we connected discovery to booking: check the
> provider's facts, choose a date, and pay a deposit with PayPal.

**3. The request and an honest answer (about 32 s)**
> The traveler just says what they need. AI-assisted search checks the provider's
> catalog, live availability, and the facts the provider has confirmed. The coastal walk
> fits: the provider confirms it is step-free. The canoe trip doesn't, and says why. The
> four-by-four route is over budget, and its step-free access is marked as not confirmed,
> because the provider never said so. These labels reflect the provider's recorded facts.

**4. The offer (about 18 s)**
> The offer comes from the server, not the model: a hundred and twenty euros, thirty now,
> ninety on the day, and free cancellation until twenty-four hours before. Telling the
> assistant "I've paid" changes nothing. Only the traveler's button can accept.

**5. PayPal deposit (about 26 s)**
> Accepting holds the places and creates a PayPal order through the official PayPal
> Server SDK. The traveler approves in the PayPal sandbox, comes back, and the deposit is
> captured. The booking link needs no account, and shows PayPal's own order and capture
> ids.

**6. Recovery after approval (about 12 s)**
> If the browser closes after approval, PayPal's webhook or the reconciliation job can
> complete the capture. Both paths use the same PayPal order and idempotency key.

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

Use the released site at https://paisaxe.es. Before the take:

- Select **English** in the site language selector. Check the chat, booking page and
  operator dashboard in the recording browser; select English on the PayPal sandbox
  approval page too if it retained a previous language preference.
- Use the existing owner voucher and operator link for the fixture merchant; verify their
  remaining allowance and expiry, and confirm a slot with at least four free places.
- Rehearse the English request and quote prompts below. Check the three suitability
  outcomes and the €120 total, €30 deposit, €90 balance and 24-hour cancellation terms
  against the actual cards. If a card differs, resolve that before recording its narration.
- Confirm the fixture bookings needed for the take are authorized. Juan approves each
  PayPal sandbox payment himself. This recording uses fictitious experiences and sandbox
  money throughout.

The release checks and English UI checks passed on v1.13.0. A fresh live English
payment/refund rehearsal and actual voice audio were not part of those read-only
production checks. If the take includes a live voice-guide segment, rehearse that in
English first; the nine-scene core story below uses text booking and an English voice-over.

### Data for the take

- **Booking B (the panel's "PayPal confirms").** Book and pay at least **three hours**
  before recording scene 8, and leave it confirmed. PayPal lists movements up to three
  hours late (about two hours in our earlier sandbox run), so a fresh booking can still
  show "Pending in PayPal". Use a different available date or slot from Booking A so it
  does not consume the places needed for the main take.
- **Booking A (scenes 1, 3 to 7).** The live take. Book it at least two days ahead, so
  the refund is the full €30.00. Record scene 1 right after scene 5, before cancelling.
- Record scene 8 at least three hours after booking A is refunded, so its chip reads
  "Refunded in PayPal". Check the actual status before filming; if it is still "Pending
  in PayPal", wait rather than presenting it as verified.

**Capture order:** prepare and pay B; record scenes 2–5 with A; record the confirmed A
close-up for scene 1; record scene 6 and A's cancellation/refund for scene 7; record
scene 8 after PayPal reporting catches up; add the closing card. Assemble those clips
in the numbered shot-list order. This keeps the confirmed opening and refunded ending
consistent with the same booking.

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

> What experiences are available for four people on 2026-11-04 up to 120 euros with
> step-free access?

This is a concrete example for recording preparation on October 31. Confirm that date
has a 10:00 slot before using it. If it is unavailable, or recording moves later, replace
the date in both prompts with the same available date at least 48 hours ahead. Then
follow up in English:

> Please quote the Coastal path walk at 10:00 on 2026-11-04 for four people.

English UI and English visitor requests are required for the recording. The initial
request deliberately leaves the time to the follow-up so the bounded discovery intake
can run; the ordinary booking agent handles the quote. The matching panel is "Find my kind of
experience" in English. All payment and refund actions still require the existing buttons.

Pick a date at least two days ahead. The fixture catalog gives the intended answer: the
coastal walk fits (€120, step-free access confirmed), the canoe does not fit (no
step-free access), and the 4x4 route is over budget with step-free access unconfirmed.

## Audio and captions

- One narration file per scene, named `vo-01-cold-open.mp3` and so on. If using TTS,
  record the chosen voice, model and settings alongside the audio files.
- Write `paisaxe-demo.en.srt` from the final scene timings and the caption spellings, and
  upload it to YouTube with the video.
- Optional: quiet background music under the narration, ending at scene 9.

## YouTube

- Title: "Paisaxe: book a local experience through conversation, with PayPal (PayPal AI
  Hackathon)"
- Visibility: public. Add the link to the Devpost project's video field.
- Description: the pitch sentence, the repository link and "Demo merchant and PayPal
  sandbox money; no real payments."
