using Dentist.Api.Common;
using Dentist.Api.Contracts.Sms;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Dentist.Api.Infrastructure.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dentist.Api.Endpoints;

public static class SmsEndpoints
{
    public static IEndpointRouteBuilder MapSmsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sms").WithTags("Sms");

        group.MapGet("", GetMessages);
        group.MapGet("/gateway", GetGatewayHealth);
        group.MapGet("/settings", GetSettings);
        group.MapPut("/settings", UpdateSettings);
        group.MapPost("/process-due", TriggerAutoReminders);
        group.MapPost("", SendSms);

        return app;
    }

    private static async Task<IResult> SendSms(
        SendSmsRequest request,
        DentistDbContext db,
        ISmsGatewayClient gateway,
        IOptions<SmsGatewayOptions> options,
        HttpContext http,
        CancellationToken cancellationToken)
    {
        if (request.AppointmentId is null || request.AppointmentId == Guid.Empty)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["appointmentId"] = ["AppointmentId is required."],
            });
        }

        var appointment = await db.Appointments
            .Include(candidate => candidate.Patient)
            .FirstOrDefaultAsync(candidate => candidate.Id == request.AppointmentId.Value, cancellationToken);

        if (appointment?.Patient is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["appointmentId"] = ["Appointment not found."],
            });
        }

        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            errors["message"] = ["The message cannot be empty."];
        }

        var message = (request.Message ?? string.Empty).Trim();
        var maxLength = options.Value.MaxMessageLength;

        if (message.Length > maxLength)
        {
            errors["message"] = [$"The message is {message.Length} characters; keep it under {maxLength}."];
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var outcome = await SmsDelivery.DeliverAsync(appointment, message, gateway, cancellationToken);

        if (!outcome.Succeeded)
        {
            return SmsDelivery.ToProblem(http, outcome);
        }

        var record = await SmsDelivery.RecordAsync(db, appointment.Id, message, cancellationToken);

        return Results.Created(
            $"/api/sms/{record.Id}",
            new SmsMessageResponse(
                record.Id,
                record.AppointmentId,
                SmsDelivery.PatientName(appointment),
                appointment.Date,
                record.Message));
    }

    private static async Task<IResult> GetMessages(
        DentistDbContext db,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var total = await db.SmsMessages.CountAsync(cancellationToken);

        var items = await db.SmsMessages
            .AsNoTracking()
            .OrderByDescending(message => message.Appointment.Date)
            .ThenBy(message => message.Appointment.Patient!.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(message => new SmsMessageResponse(
                message.Id,
                message.AppointmentId,
                message.Appointment.Patient!.FirstName + " " + message.Appointment.Patient.LastName,
                message.Appointment.Date,
                message.Message))
            .ToListAsync(cancellationToken);

        return Results.Ok(new PagedResult<SmsMessageResponse>(items, page, pageSize, total));
    }

    private static async Task<IResult> GetGatewayHealth(
        ISmsGatewayClient gateway,
        CancellationToken cancellationToken)
    {
        var health = await gateway.GetHealthAsync(probe: true, cancellationToken);

        return Results.Ok(health is null
            ? new GatewayHealthView("unavailable", null, null)
            : new GatewayHealthView(health.Status ?? "unknown", health.Transport, health.Modem));
    }

    private static async Task<IResult> GetSettings(
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var settings = await db.SmsSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new SmsSettings();
            db.SmsSettings.Add(settings);
            await db.SaveChangesAsync(cancellationToken);
        }

        var rules = settings.GetReminderRules()
            .Select(r => new SmsReminderRuleDto(r.DaysBefore, r.Time))
            .ToList();

        return Results.Ok(new SmsSettingsResponse(
            settings.AutoSendEnabled,
            settings.SendOnBooking,
            settings.SendReminderBefore,
            settings.DaysBefore,
            settings.SendHour,
            settings.SendMinute,
            settings.MaxReminders,
            rules,
            settings.ReminderTemplate,
            settings.BookingTemplate));
    }

    private static async Task<IResult> UpdateSettings(
        UpdateSmsSettingsRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var settings = await db.SmsSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new SmsSettings();
            db.SmsSettings.Add(settings);
        }

        settings.AutoSendEnabled = request.AutoSendEnabled;
        settings.SendOnBooking = request.SendOnBooking;
        settings.SendReminderBefore = request.SendReminderBefore;

        var validRules = new List<SmsReminderRule>();
        if (request.Reminders is not null && request.Reminders.Count > 0)
        {
            foreach (var rule in request.Reminders)
            {
                var days = Math.Clamp(rule.DaysBefore, 0, 30);
                var timeParts = (rule.Time ?? "18:00").Split(':');
                var hour = 18;
                var minute = 0;
                if (timeParts.Length >= 2 &&
                    int.TryParse(timeParts[0], out var h) &&
                    int.TryParse(timeParts[1], out var m))
                {
                    hour = Math.Clamp(h, 0, 23);
                    minute = Math.Clamp(m, 0, 59);
                }
                var cleanTime = $"{hour:D2}:{minute:D2}";
                validRules.Add(new SmsReminderRule(days, cleanTime));
            }
        }

        if (validRules.Count == 0)
        {
            var cleanHour = Math.Clamp(request.SendHour, 0, 23);
            var cleanMinute = Math.Clamp(request.SendMinute, 0, 59);
            validRules.Add(new SmsReminderRule(
                Math.Clamp(request.DaysBefore, 0, 30),
                $"{cleanHour:D2}:{cleanMinute:D2}"));
        }

        // Sort rules by days descending (e.g. 3 days before first, then 1 day before, etc.)
        validRules = validRules.OrderByDescending(r => r.DaysBefore).ThenBy(r => r.Time).ToList();

        settings.RemindersJson = System.Text.Json.JsonSerializer.Serialize(validRules);
        settings.MaxReminders = validRules.Count;
        settings.DaysBefore = validRules.Max(r => r.DaysBefore);
        var firstTimeParts = validRules[0].Time.Split(':');
        if (int.TryParse(firstTimeParts[0], out var fh)) settings.SendHour = fh;
        if (firstTimeParts.Length > 1 && int.TryParse(firstTimeParts[1], out var fm)) settings.SendMinute = fm;

        settings.ReminderTemplate = string.IsNullOrWhiteSpace(request.ReminderTemplate)
            ? settings.ReminderTemplate
            : request.ReminderTemplate.Trim();
        settings.BookingTemplate = string.IsNullOrWhiteSpace(request.BookingTemplate)
            ? settings.BookingTemplate
            : request.BookingTemplate.Trim();

        await db.SaveChangesAsync(cancellationToken);

        var responseRules = validRules
            .Select(r => new SmsReminderRuleDto(r.DaysBefore, r.Time))
            .ToList();

        return Results.Ok(new SmsSettingsResponse(
            settings.AutoSendEnabled,
            settings.SendOnBooking,
            settings.SendReminderBefore,
            settings.DaysBefore,
            settings.SendHour,
            settings.SendMinute,
            settings.MaxReminders,
            responseRules,
            settings.ReminderTemplate,
            settings.BookingTemplate));
    }

    private static async Task<IResult> TriggerAutoReminders(
        DentistDbContext db,
        ISmsGatewayClient gateway,
        IOptions<SmsGatewayOptions> options,
        CancellationToken cancellationToken)
    {
        var settings = await db.SmsSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null || !settings.AutoSendEnabled || !settings.SendReminderBefore)
        {
            return Results.Ok(new { processed = 0, message = "Auto-reminders are disabled." });
        }

        var rules = settings.GetReminderRules();
        if (rules.Count == 0)
        {
            return Results.Ok(new { processed = 0, message = "No reminder rules configured." });
        }

        DateTime nowLocal;
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Africa/Casablanca");
            nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        catch
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Morocco Standard Time");
                nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch
            {
                nowLocal = DateTime.UtcNow.AddHours(1);
            }
        }

        var today = DateOnly.FromDateTime(nowLocal);
        var maxHorizonDays = rules.Max(r => r.DaysBefore);
        var targetDate = today.AddDays(maxHorizonDays);

        var dueAppointments = await db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.SmsMessages)
            .Where(a => a.Date <= targetDate && a.Date >= today && a.SmsMessages.Count < rules.Count)
            .ToListAsync(cancellationToken);

        int sent = 0;
        int failed = 0;

        foreach (var appointment in dueAppointments)
        {
            if (appointment.Patient is null || string.IsNullOrWhiteSpace(appointment.Patient.Phone)) continue;

            // Don't send more than one message on the same day for the same appointment
            var alreadySentToday = appointment.SmsMessages.Any(m => DateOnly.FromDateTime(m.SentAt.AddHours(1)) == today);
            if (alreadySentToday) continue;

            var text = ReminderTemplate.Render(settings.ReminderTemplate, appointment.Patient, appointment);
            if (text.Length > options.Value.MaxMessageLength)
            {
                text = text[..options.Value.MaxMessageLength];
            }

            appointment.LastSmsAttemptAt = DateTime.UtcNow;

            var outcome = await SmsDelivery.DeliverAsync(appointment, text, gateway, cancellationToken);
            if (outcome.Succeeded)
            {
                appointment.LastSmsStatus = "SENT";
                appointment.LastSmsError = null;
                await SmsDelivery.RecordAsync(db, appointment.Id, text, cancellationToken);
                sent++;
            }
            else
            {
                appointment.LastSmsStatus = "FAILED";
                appointment.LastSmsError = $"[{outcome.ErrorCode}] {outcome.ErrorDetail}";
                await db.SaveChangesAsync(cancellationToken);
                failed++;
            }
        }

        return Results.Ok(new { sent, failed, total = dueAppointments.Count });
    }
}
