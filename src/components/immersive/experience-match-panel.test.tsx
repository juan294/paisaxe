import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  ExperienceMatchPanel,
  type ExperienceMatchCopy,
} from "./experience-match-panel";
import type { MatchSuggestion } from "@/types/experience-match";

const fetchMock = vi.fn<typeof fetch>();
const copy: ExperienceMatchCopy = {
  title: "Buscar a mi medida",
  preference: "Estilo",
  preferenceHelp: "Usa los controles para las necesidades obligatorias.",
  budgetDisclosure: "Cada búsqueda usa un turno.",
  consumptionDisclosure:
    "Una búsqueda enviada puede usar un turno aunque la canceles.",
  date: "Fecha",
  partySize: "Personas",
  budgetEuros: "Presupuesto total en euros",
  requirements: "Necesidades obligatorias",
  stepFree: "Sin escaleras",
  publicTransport: "Transporte público",
  pets: "Con mascota",
  minAge: "Edad del más pequeño",
  language: "Idioma de la visita",
  none: "Sin requisito",
  submit: "Buscar experiencias",
  cancel: "Cancelar búsqueda",
  retry: "Volver a buscar",
  close: "Cerrar búsqueda",
  checking: "Comprobando acceso",
  searching: "Buscando experiencias",
  disabled: "Puedes seguir buscando en el chat.",
  accessExpired: "Revisa tu acceso.",
  accessAction: "Revisar acceso",
  allowanceExhausted: "No quedan turnos.",
  rateLimited: "Demasiadas búsquedas.",
  retryAfter: "Espera {seconds} segundos.",
  invalidInput: "Revisa los campos indicados.",
  unavailable: "La búsqueda no está disponible.",
  cancelled: "Búsqueda cancelada.",
  noResults: "No hay opciones. Cambia los criterios.",
  degraded: "Mostramos las opciones del catálogo.",
  noClearStyleMatch: "No hay una afinidad clara.",
  estimatedStyle: "Afinidad de estilo estimada",
  notEstablishedStyle: "Afinidad no establecida",
  useInChat: "Usar en el chat",
  remaining: "Quedan {remaining} turnos.",
  examined: "Se compararon {count} opciones.",
  truncated: "Se comparó una parte del catálogo.",
  catalogNotices: "Datos y avisos del catálogo",
  slots: "Horarios disponibles",
  alternatives: "Fechas alternativas",
  places: "{count} plazas",
  deposit: "Señal",
  duration: "Duración",
  maxParty: "Máximo de personas",
  chatGuidance: "Continúa en el chat.",
  validation: {
    preference: "Escribe un estilo de 1 a 240 caracteres.",
    date: "Indica una fecha válida en los próximos 90 días.",
    partySize: "Indica entre 1 y 12 personas.",
    budgetCents: "Indica un importe válido con hasta dos decimales.",
    min_age: "Indica una edad entre 0 y 120.",
  },
  suitability: {
    suitable: "Adecuada",
    unconfirmed: "Sin confirmar",
    rejected: "Descartada",
  },
  reasons: {
    over_budget: "Supera el presupuesto",
    party_too_large: "Grupo demasiado grande",
    constraint_unsupported: "No cumple una necesidad",
    no_availability: "Sin disponibilidad",
  },
  verdicts: {
    supported: "Confirmado",
    unsupported: "No compatible",
    unknown: "Dato desconocido",
  },
  constraintLabels: {
    step_free: "Escalones",
    public_transport: "Transporte",
    pets: "Mascotas",
    min_age: "Edad",
    language: "Idioma",
  },
  languageOptions: [
    { value: "es", label: "Español" },
    { value: "en", label: "Inglés" },
  ],
};
const suggestion: MatchSuggestion = {
  experience: {
    id: "experience-1",
    title: "Paseo por la senda costera",
    description: "Paseo costero guiado",
    currency: "EUR",
    priceCents: 12000,
    depositCents: 3000,
    maxParty: 6,
    durationMinutes: 150,
    facts: [],
  },
  suitability: "unconfirmed",
  verdicts: [
    {
      key: "pets",
      verdict: "unknown",
      detail: "El proveedor no ha confirmado las mascotas",
      confirmedByProvider: false,
    },
  ],
  reasons: [],
  slots: [{ date: "2026-11-02", startTime: "10:00", available: 8 }],
  alternatives: [],
  styleFit: "estimated",
};
const rejected = {
  ...suggestion,
  experience: {
    ...suggestion.experience,
    id: "experience-2",
    title: "Descenso en canoa",
    priceCents: 6000,
    depositCents: 1500,
  },
  suitability: "rejected" as const,
  reasons: ["constraint_unsupported" as const],
  slots: [],
  alternatives: [{ date: "2026-11-03", startTime: "16:00", available: 4 }],
};
const matched = {
  status: "matched",
  reason: "style_matches",
  suggestions: [suggestion],
  catalog: [suggestion, rejected],
  examinedCount: 2,
  truncated: false,
  remaining: 3,
};
const json = (body: unknown, status = 200) => Response.json(body, { status });
const setup = () => {
  const onUse = vi.fn();
  render(
    <ExperienceMatchPanel
      copy={copy}
      locale="es"
      accessToken="token"
      onUseSuggestion={onUse}
    />,
  );
  return onUse;
};
async function open() {
  fireEvent.click(screen.getByRole("button", { name: copy.title }));
  await screen.findByLabelText(copy.preference);
}
function style(value = "Un paseo tranquilo") {
  fireEvent.change(screen.getByLabelText(copy.preference), {
    target: { value },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ExperienceMatchPanel", () => {
  it("keeps passive edits free, discloses cost, submits explicit hard controls and exact integer group cents", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(matched));
    const onUse = setup();
    expect(fetchMock).not.toHaveBeenCalled();
    await open();
    style("Un paseo tranquilo sin escaleras");
    fireEvent.change(screen.getByLabelText(copy.partySize), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(copy.budgetEuros), {
      target: { value: "120,50" },
    });
    fireEvent.click(screen.getByLabelText(copy.pets));
    expect(screen.getByText(copy.budgetDisclosure)).toBeVisible();
    expect(screen.getByText(copy.consumptionDisclosure)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByRole("button", { name: copy.useInChat });
    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);
    expect(body).toEqual({
      locale: "es",
      preference: "Un paseo tranquilo sin escaleras",
      partySize: 2,
      budgetCents: 12050,
      constraints: { pets: true },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.useInChat }));
    expect(onUse).toHaveBeenCalledWith(suggestion, {
      partySize: 2,
      budgetCents: 12050,
      constraints: { pets: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("opens and closes by keyboard with focus restored to the disclosure button", async () => {
    fetchMock.mockResolvedValueOnce(json({ available: true }));
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole("button", { name: copy.title });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByLabelText(copy.preference);
    const close = screen.getByRole("button", { name: copy.close });
    close.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("validates editable fields before a charged submit and focuses the invalid field", async () => {
    fetchMock.mockResolvedValueOnce(json({ available: true }));
    setup();
    await open();
    style();
    fireEvent.change(screen.getByLabelText(copy.budgetEuros), {
      target: { value: "12,345" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByText(copy.validation.budgetCents)).toBeVisible();
    expect(screen.getByLabelText(copy.budgetEuros)).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(copy.budgetEuros), {
      target: { value: "" },
    });
    style("");
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByText(copy.validation.preference)).toBeVisible();
  });
  it("announces successful matching completion in the persistent status region", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(matched));
    setup();
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByRole("button", { name: copy.useInChat });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Se compararon 2 opciones.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Quedan 3 turnos.");
  });
  it("preserves authoritative notices, unknown facts, prices and alternative slots beyond suggestions", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(matched));
    setup();
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByRole("button", { name: copy.useInChat });
    expect(screen.getByText(copy.estimatedStyle)).toBeVisible();
    expect(
      screen.getAllByText(/El proveedor no ha confirmado las mascotas/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Descenso en canoa")).toBeVisible();
    expect(screen.getByText(copy.reasons.constraint_unsupported)).toBeVisible();
    expect(screen.getByText(/16:00/)).toBeVisible();
    expect(screen.getByText(/120,00/)).toBeVisible();
    expect(screen.getByText(/60,00/)).toBeVisible();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
  it("rechecks on reopen and explicit retry; unavailable results disclose possible consumed allowance", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: false }))
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(
        json({
          status: "unavailable",
          reason: "catalog_unavailable",
          guidance: "retry_or_chat",
          turnMayBeConsumed: true,
        }),
      )
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(matched));
    setup();
    await open();
    expect(screen.getByText(copy.disabled)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy.close }));
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByText(copy.unavailable);
    expect(screen.getByText(copy.consumptionDisclosure)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    await screen.findByRole("button", { name: copy.useInChat });
    expect(fetchMock.mock.calls.map((c) => c[1]?.method)).toEqual([
      "GET",
      "GET",
      "POST",
      "GET",
      "POST",
    ]);
  });
  it("cancel leaves fields editable, ignores late response, and offers a fresh charged retry", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockReturnValueOnce(pending);
    setup();
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    fireEvent.click(await screen.findByRole("button", { name: copy.cancel }));
    expect(screen.getByText(copy.cancelled)).toBeVisible();
    expect(screen.getByLabelText(copy.preference)).toHaveValue(
      "Un paseo tranquilo",
    );
    await act(async () => {
      resolve(json(matched));
    });
    expect(
      screen.queryByRole("button", { name: copy.useInChat }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("localizes server field errors and keeps unknown technical details out of the UI", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(
        json(
          {
            status: "invalid_input",
            fields: {
              budgetCents: "Zod: unsafe integer at request.budgetCents",
              unknownInternal: "implementation detail",
            },
          },
          400,
        ),
      );
    setup();
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByText(copy.validation.budgetCents)).toBeVisible();
    expect(screen.getByLabelText(copy.budgetEuros)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.queryByText(/Zod:|implementation detail/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(copy.invalidInput);
  });
  it("shows editable no-results recovery, rate timing and the existing access link", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(
        json({
          ...matched,
          status: "no_results",
          suggestions: [],
          examinedCount: 0,
        }),
      )
      .mockResolvedValueOnce(
        json({ status: "rate_limited", retryAfter: 12 }, 429),
      )
      .mockResolvedValueOnce(json({ error: "Not found" }, 404));
    setup();
    await open();
    style();
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByText(copy.noResults);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByText("Espera 12 segundos.");
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: copy.accessAction }),
      ).toHaveAttribute("href", "/acceso"),
    );
  });
});


