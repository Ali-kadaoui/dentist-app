using Dentist.Api.Contracts.Dashboard;
using Dentist.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/dashboard/summary", GetSummary).WithTags("Dashboard");
        return app;
    }

    private static async Task<IResult> GetSummary(
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var totalPatients = await db.Patients
            .AsNoTracking()
            .CountAsync(cancellationToken);

        var appointmentsToday = await db.Appointments
            .AsNoTracking()
            .CountAsync(appointment => appointment.Date == today, cancellationToken);

        var upcomingAppointments = await db.Appointments
            .AsNoTracking()
            .CountAsync(appointment => appointment.Date >= today, cancellationToken);

        var messages = await db.SmsMessages
            .AsNoTracking()
            .CountAsync(cancellationToken);

        return Results.Ok(new DashboardSummaryResponse(
            totalPatients,
            appointmentsToday,
            upcomingAppointments,
            messages));
    }
}
