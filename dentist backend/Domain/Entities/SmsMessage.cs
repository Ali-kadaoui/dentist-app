namespace Dentist.Api.Domain.Entities;

/// <summary>
/// A message sent to the patient of one appointment. The recipient is the phone
/// number on the patient file, and a row is written when the gateway
/// accepted the message, so the table is a history of messages that went out.
/// </summary>
public sealed class SmsMessage
{
    public Guid Id { get; set; }

    /// <summary>The appointment this reminder belongs to.</summary>
    public Guid AppointmentId { get; set; }

    public Appointment Appointment { get; set; } = null!;

    public string Message { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
