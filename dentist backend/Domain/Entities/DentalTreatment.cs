namespace Dentist.Api.Domain.Entities;

public sealed class DentalTreatment
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }

    public Patient? Patient { get; set; }

    public DateOnly Date { get; set; }

    public string ToothNumbers { get; set; } = string.Empty;

    public string ActName { get; set; } = string.Empty;

    public string Status { get; set; } = "Terminé";

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
