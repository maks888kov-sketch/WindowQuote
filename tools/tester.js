// tools/tester.js
// Запуск: node tools/tester.js
// Выход: 0 PASS, 1 FAIL
// Артефакты: tools/test_report.json, tools/test_artifacts/fail.png

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const ROOT = __dirname;
const REPORT_PATH = path.join(ROOT, "test_report.json");
const ART_DIR = path.join(ROOT, "test_artifacts");
const FAIL_PNG = path.join(ART_DIR, "fail.png");

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function writeReport(obj) {
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(obj, null, 2), "utf8");
}

async function main() {
  const TEST_ID = "ADMIN_DELETE_RECORDS";
  const started = Date.now();

  // Настройки через env (не хардкодь логин/пароль)
  const ADMIN_URL = process.env.ADMIN_URL;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_URL || !ADMIN_EMAIL || !ADMIN_PASS) {
    writeReport({
      test_id: TEST_ID,
      ok: false,
      started_at: nowIso(),
      finished_at: nowIso(),
      duration_sec: 0,
      fail_reason: "MissingEnv",
      details: { required: ["ADMIN_URL", "ADMIN_EMAIL", "ADMIN_PASS"] },
    });
    process.exit(1);
  }

  const headless = (process.env.TEST_HEADLESS ?? "1") === "1";
  const timeoutMs = Number(process.env.TEST_TIMEOUT_MS ?? "20000");

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    // =========================
    // TODO: TEST STEPS HERE
    // =========================

    // 1) Открыть админку
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });

    // 2) Логин (селекторы под себя!)
    await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();

    // 3) Дождаться загрузки
    await page.waitForLoadState("networkidle");

    // !!! Сейчас тест специально падает, пока ты не вставишь реальные шаги удаления + проверку.
    throw new Error("TesterNotImplemented: fill TODO block with delete + assert logic.");

    // =========================
    // END TODO
    // =========================

  } catch (e) {
    try {
      fs.mkdirSync(ART_DIR, { recursive: true });
      await page.screenshot({ path: FAIL_PNG, fullPage: true });
    } catch {}

    writeReport({
      test_id: TEST_ID,
      ok: false,
      started_at: new Date(started).toISOString(),
      finished_at: nowIso(),
      duration_sec: Math.round((Date.now() - started) / 1000),
      fail_reason: "FAIL",
      details: { error: String(e && e.message ? e.message : e) },
      artifacts: { screenshot: FAIL_PNG },
    });

    await context.close();
    await browser.close();
    process.exit(1);
  }

  writeReport({
    test_id: TEST_ID,
    ok: true,
    started_at: new Date(started).toISOString(),
    finished_at: nowIso(),
    duration_sec: Math.round((Date.now() - started) / 1000),
  });

  await context.close();
  await browser.close();
  process.exit(0);
}

main();
