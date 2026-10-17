import { describe, it } from "vitest";
import { CAPABILITY, captureEnvelopes, expectNothingSensitive, loadSentryBuild } from "@/test/sentry-envelopes";

describe("Sentry browser SDK with this project's options (#1033, F05)", () => {
  it("sends errors and streamed spans without capability links, PII or credentials", async () => {
    const sent = await captureEnvelopes(await loadSentryBuild("client"), () => {
      // The browser SDK reads the request from the page itself.
      window.history.pushState({}, "", `/booking/${CAPABILITY}/return?token=X&PayerID=Y`);
      document.cookie = "session=secret-cookie; Path=/";
    });
    document.cookie = "session=; Max-Age=0; Path=/";

    expectNothingSensitive(sent);
  });
});
