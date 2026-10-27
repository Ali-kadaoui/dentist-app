using Dentist.Api.Domain.Entities;
using Dentist.Api.Infrastructure.Sms;

namespace Dentist.Api.Contracts.Sms;

/// <summary>A message is always sent for an appointment; the patient is read from it.</summary>
public sealed record SendSmsRequest(
    Guid? AppointmentId,
    string? Message);

public sealed record SmsMessageResponse(
    Guid Id,
    Guid AppointmentId,
    string PatientName,
    DateOnly Date,
    string Message)
{
    public static SmsMessageResponse From(SmsMessage message, string patientName) => new(
        message.Id,
        message.AppointmentId,
        patientName,
        message.Appointment.Date,
        message.Message);
}

/// <summary>Read-only projection of the gateway health probe.</summary>
public sealed record GatewayHealthView(
    string Status,
    string? Transport,
    SmsGatewayModem? Modem);
