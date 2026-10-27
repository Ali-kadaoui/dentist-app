using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dentist.Api.Infrastructure.Sms;

/// <summary>
/// Hosted service that runs continuously in the background and evaluates configured
/// reminder rules (e.g. 3 days before at 10:00, 1 day before at 18:00) to dispatch
/// automated SMS reminders to patients with upcoming appointments.
/// </summary>
public sealed class AutoSmsBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<AutoSmsBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Auto-SMS background worker initialized.");

        // Initial grace delay on container startup
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndDispatchDueRemindersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error in Auto-SMS background worker loop.");
            }

            // Check every 30 seconds
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task CheckAndDispatchDueRemindersAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DentistDbContext>();

        var settings = await db.SmsSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null || !settings.AutoSendEnabled || !settings.SendReminderBefore)
        {
            return;
        }

        var rules = settings.GetReminderRules();
        if (rules.Count == 0)
        {
            return;
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
        var currentMinutesOfDay = nowLocal.Hour * 60 + nowLocal.Minute;

        // Check each rule that has reached its scheduled time today
        var eligibleRules = new List<SmsReminderRule>();
        foreach (var rule in rules)
        {
            var parts = (rule.Time ?? "18:00").Split(':');
            var ruleHour = 18;
            var ruleMinute = 0;
            if (parts.Length >= 2 && int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m))
            {
                ruleHour = h;
                ruleMinute = m;
            }

            var ruleMinutesOfDay = ruleHour * 60 + ruleMinute;
            if (currentMinutesOfDay >= ruleMinutesOfDay)
            {
                eligibleRules.Add(rule);
            }
        }

        if (eligibleRules.Count == 0)
        {
            return;
        }

        // For each eligible rule, find appointments for which today corresponds to (appointment.Date - DaysBefore)
        var gateway = scope.ServiceProvider.GetRequiredService<ISmsGatewayClient>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<SmsGatewayOptions>>();

        foreach (var rule in eligibleRules)
        {
            var targetAppointmentDate = today.AddDays(rule.DaysBefore);

            var dueAppointments = await db.Appointments
                .Include(a => a.Patient)
                .Include(a => a.SmsMessages)
                .Where(a => a.Date == targetAppointmentDate && a.SmsMessages.Count < rules.Count)
                .OrderBy(a => a.Patient!.LastName)
                .ToListAsync(cancellationToken);

            foreach (var appointment in dueAppointments)
            {
                if (appointment.Patient is null || string.IsNullOrWhiteSpace(appointment.Patient.Phone))
                {
                    continue;
                }

                // Check if a reminder has already been sent today for this appointment
                var alreadySentToday = appointment.SmsMessages.Any(m => DateOnly.FromDateTime(m.SentAt.AddHours(1)) == today);
                if (alreadySentToday)
                {
                    continue;
                }

                try
                {
                    var template = string.IsNullOrWhiteSpace(settings.ReminderTemplate)
                        ? ReminderTemplate.Default
                        : settings.ReminderTemplate;

                    var text = ReminderTemplate.Render(template, appointment.Patient, appointment);
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
                        logger.LogInformation("Auto-SMS dispatched for visit {Date} (rule: J-{Days} at {Time}) to {Patient} ({Phone}).",
                            appointment.Date, rule.DaysBefore, rule.Time,
                            $"{appointment.Patient.FirstName} {appointment.Patient.LastName}",
                            appointment.Patient.Phone);
                    }
                    else
                    {
                        appointment.LastSmsStatus = "FAILED";
                        appointment.LastSmsError = $"[{outcome.ErrorCode}] {outcome.ErrorDetail}";
                        await db.SaveChangesAsync(cancellationToken);

                        logger.LogWarning("Auto-SMS deferred for appointment {Id}: [{Code}] {Detail}",
                            appointment.Id, outcome.ErrorCode, outcome.ErrorDetail);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send auto-SMS for appointment {Id}.", appointment.Id);
                }
            }
        }
    }
}
