<#
.SYNOPSIS
    End-to-end smoke test for the dentist dashboard.

.DESCRIPTION
    Exercises health, patients (including the problem/progress state log),
    date-only appointments, the dashboard summary, the appointment reminder
    queue, and the SMS history.
    The SMS assertions tolerate both an online modem (send succeeds, the message
    is stored) and an offline gateway (send returns a problem+json 503 and
    nothing is stored), so the script is safe to run on any machine.

.EXAMPLE
    .\smoke.ps1
    # -> compose stack through nginx (http://localhost:8081)

.EXAMPLE
    .\smoke.ps1 -BaseUrl http://localhost:5080
    # -> `dotnet run` on the host

.NOTES
    Exits 1 when an expectation fails. Created data stays in the database.
#>
[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:8081'
)

$ErrorActionPreference = 'Stop'
$script:failures = 0

function Send([string]$Method, [string]$Path, $Body) {
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 6)
    }

    try {
        $response = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $response.Content }
    }
    catch {
        $response = $_.Exception.Response
        $status = 0
        $body = ''

        if ($null -ne $response) {
            $status = [int]$response.StatusCode

            try {
                if ($response.GetType().GetMethod('GetResponseStream')) {
                    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                    $body = $reader.ReadToEnd()
                    $reader.Dispose()
                }
                elseif ($null -ne $response.Content) {
                    $body = $response.Content.ReadAsStringAsync().Result
                }
            }
            catch {
                $body = $_.Exception.Message
            }
        }

        return [pscustomobject]@{ Status = $status; Body = $body }
    }
}

function Check([string]$Name, [bool]$Condition, [string]$Detail) {
    if ($Condition) {
        Write-Host ("PASS  {0}  {1}" -f $Name, $Detail) -ForegroundColor Green
    }
    else {
        Write-Host ("FAIL  {0}  {1}" -f $Name, $Detail) -ForegroundColor Red
        $script:failures++
    }
}

Write-Host "Smoke test against $BaseUrl" -ForegroundColor Cyan

# --- health ---------------------------------------------------------------
$health = Send 'GET' '/health' $null
Check 'health' ($health.Status -eq 200) $health.Body

$ready = Send 'GET' '/health/ready' $null
Check 'health/ready' ($ready.Status -eq 200 -and $ready.Body -match '"database":"up"') $ready.Body

# --- patients -------------------------------------------------------------
$bad = Send 'POST' '/api/patients' @{ firstName = 'Bad'; lastName = 'Phone'; phone = '12345' }
Check 'reject invalid phone' ($bad.Status -eq 400 -and $bad.Body -match 'errors') $bad.Body

$phone = '+2126' + (Get-Random -Minimum 10000000 -Maximum 99999999)
$created = Send 'POST' '/api/patients' @{
    firstName = 'Smoke'
    lastName  = 'Test'
    phone     = $phone
    email     = 'smoke@example.ma'
}
$patient = $null
if ($created.Status -eq 201) { $patient = $created.Body | ConvertFrom-Json }
Check 'create patient' ($created.Status -eq 201 -and $patient.id) $created.Body

if (-not $patient) {
    Write-Host 'Cannot continue without a patient.' -ForegroundColor Red
    exit 1
}

$search = Send 'GET' '/api/patients?search=Smoke&pageSize=5' $null
$found = $search.Body | ConvertFrom-Json
Check 'search patient' ($search.Status -eq 200 -and $found.total -ge 1) ("total={0}" -f $found.total)

# --- patient state (problem / progress) -----------------------------------
$state = Send 'POST' ("/api/patients/{0}/states" -f $patient.id) @{
    problem  = 'Smoke test: pain on the lower left molar.'
    progress = 'Temporary filling placed; root canal planned.'
}
$stateRow = $state.Body | ConvertFrom-Json
Check 'create patient state' ($state.Status -eq 201 -and $stateRow.progress) $state.Body

