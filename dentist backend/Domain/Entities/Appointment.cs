namespace Dentist.Api.Domain.Entities;

/// <summary>
/// One visit, identified by its date only. The time of day is agreed with the
/// patient, so no time, duration, reason, note or status is stored: an
/// appointment is "this patient, that day".
/// </summary>
public sealed class Appointment
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }

    public Patient? Patient { get; set; }

    /// <summary>Day of the visit (no time component).</summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Status of the last SMS attempt: null (not tried yet), "SENT", or "FAILED".
    /// </summary>
    public string? LastSmsStatus { get; set; }

    /// <summary>
    /// Last SMS delivery error detail, if any.
    /// </summary>
    public string? LastSmsError { get; set; }

    /// <summary>
    /// Timestamp of the last SMS dispatch attempt.
    /// </summary>
    public DateTime? LastSmsAttemptAt { get; set; }

    /// <summary>The reminder sent for this visit, if any.</summary>
    public List<SmsMessage> SmsMessages { get; set; } = [];
}
