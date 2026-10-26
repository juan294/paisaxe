// @vitest-environment node
import { describe, expect, it } from "vitest";
import { captureEnvelopes, expectNothingSensitive, loadSentryBuild, SECRETS } from "@/test/sentry-envelopes";

describe("Sentry server SDK with this project's options (#1033, F05)", () => {
  it("sends errors and streamed spans without capability links, PII or credentials", async () => {
    const sent = await captureEnvelopes(await loadSentryBuild("server"));
    expect(sent).toContain('"type":"session"');
    expectNothingSensitive(sent);
  });

  it("keeps session health counts without a user's email or IP in single or aggregate envelopes", async () => {
    const Sentry = await loadSentryBuild("server");
    const sent = await captureEnvelopes(Sentry, () => {
      Sentry.startSession({ user: { email: SECRETS[0], ip_address: SECRETS[1] } });
      Sentry.captureSession();
      const client = Sentry.getClient();
      if (!client) throw new Error("Sentry client was not initialized");
      client.sendSession({
        attrs: { ip_address: SECRETS[1] },
        aggregates: [{ started: "2026-10-18T00:00:00.000Z", errored: 2 }],
      });
      client.sendSession({ aggregates: [{ started: "2026-10-18T00:00:00.000Z", crashed: 1 }] });
    });
    expect(sent).toContain('"type":"sessions"');
    expect(sent).toContain('"errored":2');
    expect(sent).toContain('"crashed":1');
    expect(sent).toContain('"release":"sentry-privacy-regression"');
    expectNothingSensitive(sent);
  });
});
