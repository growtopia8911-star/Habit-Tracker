// End-to-end check of SPEC.md § Acceptance criteria → Auth.
// Drives the installed Chrome against a local server. Usage:
//   node auth.test.mjs [baseURL]

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:8765/";
const stamp = Date.now();
// Not @example.com — Supabase rejects reserved domains with email_address_invalid.
// Nothing is ever sent here: with mailer_autoconfirm on, no mail leaves Supabase.
const EMAIL = `habit.test.${stamp}@gmail.com`;
const PASSWORD = `pw-${stamp}-Aa1!`;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  if (!ok) failures.push(`${name}\n      expected ${expected}, got ${actual}`);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
}

async function state(page) {
  await page.waitForSelector('body[data-ready="true"]', { timeout: 15000 });
  return {
    login: await page.locator("#screen-login").isVisible(),
    today: await page.locator("#screen-today").isVisible(),
    error: (await page.locator("#auth-error").isVisible())
      ? await page.locator("#auth-error").textContent()
      : null,
    fatal: (await page.locator("#fatal").isVisible())
      ? await page.locator("#fatal").textContent()
      : null,
  };
}

// The app routes on an async auth event, so the screen swap lands a tick after
// the click. Waiting on the destination beats a fixed sleep.
async function waitForToday(page) {
  await page.locator("#screen-today").waitFor({ state: "visible", timeout: 15000 });
}
async function waitForError(page) {
  await page.locator("#auth-error").waitFor({ state: "visible", timeout: 15000 });
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext();
const page = await context.newPage();

// The wrong-password step deliberately provokes a 400 from Supabase's token
// endpoint, and Chrome logs every failed request to the console whether or not
// the app handled it. Ignoring that ONE expected failure keeps the check
// meaningful — anything else still fails the suite.
const EXPECTED = /\/auth\/v1\/token\?grant_type=password/;
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (EXPECTED.test(m.text()) || EXPECTED.test(m.location()?.url ?? "")) return;
  consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

// Requests that already came back OK. Reloading the page tears down their
// connections afterwards, and Chrome reports that teardown as ERR_ABORTED —
// the harness cancelling itself, not a fault. Sign-out hits this every run:
// /auth/v1/logout answers 204, then the reload aborts it.
const succeeded = new Set();
page.on("response", (r) => {
  if (r.status() < 400) succeeded.add(r.url());
  else if (!EXPECTED.test(r.url())) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`);
});
page.on("requestfailed", (r) => {
  const why = r.failure()?.errorText ?? "unknown";
  if (why === "net::ERR_ABORTED" && succeeded.has(r.url())) return;
  consoleErrors.push(`requestfailed: ${r.url()} (${why})`);
});

console.log(`\nTesting ${BASE}`);
console.log(`Account:  ${EMAIL}\n`);

try {
  // --- 6. Visiting the URL signed out shows Login and no habit data ---------
  console.log("Signed out");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  let s = await state(page);
  check("visiting signed out shows Login", s.login, true);
  check("visiting signed out shows no habit data", s.today, false);
  check("no fatal connection error", s.fatal, null);

  // --- 1. Sign up creates an account and lands on Today --------------------
  console.log("\nSign up");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("#sign-up");
  await waitForToday(page);
  s = await state(page);
  check("signing up lands on Today", s.today, true);
  check("signing up hides Login", s.login, false);
  check(
    "Today names the signed-in account",
    await page.locator("#signed-in-as").textContent(),
    `Signed in as ${EMAIL}`
  );

  // --- 4. Refreshing while signed in stays signed in ------------------------
  console.log("\nRefresh while signed in");
  await page.reload({ waitUntil: "domcontentloaded" });
  s = await state(page);
  check("refresh keeps the session", s.today, true);
  check("refresh does not show Login", s.login, false);

  // --- 5. Signing out returns to Login -------------------------------------
  console.log("\nSign out");
  // The UI returns to Login the moment the local session is cleared, which is
  // before the server-side revocation call comes back. Reloading in that window
  // aborts a request that already succeeded, so wait for it to land first —
  // otherwise the suite reports a failure it caused itself.
  const logoutLanded = page
    .waitForResponse((r) => r.url().includes("/auth/v1/logout"), { timeout: 15000 })
    .catch(() => null);
  await page.click("#sign-out");
  await page.locator("#screen-login").waitFor({ state: "visible", timeout: 15000 });
  await logoutLanded;
  s = await state(page);
  check("signing out returns to Login", s.login, true);
  check("signing out hides Today", s.today, false);

  await page.reload({ waitUntil: "domcontentloaded" });
  s = await state(page);
  check("refresh after sign out does not sneak back in", s.today, false);

  // --- 3. Wrong password shows an error and stays on Login -----------------
  console.log("\nWrong password");
  await page.fill("#email", EMAIL);
  await page.fill("#password", "definitely-not-the-password");
  await page.click("#sign-in");
  await waitForError(page);
  s = await state(page);
  check("wrong password stays on Login", s.login, true);
  check("wrong password does not reach Today", s.today, false);
  check("wrong password shows an error", s.error, "Wrong email or password.");

  // --- 2. Correct password lands on Today ----------------------------------
  console.log("\nSign in with the correct password");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("#sign-in");
  await waitForToday(page);
  s = await state(page);
  check("correct password lands on Today", s.today, true);
  check("correct password clears the earlier error", s.error, null);

  // --- console hygiene -----------------------------------------------------
  console.log("\nConsole");
  check("no console or page errors", consoleErrors.join(" | ") || "none", "none");
} catch (err) {
  fail++;
  failures.push(`THREW: ${err.message}`);
  console.log(`  FAIL  threw: ${err.message}`);
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail ? 1 : 0);
