# Dentist dashboard - architecture

A small clinic workspace: patient files with a problem/progress log, an **Agenda**
of date-only appointments, and a **Messages** workspace that sends one SMS per
appointment. The UI is a Vite + React 19 SPA; a .NET 10 minimal API owns
PostgreSQL through EF Core; messages leave through the existing Python FastAPI
**SMS gateway** that drives a Huawei E173 modem.

> Status: re-verified end to end on 2026-10-18 with the .NET SDK 10 container
> images, Node 24 / npm 11, Docker Desktop and PostgreSQL 16.
> `docker compose build api web` succeeds, the three migrations applied
> (`InitialCreate` -> `SimplifyAppointmentsAndSms` -> `OnlyDateAndMessage`), the
> schema was inspected with `psql`, and `smoke.ps1` passed **16/16** checks on the
> API port (`:8080`) and through nginx (`:8081`). Only a live modem send is
> outstanding, because the modem is not attached to this machine.

## Topology

```
+----------------+   /api, /health   +------------------+   HttpClient   +--------------------+
|  React (Vite)  | ----------------> |  Dentist API     | -------------> | Python SMS gateway |
|  :5173 / :8081 |  JSON, RFC 9457   |  .NET 10, :5080  |  POST /send-sms| FastAPI, :8000     |
+----------------+                   +--------+---------+  GET /health   +---------+----------+
                                              | EF Core                            | AT commands
                                              v                                    v
                                     +------------------+                 +--------------------+
                                     |  PostgreSQL 16   |                 |  Huawei E173z-1    |
                                     | database:dentist |                 |  USB modem + SIM   |
                                     +------------------+                 +--------------------+
```

In development Vite proxies `/api` and `/health` to `http://localhost:5080`, so
the browser only ever sees one origin and CORS stays out of the way. In
containers nginx does the same against `http://api:8080`.

## Components

| Layer | Technology | Responsibility |
| --- | --- | --- |
| `dentist front/` | Vite 8, React 19, plain CSS | Agenda (dates only), patient files + state log, due-reminder queue / composer / message history |
| `dentist backend/` | ASP.NET Core 10 minimal APIs, EF Core 10, Npgsql | Domain rules, persistence, gateway client, problem details |
| `sms/` | Python 3.11+, FastAPI, pyserial | Stateless modem driver; one message at a time |
| PostgreSQL 16 | `postgres:16-alpine` | Durable clinic data |

The API is the only service that talks to the gateway: the browser never needs
the gateway API key, and the modem cannot be reached from a web page.

## Data model

Four tables, no billing concepts:

```
Patient 1 --- * PatientState             (problem + progress log)
Patient 1 --- * Appointment              (patient + one date)
Appointment 1 --- 0..1 SmsMessage        (AppointmentId unique: one message per visit)
```

| Entity | Columns | Notes |
| --- | --- | --- |
| `Patient` | `Id`, `FirstName`, `LastName`, `Phone` (E.164), `Email`, `DateOfBirth`, `Gender`, `Notes` | Identity and contact only |
| `PatientState` | `Id`, `PatientId`, `Problem`, `Progress` | What the patient came with and what has been done since; no timestamps |
| `Appointment` | `Id`, `PatientId`, `Date` (`date`) | One date and nothing else: no time, duration, reason, note or status |
| `SmsMessage` | `Id`, `AppointmentId` (required, unique), `Message` | The message text; the recipient is `Appointment.Patient.Phone` |

`Appointment.Date` is `DateOnly` -> PostgreSQL `date`, so booking is
timezone-free. Every primary key is a `Guid` (v4). There is no `CreatedAt`,
`UpdatedAt`, `SentAt` or status column anywhere: if a field is not shown in the
UI it is not stored. The `AppointmentStatus` and `SmsStatus` enums were deleted
together with the columns that used them, so the API serializes plain strings
and numbers only.

