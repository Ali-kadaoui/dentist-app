# Dentist API

Minimal ASP.NET Core (`net10.0`) Web API for the dentist dashboard.
It owns the clinic data in PostgreSQL and is the only service that talks to the
Python **SMS gateway** (FastAPI + Huawei modem). No authentication layer yet -
see the roadmap in `../ARCHITECTURE.md`.

## Requirements

- .NET SDK 10.0.100 or newer (`dotnet --list-sdks`)
- PostgreSQL 16+ (or the `db` service from `../docker-compose.yml`: `docker compose up -d db`)
- The SMS gateway running on its own port, by default `http://127.0.0.1:8000`

## Configuration

`appsettings.json` holds safe defaults; override them per environment:

| Setting | Environment variable | Default |
| --- | --- | --- |
| `ConnectionStrings:Postgres` | `ConnectionStrings__Postgres` | `Host=localhost;Port=5432;Database=dentist;Username=postgres;Password=postgres` |
| `Cors:AllowedOrigins` | `Cors__AllowedOrigins` | `http://localhost:5173` (comma separated) |
| `SmsGateway:BaseUrl` | `SmsGateway__BaseUrl` | `http://127.0.0.1:8000` |
| `SmsGateway:ApiKey` | `SmsGateway__ApiKey` | empty (header omitted) |
| `SmsGateway:TimeoutSeconds` | `SmsGateway__TimeoutSeconds` | `40` |
| `SmsGateway:MaxMessageLength` | `SmsGateway__MaxMessageLength` | `160` |
| `Database:MigrateOnStartup` | `Database__MigrateOnStartup` | `true` in Development, `true` in compose |

Never commit production credentials: use user-secrets locally
(`dotnet user-secrets set "ConnectionStrings:Postgres" "..."`) or environment
variables in containers.

## First run

```powershell
# 1. Restore + tooling
dotnet restore
dotnet tool install --global dotnet-ef   # once per machine

# 2. Create a migration (only when the model changes; all three are committed)
dotnet ef migrations add <Name>

# 3. Apply it (skip when Database:MigrateOnStartup is true)
dotnet ef database update

# 4. Run
dotnet run
# -> http://localhost:5080  (launch profile)
```

Migrations are applied at startup when `Database:MigrateOnStartup` is true: it
defaults to `true` in `Development` (only when at least one migration exists)
and is set to `true` for the compose `api` service, so an empty volume
provisions itself.

## Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | PostgreSQL connectivity |
| GET | `/api/dashboard/summary` | Counters (`totalPatients`, `appointmentsToday`, `upcomingAppointments`, `messages`) |
| GET | `/api/patients?search=&page=1&pageSize=25` | Paged, case-insensitive search |
| GET | `/api/patients/{id}` | Single patient |
| POST | `/api/patients` | Create patient (E.164 phone required) |
| PUT | `/api/patients/{id}` | Update patient |
| GET | `/api/patients/{id}/states` | Problem/progress log |
| POST | `/api/patients/{id}/states` | Add a `{problem, progress}` entry |
| DELETE | `/api/patients/{id}/states/{stateId}` | Delete an entry |
| GET | `/api/appointments?from=&to=&page=&pageSize=` | Agenda window (`from`/`to` are dates) |
| GET | `/api/appointments/{id}` | Single appointment |
| POST | `/api/appointments` | Book a visit (`{patientId, date}` with `date` as `yyyy-MM-dd`) |
| DELETE | `/api/appointments/{id}` | Delete a visit (its message cascades) |
| GET | `/api/sms/reminders/due?horizonDays=30` | Appointments without a message |
| POST | `/api/sms/reminders/send` | Send one appointment's reminder (`{appointmentId, message?}`) |
| GET | `/api/sms?page=&pageSize=` | Message history (patient name joined) |
| POST | `/api/sms` | Send (and store) an appointment message |
| GET | `/api/sms/gateway` | Proxy of the gateway health probe |

Lists return `{ items, page, pageSize, total, totalPages }`.
Errors are RFC 9457 `application/problem+json` documents, exactly like the
Python gateway, with an extra `code` extension
(e.g. `GATEWAY_UNREACHABLE`, `MODEM_BUSY`, `GATEWAY_TIMEOUT`).

### Example

```powershell
# An appointment is a patient plus a date; nothing else.
$patient = (Invoke-RestMethod http://localhost:5080/api/patients).items[0]

$appointment = Invoke-RestMethod -Method Post -Uri http://localhost:5080/api/appointments `
  -ContentType 'application/json' `
  -Body (@{ patientId = $patient.id; date = '2026-11-03' } | ConvertTo-Json)

# Every message is appointment-linked and carries only its text.
Invoke-RestMethod -Method Post -Uri http://localhost:5080/api/sms `
  -ContentType 'application/json' `
  -Body (@{ appointmentId = $appointment.id; message = 'Rappel: rendez-vous le 3 novembre.' } | ConvertTo-Json)
```

## Layout

```
Program.cs                 composition root (DI, pipeline, CORS, HttpClient)
Common/                    PagedResult, E.164 normalization
Contracts/                 request/response records per feature
Domain/Entities/           Patient, PatientState, Appointment, SmsMessage
Data/                      DbContext + IEntityTypeConfiguration mappings
Endpoints/                 minimal-API route groups (one file per feature)
Infrastructure/Sms/        typed client for the Python gateway
```

## Notes

- Phone numbers are stored in E.164; the modem rejects anything else.
- `Appointments` holds `Id`, `PatientId` and `Date` only. No time, duration,
  reason, note or status column exists, and `AppointmentStatus` is gone.
- `PatientStates` holds `Problem` and `Progress` only - no `CreatedAt`.
- `SmsMessages` holds `AppointmentId` + `Message` only. The recipient is
  `Appointment.Patient.Phone`, so no phone or patient name is duplicated. The
  `AppointmentId` index is unique: one message per appointment.
- A message row is written **after** the gateway accepts it. "No row" therefore
  means "not sent", which is exactly what the reminder queue queries; a failed
  send returns a problem document and stores nothing.
- Messages are limited to a single GSM-7 segment (160 chars) because the gateway
  does not implement concatenation yet.
- Template tokens `{firstName}`, `{lastName}` and `{date}` are rendered
  server-side. There is no `{time}` or `{reason}` token because appointments are
  date-only.
- `Treatments` no longer exists: clinical history lives in the per-patient
  problem/progress log.

## Verification

```powershell
docker compose build api                       # SDK 10.0 image, dotnet publish
./smoke.ps1 -BaseUrl http://localhost:8080     # 16 checks, exit 0
```

The script also passes against the compose stack
(`-BaseUrl http://localhost:8081`); see `../ARCHITECTURE.md` for the full
verification table and known limitations.
