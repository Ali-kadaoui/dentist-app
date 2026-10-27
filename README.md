# Dentist Clinic Full-Stack Management System

A comprehensive clinic management platform featuring patient medical records, an odontogram dental chart, appointments agenda, clinical treatments ledger, billing/payments tracking, and an automated SMS reminder system powered by a dedicated hardware GSM modem gateway.

---

## 🏛 Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Public Landing Page    │
                          │     (dr-nadia-clinic)    │
                          │   React 19 + Tailwind    │
                          └──────────────────────────┘

┌────────────────────────┐      /api, /health       ┌────────────────────────┐
│  Admin Web Dashboard   │ ───────────────────────> │   Dentist Backend API  │
│    (dentist front)     │    JSON, RFC 9457        │   (.NET 8 Minimal API) │
│     React 19 + Vite    │                          │      Port 8080/5080    │
└────────────────────────┘                          └───────────┬────────────┘
                                                                │
                                        ┌───────────────────────┴───────────────────────┐
                                        │ EF Core 8/10                                  │ HTTP Client
                                        ▼                                               ▼
                         ┌─────────────────────────────┐                 ┌─────────────────────────────┐
                         │      PostgreSQL 16          │                 │     SMS Modem Gateway       │
                         │    (Docker Container)       │                 │     (sms/ FastAPI Service)  │
                         │      Port 5432/5433         │                 │         Port 8000           │
                         └─────────────────────────────┘                 └──────────────┬──────────────┘
                                                                                        │ AT Commands (COM)
                                                                                        ▼
                                                                         ┌─────────────────────────────┐
                                                                         │    Huawei E173 USB Modem    │
                                                                         └─────────────────────────────┘
```

---

## 📦 Project Structure

```
├── dentist backend/       # .NET 8/10 Minimal API with EF Core & PostgreSQL
├── dentist front/         # React 19 + Vite Admin Dashboard SPA
├── dr-nadia-clinic/       # React 19 + TypeScript + Tailwind CSS public showcase site
├── sms/                   # Python FastAPI service for USB GSM modem (Huawei E173)
├── docker-compose.yml     # Container definition for PostgreSQL db and production API
├── start.ps1 / start.bat  # Unified one-click startup scripts
├── stop.ps1 / stop.bat    # Unified shutdown scripts
├── smoke.ps1              # End-to-end API smoke test suite
├── .env.example           # Environment template with sanitized placeholders
└── ARCHITECTURE.md        # Deep-dive architectural specification
```

---

## 🚀 Prerequisites

Ensure the following tools are installed on your machine:
- **Docker Desktop** (for PostgreSQL database)
- **.NET SDK 8.0 or 10.0** (`dotnet --version`)
- **Node.js 20+ & npm 10+** (`node -v`, `npm -v`)
- **Python 3.11+** (`python --version`)

---

## ⚙️ Configuration

1. **Root Environment Settings:**
   Copy the provided root `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Adjust `POSTGRES_PASSWORD` and `POSTGRES_PORT` (use `5433` if port `5432` is occupied on your host).

2. **SMS Gateway Settings:**
   Copy `sms/.env.example` to `sms/.env`:
   ```bash
   cp sms/.env.example sms/.env
   ```
   Configure `AT_PORT` (e.g. `COM3` or `COM8`) matching your USB GSM modem.

3. **Frontend Settings (Optional):**
   Copy `dentist front/.env.example` to `dentist front/.env` if custom proxy routing is needed.

4. **Landing Page Settings (Optional):**
   Copy `dr-nadia-clinic/.env.example` to `dr-nadia-clinic/.env.local` to customize base URL or assets.

5. **Backend Settings (Optional):**
   Refer to `dentist backend/.env.example` if overriding PostgreSQL connection strings or SMS gateway options via environment variables.

---

## 🛠 Running the Application

### Option A: Unified PowerShell Launcher (Recommended)
Launch the local stack (PostgreSQL Docker container, .NET API, SMS Gateway, Vite Dashboard):
```powershell
.\start.ps1                         # Starts core services & Admin Dashboard (:5173)
.\start.ps1 -IncludeLandingPage     # Also starts Dr. Nadia Clinic showcase (:5174)
.\start.ps1 -NoBrowser              # Starts services without auto-opening browser
```
To stop all services:
```powershell
.\stop.ps1                          # Stops host dev processes (:5173, :5174, :8080, :8000)
.\stop.ps1 -IncludeDocker           # Also stops Docker containers (dentist-api, dentist-db)
```

### Option B: Docker Compose
Run the core database and containerized API:
```bash
docker compose up -d db     # Launch PostgreSQL database only
docker compose up --build   # Launch full containerized stack
```

### Option C: Manual Service Execution

1. **Database:**
   ```bash
   docker compose up -d db
   ```

2. **Backend API:**
   ```bash
   cd "dentist backend"
   dotnet restore
   dotnet run
   ```

3. **SMS Gateway:**
   ```bash
   cd sms
   python -m venv .venv
   .\.venv\Scripts\activate      # Windows (or source .venv/bin/activate on Linux)
   pip install -r requirements.txt
   uvicorn app.main:app --port 8000
   ```

4. **Admin Dashboard:**
   ```bash
   cd "dentist front"
   npm install
   npm run dev
   ```

5. **Landing Page:**
   ```bash
   cd dr-nadia-clinic
   npm install
   npm run dev
   ```

---

## 🧪 Verification & Smoke Testing

Run the automated smoke test suite to verify all backend API endpoints and database integrity:
```powershell
.\smoke.ps1 -BaseUrl http://localhost:8080
```

---

## 🔐 Security & Cleanliness Note

- **Never commit `.env` or sensitive credentials** to version control. All `.env` files are ignored by git.
- Build artifacts (`bin/`, `obj/`, `dist/`, `node_modules/`, `.venv/`, `__pycache__/`) and local caches (`.codegraph/`, `.agents/`) are strictly ignored across the repository.
