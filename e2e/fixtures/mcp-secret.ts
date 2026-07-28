/**
 * The MCP secret shared by the Playwright runner and the app under test.
 *
 * 16 of the 31 probes in mcp.spec.ts used to skip whenever MCP_API_SECRET was
 * unset, which in CI was always — so more than half of the MCP surface had
 * never actually been exercised while the suite reported green.
 *
 * Supplying a fixed dummy value to both processes removes the reason to skip.
 * It is not a credential: the authenticated paths reach upstreams that are
 * unconfigured in test environments, so the probes assert routing, validation
 * and auth behaviour rather than live upstream results. A real MCP_API_SECRET
 * in the environment still wins, so nothing is forced on a configured run.
 */
export const E2E_MCP_SECRET =
  process.env.MCP_API_SECRET?.trim() || "dummy_mcp_secret_for_e2e";
