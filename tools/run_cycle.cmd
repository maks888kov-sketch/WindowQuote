@echo off
setlocal
cd /d C:\WindowQuote

if "%OPENAI_API_KEY%"=="" (
  echo [ERROR] OPENAI_API_KEY is not set. Set it in environment variables and run again.
  exit /b 1
)

node tools\orchestrator.js
exit /b %ERRORLEVEL%
