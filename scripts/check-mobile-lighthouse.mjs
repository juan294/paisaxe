import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_THROTTLING = {
  rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5,
  downloadThroughputKbps: 1474.5600000000002, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4,
};
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const median = values => [...values].sort((a, b) => a - b)[1];
const invalid = detail => { throw new Error('Invalid mobile Lighthouse report: ' + detail); };

function route(value) {
  if (typeof value !== 'string') invalid('URL must be a string');
  let url;
  try { url = new URL(value); } catch { invalid('URL'); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/immersive' || url.search || url.hash || url.username || url.password) invalid('route URL');
  return url.href;
}

/** Validate all three raw measurements before calculating independent metric medians. */
export function evaluateMobileReports(reports) {
  if (!Array.isArray(reports) || reports.length !== 3) throw new Error('Exactly three mobile Lighthouse reports required');
  const timestamps = new Set();
  const values = reports.map(report => {
    if (!report || typeof report !== 'object' || report.runtimeError) invalid('runtime error');
    if (typeof report.fetchTime !== 'string' || !Number.isFinite(Date.parse(report.fetchTime))) invalid('timestamp');
    const timestamp = Date.parse(report.fetchTime);
    if (timestamps.has(timestamp)) throw new Error('Three distinct reports required; duplicate run timestamp');
    timestamps.add(timestamp);
    if (typeof report.lighthouseVersion !== 'string' || !/^\d+\.\d+\.\d+/.test(report.lighthouseVersion) ||
      report.lighthouseVersion !== reports[0].lighthouseVersion) invalid('mixed or missing version');
    const url = route(report.requestedUrl);
    if (url !== route(reports[0].requestedUrl) || route(report.finalDisplayedUrl ?? report.finalUrl) !== url ||
      (report.finalUrl !== undefined && route(report.finalUrl) !== url)) invalid('redirected or mixed route URL');
    const settings = report.configSettings;
    if (settings?.formFactor !== 'mobile' || settings.throttlingMethod !== 'simulate' ||
      settings.disableStorageReset !== false || settings.screenEmulation?.mobile !== true ||
      settings.screenEmulation.disabled !== false || settings.screenEmulation.width !== 412 ||
      settings.screenEmulation.height !== 823 || settings.screenEmulation.deviceScaleFactor !== 1.75) invalid('default mobile settings');
    for (const key of ['blockedUrlPatterns', 'onlyAudits', 'skipAudits', 'precomputedLanternData', 'extraHeaders']) {
      const override = settings[key];
      if (override !== undefined && override !== null &&
        !(Array.isArray(override) && override.length === 0)) invalid('measurement settings override: ' + key);
    }
    for (const [key, expected] of Object.entries(MOBILE_THROTTLING)) {
      const actual = settings.throttling?.[key];
      if (!numeric(actual) || Math.abs(actual - expected) > 1e-8) invalid('default slow4G/4x throttling');
    }
    const performance = report.categories?.performance?.score;
    const lcp = report.audits?.['largest-contentful-paint'];
    const tbt = report.audits?.['total-blocking-time'];
    if (!numeric(performance) || performance > 1 || !numeric(lcp?.numericValue) || !numeric(tbt?.numericValue) ||
      lcp.errorMessage || tbt.errorMessage || lcp.scoreDisplayMode === 'error' || tbt.scoreDisplayMode === 'error') invalid('metric or audit error');
    return { performance, lcp: lcp.numericValue, tbt: tbt.numericValue };
  });
  const result = Object.fromEntries(['performance', 'lcp', 'tbt'].map(key => [key, median(values.map(value => value[key]))]));
  const failures = [];
  if (result.performance < 0.7) failures.push('performance median must be >= 0.7');
  if (result.lcp > 4000) failures.push('LCP median must be <= 4000ms');
  if (result.tbt >= 500) failures.push('TBT median must be < 500ms');
  if (failures.length) throw new Error(failures.join('; '));
  return result;
}

function readReports(directory) {
  if (!lstatSync(directory).isDirectory()) throw new Error('Lighthouse report directory required');
  return readdirSync(directory).filter(name => /^lhr-\d+\.json$/.test(name)).sort().map(name => {
    const path = join(directory, name);
    if (!lstatSync(path).isFile()) throw new Error('Regular Lighthouse report required');
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw new Error('Invalid Lighthouse JSON report: ' + name); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !process.argv[2]) throw new Error('One Lighthouse report directory required');
    console.log(JSON.stringify(evaluateMobileReports(readReports(process.argv[2]))));
  } catch (error) {
    console.error('Mobile Lighthouse gate failed: ' + error.message);
    process.exitCode = 1;
  }
}
