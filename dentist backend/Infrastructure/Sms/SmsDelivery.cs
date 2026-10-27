using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Infrastructure.Sms;

/// <summary>
/// The one place that talks to the SMS gateway and the one place that stores a
/// message. A row is written only after the gateway accepted the message, so the
/// SmsMessages table is a plain history of what was sent.
/// </summary>
public static class SmsDelivery
{
    public static Task<SmsSendOutcome> DeliverAsync(
        Appointment appointment,
        string message,
        ISmsGatewayClient gateway,
        CancellationToken cancellationToken) =>
        appointment.Patient is null
            ? Task.FromResult(SmsSendOutcome.Failure(
                "INVALID_NUMBER",
                "The appointment has no patient, so there is no number to send to.",
                StatusCodes.Status422UnprocessableEntity))
            : gateway.SendAsync(appointment.Patient.Phone, message, cancellationToken);

    /// <summary>Stores a newly sent message in history for one appointment.</summary>
    public static async Task<SmsMessage> RecordAsync(
        DentistDbContext db,
        Guid appointmentId,
        string message,
        CancellationToken cancellationToken)
    {
        var record = new SmsMessage
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointmentId,
            Message = message,
            SentAt = DateTime.UtcNow,
        };

        db.SmsMessages.Add(record);
        await db.SaveChangesAsync(cancellationToken);

        return record;
    }

    public static string PatientName(Appointment appointment) =>
        appointment.Patient is null
            ? string.Empty
            : $"{appointment.Patient.FirstName} {appointment.Patient.LastName}".Trim();

    public static IResult ToProblem(HttpContext http, SmsSendOutcome outcome)
    {
        var traceId = http.TraceIdentifier;

        return outcome.ErrorCode switch
        {
            "INVALID_NUMBER" => Results.UnprocessableEntity(new
            {
                type = "https://httpstatuses.com/422",
                title = "Invalid patient phone number",
                status = StatusCodes.Status422UnprocessableEntity,
                detail = outcome.ErrorDetail,
                instance = http.Request.Path.Value,
                traceId,
            }),

            "PORT_BUSY" => Results.StatusCode(StatusCodes.Status503ServiceUnavailable),

            "NO_RESPONSE" or "COMMAND_ERROR" => Results.Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "SMS gateway error",
                detail: outcome.ErrorDetail,
                instance: http.Request.Path.Value,
                extensions: new Dictionary<string, object?> { ["traceId"] = traceId }),

            _ => Results.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "SMS gateway error",
                detail: outcome.ErrorDetail,
                instance: http.Request.Path.Value,
                extensions: new Dictionary<string, object?> { ["traceId"] = traceId }),
        };
    }
}
