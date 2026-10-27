namespace Dentist.Api.Domain.Entities;

public sealed class Medicine
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Dosage { get; set; }

    public string? Form { get; set; }

    public string Category { get; set; } = "Général";

    public string? DefaultDosageInstructions { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
