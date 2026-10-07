# Provider desk survey (public websites)

Date checked: 2026-10-03, for all ten providers.

Method: providers were found with web search. Each provider's own pages were then fetched
without a browser (HTTP fetch, HTML converted to text) and searched for booking, payment,
availability, accessibility and cancellation wording. Booking widgets that load only by
JavaScript were identified from their embed code (script host or plugin path). Their
content, such as calendars and payment steps, was not executed or viewed. No form was
submitted, no booking or payment button was used and no provider was contacted.

Labels used below:

- **Observed**: the wording or element is on the cited page.
- **Not shown**: nothing about it was found on the pages checked.
- **Unclear**: the page has an element (for example a date picker inside a JavaScript
  widget) but a browser-free fetch cannot show whether it reflects live availability.

## Providers at a glance (items 1-7)

| # | Provider, type, town, website | 2. Booking methods offered | 3. Online payment | 4. Real-time availability | 5. Accessibility info | 6. Cancellation policy | 7. Site languages |
|---|---|---|---|---|---|---|---|
| 1 | Jaire Aventura (Jaire Canoas): canoe on the Sella and multi-adventure; Arriondas area (El Merediz, Coviella); https://jairecanoas.com/ | Observed: phone, WhatsApp, email, contact pop-up form, and an online booking engine that is the site's own WordPress plugin (`jaire-motor-reservas`, labelled "motor de reservas") | Observed: deposit, "paga ahora el 50%". Payment method not shown | Unclear: the engine has a "Calendario" step that loads closure dates. Free-slot display not observable | None found | Observed: full refund if cancelled more than 48 h before, minus a €2/person fee; no refund under 24 h | Spanish, English, German, French |
| 2 | Asturguías: guided hiking in the Picos de Europa; Cangas de Onís; https://asturguias.com/ | Observed: phone, WhatsApp, email, contact form, and an on-page booking box (date, passengers, "Reservar Ahora") on WooCommerce | Observed: full payment online by credit/debit card or PayPal (sales conditions). No deposit shown | Unclear: a "Selecciona la fecha" date selector is present. Live slots not observable | None found | Observed: free cancellation up to 48 h before by email; no-show loses the booking | Spanish, English |
| 3 | Coge las Riendas: horse riding; Ribadesella (departs from Vega); https://cogelasriendas.com/ | Observed: WhatsApp ("Reservar por WhatsApp") and email only | Not shown | No. Observed: availability is confirmed by message | None found | None found | Spanish |
| 4 | Rodiles Surf School (RodiRide): surf school; Selorio, Villaviciosa; http://www.rodilesurf.com/ | Observed: phone, email (obfuscated address), and an enquiry form ("Formulario de consulta") | Not shown | No. None shown | None found | None found for surf lessons | Spanish. Links to English and Russian sections are present but were not checked |
| 5 | Llagar Sidra Castañón: cider-mill (llagar) guided visit and tasting; Quintueles, Villaviciosa; https://sidracastanon.com/ | Observed: online booking through an embedded Mr.Plan widget (mrplan.io). Phone, WhatsApp and email for private tours | Not shown on the static pages. The widget content was not retrievable without a browser | Observed claim: "disponibilidad en tiempo real" in an "calendario interactivo de reservas" | None found | None found on the pages checked | Spanish. Visits are offered in English, but no English site was observed |
| 6 | Bicisendadeloso: bike rental on the Senda del Oso; Entrago (Teverga); https://www.bicisendadeloso.es/ | Observed: online booking form (Rutevia widget, panel.rutevia.com), phone, WhatsApp, email | Observed: optional, by credit card online or cash in the shop. No deposit ("Sin fianza"). See the note on conflicting wording | Unclear: booking is by form, with confirmation sent by WhatsApp | None found | Observed: free cancellation or date change up to 24 h before, by WhatsApp or phone | Spanish, English, French, Portuguese |
| 7 | Deporventura: guided caving (espeleología and rappel) and the Cueva Huerta walkway visit; Valles del Oso / Teverga; https://www.deporventura.es/ | Observed: a contact-form booking flow in 3 steps, a WhatsApp chat widget (Joinchat), and a Mr.Plan widget (mrplan.io) in its "Experiencias" section | Not shown | Unclear: inside the Mr.Plan widget, not observable | None found | None found on the pages checked | Spanish content. No other language observed |
| 8 | Tu Escuela Náutica: boat trips and skippered charter; Gijón; https://tuescuelanautica.com/salidas-en-barco-asturias/ | Observed: a request form for boat trips (boat type, day, time, crew, message). A WooCommerce cart exists on the site for courses | No for boat trips. Observed: nothing is paid until the trip is confirmed (within 48 h). Card payment appears only in the course purchase conditions | No. Observed: confirmation within 48 h | None found about physical access. A web-accessibility statement (RD 1112/2018) covers the website only | None found for boat trips. Refund conditions are published for courses | Spanish |
| 9 | Rutas 4x4 en Picos ("Ven a Picos"): 4x4 tours in the Picos de Europa; Cangas de Onís; https://rutas4x4enpicos.es/ | Observed: phone, email, contact form, and a "Reservas" link to an external booking page (reservaonline.support/venapicos) that embeds a Mr.Plan widget | Not shown | Unclear: inside the Mr.Plan widget, not observable | None found | None found on the pages checked | Spanish |
| 10 | Los Cauces Multiaventura: multi-adventure (Sella canoe, canyoning, horse riding, rafting, 4x4 and more); Arriondas; https://www.loscauces.com/ | Observed: online booking through an embedded Mr.Plan widget (mrplan.es) with "RESERVA ONLINE" per activity, plus phone, WhatsApp and email | Not shown. Observed: the Sella canoe trip can be booked online without paying in advance with the "sin picnic" option | Unclear: inside the Mr.Plan widget, not observable | None found. Child-adapted equipment is mentioned, but that is not accessibility | Observed: full refund if cancelled at least 7 days before; no-show cancels the booking | Spanish |