describe("ExperienceMatchPanel editable recovery", () => {
  it.each([
    ["date", copy.date, "2020-01-01", copy.validation.date],
    ["party below minimum", copy.partySize, "0", copy.validation.partySize],
    ["party above maximum", copy.partySize, "13", copy.validation.partySize],
    ["fractional party", copy.partySize, "1.5", copy.validation.partySize],
    ["budget above maximum", copy.budgetEuros, "100000,01", copy.validation.budgetCents],
    ["unsafe huge budget", copy.budgetEuros, "99999999999999999999", copy.validation.budgetCents],
    ["age above maximum", copy.minAge, "121", copy.validation.min_age],
    ["fractional age", copy.minAge, "1.5", copy.validation.min_age],
  ])("keeps %s editable and does not POST invalid criteria", async (_name, label, value, message) => {
    fetchMock.mockResolvedValueOnce(json({ available: true })); setup(); await open(); style();
    fireEvent.change(screen.getByLabelText(label!), { target: { value } }); fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByText(message!)).toBeVisible(); expect(screen.getByLabelText(label!)).toHaveFocus(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sends date, zero group budget, minimum age, language and both hard flags only through explicit controls", async () => {
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(matched)); setup(); await open(); style();
    const today = screen.getByLabelText(copy.date).getAttribute("min"); expect(today).toBeTruthy();
    fireEvent.change(screen.getByLabelText(copy.date), { target: { value: today } });
    fireEvent.change(screen.getByLabelText(copy.budgetEuros), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(copy.minAge), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(copy.language), { target: { value: "en" } });
    fireEvent.click(screen.getByLabelText(copy.stepFree)); fireEvent.click(screen.getByLabelText(copy.publicTransport));
    fireEvent.click(screen.getByRole("button", { name: copy.submit })); await screen.findByRole("button", { name: copy.useInChat });
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ locale: "es", preference: "Un paseo tranquilo", date: today, budgetCents: 0, constraints: { step_free: true, public_transport: true, min_age: 0, language: "en" } });
  });
  it("blocks a form submit while the parent conversation is busy and can search after it becomes idle", async () => {
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(matched)); const onUse = vi.fn();
    const { rerender } = render(<ExperienceMatchPanel copy={copy} locale="es" accessToken="token" busy onUseSuggestion={onUse} />);
    await open(); style(); expect(screen.getByRole("button", { name: copy.submit })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText(copy.preference).closest("form")!); expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender(<ExperienceMatchPanel copy={copy} locale="es" accessToken="token" busy={false} onUseSuggestion={onUse} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit })); await screen.findByRole("button", { name: copy.useInChat }); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["degraded", "no_clear_style_match"] as const)("discloses %s without fabricated explanations and retains an unknown provider notice", async kind => {
    const quiet = { ...suggestion, styleFit: "not_established", experience: { ...suggestion.experience, description: null, durationMinutes: null }, verdicts: [{ key: "pets", verdict: "unknown", detail: null, confirmedByProvider: false }] };
    const body = { ...matched, status: kind === "degraded" ? "degraded" : "matched", reason: kind === "degraded" ? "semantic_unavailable" : "no_clear_style_match", suggestions: [quiet], catalog: [quiet], truncated: true };
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(body)); setup(); await open(); style(); fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByRole("button", { name: copy.useInChat }); expect(screen.getByRole("status")).toHaveTextContent(kind === "degraded" ? copy.degraded : copy.noClearStyleMatch);
    expect(screen.getByText(copy.notEstablishedStyle)).toBeVisible(); expect(screen.getByText(copy.truncated, { exact: false })).toBeVisible(); expect(screen.getByText("Mascotas: Dato desconocido")).toBeVisible();
  });
  it("shows capability errors and exhausted allowance distinctly; Escape closes with a parent notification", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "offline" }, 503)).mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json({ status: "allowance_exhausted" }, 429));
    const onOpenChange = vi.fn(); render(<ExperienceMatchPanel copy={copy} locale="es" accessToken="token" onUseSuggestion={vi.fn()} onOpenChange={onOpenChange} />);
    await open(); expect(screen.getByRole("status")).toHaveTextContent(copy.unavailable); fireEvent.click(screen.getByRole("button", { name: copy.title }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false); await open(); style(); fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.allowanceExhausted));
    fireEvent.keyDown(screen.getByLabelText(copy.preference), { key: "Escape" }); expect(screen.getByRole("button", { name: copy.title })).toHaveFocus(); expect(onOpenChange).toHaveBeenLastCalledWith(false); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
