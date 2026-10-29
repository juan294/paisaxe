"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useExperienceMatch,
  type MatchCriteria,
} from "@/hooks/use-experience-match";
import { money, slotDay } from "@/lib/booking-format";
import { addDays, madridDate } from "@/lib/booking/types";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/types";
import type { VisitorConstraints } from "@/lib/booking/facts";
import type {
  MatchCatalogOption,
  MatchRequest,
  MatchSuggestion,
} from "@/types/experience-match";

export interface ExperienceMatchCopy {
  title: string;
  preference: string;
  preferenceHelp: string;
  budgetDisclosure: string;
  consumptionDisclosure: string;
  date: string;
  partySize: string;
  budgetEuros: string;
  requirements: string;
  stepFree: string;
  publicTransport: string;
  pets: string;
  minAge: string;
  language: string;
  none: string;
  submit: string;
  cancel: string;
  retry: string;
  close: string;
  checking: string;
  searching: string;
  disabled: string;
  accessExpired: string;
  accessAction: string;
  allowanceExhausted: string;
  rateLimited: string;
  retryAfter: string;
  invalidInput: string;
  unavailable: string;
  cancelled: string;
  noResults: string;
  degraded: string;
  noClearStyleMatch: string;
  estimatedStyle: string;
  notEstablishedStyle: string;
  useInChat: string;
  remaining: string;
  examined: string;
  truncated: string;
  catalogNotices: string;
  slots: string;
  alternatives: string;
  places: string;
  deposit: string;
  duration: string;
  maxParty: string;
  chatGuidance: string;
  validation: Record<
    "preference" | "date" | "partySize" | "budgetCents" | "min_age",
    string
  >;
  suitability: Record<MatchCatalogOption["suitability"], string>;
  reasons: Record<MatchCatalogOption["reasons"][number], string>;
  verdicts: Record<"supported" | "unsupported" | "unknown", string>;
  constraintLabels: Record<keyof VisitorConstraints, string>;
  languageOptions: { value: string; label: string }[];
}
export interface ExperienceMatchPanelProps {
  onOpenChange?: (open: boolean) => void;
  accessToken?: string;
  locale: Locale;
  copy: ExperienceMatchCopy;
  busy?: boolean;
  onUseSuggestion: (
    suggestion: MatchSuggestion,
    criteria: MatchCriteria,
  ) => void;
}
const fieldClass =
  "min-h-11 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/70";
type Fields = "preference" | "date" | "partySize" | "budgetCents" | "min_age";
type FormValues = {
  preference: string;
  date: string;
  partySize: string;
  budgetEuros: string;
  minAge: string;
  language: string;
  step_free: boolean;
  public_transport: boolean;
  pets: boolean;
};
const initialValues: FormValues = {
  preference: "",
  date: "",
  partySize: "",
  budgetEuros: "",
  minAge: "",
  language: "",
  step_free: false,
  public_transport: false,
  pets: false,
};

