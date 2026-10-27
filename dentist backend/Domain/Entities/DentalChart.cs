namespace Dentist.Api.Domain.Entities;

public sealed class DentalChart
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }

    public Patient? Patient { get; set; }

    public string DentitionMode { get; set; } = "auto";

    public string TeethDataJson { get; set; } = "{}";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
