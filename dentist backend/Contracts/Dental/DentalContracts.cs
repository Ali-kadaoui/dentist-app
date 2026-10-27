using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Dental;

public sealed record DentalTreatmentResponse(
    Guid Id,
    Guid PatientId,
    DateOnly Date,
    string ToothNumbers,
    string ActName,
    string Status,
    string? Notes,
    DateTime CreatedAt)
{
    public static DentalTreatmentResponse From(DentalTreatment treatment) => new(
        treatment.Id,
        treatment.PatientId,
        treatment.Date,
        treatment.ToothNumbers,
        treatment.ActName,
        treatment.Status,
        treatment.Notes,
        treatment.CreatedAt);
}

public sealed record CreateDentalTreatmentRequest(
    DateOnly Date,
    string ToothNumbers = "",
    string ActName = "",
    string Status = "Terminé",
    string? Notes = null);

public sealed record UpdateDentalTreatmentRequest(
    DateOnly Date,
    string ToothNumbers = "",
    string ActName = "",
    string Status = "Terminé",
    string? Notes = null);

public sealed record DentalChartResponse(
    Guid Id,
    Guid PatientId,
    string DentitionMode,
    string TeethDataJson,
    DateTime UpdatedAt)
{
    public static DentalChartResponse From(DentalChart chart) => new(
        chart.Id,
        chart.PatientId,
        chart.DentitionMode,
        chart.TeethDataJson,
        chart.UpdatedAt);
}

public sealed record SaveDentalChartRequest(
    string DentitionMode = "auto",
    string TeethDataJson = "{}");
