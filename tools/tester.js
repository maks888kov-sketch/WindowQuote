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

  const ADMIN_URL = process.env.ADMIN_URL;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const DELETE_TARGET_EMAIL = process.env.DELETE_TARGET_EMAIL;

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

  if (!DELETE_TARGET_EMAIL) {
    writeReport({
      test_id: TEST_ID,
      ok: false,
      started_at: nowIso(),
      finished_at: nowIso(),
      duration_sec: 0,
      fail_reason: "MissingEnv",
      details: { required: ["DELETE_TARGET_EMAIL"] },
    });
    process.exit(1);
  }

  const headless = (process.env.TEST_HEADLESS ?? "1") === "1";
  const timeoutMs = Number(process.env.TEST_TIMEOUT_MS ?? "45000");

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  // ---- capture DELETE /api/admin/users/... response
  let deleteResp = null;
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (resp.request().method() === "DELETE" && url.includes("/api/admin/users/")) {
        const text = await resp.text().catch(() => "");
        deleteResp = { url, status: resp.status(), body: text.slice(0, 2000) };
      }
    } catch {
      // ignore capture errors
    }
  });

  try {
    const base = ADMIN_URL.replace(/\/+$/, "");
    const loginUrl = `${base}/auth`;
    const usersUrl = `${base}/admin/users`;

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // =========================
    // LOGIN
    // =========================
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASS);
    await page.locator('input[type="password"]').press("Enter");

    // логин подтверждаем НЕ по исчезновению формы, а по явным сигналам
    const signOutBtn = page.getByRole("button", { name: /sign out/i }).first();
    const toastSuccess = page.getByText(/Вход выполнен/i).first();
    const loggedAs = page.getByText(/Вы вошли как/i).first();

    // ждём любой сигнал до 30s
    await Promise.race([
      signOutBtn.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
      toastSuccess.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
      loggedAs.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
    ]);

    const loginOk = await Promise.all([
      signOutBtn.isVisible().catch(() => false),
      toastSuccess.isVisible().catch(() => false),
      loggedAs.isVisible().catch(() => false),
    ]);

    if (!loginOk.some(Boolean)) {
      throw new Error("LoginNotConfirmed");
    }

    // =========================
    // ORG SELECT (если есть)
    // =========================
    const orgScreenTitle = page.getByText(/Выберите организацию/i).first();
    const onOrgScreen = await orgScreenTitle.isVisible().catch(() => false);

    if (onOrgScreen) {
      const orgSelect = page.locator("select").first();
      await orgSelect.waitFor({ state: "visible", timeout: 30000 });

      const options = orgSelect.locator("option");
      const count = await options.count();

      let valueToSelect = null;
      for (let i = 0; i < count; i++) {
        const value = await options.nth(i).getAttribute("value");
        if (value && value.trim() !== "") {
          valueToSelect = value;
          break;
        }
      }
      if (!valueToSelect) throw new Error("OrgSelectFailed");

      await orgSelect.selectOption(valueToSelect);
      await orgSelect.dispatchEvent("change");

      const continueBtn = page
        .locator('button:has-text("Продолжить"), button:has-text("Continue"), button[type="submit"]')
        .first();
      await continueBtn.click();

      // НЕ ждём смену URL. Ждём исчезновение org-экрана ИЛИ появление nav Admin.
      const adminNav = page.locator('a:has-text("Admin")').first();

      await Promise.race([
        orgScreenTitle.waitFor({ state: "detached", timeout: 30000 }).catch(() => {}),
        adminNav.waitFor({ state: "visible", timeout: 30000 }).catch(() => {}),
      ]);
    }

    // =========================
    // USERS PAGE
    // =========================
    await page.goto(usersUrl, { waitUntil: "domcontentloaded" });

    // На твоём скрине есть "All users"
    await page.getByText(/All users/i).first().waitFor({ state: "visible", timeout: 45000 });

    // допускаем что пользователей может быть 0, но tbody должен существовать
    await page.locator("tbody").first().waitFor({ state: "visible", timeout: 45000 });

    // =========================
    // FIND TARGET
    // =========================
    const targetRow = page.locator(`tbody tr:has-text("${DELETE_TARGET_EMAIL}")`).first();
    const hasTarget = (await targetRow.count()) > 0;

    if (!hasTarget) {
      throw new Error(`TargetNotFound: ${DELETE_TARGET_EMAIL}`);
    }

    // =========================
    // DELETE
    // =========================
    await targetRow.locator('button:has-text("Delete")').click();

    // ждём исчезновение строки (это и есть критерий)
    await page
      .locator(`tbody tr:has-text("${DELETE_TARGET_EMAIL}")`)
      .first()
      .waitFor({ state: "detached", timeout: 45000 });

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
      details: {
        error: String(e && e.message ? e.message : e),
        deleteResp, // <-- добавлено
      },
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
