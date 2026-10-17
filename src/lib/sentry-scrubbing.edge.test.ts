// @vitest-environment node
import { describe, it } from "vitest";
import { captureEnvelopes, expectNothingSensitive, loadSentryBuild } from "@/test/sentry-envelopes";

describe("Sentry edge SDK with this project's options (#1033, F05)", () => {
  it("sends errors and streamed spans without capability links, PII or credentials", async () => {
    expectNothingSensitive(await captureEnvelopes(await loadSentryBuild("edge")));
  });
});
