using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Medicines;

public sealed record MedicineResponse(
    Guid Id,
    string Name,
    string? Dosage,
    string? Form,
    string Category,
    string? DefaultDosageInstructions,
    string? Notes,
    DateTime CreatedAt)
{
    public static MedicineResponse From(Medicine medicine) => new(
        medicine.Id,
        medicine.Name,
        medicine.Dosage,
        medicine.Form,
        medicine.Category,
        medicine.DefaultDosageInstructions,
        medicine.Notes,
        medicine.CreatedAt);
}

public sealed record CreateMedicineRequest(
    string Name = "",
    string? Dosage = null,
    string? Form = null,
    string Category = "Général",
    string? DefaultDosageInstructions = null,
    string? Notes = null);

public sealed record UpdateMedicineRequest(
    string Name = "",
    string? Dosage = null,
    string? Form = null,
    string Category = "Général",
    string? DefaultDosageInstructions = null,
    string? Notes = null);