Indexes (6): `Patients(Phone)`, `Patients(LastName, FirstName)`,
`Appointments(Date)`, `Appointments(PatientId, Date)`, `PatientStates(PatientId)`
and `SmsMessages(AppointmentId)` **unique** (one message per appointment).

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | PostgreSQL connectivity |
| `GET` | `/api/dashboard/summary` | Counters (`totalPatients`, `appointmentsToday`, `upcomingAppointments`, `messages`) |
| `GET` | `/api/patients?search=&page=1&pageSize=25` | Paged, case-insensitive (ILIKE) search |
| `GET` | `/api/patients/{id}` | Single patient |
| `POST` | `/api/patients` | Create patient (E.164 phone required) |
| `PUT` | `/api/patients/{id}` | Update patient |
| `GET` | `/api/patients/{id}/states` | Problem/progress log |
| `POST` | `/api/patients/{id}/states` | Add a `{problem, progress}` entry |
| `DELETE` | `/api/patients/{id}/states/{stateId}` | Delete an entry |
| `GET` | `/api/appointments?from=&to=&page=&pageSize=` | Agenda window (`from`/`to` are dates) |
| `GET` | `/api/appointments/{id}` | Single appointment |
| `POST` | `/api/appointments` | Book a visit (`{patientId, date}` as `yyyy-MM-dd`) |
| `DELETE` | `/api/appointments/{id}` | Delete a visit (its message cascades) |
| `GET` | `/api/sms/reminders/due?horizonDays=30` | Appointments in the window that have no message |
| `POST` | `/api/sms/reminders/send` | Send the reminder for one appointment (`{appointmentId, message?}`) |
| `GET` | `/api/sms?page=&pageSize=` | Message history (patient name joined from the appointment) |
| `POST` | `/api/sms` | Send (and store) a message for an appointment |
| `GET` | `/api/sms/gateway` | Proxy of the gateway health probe |

Lists return `PagedResult<T>`: `{ items, page, pageSize, total, totalPages }`
(`totalPages` is derived, not stored) with `page` clamped to `>= 1` and
`pageSize` clamped per endpoint (`1..100`, `1..200` for appointments and SMS
history). Validation failures and exceptions use RFC 9457
`application/problem+json` with `traceId`, exactly like the Python gateway, plus
an optional `code` extension (`GATEWAY_UNREACHABLE`, `MODEM_BUSY`, ...), so the
React banner renders `describeError(error)` for both services through one code
path.

## Request flows

### Booking

```
Agenda -- POST /api/appointments {patientId, date: "yyyy-MM-dd"} --> API
       -- DELETE /api/appointments/{id}                         --> API
```

The date is a plain `yyyy-MM-dd` string (`DateOnly` on the API), so the browser
never converts it to an instant and a clinic in any time zone reads the same day.
Nothing else is asked for: the time of day, the reason and any follow-up are
agreed on the phone and recorded in the patient's problem/progress log.

### Appointment reminders (one per visit)

```
Messages page -- GET /api/sms/reminders/due?horizonDays=30 --> API
                       appointments with Date between today and today + horizon
                       and no SmsMessage row
                       message = ReminderTemplate.Default rendered with
                                 {firstName}, {lastName}, {date}
              -- POST /api/sms/reminders/send {appointmentId, message?} --> gateway
                       201 { id, appointmentId, patientName, date, message }
```

* One message per appointment is enforced by the unique
  `SmsMessages(AppointmentId)` index; the patient name and phone are read
  through `Appointment.Patient`, never copied onto the message row.
* Tokens are replaced server-side: `{firstName}`, `{lastName}` and `{date}`
  (`dd MMM yyyy`). There is no `{time}` or `{reason}` token because an
  appointment no longer carries those fields.
* The due query is a plain query, not a scheduler: opening the page after a
  weekend shows every appointment that still needs its reminder.
