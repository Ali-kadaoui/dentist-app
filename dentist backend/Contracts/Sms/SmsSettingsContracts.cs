namespace Dentist.Api.Contracts.Sms;

public sealed record SmsReminderRuleDto(int DaysBefore, string Time);

public sealed record SmsSettingsResponse(
    bool AutoSendEnabled,
    bool SendOnBooking,
    bool SendReminderBefore,
    int DaysBefore,
    int SendHour,
    int SendMinute,
    int MaxReminders,
    List<SmsReminderRuleDto> Reminders,
    string ReminderTemplate,
    string BookingTemplate);

public sealed record UpdateSmsSettingsRequest(
    bool AutoSendEnabled,
    bool SendOnBooking,
    bool SendReminderBefore,
    int DaysBefore = 1,
    int SendHour = 18,
    int SendMinute = 0,
    int MaxReminders = 1,
    List<SmsReminderRuleDto>? Reminders = null,
    string? ReminderTemplate = null,
    string? BookingTemplate = null);
