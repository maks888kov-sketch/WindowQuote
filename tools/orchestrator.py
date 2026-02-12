import os
import re
import json
import time
import subprocess
from pathlib import Path

from openai import OpenAI

# ----------------- НАСТРОЙКИ -----------------
PROJECT_DIR = Path(r"C:\WindowQuote")
APPLY_PATCH = PROJECT_DIR / "apply_patch.pyw"

# Тестер пока можешь сделать любым exe/ps1. Главное: exit code 0=pass, 1=fail и пишет report.
TEST_CMD = [str(PROJECT_DIR / "tools" / "tester.exe")]  # поменяй под себя
TEST_REPORT = PROJECT_DIR / "tools" / "test_report.json"

MAX_ITERS = 5
SLEEP_SECONDS = 120

# Git команды (ровно как ты писал)
GIT_CMDS = [
    ["git", "add", "."],
    ["git", "commit", "-m", "update project"],
    ["git", "pull", "origin", "main", "--rebase"],
    ["git", "push", "origin", "main"],
]

# Supabase команды (ровно как ты писал)
SUPABASE_CMDS = [
    ["npx", "supabase", "link", "--project-ref", "twfxhvodkgfbbixmsclp"],
    ["npx", "supabase", "db", "push", "--include-all"],
    ["npx", "supabase", "migration", "list"],
]

# Шаблон запроса к Codex: он ДОЛЖЕН вернуть только apply_patch.pyw целиком
PROMPT_TEMPLATE = """\
Любые изменения в проекте оформляй ТОЛЬКО через файл apply_patch.pyw.
Запрещено: диффы, инструкции, ручные правки. Разрешено: только полный код apply_patch.pyw.

Отвечай ТОЛЬКО в таком формате:

###FILE: apply_patch.pyw
<полный код файла apply_patch.pyw целиком>
###END

Задача: исправить проблему по ошибке тестера ниже.

Ошибка тестера:
{test_error}

Требование:
После применения apply_patch.pyw и запуска приложения/кликов (если нужно) тест должен пройти.
apply_patch.pyw должен создавать директории если их нет и раскладывать/обновлять файлы в нужных местах.
"""

# Модель: возьми кодекс-ориентированную. В документах встречается codex-тюненная модель. :contentReference[oaicite:2]{index=2}
MODEL_NAME = os.getenv("OPENAI_CODE_MODEL", "gpt-5.2-codex")

# ----------------- УТИЛИТЫ -----------------
def run(cmd, cwd=PROJECT_DIR, check=True):
    print(">", " ".join(cmd))
    p = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True)
    if p.stdout:
        print(p.stdout)
    if p.stderr:
        print(p.stderr)
    if check and p.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd} (code={p.returncode})")
    return p.returncode, p.stdout, p.stderr

def run_tester():
    code, out, err = run(TEST_CMD, cwd=PROJECT_DIR, check=False)

    # Вытащим "ошибку" для промпта:
    # 1) если есть JSON-репорт — берём оттуда
    # 2) иначе — берём stderr/stdout
    test_error = ""
    if TEST_REPORT.exists():
        try:
            data = json.loads(TEST_REPORT.read_text(encoding="utf-8"))
            test_error = json.dumps(data, ensure_ascii=False, indent=2)
        except Exception:
            test_error = (err or out or "").strip()
    else:
        test_error = (err or out or "").strip()

    return code, test_error

def extract_apply_patch(text: str) -> str:
    m = re.search(r"###FILE:\s*apply_patch\.pyw\s*\n(.*?)\n###END", text, re.S)
    if not m:
        raise ValueError("Codex response does not contain apply_patch.pyw in required format.")
    return m.group(1)

def write_apply_patch(code: str):
    APPLY_PATCH.write_text(code, encoding="utf-8")
    print(f"Wrote: {APPLY_PATCH}")

def run_apply_patch():
    # Запускаем патчер. Если у тебя .pyw ассоциирован — можно просто открыть, но так надёжнее.
    # pythonw обычно без консоли, python с консолью. Возьмём python.
    run(["python", str(APPLY_PATCH)], cwd=PROJECT_DIR, check=True)

def codex_generate_apply_patch(test_error: str) -> str:
    client = OpenAI()
    prompt = PROMPT_TEMPLATE.format(test_error=test_error)

    # Responses API: POST /v1/responses с Bearer auth. :contentReference[oaicite:3]{index=3}
    resp = client.responses.create(
        model=MODEL_NAME,
        input=prompt,
    )

    # Соберём весь текстовый вывод
    out_text = ""
    for item in resp.output:
        if item.type == "message":
            for c in item.content:
                if c.type == "output_text":
                    out_text += c.text

    if not out_text.strip():
        raise RuntimeError("Empty response from model.")
    return out_text

def git_push():
    for c in GIT_CMDS:
        # commit может падать если нет изменений — тогда пропускаем
        if c[:2] == ["git", "commit"]:
            code, _, _ = run(c, check=False)
            if code != 0:
                print("git commit skipped (no changes?)")
                continue
        else:
            run(c, check=True)

def supabase_push():
    # Важно: выполняем из PROJECT_DIR
    for c in SUPABASE_CMDS:
        run(c, cwd=PROJECT_DIR, check=True)

# ----------------- ОСНОВНОЙ ЦИКЛ -----------------
def main():
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("Set OPENAI_API_KEY env var.")

    for i in range(1, MAX_ITERS + 1):
        print(f"\n=== ITERATION {i}/{MAX_ITERS} ===")
        test_code, test_error = run_tester()

        if test_code == 0:
            print("TEST PASS. Done.")
            # Тут можно отправить email (SMTP) — добавим после, когда будет тестер.
            return 0

        print("TEST FAIL. Sending to Codex...")
        codex_text = codex_generate_apply_patch(test_error)
        patch_code = extract_apply_patch(codex_text)
        write_apply_patch(patch_code)

        print("Running apply_patch.pyw...")
        run_apply_patch()

        print("Running git push...")
        git_push()

        print("Running supabase push...")
        supabase_push()

        print(f"Sleeping {SLEEP_SECONDS}s...")
        time.sleep(SLEEP_SECONDS)

    print("FAILED: max iterations reached.")
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