* A row exists only after the gateway accepted the message, so a failure leaves
  the appointment in the queue and the dentist simply sends again.

### Manual send

```
React -- POST /api/sms {appointmentId, message} --> API
                                                  1. load appointment + patient -> E.164
                                                  2. validate <= 160 chars
                                                  3. POST {gateway}/send-sms (X-API-Key)
                                                  4. 2xx -> insert/refresh the SmsMessage row
                                                       -> 201 { id, appointmentId, patientName, date, message }
                                                     error -> nothing stored
                                                       -> problem+json 422/502/503/504
```

* "No row" means "not sent": the due queue, the history and the dashboard all
  read the same table, so they can never disagree.
* Gateway errors keep their meaning: `MODEM_BUSY` / `MODEM_UNAVAILABLE` /
  `GATEWAY_UNREACHABLE` -> `503`, `MODEM_TIMEOUT` / `GATEWAY_TIMEOUT` -> `504`
  (with `Retry-After` when supplied), `SEND_REJECTED` -> `502`, invalid
  number/message -> `422`. The detail is returned in the problem document.
* There is no retry endpoint any more: a failed attempt stored nothing, so
  retrying is just sending again from the queue or the composer.
* The recipient is always `Appointment.Patient.Phone`: a message cannot exist
  without an appointment, so there are no free-number rows to clean up.

## Cross-cutting decisions

| Decision | Why |
| --- | --- |
| `DateOnly` for visits | An appointment is a calendar day; storing an instant forced every device to share a time zone and produced off-by-one-day rows |
| Four tables, no enums | Every column left is shown on screen; `AppointmentStatus` / `SmsStatus` went with the status columns they fed |
| No timestamp columns | The clinic books and sends; it never filters by "created at", so the columns only cost migrations |
| `Guid` primary keys | Ids can be minted client-side later; no sequence contention |
| Pagination envelope on every list | One `useAsyncData` hook drives patients, appointments, states and SMS history |
| Problem details everywhere | The React banner is source-agnostic; `traceId` matches container logs |
| One message per appointment | Matches the clinic workflow and lets the unique index prevent double sends |
| Due queue as a query | No cron, no scheduler state to lose; the page is the trigger |
| Message stored after the send | The table is a list of what actually left the modem; no `Failed` rows to explain |
| One gateway client, typed outcomes | Timeouts, 4xx and 5xx keep distinct status codes without throwing |
| No seed data | The shipped schema is empty so demo rows can never appear in a clinic database |

### Why the model kept shrinking (2026-10-18)

Three passes, each removing what no screen read:

1. **Reminders became appointment-driven.** `ReminderRules` was dropped and
   `SmsMessages` was reduced to appointment-linked rows (`AppointmentId`
   required and unique).
2. **Appointments became a date.** `StartsAt`/`EndsAt` (two dates) collapsed into
   a single `Date`; `Reason`, `Notes` and `Status` were dropped and the
   `AppointmentStatus` enum was deleted.
3. **Clinical notes and leftover columns went.** The `Treatments` table was
   deleted (the problem/progress log covers it), `SmsMessages` kept only
   `AppointmentId` + `Message`, and `PatientStates.CreatedAt` was removed.

Migration `OnlyDateAndMessage` renames `StartsAt` to `Date` (so existing rows keep
their day), drops the removed columns and the `Treatments` table, and replaces the
`PatientStates(PatientId, CreatedAt)` index with `(PatientId)`.

## Frontend surface

There is no router: `App.jsx` switches three views through `Sidebar`, which keeps
state alive per session and avoids adding a routing dependency.

| View | Component | Contents |
| --- | --- | --- |
| Agenda | `pages/AgendaPage.jsx` | 7/30/90-day chips, booking form (patient + date), one row per appointment (date, patient, delete) |
| Patients | `pages/PatientsPage.jsx` | Paged patient list, search, inline new-patient form, expandable problem/progress log |
| Messages | `pages/MessagesPage.jsx` | Gateway strip, due-reminder queue, composer (appointment + message), history (patient, date, message) |

