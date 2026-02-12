const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const OpenAI = require("openai");

const ROOT = path.resolve(__dirname, "..");
const TOOLS_DIR = path.join(ROOT, "tools");
const LOG_PATH = path.join(TOOLS_DIR, "autofix.log");
const REPORT_PATH = path.join(TOOLS_DIR, "test_report.json");
const TEMPLATE_PATH = path.join(TOOLS_DIR, "codex_prompt_template.txt");
const APPLY_PATCH_PATH = path.join(ROOT, "apply_patch.pyw");

const MAX_ITERS = Number.parseInt(process.env.MAX_ITERS || "5", 10);
const SLEEP_SECONDS = Number.parseInt(process.env.SLEEP_SECONDS || "120", 10);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.2-codex";

function now() { return new Date().toISOString(); }

function log(message) {
  const line = `[${now()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`, "utf8");
}

function run(command, args, options = {}) {
  const cwd = options.cwd || ROOT;
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  if (result.stdout) {
    const out = result.stdout.trim();
    if (out) log(`[stdout] ${out}`);
  }
  if (result.stderr) {
    const err = result.stderr.trim();
    if (err) log(`[stderr] ${err}`);
  }
  return result;
}

function sleep(seconds) {
  const ms = Math.max(0, seconds) * 1000;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readTestReportStrict() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(`Required report file not found: ${REPORT_PATH}`);
  }
  return fs.readFileSync(REPORT_PATH, "utf8");
}

function buildPrompt(reportJsonText) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Prompt template not found: ${TEMPLATE_PATH}`);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  return template.replace("{{TEST_ERROR_JSON}}", reportJsonText);
}

async function requestApplyPatch(promptText) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({ model: MODEL, input: promptText });

  const text = response.output_text || "";
  if (!text.trim()) throw new Error("Codex returned empty output");

  const match = text.match(/###FILE:\s*apply_patch\.pyw\s*\r?\n([\s\S]*?)\r?\n###END/);
  if (!match) throw new Error("Codex output does not contain required apply_patch.pyw block");

  return match[1];
}

function writeApplyPatch(content) {
  fs.writeFileSync(APPLY_PATCH_PATH, content, "utf8");
  log("Updated apply_patch.pyw from Codex response");
}

function runApplyPatch() {
  const pyLauncher = run("py", ["-3.13", APPLY_PATCH_PATH], { cwd: ROOT });
  if (pyLauncher.status === 0) return;

  log("py -3.13 failed, trying python");
  const pyFallback = run("python", [APPLY_PATCH_PATH], { cwd: ROOT });
  if (pyFallback.status !== 0) throw new Error("apply_patch.pyw execution failed");
}

function runGitFlow() {
  run("git", ["add", "."], { cwd: ROOT });

  const commit = run("git", ["commit", "-m", "update project"], { cwd: ROOT });
  if (commit.status !== 0) {
    const combined = `${commit.stdout || ""}\n${commit.stderr || ""}`;
    if (!/nothing to commit|no changes added to commit/i.test(combined)) {
      throw new Error("git commit failed");
    }
    log("No git changes to commit, continuing");
  }

  const pull = run("git", ["pull", "origin", "main", "--rebase"], { cwd: ROOT });
  if (pull.status !== 0) throw new Error("git pull --rebase failed");

  const push = run("git", ["push", "origin", "main"], { cwd: ROOT });
  if (push.status !== 0) throw new Error("git push failed");
}

function runSupabaseFlow() {
  const supaRoot = process.platform === "win32" ? "C:\\WindowQuote" : ROOT;
  const commands = [
    ["npx", ["supabase", "link", "--project-ref", "twfxhvodkgfbbixmsclp"]],
    ["npx", ["supabase", "db", "push", "--include-all"]],
    ["npx", ["supabase", "migration", "list"]],
  ];

  for (const [cmd, args] of commands) {
    const result = run(cmd, args, { cwd: supaRoot });
    if (result.status !== 0) throw new Error(`Supabase command failed: ${cmd} ${args.join(" ")}`);
  }
}

async function main() {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  log(`Starting orchestrator MAX_ITERS=${MAX_ITERS} SLEEP_SECONDS=${SLEEP_SECONDS} MODEL=${MODEL}`);

  for (let iter = 1; iter <= MAX_ITERS; iter++) {
    log(`Iteration ${iter}/${MAX_ITERS}: running tester`);
    const testResult = run("node", [path.join("tools", "tester.js")], { cwd: ROOT });

    if (testResult.status === 0) {
      log("PASS");
      process.exit(0);
    }

    log("Tester failed; reading tools/test_report.json");
    const reportJson = readTestReportStrict();
    const prompt = buildPrompt(reportJson);

    log("Requesting updated apply_patch.pyw from Codex");
    const applyPatchCode = await requestApplyPatch(prompt);
    writeApplyPatch(applyPatchCode);

    log("Running apply_patch.pyw");
    runApplyPatch();

    log("Running git flow");
    runGitFlow();

    log("Running supabase flow");
    runSupabaseFlow();

    log(`Sleeping ${SLEEP_SECONDS}s`);
    sleep(SLEEP_SECONDS);
  }

  log("FAIL: reached MAX_ITERS without PASS");
  process.exit(1);
}

main().catch((e) => {
  log(`FATAL: ${e && e.message ? e.message : String(e)}`);
  process.exit(1);
});
