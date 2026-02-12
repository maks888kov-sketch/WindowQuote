@echo off
cd /d C:\WindowQuote

REM Настрой один раз:
REM setx ADMIN_URL "https://your-admin.example.com"
REM setx ADMIN_EMAIL "user@example.com"
REM setx ADMIN_PASS "password"

node tools\tester.js
exit /b %errorlevel%