Shared building blocks: `api/client.js` (fetch wrapper that turns problem+json
into a thrown `ApiError`), `api/dentistApi.js` (one function per route),
`hooks/useAsyncData.js` (loading/error/reload), `lib/format.js` (Intl date
formatting, `describeError` for problem details), `components/` (`PageHeader`,
`StatCard`, `Field`, `Notice`, `Sidebar`), and a single `styles.css` with CSS
variables - no UI framework.

## Repository layout

```
detist app/
+- docker-compose.yml          db + api + web, named volume, healthcheck
+- .env                        POSTGRES_PORT=5433 / POSTGRES_PASSWORD for this machine
+- smoke.ps1                   16-check end-to-end script (host or compose)
+- ARCHITECTURE.md
+- dentist backend/
|  +- Program.cs               composition root (DI, startup, CORS, problem details)
|  +- Common/                  PagedResult<T>, PhoneNumbers (E.164)
|  +- Contracts/               request/response records per feature
|  +- Domain/Entities/         Patient, PatientState, Appointment, SmsMessage
|  +- Data/                    DentistDbContext + IEntityTypeConfiguration per entity
|  +- Migrations/              InitialCreate, SimplifyAppointmentsAndSms, OnlyDateAndMessage
|  +- Endpoints/               one route group per feature
|  +- Infrastructure/Sms/      gateway client, template renderer, send outcome
|  +- Dockerfile               SDK build -> aspnet runtime, port 8080
+- dentist front/
   +- src/                     App, pages, components, hooks, api, lib, styles
   +- nginx.conf               /api + /health proxy, immutable assets, SPA fallback
   +- Dockerfile               npm ci + vite build -> nginx:alpine
```

## Running it

### Host (fastest loop)

```powershell
# 1. database (5433 keeps a local PostgreSQL on 5432 untouched)
docker compose up -d db

# 2. API (launch profile: http://localhost:5080)
cd "dentist backend"
dotnet run

# 3. SPA (Vite proxies /api and /health to :5080)
cd "dentist front"
npm install
npm run dev        # http://localhost:5173
```

The SMS gateway is optional in this loop: without it, `/api/sms/gateway` reports
`unreachable` and sends answer `503 GATEWAY_UNREACHABLE`, which is exactly what
the UI shows when the modem is unplugged.

### Compose

```powershell
docker compose build
docker compose up -d
# web      http://localhost:8081   (nginx -> api:8080, SPA fallback)
# api      http://localhost:8080   (direct, for debugging)
# db       localhost:5433          (POSTGRES_PORT from .env; 5432 when unset)
docker compose ps
docker compose logs -f api
```

* The `api` container sets `Database__MigrateOnStartup=true`, so a fresh volume
  provisions itself; re-creating a stopped stack does not re-run anything.
* `SMS_GATEWAY_BASE_URL` defaults to `http://host.docker.internal:8000`, because
  the gateway keeps the modem's COM port on the host.
* `POSTGRES_PORT` is the only knob that changes host ports; containers always
  talk over the compose network on 5432. The committed `.env` uses `5433`
  because this machine already runs PostgreSQL on 5432.

### Configuration

| Setting | Environment variable | Default |
| --- | --- | --- |
| `ConnectionStrings:Postgres` | `ConnectionStrings__Postgres` | `Host=localhost;Port=5432;Database=dentist;Username=postgres;Password=postgres` |
| `Cors:AllowedOrigins` | `Cors__AllowedOrigins` | `http://localhost:5173` (comma separated) |
| `SmsGateway:BaseUrl` | `SmsGateway__BaseUrl` | `http://127.0.0.1:8000` |
| `SmsGateway:ApiKey` | `SmsGateway__ApiKey` | empty (header omitted) |
| `SmsGateway:TimeoutSeconds` | `SmsGateway__TimeoutSeconds` | `40` |
| `SmsGateway:MaxMessageLength` | `SmsGateway__MaxMessageLength` | `160` |
| `Database:MigrateOnStartup` | `Database__MigrateOnStartup` | `true` in Development and compose |
| `POSTGRES_PASSWORD` | - | `postgres` (compose only) |
| `POSTGRES_PORT` | - | `5432` (compose only; `.env` sets `5433`) |
| `VITE_API_BASE_URL` | - | `/api` (same origin; Vite proxy in dev) |

