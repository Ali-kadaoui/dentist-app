namespace Dentist.Api.Contracts.Sms;

/// <summary>
/// An appointment that is scheduled for automatic reminder dispatch.
/// </summary>
public sealed record DueReminderResponse(
    Guid AppointmentId,
    Guid PatientId,
    string PatientName,
    string Phone,
    DateOnly Date,
    DateOnly NextSendDate,
    string NextSendTime,
    string Message,
    string? LastSmsStatus,
    string? LastSmsError,
    DateTime? LastSmsAttemptAt);

public sealed record SendReminderRequest(
    Guid AppointmentId,
    string? Message);
