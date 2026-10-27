using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Appointments;

/// <summary>An appointment is a patient plus a date; nothing else is stored.</summary>
public sealed record AppointmentListItem(
    Guid Id,
    Guid PatientId,
    string PatientName,
    string PatientPhone,
    DateOnly Date,
    bool HasSms);

public sealed record AppointmentResponse(
    Guid Id,
    Guid PatientId,
    DateOnly Date)
{
    public static AppointmentResponse From(Appointment appointment) => new(
        appointment.Id,
        appointment.PatientId,
        appointment.Date);
}

public sealed record CreateAppointmentRequest(
    Guid PatientId,
    DateOnly Date);