## Per-provider notes and quotes (item 8)

1. **Jaire Aventura.** Quote: "RESERVA DESCENSO EN CANOAS PAGA AHORA EL 50% Y EL RESTO EL DÍA
   DE LA ACTIVIDAD". Page: https://jairecanoas.com/reservar_descenso_sella.php. The same page
   shows "Cargando motor de reservas..." while the plugin loads. The cancellation policy is at
   https://jairecanoas.com/cancelacion.php.
2. **Asturguías.** Quote: "Los medios de pago aceptados serán: Tarjeta de crédito o débito,
   y PayPal". Page: https://asturguias.com/condiciones-generales-de-venta/. The activity page
   https://asturguias.com/ruta-guiada-lagos-de-covadonga/ shows "Reserva tu plaza Selecciona
   la fecha Nº de pasajeros ... Reservar Ahora" and the 48 h cancellation text.
3. **Coge las Riendas.** Quote: "Plazas limitadas por salida. Escríbenos y te confirmamos
   disponibilidad en el mismo día. Reservar por WhatsApp". Page: https://cogelasriendas.com/.
4. **Rodiles Surf School.** Quote: "Formulario de consulta Háganos llegar sus consultas"
   (the page also lists a phone number and an email address, omitted here). Page: http://www.rodilesurf.com/contacto/. Course
   prices are published at
   http://www.rodilesurf.com/rodiles-surf/escuela-de-surf/nuestra-escuela-de-surf_48_1_ap.html
   with no booking step.
5. **Llagar Sidra Castañón.** Quote: "Para ver la disponibilidad en tiempo real de cada pase,
   especialmente en festivos, puentes y temporada alta, consulta siempre nuestro calendario
   interactivo de reservas". Page: https://sidracastanon.com/visitas-guiadas-llagar-sidra-asturias/.
   The "Reservar Experiencia" links open https://sidracastanon.com/visitas-guiadas-reserva/,
   which embeds a script from mrplan.io. The real-time claim is the provider's own wording. It
   was not checked inside the widget.
