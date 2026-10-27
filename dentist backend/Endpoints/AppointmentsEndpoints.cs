using Dentist.Api.Common;
using Dentist.Api.Contracts.Appointments;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Dentist.Api.Infrastructure.Sms;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class AppointmentsEndpoints
{
    public static IEndpointRouteBuilder MapAppointmentsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/appointments").WithTags("Appointments");

        group.MapGet("", GetAppointments);
        group.MapGet("/{id:guid}", GetAppointment);
        group.MapPost("", CreateAppointment);
        group.MapDelete("/{id:guid}", DeleteAppointment);

        return app;
    }

    private static async Task<IResult> GetAppointments(
        DentistDbContext db,
        DateOnly? from = null,
        DateOnly? to = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Appointments.AsNoTracking();

        if (from is { } fromDate)
        {
            query = query.Where(appointment => appointment.Date >= fromDate);
        }

        if (to is { } toDate)
        {
            query = query.Where(appointment => appointment.Date <= toDate);
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(appointment => appointment.Date)
            .ThenBy(appointment => appointment.Patient!.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(appointment => new AppointmentListItem(
                appointment.Id,
                appointment.PatientId,
                appointment.Patient!.FirstName + " " + appointment.Patient.LastName,
                appointment.Patient.Phone,
                appointment.Date,
                appointment.SmsMessages.Any()))
            .ToListAsync(cancellationToken);

        return Results.Ok(new PagedResult<AppointmentListItem>(items, page, pageSize, total));
    }

    private static async Task<IResult> GetAppointment(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return appointment is null
            ? Results.NotFound()
            : Results.Ok(AppointmentResponse.From(appointment));
    }

    private static async Task<IResult> CreateAppointment(
        CreateAppointmentRequest request,
        DentistDbContext db,
        ISmsGatewayClient gateway,
        Microsoft.Extensions.Options.IOptions<Dentist.Api.Infrastructure.Sms.SmsGatewayOptions> options,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (request.Date == default)
        {
            errors["date"] = ["This field is required."];
        }

        var patient = await db.Patients
            .FirstOrDefaultAsync(p => p.Id == request.PatientId, cancellationToken);

        if (patient is null)
        {
            errors["patientId"] = ["Patient not found."];
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = request.PatientId,
            Date = request.Date,
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync(cancellationToken);

        // Auto-SMS on booking if enabled
        var settings = await db.SmsSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is { AutoSendEnabled: true, SendOnBooking: true } && patient is not null)
        {
            try
            {
                var text = Dentist.Api.Infrastructure.Sms.ReminderTemplate.Render(
                    settings.BookingTemplate,
                    patient,
                    appointment);

                if (text.Length > options.Value.MaxMessageLength)
                {
                    text = text[..options.Value.MaxMessageLength];
                }

                appointment.Patient = patient;
                var outcome = await Dentist.Api.Infrastructure.Sms.SmsDelivery.DeliverAsync(
                    appointment,
                    text,
                    gateway,
                    cancellationToken);

                if (outcome.Succeeded)
                {
                    await Dentist.Api.Infrastructure.Sms.SmsDelivery.RecordAsync(
                        db,
                        appointment.Id,
                        text,
                        cancellationToken);
                }
            }
            catch
            {
                // Never block appointment creation if modem send fails
            }
        }

        return Results.Created($"/api/appointments/{appointment.Id}", AppointmentResponse.From(appointment));
    }

    private static async Task<IResult> DeleteAppointment(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (appointment is null)
        {
            return Results.NotFound();
        }

        db.Appointments.Remove(appointment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}

