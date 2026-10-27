using Dentist.Api.Contracts.Dental;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class DentalEndpoints
{
    public static IEndpointRouteBuilder MapDentalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/patients/{patientId:guid}").WithTags("Dental");

        // Treatments
        group.MapGet("/dental-treatments", GetTreatments);
        group.MapPost("/dental-treatments", CreateTreatment);
        group.MapPut("/dental-treatments/{treatmentId:guid}", UpdateTreatment);
        group.MapDelete("/dental-treatments/{treatmentId:guid}", DeleteTreatment);

        // Odontogram / Dental Chart
        group.MapGet("/dental-chart", GetDentalChart);
        group.MapPut("/dental-chart", SaveDentalChart);

        return app;
    }

    private static async Task<IResult> GetTreatments(
        Guid patientId,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var treatments = await db.DentalTreatments
            .AsNoTracking()
            .Where(t => t.PatientId == patientId)
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.CreatedAt)
            .Select(t => DentalTreatmentResponse.From(t))
            .ToListAsync(cancellationToken);

        return Results.Ok(treatments);
    }

    private static async Task<IResult> CreateTreatment(
        Guid patientId,
        CreateDentalTreatmentRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patientExists = await db.Patients.AnyAsync(p => p.Id == patientId, cancellationToken);
        if (!patientExists)
        {
            return Results.NotFound(new { message = "Patient introuvable." });
        }

        if (string.IsNullOrWhiteSpace(request.ActName))
        {
            return Results.BadRequest(new { message = "Le nom de l'acte de soin est requis." });
        }

        var treatment = new DentalTreatment
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Date = request.Date == default ? DateOnly.FromDateTime(DateTime.Today) : request.Date,
            ToothNumbers = string.IsNullOrWhiteSpace(request.ToothNumbers) ? "Général" : request.ToothNumbers.Trim(),
            ActName = request.ActName.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Terminé" : request.Status.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        db.DentalTreatments.Add(treatment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/patients/{patientId}/dental-treatments/{treatment.Id}", DentalTreatmentResponse.From(treatment));
    }

    private static async Task<IResult> UpdateTreatment(
        Guid patientId,
        Guid treatmentId,
        UpdateDentalTreatmentRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var treatment = await db.DentalTreatments
            .FirstOrDefaultAsync(t => t.Id == treatmentId && t.PatientId == patientId, cancellationToken);

        if (treatment is null)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.ActName))
        {
            return Results.BadRequest(new { message = "Le nom de l'acte de soin est requis." });
        }

        treatment.Date = request.Date == default ? treatment.Date : request.Date;
        treatment.ToothNumbers = string.IsNullOrWhiteSpace(request.ToothNumbers) ? "Général" : request.ToothNumbers.Trim();
        treatment.ActName = request.ActName.Trim();
        treatment.Status = string.IsNullOrWhiteSpace(request.Status) ? "Terminé" : request.Status.Trim();
        treatment.Notes = request.Notes?.Trim();

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(DentalTreatmentResponse.From(treatment));
    }

    private static async Task<IResult> DeleteTreatment(
        Guid patientId,
        Guid treatmentId,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var treatment = await db.DentalTreatments
            .FirstOrDefaultAsync(t => t.Id == treatmentId && t.PatientId == patientId, cancellationToken);

        if (treatment is null)
        {
            return Results.NotFound();
        }

        db.DentalTreatments.Remove(treatment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> GetDentalChart(
        Guid patientId,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var chart = await db.DentalCharts
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PatientId == patientId, cancellationToken);

        if (chart is null)
        {
            // Return empty chart response
            return Results.Ok(new DentalChartResponse(Guid.Empty, patientId, "auto", "{}", DateTime.UtcNow));
        }

        return Results.Ok(DentalChartResponse.From(chart));
    }

    private static async Task<IResult> SaveDentalChart(
        Guid patientId,
        SaveDentalChartRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patientExists = await db.Patients.AnyAsync(p => p.Id == patientId, cancellationToken);
        if (!patientExists)
        {
            return Results.NotFound(new { message = "Patient introuvable." });
        }

        var chart = await db.DentalCharts
            .FirstOrDefaultAsync(c => c.PatientId == patientId, cancellationToken);

        if (chart is null)
        {
            chart = new DentalChart
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DentitionMode = string.IsNullOrWhiteSpace(request.DentitionMode) ? "auto" : request.DentitionMode.Trim(),
                TeethDataJson = string.IsNullOrWhiteSpace(request.TeethDataJson) ? "{}" : request.TeethDataJson,
                UpdatedAt = DateTime.UtcNow
            };
            db.DentalCharts.Add(chart);
        }
        else
        {
            chart.DentitionMode = string.IsNullOrWhiteSpace(request.DentitionMode) ? "auto" : request.DentitionMode.Trim();
            chart.TeethDataJson = string.IsNullOrWhiteSpace(request.TeethDataJson) ? "{}" : request.TeethDataJson;
            chart.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(DentalChartResponse.From(chart));
    }
}