6. **Bicisendadeloso.** Quote: "Pago con tarjeta de crédito online o en efectivo en tienda.
   Te confirmamos por WhatsApp en cuanto recibimos tu reserva". Page:
   https://www.bicisendadeloso.es/reservas/. Note: the homepage https://www.bicisendadeloso.es/
   says "No pedimos tarjeta ni datos de pago." The two pages conflict. Both statements are
   recorded as observed.
7. **Deporventura.** Quote: "Reserva en 3 sencillos pasos 01 Elija la actividad ... 02
   Rellena el formulario de contacto. Datos, fechas y número de personas". Page:
   https://www.deporventura.es/. The chat widget says "Reserva directamente en nuestra sección
   Experiencias", and https://www.deporventura.es/experiencias/ embeds a Mr.Plan script. The
   Cueva Huerta page https://www.deporventura.es/actividad-cueva-huerta/ says "ACTUALMENTE NO
   VISITABLE", so the cave activity currently on offer is the caving route
   (https://www.deporventura.es/espeleologia-rapel/).
8. **Tu Escuela Náutica.** Quote: "Puedes elegir el tipo de barco, el día y la hora. No
   pagarás nada hasta que no te confirmemos". Page:
   https://tuescuelanautica.com/salidas-en-barco-asturias/. The accessibility statement
   (https://tuescuelanautica.com/declaracion-de-accesibilidad/) is about the website. The
   conditions at https://tuescuelanautica.com/reembolso_devoluciones/ cover course purchases.
9. **Rutas 4x4 en Picos.** Quote: "cumplimenta el formulario y envianoslo, o bien llamanos por
   teléfono". Page: https://rutas4x4enpicos.es/contacto/. The site menu's "Reservas" item links
   to https://www.reservaonline.support/venapicos/, a page titled "Ven a Picos" that embeds a
   Mr.Plan script.
10. **Los Cauces Multiaventura.** Quote: "Reserva online sin pagar nada por adelantado con la
    opción «sin picnic»". Page: https://loscauces.com/descenso-del-sella/. The booking page
    https://www.loscauces.com/reservar/ embeds a script from mrplan.es. The cancellation policy
    is at https://loscauces.com/politica-de-cancelaciones/.

## Summary (counts out of ten)

| Measure | Count | Providers |
|---|---|---|
| Online booking engine present | 7 / 10 | 1 (own plugin), 2 (WooCommerce), 5, 7, 9, 10 (Mr.Plan), 6 (Rutevia) |
| Online payment possible (observed) | 3 / 10 | 1 (50% up front), 2 (card or PayPal), 6 (optional card) |
| Deposit option shown | 1 / 10 | 1 (50%) |
| Real-time availability (observed) | 1 / 10 | 5 (provider's own claim). Unclear for 1, 2, 6, 7, 9 and 10; no for 3, 4 and 8 |
| Accessibility info published (physical access) | 0 / 10 | none. Provider 8 has a web-accessibility statement only |
| Cancellation policy published | 4 / 10 | 1, 2, 6, 10 |
| Booking only by phone, WhatsApp, email or form | 3 / 10 | 3, 4, 8 |

Mr.Plan (mrplan.io / mrplan.es) is the most common booking engine in this sample (4 of 10).
None of TuriTop, Bókun, FareHarbor, Rezdy or Checkfront was found in the fetched pages.

## Replacements and exclusions

- Aventuras en Asturias (aventurasenasturias.com) was first chosen for 4x4. It was replaced
  by Rutas 4x4 en Picos because its own site calls it "una central pionera de reservas de
  turismo activo en Asturias", which makes it a booking intermediary, not a provider.
- Every site in the final ten loaded. No provider was replaced because a site failed.

## Limits

This survey covers ten providers, chosen through web search, using public websites only on
one date (2026-10-03), with no contact with any provider. It cannot see back-office tools,
phone practices, or what the JavaScript booking widgets (Mr.Plan, Rutevia, the Jaire plugin)
show once they run in a browser. Payment and availability inside those widgets are therefore
recorded as not shown or unclear, not as absent. The sample leans towards eastern Asturias and
the Senda del Oso area. It records what public websites show. It is not a market study, and
it implies no endorsement of any provider.
