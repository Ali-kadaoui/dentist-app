using Dentist.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            service = "dentist-api",
            timestamp = DateTimeOffset.UtcNow,
        }));

        app.MapGet("/health/ready", async (DentistDbContext db, CancellationToken cancellationToken) =>
        {
            var databaseReady = await db.Database.CanConnectAsync(cancellationToken);

            return databaseReady
                ? Results.Ok(new { status = "ready", database = "up" })
                : Results.Json(
                    new { status = "degraded", database = "down" },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        return app;
    }
}