## Smoke test

`smoke.ps1` is the shipping check; it only needs an HTTP endpoint:

```powershell
./smoke.ps1                                        # http://localhost:8081
./smoke.ps1 -BaseUrl http://localhost:8080          # direct to the API
```

It runs 16 checks. None depends on a live modem: the send assertions accept the
documented gateway error codes, and two `INFO` lines echo the SMS response. It
exits non-zero when a check fails.

| # | Check | What it proves |
| --- | --- | --- |
| 1-2 | `/health`, `/health/ready` | API up, PostgreSQL reachable |
| 3 | `POST /api/patients` invalid phone -> 400 | E.164 validation with a `phone` field error |
| 4-5 | create patient, search `Smoke` | patient round-trip, `total >= 1` |
| 6-7 | create + list patient state | `Problem`/`Progress` persisted and returned |
| 8-9 | book appointment, list appointments | `date` is `yyyy-MM-dd`, response carries `patientName` |
| 10 | dashboard summary | `totalPatients >= 1`, `upcomingAppointments >= 1` |
| 11 | gateway probe | proxied gateway health, `200` even when `unreachable` |
| 12 | manual send answered | `201` or a documented gateway status (422/502/503/504) |
| 13 | SMS history | a stored row matches the sent text when delivered; nothing is stored when the gateway is down |
| 14 | due queue | the appointment renders a message with no `{token}` left |
| 15 | reminder send answered | same tolerant status set as the manual send |
| 16 | reminder queue tracks stored messages | stored -> gone from the queue; failure -> still listed |

A `503` from the SMS block is a *pass*: the script asserts the API degrades
cleanly with no modem attached.

## Startup and migrations

`Program.cs` resolves the connection string, enables `MigrateOnStartup` in
Development and container environments and builds the typed gateway client with
a 40 s timeout. The container log after this change:

```
Applying migration '20261018134154_OnlyDateAndMessage'.
Now listening on: http://[::]:8080
```

Three migrations exist:

1. `20261017183334_InitialCreate` - the original schema (patients, appointments,
   treatments, SMS, reminder rules).
2. `20261018120805_SimplifyAppointmentsAndSms` - drops `ReminderRules`, trims the
   SMS columns, makes `AppointmentId` required and unique, converts the
   appointment columns to `date`, adds `PatientStates`.
3. `20261018134154_OnlyDateAndMessage` - renames `StartsAt` to `Date`, drops
   `EndsAt`/`Reason`/`Notes`/`Status`, drops the `Treatments` table, drops
   `SmsMessages.To`/`Status`/`ErrorDetail`/`SentAt`, drops
   `PatientStates.CreatedAt`.

There is no seeding, so a provisioned database is empty and the dashboard starts
at zero.

To reset a database (destroys all rows):

```powershell
docker compose down -v
docker compose up -d
```

## Verification

