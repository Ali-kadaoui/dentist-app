namespace Dentist.Api.Contracts.Dashboard;

public sealed record DashboardSummaryResponse(
    int TotalPatients,
    int AppointmentsToday,
    int UpcomingAppointments,
    int Messages);
