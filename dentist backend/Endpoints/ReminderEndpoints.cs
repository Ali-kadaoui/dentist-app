using Dentist.Api.Contracts.Sms;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Dentist.Api.Infrastructure.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dentist.Api.Endpoints;

/// <summary>
/// Appointment reminders. Every appointment gets at most one reminder, addressed
/// to the patient on file; the queue is simply "appointments without a message".
/// </summary>
public static class ReminderEndpoints
{
    public static IEndpointRouteBuilder MapReminderEndpoints(this IEndpointRouteBuilder app)
    {
        var reminders = app.MapGroup("/api/sms/reminders").WithTags("Sms");

        reminders.MapGet("/due", GetDueReminders);
        reminders.MapPost("/send", SendReminder);

        return app;
    }

    /// <summary>
    /// Appointments in the horizon without a reminder. <paramref name="horizonDays"/>
    /// limits how far ahead the UI looks.
    /// </summary>
    private static async Task<IResult> GetDueReminders(
        DentistDbContext db,
        int horizonDays = 30,
        CancellationToken cancellationToken = default)
    {
        horizonDays = Math.Clamp(horizonDays, 0, 120);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var horizonEnd = today.AddDays(horizonDays);

        var settings = await db.SmsSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var activeTemplate = string.IsNullOrWhiteSpace(settings?.ReminderTemplate)
            ? ReminderTemplate.Default
            : settings.ReminderTemplate;

        var rules = settings?.GetReminderRules() ?? [new SmsReminderRule(1, "18:00")];
        var maxReminders = Math.Max(1, rules.Count);

        var appointments = await db.Appointments
            .AsNoTracking()
            .Include(appointment => appointment.Patient)
            .Include(appointment => appointment.SmsMessages)
            .Where(appointment =>
                appointment.Date >= today &&
                appointment.Date <= horizonEnd &&
                appointment.SmsMessages.Count < maxReminders)
            .OrderBy(appointment => appointment.Date)
            .ThenBy(appointment => appointment.Patient!.LastName)
            .ToListAsync(cancellationToken);

        var due = appointments
            .Where(appointment => appointment.Patient is not null &&
                                  !appointment.SmsMessages.Any(m => DateOnly.FromDateTime(m.SentAt.AddHours(1)) == today))
            .Select(appointment =>
            {
                var sentCount = appointment.SmsMessages.Count;
                var sortedRules = rules.OrderByDescending(r => r.DaysBefore).ToList();

                var targetRule = sentCount < sortedRules.Count
                    ? sortedRules[sentCount]
                    : sortedRules.Last();

                var candidateDate = appointment.Date.AddDays(-targetRule.DaysBefore);
                if (candidateDate < today)
                {
                    var upcomingRule = sortedRules
                        .Where(r => appointment.Date.AddDays(-r.DaysBefore) >= today)
                        .LastOrDefault();

                    if (upcomingRule is not null)
                    {
                        targetRule = upcomingRule;
                        candidateDate = appointment.Date.AddDays(-targetRule.DaysBefore);
                    }
                    else
                    {
                        candidateDate = today;
                    }
                }

                return new DueReminderResponse(
                    appointment.Id,
                    appointment.PatientId,
                    $"{appointment.Patient!.FirstName} {appointment.Patient.LastName}".Trim(),
                    appointment.Patient.Phone,
                    appointment.Date,
                    candidateDate,
                    targetRule.Time,
                    ReminderTemplate.Render(activeTemplate, appointment.Patient, appointment),
                    appointment.LastSmsStatus,
                    appointment.LastSmsError,
                    appointment.LastSmsAttemptAt);
            })
            .OrderBy(r => r.NextSendDate)
            .ThenBy(r => r.NextSendTime)
            .ToList();

        return Results.Ok(due);
    }

    private static async Task<IResult> SendReminder(
        SendReminderRequest request,
        DentistDbContext db,
        ISmsGatewayClient gateway,
        IOptions<SmsGatewayOptions> options,
        HttpContext http,
        CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .Include(candidate => candidate.Patient)
            .FirstOrDefaultAsync(candidate => candidate.Id == request.AppointmentId, cancellationToken);

        if (appointment?.Patient is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["appointmentId"] = ["Appointment not found."],
            });
        }

        var settings = await db.SmsSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var activeTemplate = string.IsNullOrWhiteSpace(settings?.ReminderTemplate)
            ? ReminderTemplate.Default
            : settings.ReminderTemplate;

        var text = string.IsNullOrWhiteSpace(request.Message)
            ? ReminderTemplate.Render(activeTemplate, appointment.Patient, appointment)
            : request.Message.Trim();

        var maxLength = options.Value.MaxMessageLength;

        if (text.Length > maxLength)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["message"] =
                [
                    $"The message is {text.Length} characters; keep it under {maxLength}.",
                ],
            });
        }

        var outcome = await SmsDelivery.DeliverAsync(appointment, text, gateway, cancellationToken);

        if (!outcome.Succeeded)
        {
            return SmsDelivery.ToProblem(http, outcome);
        }

        var record = await SmsDelivery.RecordAsync(db, appointment.Id, text, cancellationToken);

        return Results.Created(
            $"/api/sms/{record.Id}",
            new SmsMessageResponse(
                record.Id,
                record.AppointmentId,
                SmsDelivery.PatientName(appointment),
                appointment.Date,
                record.Message));
    }
}
