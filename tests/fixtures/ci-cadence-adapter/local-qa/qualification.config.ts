import { defineConfig, devices } from '@playwright/test';
import { E2E_MCP_SECRET } from '../../../../e2e/fixtures/mcp-secret';

const origin = process.env.CI_CADENCE_QA_APP_ORIGIN;
if (process.env.CI_CADENCE_LOCAL_QA !== '1' || !origin || !process.env.CI_CADENCE_ARTIFACT_MANIFEST) throw Error('owned local qualification handoff required');
const app = new URL(origin);
if (app.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname) || !app.port || app.origin !== origin) throw Error('loopback qualification required');
const selection = [
  '**/tests/fixtures/ci-cadence-adapter/local-qa/auth-proof.spec.ts',
  '**/tests/fixtures/ci-cadence-adapter/local-qa/artifact-smoke.spec.ts',
  '**/e2e/release-required-local.spec.ts',
];
export default defineConfig({
  testDir: '../../../..',
  testMatch: selection,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: origin, storageState: undefined, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'cadence-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', locale: 'en-US' } },
    { name: 'cadence-mobile', use: { ...devices['Pixel 7'], channel: 'chrome', locale: 'en-US' } },
  ],
  webServer: {
    command: `npm run start -- --port ${app.port}`,
    url: `${origin}/api/health/live`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'pipe',
    env: { PLAYWRIGHT_TEST_ORIGIN: origin, MCP_API_SECRET: E2E_MCP_SECRET },
  },
});
