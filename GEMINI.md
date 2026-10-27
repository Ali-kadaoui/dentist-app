# Dentist App — Workspace Guidelines & Rules

## Project Stack & Startup Routine

Whenever starting a session or beginning work on this project, **always ensure the development stack is running first**:

1. **Quick Startup Script:**
   - Execute `.\start.ps1 -NoBrowser` from the repository root.
   - Core services:
     - **Docker Database:** `dentist-db` PostgreSQL (:5433 -> 5432) via `docker compose up -d db`.
     - **Local .NET 8 Backend API:** Host process on `:8080` (`dentist backend` -> `dotnet run`).
     - **FastAPI SMS Gateway:** Host process on `:8000` (`sms\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`).
     - **Vite React Frontend:** Host process on `:5173` (`dentist front` -> `npm run dev`).

2. **Endpoints & Topology:**
   - Frontend Dashboard: `http://localhost:5173/`
   - .NET Backend API: `http://localhost:8080/` (proxied by Vite)
   - SMS Gateway: `http://localhost:8000/` (OpenAPI spec at `http://localhost:8000/openapi.json`)
   - Database: PostgreSQL container on port `5433`

3. **Prompt Optimization & Velocity Rules:**
   - Automatically parse, expand, and optimize every user prompt into an actionable technical plan.
   - Execute end-to-end without unnecessary delay or redundant questions.

4. **Code Intelligence (CodeGraph):**
   - Repository is indexed with CodeGraph in `.codegraph/`.
   - Prefer `codegraph explore "<query>"` before grep/find when locating symbols and dynamic hops.

5. **Shutdown:**
   - Run `.\stop.ps1` to stop the host frontend, backend, and SMS services when done.