$stateList = Send 'GET' ("/api/patients/{0}/states" -f $patient.id) $null
$states = @($stateList.Body | ConvertFrom-Json)
Check 'list patient states' ($stateList.Status -eq 200 -and $states.Count -ge 1) `
    ("count={0}" -f $states.Count)

# --- appointments ---------------------------------------------------------
$date = [DateTime]::UtcNow.Date.AddDays(1)
$booked = Send 'POST' '/api/appointments' @{
    patientId = $patient.id
    date      = $date.ToString('yyyy-MM-dd')
}
$appointment = $booked.Body | ConvertFrom-Json
$expectedDate = $date.ToString('yyyy-MM-dd')
Check 'book appointment' ($booked.Status -eq 201 -and $appointment.date -eq $expectedDate) $booked.Body

$schedule = Send 'GET' '/api/appointments?pageSize=10' $null
$appointments = $schedule.Body | ConvertFrom-Json
Check 'list appointments' ($schedule.Status -eq 200 -and $appointments.total -ge 1 -and $appointments.items[0].patientName) `
    ("total={0} patientName={1}" -f $appointments.total, $appointments.items[0].patientName)

# --- dashboard ------------------------------------------------------------
$summary = Send 'GET' '/api/dashboard/summary' $null
$dashboard = $summary.Body | ConvertFrom-Json
Check 'dashboard summary' ($summary.Status -eq 200 -and $dashboard.totalPatients -ge 1 -and $dashboard.upcomingAppointments -ge 1) $summary.Body

# --- sms ------------------------------------------------------------------
$probe = Send 'GET' '/api/sms/gateway' $null
Check 'gateway probe' ($probe.Status -eq 200) $probe.Body

$sent = Send 'POST' '/api/sms' @{ appointmentId = $appointment.id; message = 'Smoke test: rappel de rendez-vous.' }
$delivered = $sent.Status -eq 201
Write-Host ("INFO  sms send  {0} {1}" -f $sent.Status, $sent.Body) -ForegroundColor Yellow
Check 'sms send answered' (($sent.Status -in 201, 422, 502, 503, 504)) ("status={0}" -f $sent.Status)

$history = Send 'GET' '/api/sms?page=1&pageSize=50' $null
$messages = $history.Body | ConvertFrom-Json
$storedRow = @($messages.items) | Where-Object { $_.appointmentId -eq $appointment.id } | Select-Object -First 1
Check 'sms history' ($history.Status -eq 200 -and (($null -ne $storedRow -and $storedRow.message -like 'Smoke test*') -or -not $delivered)) `
    ("total={0} stored={1}" -f $messages.total, [bool]$storedRow)

# --- appointment reminders -------------------------------------------------
$dueResponse = Send 'GET' '/api/sms/reminders/due?horizonDays=30' $null
$due = @($dueResponse.Body | ConvertFrom-Json)
$dueRow = $due | Where-Object { $_.appointmentId -eq $appointment.id } | Select-Object -First 1
Check 'due reminder renders template' ($dueResponse.Status -eq 200 -and (($null -ne $dueRow -and $dueRow.message -notmatch '\{[a-zA-Z]+\}') -or $delivered)) `
    ("message={0} alreadySent={1}" -f @($dueRow)[0].message, $delivered)

$reminderSend = Send 'POST' '/api/sms/reminders/send' @{ appointmentId = $appointment.id }
Write-Host ("INFO  reminder send  {0} {1}" -f $reminderSend.Status, $reminderSend.Body) -ForegroundColor Yellow
Check 'reminder send answered' (($reminderSend.Status -in 201, 422, 502, 503, 504)) ("status={0}" -f $reminderSend.Status)

$dueAfter = Send 'GET' '/api/sms/reminders/due?horizonDays=30' $null
$dueItemsAfter = @($dueAfter.Body | ConvertFrom-Json)
$stillDue = $dueItemsAfter | Where-Object { $_.appointmentId -eq $appointment.id }
Check 'reminder queue tracks stored messages' ((($reminderSend.Status -eq 201) -and ($null -eq $stillDue)) -or (($reminderSend.Status -ne 201) -and ($null -ne $stillDue))) `
    ("sendStatus={0} stillDue={1}" -f $reminderSend.Status, [bool]$stillDue)

Write-Host ''
if ($script:failures -eq 0) {
    Write-Host 'All checks passed.' -ForegroundColor Green
    exit 0
}

Write-Host ("{0} check(s) failed." -f $script:failures) -ForegroundColor Red
exit 1
