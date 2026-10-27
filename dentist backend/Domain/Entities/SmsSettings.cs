namespace Dentist.Api.Domain.Entities;

public sealed record SmsReminderRule(int DaysBefore, string Time);

public sealed class SmsSettings
{
    public Guid Id { get; set; } = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// Whether automatic sending is globally enabled.
    /// </summary>
    public bool AutoSendEnabled { get; set; } = false;

    /// <summary>
    /// Automatically send confirmation SMS right when an appointment is booked.
    /// </summary>
    public bool SendOnBooking { get; set; } = false;

    /// <summary>
    /// Automatically send reminder before appointment date.
    /// </summary>
    public bool SendReminderBefore { get; set; } = true;

    /// <summary>
    /// Legacy/fallback: How many days before the appointment to send the reminder.
    /// </summary>
    public int DaysBefore { get; set; } = 1;

    /// <summary>
    /// Legacy/fallback: Time of day: hour (0-23).
    /// </summary>
    public int SendHour { get; set; } = 18;

    /// <summary>
    /// Legacy/fallback: Time of day: minute (0-59).
    /// </summary>
    public int SendMinute { get; set; } = 0;

    /// <summary>
    /// Maximum reminder SMS to send per appointment.
    /// </summary>
    public int MaxReminders { get; set; } = 1;

    /// <summary>
    /// Configured reminder rules as JSON: [{"daysBefore":1,"time":"18:00"}].
    /// </summary>
    public string RemindersJson { get; set; } = "[{\"daysBefore\":1,\"time\":\"18:00\"}]";

    /// <summary>
    /// Template for reminders.
    /// </summary>
    public string ReminderTemplate { get; set; } = "Bonjour {firstName}, rappel : votre rendez-vous au cabinet dentaire est prevu le {date}. Merci de confirmer.";

    /// <summary>
    /// Template for immediate booking confirmations.
    /// </summary>
    public string BookingTemplate { get; set; } = "Bonjour {firstName}, votre rendez-vous au cabinet dentaire a ete reserve pour le {date}.";

    public List<SmsReminderRule> GetReminderRules()
    {
        if (string.IsNullOrWhiteSpace(RemindersJson))
        {
            return [new SmsReminderRule(DaysBefore, $"{SendHour:D2}:{SendMinute:D2}")];
        }

        try
        {
            var rules = System.Text.Json.JsonSerializer.Deserialize<List<SmsReminderRule>>(
                RemindersJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (rules is not null && rules.Count > 0)
            {
                return rules;
            }
        }
        catch
        {
            // fallback if JSON cannot be parsed
        }

        return [new SmsReminderRule(DaysBefore, $"{SendHour:D2}:{SendMinute:D2}")];
    }
}
