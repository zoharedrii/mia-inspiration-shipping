@echo off
REM ====================================================
REM הפעלת המערכת - פותח שני חלונות PowerShell במקביל
REM   1. Backend  על פורט 3001
REM   2. Frontend על פורט 5173
REM
REM שימוש: לחיצה כפולה על הקובץ הזה
REM ====================================================

echo.
echo ============================================
echo   מייה אינספיריישן - הפעלת המערכת
echo ============================================
echo.

REM פתיחת חלון נפרד ל-Backend
start "Mia Backend" powershell -NoExit -Command "cd '%~dp0server'; Write-Host '*** Backend - פורט 3001 ***' -ForegroundColor Green; npm run dev"

REM המתנה קצרה כדי שה-Backend יתחיל
timeout /t 3 /nobreak > nul

REM פתיחת חלון נפרד ל-Frontend
start "Mia Frontend" powershell -NoExit -Command "cd '%~dp0client'; Write-Host '*** Frontend - פורט 5173 ***' -ForegroundColor Cyan; npm run dev"

echo.
echo שני השרתים מתחילים להפעלה...
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo המתיני 5-10 שניות, ואז פתחי בדפדפן: http://localhost:5173
echo.
echo כדי לעצור את המערכת - סגרי את שני החלונות שנפתחו.
echo.
pause