| Check | Command | Result |
| --- | --- | --- |
| API build | `docker compose build api` | `Dentist.Api -> /app/publish`, image built |
| Web build | `docker compose build web` | `vite build`, 27 modules, 12.4 kB CSS / 244 kB JS |
| Compose up | `docker compose up -d` | `dentist-db` healthy, `dentist-api` / `dentist-web` running |
| Migrations | `__EFMigrationsHistory` | `InitialCreate`, `SimplifyAppointmentsAndSms`, `OnlyDateAndMessage` |
| Schema | `information_schema.columns` | 4 tables (+ `__EFMigrationsHistory`); `Appointments(Id, PatientId, Date)`; `PatientStates(Id, PatientId, Problem, Progress)`; `SmsMessages(Id, AppointmentId, Message)`; no `Treatments` |
| Smoke (API) | `./smoke.ps1 -BaseUrl http://localhost:8080` | `All checks passed.` (16/16) |
| Smoke (nginx) | `./smoke.ps1 -BaseUrl http://localhost:8081` | `All checks passed.` (16/16) |
| Bundle | `curl http://localhost:8081/assets/index-*.js` | contains "Sorted by date", "Delete the appointment", "Due reminders", "Problem & progress"; no "Clinical notes", "treatments", "NoShow" |
| Gateway failure path | smoke's SMS block, no modem | `503 GATEWAY_UNREACHABLE`, nothing stored, appointment still due |

Sample of a first run (compose stack, freshly migrated database, modem absent):

```
PASS  create patient               201 {"id":"478cce87-...","firstName":"Smoke",...}
PASS  create patient state         201 {"problem":"Smoke test: pain...","progress":"Temporary filling placed..."}
PASS  book appointment             201 {"id":"...","patientId":"...","date":"2026-10-19"}
PASS  dashboard summary            {"totalPatients":1,"appointmentsToday":0,"upcomingAppointments":1,"messages":0}
PASS  gateway probe                {"status":"unreachable"}
INFO  sms send                     503 {"code":"GATEWAY_UNREACHABLE",...}
PASS  sms history                  total=0 stored=False
PASS  due reminder renders template message=Bonjour Smoke, rappel : votre rendez-vous au cabinet dentaire est prevu le 19 Oct 2026. Merci de confirmer.
INFO  reminder send                503 {"code":"GATEWAY_UNREACHABLE",...}
PASS  reminder queue tracks stored messages sendStatus=503 stillDue=True
All checks passed.
```

## Known limitations

* **No live modem in verification.** The Huawei E173 was not attached, so no real
  `+CMGS` exchange was observed end to end. A `201` send path is handled by the
  same code, but the final leg needs a machine with the modem.
* **Dates, not times.** An appointment has no time of day, so the agenda cannot
  sort two visits on the same day or warn about overlaps; the time is agreed by
  phone.
* **One message per appointment.** The unique index means a 7-day *and* a 1-day
  reminder for the same visit cannot coexist; stages would need a nullable offset
  column or a reminder-plan table plus a migration.
* **Failed sends leave no trace.** Rows are written after the gateway accepts the
  message, so an offline modem produces an error banner but no history entry.
  Add a delivery-attempt table if auditing failures becomes a requirement.
* **No authentication.** Anyone who reaches the API can read patient data and
  trigger SMS. It is intended for a single-machine clinic deployment behind the
  nginx port; add auth before exposing it.
* **Single SMS segment.** 160 characters, no concatenation, because the gateway
  sends one `+CMGS` at a time.
* **Pull-based reminders.** The due queue is a query, not a scheduler: messages
  go out when the SMS page is opened (or `/api/sms/reminders/send` is called).
* **No .NET test project.** Integration coverage is `smoke.ps1` plus the
  gateway's pytest suite; adding `Microsoft.AspNetCore.Mvc.Testing` tests is the
  natural next step.
* **No seed data.** A fresh install starts with an empty dashboard by design.

## Future work

1. Attach the modem and record a verified send (`201`) from the compose stack.
2. Add a background reminder runner (or a Windows service) that calls the same
   due/send endpoints, so reminders do not depend on someone opening the app.
3. Add authentication (clinic password or OIDC) and per-user audit.
4. Add API integration tests on top of `WebApplicationFactory`.
5. Revisit billing as an isolated module if the clinic ever needs it.
