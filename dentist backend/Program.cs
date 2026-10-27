using System.Text.Json;
using System.Text.Json.Serialization;
using Dentist.Api.Data;
using Dentist.Api.Endpoints;
using Dentist.Api.Infrastructure.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// -----------------------------------------------------------------------------
// Database: PostgreSQL through EF Core (pooled DbContext for lower allocation).
// -----------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Postgres is missing. Set it in appsettings.Development.json " +
        "or through the ConnectionStrings__Postgres environment variable.");

builder.Services.AddDbContextPool<DentistDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure(3));
});

// -----------------------------------------------------------------------------
// JSON + RFC 7807 problem details (same shape the Python gateway returns).
// -----------------------------------------------------------------------------
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddProblemDetails();

// -----------------------------------------------------------------------------
// CORS: the Vite dev server in development, the container host in production.
// -----------------------------------------------------------------------------
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

// -----------------------------------------------------------------------------
// Python SMS gateway: one typed HttpClient, API key sent on every request.
// -----------------------------------------------------------------------------
builder.Services.Configure<SmsGatewayOptions>(
    builder.Configuration.GetSection(SmsGatewayOptions.SectionName));

builder.Services.AddHttpClient<ISmsGatewayClient, SmsGatewayClient>((provider, http) =>
{
    var gateway = provider.GetRequiredService<IOptions<SmsGatewayOptions>>().Value;

    http.BaseAddress = new Uri(gateway.BaseUrl.TrimEnd('/') + "/", UriKind.Absolute);
    http.Timeout = TimeSpan.FromSeconds(gateway.TimeoutSeconds);

    if (!string.IsNullOrWhiteSpace(gateway.ApiKey))
    {
        http.DefaultRequestHeaders.TryAddWithoutValidation("X-API-Key", gateway.ApiKey);
    }
});

builder.Services.AddHostedService<AutoSmsBackgroundService>();

var app = builder.Build();

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();

app.MapHealthEndpoints();
app.MapPatientsEndpoints();
app.MapDentalEndpoints();
app.MapAppointmentsEndpoints();
app.MapSmsEndpoints();
app.MapReminderEndpoints();
app.MapPaymentsEndpoints();
app.MapMedicinesEndpoints();
app.MapDashboardEndpoints();

// Apply migrations on startup where that is safe: Development, and containers
// that set `Database__MigrateOnStartup=true`. Production deploys may instead
// run `dotnet ef database update` as a separate step.
if (builder.Configuration.GetValue("Database:MigrateOnStartup", app.Environment.IsDevelopment()))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<DentistDbContext>();

    if (db.Database.GetMigrations().Any())
    {
        await db.Database.MigrateAsync();
    }
}

app.Run();

public partial class Program
{
}
