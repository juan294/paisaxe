"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { clientLogger } from "@/lib/client-logger";
import { csrfHeaders } from "@/lib/csrf-client";
import { useTranslation } from "@/lib/i18n";

type ErrorKey = "invalid" | "expired" | "exhausted" | "anonFailed" | "rateLimited" | "failed";
/** One state: idle, in flight, redeemed (navigating away), or the error to show. */
type FormState = "idle" | "submitting" | "done" | ErrorKey;

const REFUSAL_REASONS = new Set<ErrorKey>(["invalid", "expired", "exhausted"]);

/** Maps a failed redemption response to the message to show. */
async function errorFor(response: Response): Promise<ErrorKey> {
  if (response.status === 429) return "rateLimited";
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    if (body?.reason && REFUSAL_REASONS.has(body.reason as ErrorKey)) return body.reason as ErrorKey;
  }
  return "failed";
}

/**
 * Redeems a voucher code. Without a session it first signs the visitor in
 * anonymously, so a judge needs no Google account; the server records the
 * redemption and the voice pass, and nothing is stored in the browser.
 */
export function VoucherForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const [code, setCode] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const error = state === "idle" || state === "submitting" || state === "done" ? null : state;

  async function guestToken(): Promise<string | null> {
    // Loaded on submit, not with the page: the client is most of /acceso's bundle budget.
    const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      clientLogger.error("[VOUCHER_ANON_SIGNIN_FAILED]", { error: "Supabase is not configured" });
      return null;
    }
    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError || !data.session) {
      clientLogger.error("[VOUCHER_ANON_SIGNIN_FAILED]", { error: String(signInError) });
      return null;
    }
    return data.session.access_token;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");

    try {
      const token = session?.access_token ?? (await guestToken());
      if (!token) {
        setState("anonFailed");
        return;
      }

      const response = await fetch("/api/booking/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...csrfHeaders() },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setState(await errorFor(response));
        return;
      }

      setState("done");
      router.push("/immersive?booking=1");
    } catch {
      setState("failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      {/* method="post" and no input name: a submit before hydration must never
          put the code in the URL (history, logs, analytics page views). */}
      <form method="post" onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{t("booking.access.title")}</h1>
          <p className="text-white/70">{t("booking.access.intro")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voucher-code">{t("booking.access.codeLabel")}</Label>
          <Input
            id="voucher-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t("booking.access.codePlaceholder")}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            minLength={8}
            maxLength={64}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "voucher-error" : undefined}
          />
        </div>

        {/* Until auth has loaded a missing session may be a Google user still
            restoring; signing in as a guest then would replace it. */}
        <Button type="submit" className="w-full" disabled={isAuthLoading || state === "submitting" || state === "done"}>
          {state === "submitting" ? t("booking.access.submitting") : t("booking.access.submit")}
        </Button>

        <div aria-live="polite">
          {error && (
            <div id="voucher-error" className="space-y-1 text-sm">
              <p className="text-red-300">{t(`booking.access.${error}`)}</p>
              {REFUSAL_REASONS.has(error) && <p className="text-white/60">{t("booking.access.contactHint")}</p>}
            </div>
          )}
          {state === "done" && <p className="text-sm text-emerald-300">{t("booking.access.welcome")}</p>}
        </div>
      </form>
    </main>
  );
}