/** Structured controls alone supply hard criteria; style text never fills them. */
function parseForm(
  values: FormValues,
  copy: ExperienceMatchCopy,
): { request?: MatchRequest; errors: Partial<Record<Fields, string>> } {
  const errors: Partial<Record<Fields, string>> = {};
  const preference = values.preference.trim();
  if (!preference || preference.length > 240)
    errors.preference = copy.validation.preference;
  const request: MatchRequest = { locale: "es", preference };
  if (values.date) {
    const today = madridDate(new Date());
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(values.date) &&
      !Number.isNaN(Date.parse(`${values.date}T00:00:00Z`)) &&
      new Date(`${values.date}T00:00:00Z`).toISOString().slice(0, 10) ===
        values.date;
    if (!valid || values.date < today || values.date > addDays(today, 90))
      errors.date = copy.validation.date;
    else request.date = values.date;
  }
  if (values.partySize) {
    if (
      !/^\d+$/.test(values.partySize) ||
      Number(values.partySize) < 1 ||
      Number(values.partySize) > 12
    )
      errors.partySize = copy.validation.partySize;
    else request.partySize = Number(values.partySize);
  }
  if (values.budgetEuros) {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(values.budgetEuros.trim()))
      errors.budgetCents = copy.validation.budgetCents;
    else {
      const [whole, fraction = ""] = values.budgetEuros.trim().split(/[.,]/);
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      if (!Number.isSafeInteger(cents) || cents > 10_000_000)
        errors.budgetCents = copy.validation.budgetCents;
      else request.budgetCents = cents;
    }
  }
  const constraints: VisitorConstraints = {};
  for (const key of ["step_free", "public_transport", "pets"] as const)
    if (values[key]) constraints[key] = true;
  if (values.minAge) {
    if (!/^\d+$/.test(values.minAge) || Number(values.minAge) > 120)
      errors.min_age = copy.validation.min_age;
    else constraints.min_age = Number(values.minAge);
  }
  if (values.language) constraints.language = values.language;
  if (Object.keys(constraints).length) request.constraints = constraints;
  return Object.keys(errors).length ? { errors } : { request, errors };
}
function OptionDetails({
  option,
  copy,
  locale,
}: {
  option: MatchCatalogOption;
  copy: ExperienceMatchCopy;
  locale: Locale;
}) {
  return (
    <>
      <p className="text-white/80">{copy.suitability[option.suitability]}</p>
      <p className="text-xs text-white/70">
        {copy.deposit}:{" "}
        {money(
          option.experience.depositCents,
          option.experience.currency,
          locale,
        )}{" "}
        · {copy.duration}: {option.experience.durationMinutes} min ·{" "}
        {copy.maxParty}: {option.experience.maxParty}
      </p>
      {option.reasons.map((reason) => (
        <p key={reason} className="text-sm text-amber-200">
          {copy.reasons[reason]}
        </p>
      ))}
      {option.verdicts.map((verdict) => (
        <p key={verdict.key} className="text-sm text-white/80">
          {copy.constraintLabels[verdict.key]}: {copy.verdicts[verdict.verdict]}
          {verdict.detail ? ` — ${verdict.detail}` : ""}
        </p>
      ))}
      {(["slots", "alternatives"] as const).map(
        (key) =>
          option[key].length > 0 && (
            <div key={key} className="mt-2 text-xs text-white/80">
              <p>{copy[key]}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {option[key].map((slot) => (
                  <li key={`${slot.date}-${slot.startTime}`}>
                    {slotDay(slot.date, locale)} {slot.startTime} (
                    {interpolate(copy.places, {
                      count: String(slot.available),
                    })}
                    )
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
    </>
  );
}

/** An explicit, editable search beside the existing conversation, never a booking action. */
export function ExperienceMatchPanel({
  accessToken,
  locale,
  copy,
  onUseSuggestion,
  onOpenChange,
  busy = false,
}: ExperienceMatchPanelProps) {
  const match = useExperienceMatch({ accessToken, locale });
  useEffect(() => {
    onOpenChange?.(match.isOpen);
  }, [match.isOpen, onOpenChange]);
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeToTrigger = () => {
    match.close();
    trigger.current?.focus();
  };
  const [values, setValues] = useState(initialValues);
  const [localErrors, setLocalErrors] = useState<
    Partial<Record<Fields, string>>
  >({});
  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setLocalErrors({});
  };
  const serverFields =
    match.error?.kind === "invalid_input" ? (match.error.fields ?? {}) : {};
  const errorFor = (field: Fields) =>
    localErrors[field] ??
    (serverFields[field] || serverFields[`constraints.${field}`]
      ? copy.validation[field]
      : undefined);
  const submit = (retry: boolean) => {
    if (busy || match.isSearching) return;
    const parsed = parseForm(values, copy);
    setLocalErrors(parsed.errors);
    if (!parsed.request) {
      const first = Object.keys(parsed.errors)[0];
      form.current
        ?.querySelector<HTMLElement>(`[data-match-field="${first}"]`)
        ?.focus();
      return;
    }
    void (retry ? match.retry(parsed.request) : match.submit(parsed.request));
  };
  const results =
    match.result && match.result.status !== "unavailable" ? match.result : null;
  const notice =
    match.capability === "checking"
      ? copy.checking
      : match.isSearching
        ? copy.searching
        : match.cancelled
          ? copy.cancelled
          : match.capability === "access_expired"
            ? copy.accessExpired
            : match.capability === "unavailable"
              ? copy.disabled
              : match.capability === "error"
                ? copy.unavailable
                : match.error?.kind === "invalid_input"
                  ? ""
                  : match.error?.kind === "allowance_exhausted"
                    ? copy.allowanceExhausted
                    : match.error?.kind === "rate_limited"
                      ? copy.rateLimited
                      : match.error || match.result?.status === "unavailable"
                        ? copy.unavailable
                        : results?.status === "no_results"
                          ? copy.noResults
                          : results?.status === "degraded"
                            ? copy.degraded
                            : results?.status === "matched" &&
                                results.reason === "no_clear_style_match"
                              ? copy.noClearStyleMatch
                              : results?.status === "matched"
                                ? `${interpolate(copy.examined, { count: String(results.examinedCount) })} ${interpolate(copy.remaining, { remaining: String(results.remaining) })}`
                                : "";
  const canSubmit =
    match.capability === "available" && !match.isSearching && !busy;
  const hasErrors =
    Object.keys(localErrors).length > 0 ||
    match.error?.kind === "invalid_input";
  const field = (
    key: Fields,
    label: string,
    valueKey: "date" | "partySize" | "budgetEuros" | "minAge",
    type = "text",
    limits: Record<string, string | number> = {},
  ) => (
    <div className="text-sm">
      <label className="block" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        data-match-field={key}
        type={type}
        value={values[valueKey]}
        onChange={(event) => update(valueKey, event.target.value)}
        className={`${fieldClass} mt-1`}
        aria-invalid={Boolean(errorFor(key))}
        aria-describedby={errorFor(key) ? `${id}-${key}-error` : undefined}
        {...limits}
      />
      {errorFor(key) && (
        <span
          id={`${id}-${key}-error`}
          className="mt-1 block text-xs text-amber-200"
        >
          {errorFor(key)}
        </span>
      )}
    </div>
  );
  return (
    <section
      className={`mx-4 mb-3 rounded-xl border border-white/20 bg-white/5 text-white ${match.isOpen ? "flex min-h-0 flex-col" : "shrink-0"}`}
      onKeyDown={(event) => {
        if (match.isOpen && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeToTrigger();
        }
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3">
        <button
          ref={trigger}
          type="button"
          aria-expanded={match.isOpen}
          aria-controls={`${id}-panel`}
          onClick={() => {
            if (match.isOpen) match.close();
            else void match.open();
          }}
          className="min-h-11 flex-1 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {copy.title}
        </button>
        {match.isOpen && (
          <Button
            type="button"
            variant="glass"
            className="min-h-11 rounded-md"
            onClick={closeToTrigger}
          >
            {copy.close}
          </Button>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          notice && match.isOpen
            ? "shrink-0 px-3 pb-2 text-sm text-white/80"
            : "sr-only"
        }
      >
        {match.isOpen ? notice : ""}
      </p>
      {match.isOpen && (
        <div
          id={`${id}-panel`}
          className="min-h-0 max-h-[60vh] flex-1 overflow-y-auto border-t border-white/10 px-3 pb-3 pt-3"
        >
          {match.capability === "access_expired" && (
            <a
              className="inline-flex min-h-11 items-center underline focus-visible:ring-2 focus-visible:ring-white/70"
              href="/acceso"
            >
              {copy.accessAction}
            </a>
          )}
          {match.capability === "unavailable" && (
            <p className="text-sm text-white/70">{copy.chatGuidance}</p>
          )}
          {match.capability !== "checking" && (
            <form
              ref={form}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                submit(false);
              }}
            >
              <p className="mb-3 text-xs text-white/80">
                {copy.budgetDisclosure}
              </p>
              <label htmlFor={`${id}-preference`} className="block text-sm">
                {copy.preference}
              </label>
              <textarea
                id={`${id}-preference`}
                data-match-field="preference"
                rows={3}
                maxLength={240}
                value={values.preference}
                onChange={(event) => update("preference", event.target.value)}
                className={`${fieldClass} mt-1 w-full resize-y rounded-md border px-3 py-2 text-base sm:text-sm`}
                aria-invalid={Boolean(errorFor("preference"))}
                aria-describedby={`${id}-style-help${errorFor("preference") ? ` ${id}-preference-error` : ""}`}
              />
              <p id={`${id}-style-help`} className="mt-1 text-xs text-white/70">
                {copy.preferenceHelp}
              </p>
              {errorFor("preference") && (
                <p
                  id={`${id}-preference-error`}
                  className="text-xs text-amber-200"
                >
                  {errorFor("preference")}
                </p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field("date", copy.date, "date", "date", {
                  min: madridDate(new Date()),
                  max: addDays(madridDate(new Date()), 90),
                })}
                {field("partySize", copy.partySize, "partySize", "number", {
                  min: 1,
                  max: 12,
                  step: 1,
                })}
                {field("budgetCents", copy.budgetEuros, "budgetEuros", "text", {
                  inputMode: "decimal",
                })}
              </div>
              <fieldset className="mt-3 border-t border-white/10 pt-3">
                <legend className="text-sm font-medium">
                  {copy.requirements}
                </legend>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {(
                    [
                      ["step_free", copy.stepFree],
                      ["public_transport", copy.publicTransport],
                      ["pets", copy.pets],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-11 items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={values[key]}
                        onChange={(event) => update(key, event.target.checked)}
                        className="h-4 w-4 accent-white focus-visible:ring-2 focus-visible:ring-white/70"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {field("min_age", copy.minAge, "minAge", "number", {
                    min: 0,
                    max: 120,
                    step: 1,
                  })}
                  <label htmlFor={`${id}-language`} className="block text-sm">
                    {copy.language}
                    <select
                      id={`${id}-language`}
                      className={`${fieldClass} mt-1 w-full rounded-md border px-3 py-2`}
                      value={values.language}
                      onChange={(event) =>
                        update("language", event.target.value)
                      }
                    >
                      <option value="" className="bg-neutral-950">
                        {copy.none}
                      </option>
                      {copy.languageOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          className="bg-neutral-950"
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              {hasErrors && (
                <p role="alert" className="mt-3 text-sm text-amber-200">
                  {copy.invalidInput}
                </p>
              )}
              {match.error?.retryAfter !== undefined && (
                <p className="mt-2 text-sm text-white/80">
                  {interpolate(copy.retryAfter, {
                    seconds: String(match.error.retryAfter),
                  })}
                </p>
              )}
              <p className="mt-1 text-xs text-white/70">
                {copy.consumptionDisclosure}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="brand"
                  className="min-h-11 flex-1"
                  disabled={!canSubmit}
                >
                  {copy.submit}
                </Button>
                {match.isSearching ? (
                  <Button
                    type="button"
                    variant="glass"
                    className="min-h-11 rounded-md"
                    onClick={match.cancel}
                  >
                    {copy.cancel}
                  </Button>
                ) : (
                  (match.error ||
                    match.cancelled ||
                    match.result?.status === "unavailable" ||
                    match.capability === "error") && (
                    <Button
                      type="button"
                      variant="glass"
                      className="min-h-11 rounded-md"
                      disabled={busy}
                      onClick={() => submit(true)}
                    >
                      {copy.retry}
                    </Button>
                  )
                )}
              </div>
            </form>
          )}
          {results && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-white/70">
                {interpolate(copy.remaining, {
                  remaining: String(results.remaining),
                })}{" "}
                {interpolate(copy.examined, {
                  count: String(results.examinedCount),
                })}
                {results.truncated ? ` ${copy.truncated}` : ""}
              </p>
              <ul className="space-y-3">
                {results.suggestions.slice(0, 3).map((suggestion) => (
                  <li
                    key={suggestion.experience.id}
                    className="rounded-lg border border-white/20 bg-white/5 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {suggestion.experience.title}
                      </h3>
                      <span className="text-sm tabular-nums">
                        {money(
                          suggestion.experience.priceCents,
                          suggestion.experience.currency,
                          locale,
                        )}
                      </span>
                    </div>
                    <p className="my-1 text-xs text-white/80">
                      {suggestion.styleFit === "estimated"
                        ? copy.estimatedStyle
                        : copy.notEstablishedStyle}
                    </p>
                    <OptionDetails
                      option={suggestion}
                      copy={copy}
                      locale={locale}
                    />
                    <Button
                      type="button"
                      variant="glass"
                      className="mt-3 min-h-11 w-full rounded-md"
                      disabled={busy}
                      onClick={() => {
                        if (match.submittedCriteria) {
                          onUseSuggestion(suggestion, match.submittedCriteria);
                          match.close();
                        }
                      }}
                    >
                      {copy.useInChat}
                    </Button>
                  </li>
                ))}
              </ul>
              <h3 className="text-sm font-semibold">{copy.catalogNotices}</h3>
              <ul className="space-y-3">
                {results.catalog
                  .filter(
                    (option) =>
                      !results.suggestions
                        .slice(0, 3)
                        .some(
                          (suggestion) =>
                            suggestion.experience.id === option.experience.id,
                        ),
                  )
                  .map((option) => (
                    <li
                      key={option.experience.id}
                      className="border-t border-white/10 pt-2"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <h4 className="text-sm font-medium">
                          {option.experience.title}
                        </h4>
                        <span className="text-sm tabular-nums">
                          {money(
                            option.experience.priceCents,
                            option.experience.currency,
                            locale,
                          )}
                        </span>
                      </div>
                      <OptionDetails
                        option={option}
                        copy={copy}
                        locale={locale}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
