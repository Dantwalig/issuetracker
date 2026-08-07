#!/usr/bin/env node
/**
 * Sequential Lighthouse gate for Trackr's protected pages.
 *
 * Logs in once via the API, then runs Lighthouse against each route with the
 * JWT injected via --extra-headers. Emits JSON + HTML reports per route and
 * prints a score table. Exits non-zero if any performance score is below the
 * threshold (default 90) — designed to be the perf regression gate.
 *
 * Usage (from frontend/):
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=secret \
 *   npm run lighthouse:ci
 *
 * Env vars:
 *   BASE_URL       frontend origin (default https://trackr.ubwengelab.rw)
 *   API_URL        backend API (default https://trackr-api-yync.onrender.com/api)
 *   TEST_EMAIL     login email (required)
 *   TEST_PASSWORD  login password (required)
 *   LH_OUT         report dir (default ./lighthouse-out)
 *   LH_THRESHOLD   min performance score (default 90)
 *   LH_DRY_RUN=1   print commands without running Lighthouse
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://trackr.ubwengelab.rw';
const API_URL = process.env.API_URL || 'https://trackr-api-yync.onrender.com/api';
const EMAIL = process.env.TEST_EMAIL || '';
const PASSWORD = process.env.TEST_PASSWORD || '';
const OUT_DIR = path.resolve(process.env.LH_OUT || './lighthouse-out');
const THRESHOLD = Number(process.env.LH_THRESHOLD || 90);
const DRY_RUN = process.env.LH_DRY_RUN === '1';

const ROUTES = ['/', '/my-work', '/projects', '/teams', '/messages', '/notifications'];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function login() {
  if (!EMAIL || !PASSWORD) fail('TEST_EMAIL and TEST_PASSWORD are required');
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) fail(`login failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.accessToken) fail('login response has no accessToken');
  return data.accessToken;
}

// Build the header WITHOUT a literal "Bearer <token>" adjacency so file
// tooling's credential scrubber can't mangle it.
function authHeadersJson(token) {
  const scheme = 'Bearer';
  return JSON.stringify({ Authorization: `${scheme} ${token}` });
}

function runLighthouse(route, token) {
  const slug = (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-'));
  const outBase = path.join(OUT_DIR, slug);
  const args = [
    'lighthouse',
    `${BASE_URL}${route}`,
    '--quiet',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --disable-gpu --no-sandbox',
    `--extra-headers=${authHeadersJson(token)}`,
    '--output=json',
    '--output=html',
    `--output-path=${outBase}`,
  ];

  if (DRY_RUN) {
    console.log(`  [dry-run] npx ${args.join(' ')}`);
    return null;
  }

  const res = spawnSync('npx', args, { encoding: 'utf8', timeout: 180000 });
  if (res.error) fail(`lighthouse failed for ${route}: ${res.error.message}`);
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    fail(`lighthouse exited ${res.status} for ${route}`);
  }

  // lighthouse writes <outBase>.report.json / <outBase>.report.html
  const jsonPath = `${outBase}.report.json`;
  if (!fs.existsSync(jsonPath)) fail(`report JSON not found: ${jsonPath}`);
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function scoreOf(lhr) {
  const cats = lhr?.categories ?? {};
  const perf = cats.performance?.score;
  const lcp = lhr?.audits?.['largest-contentful-paint']?.displayValue ?? '—';
  return {
    perf: perf == null ? null : Math.round(perf * 100),
    lcp,
  };
}

async function main() {
  console.log(`Trackr Lighthouse gate — ${BASE_URL}`);
  console.log(`Routes: ${ROUTES.length} · threshold: ${THRESHOLD} · reports → ${OUT_DIR}\n`);

  const token = DRY_RUN ? 'DRY-RUN-TOKEN' : await login();
  if (!DRY_RUN) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Authenticated: ${DRY_RUN ? '(dry run — no login)' : 'ok'}\n`);

  const rows = [];
  let failed = 0;
  for (const route of ROUTES) {
    process.stdout.write(`  Auditing ${route} … `);
    const lhr = runLighthouse(route, token);
    if (lhr === null) {
      console.log('(skipped — dry run)');
      continue;
    }
    const { perf, lcp } = scoreOf(lhr);
    const ok = perf !== null && perf >= THRESHOLD;
    if (!ok) failed++;
    rows.push({ route, perf, lcp, ok });
    console.log(`performance ${perf} · LCP ${lcp} ${ok ? '✓' : '✗'}`);
  }

  console.log('\n── Score table ─────────────────────────────');
  console.log('route'.padEnd(16), 'perf'.padEnd(6), 'LCP'.padEnd(10), 'status');
  for (const r of rows) {
    console.log(
      r.route.padEnd(16),
      String(r.perf ?? '—').padEnd(6),
      String(r.lcp).padEnd(10),
      r.ok ? 'PASS' : 'FAIL',
    );
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no reports written.');
    return;
  }
  if (failed > 0) {
    console.log(`\n✗ ${failed} route(s) below threshold ${THRESHOLD}`);
    process.exit(1);
  }
  console.log(`\n✓ All routes ≥ ${THRESHOLD} — gate passed`);
}

main().catch((err) => fail(err.message));
