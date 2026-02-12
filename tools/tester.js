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
  const timeoutMs = Number(process.env.TEST_TIMEOUT_MS ?? "30000");

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    const base = ADMIN_URL.replace(/\/+$/, "");
    const loginUrl = base + "/auth";
    const usersUrl = base + "/admin/users";

    // auto-confirm dialogs
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // =========================
    // LOGIN
    // =========================
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASS);

    // submit через Enter (надёжнее click)
    await page.locator('input[type="password"]').press("Enter");

    await page.waitForLoadState("networkidle");

    // проверка что ушли со страницы логина
    const stillOnLogin = await page
      .locator('text="Sign in or create an account"')
      .first()
      .isVisible()
      .catch(() => false);

    if (stillOnLogin) {
      throw new Error("LoginFailed");
    }


    // =========================
    // ORG SELECT (реальный рабочий)
    // =========================
    
    const orgHeader = page.locator('text="Выберите организацию"');
    
    const onOrgScreen = await orgHeader
      .isVisible()
      .catch(() => false);
    
    if (onOrgScreen) {
      const select = page.locator("select").first();
      await select.waitFor({ state: "visible" });
    
      const options = select.locator("option");
      const count = await options.count();
    
      let valueToSelect = null;
    
      for (let i = 0; i < count; i++) {
        const value = await options.nth(i).getAttribute("value");
        if (value && value.trim() !== "") {
          valueToSelect = value;
          break;
        }
      }
    
      if (!valueToSelect) {
        throw new Error("OrgSelectFailed");
      }
    
      // выбрать org
      await select.selectOption(valueToSelect);
    
      // принудительно триггерим change
      await select.dispatchEvent("change");
    
      // нажать продолжить
      const continueBtn = page.locator('button:has-text("Продолжить")');
      await continueBtn.click();
    
      // ждём исчезновение guard-экрана
      await orgHeader.waitFor({ state: "detached", timeout: 30000 });
    
      await page.waitForLoadState("networkidle");
    }
    

    // =========================
    // USERS PAGE (жёсткий переход)
    // =========================
    
    // иногда selector остаётся на той же странице → принудительно идём в users
    await page.goto(usersUrl, { waitUntil: "domcontentloaded" });
    
    // ждём либо таблицу, либо сообщение “нет данных”
    await page.waitForFunction(() => {
      return (
        document.querySelector("tbody tr") ||
        document.body.innerText.includes("No users") ||
        document.body.innerText.includes("Users")
      );
    }, { timeout: 30000 });

    // =========================
    // FIND TARGET
    // =========================
    const row = page.locator(`tbody tr:has-text("${DELETE_TARGET_EMAIL}")`);
    const count = await row.count();

    if (count === 0) {
      throw new Error(`TargetNotFound: ${DELETE_TARGET_EMAIL}`);
    }

    // =========================
    // DELETE
    // =========================
    await row.first().locator('button:has-text("Delete")').click();

    await page.waitForTimeout(2000);

    // =========================
    // VERIFY
    // =========================
    const stillThere = await page
      .locator(`tbody tr:has-text("${DELETE_TARGET_EMAIL}")`)
      .count();

    if (stillThere !== 0) {
      throw new Error("RecordsNotDeleted");
    }

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
