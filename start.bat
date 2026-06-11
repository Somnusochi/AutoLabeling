@echo off
echo Starting AutoLabeling...
echo.

start "Backend" cmd /c "cd backend && .venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
start "Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo [NOTE] VLM and SAM models are lazy-loaded.
echo They will appear as 'Unloaded' in the web UI until your first detection.
echo.
echo Press Ctrl+C in each window to stop.
pause
