namespace Dentist.Api.Domain.Entities;

public sealed class Payment
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }

    public Patient? Patient { get; set; }

    public string Treatment { get; set; } = string.Empty;

    public decimal TotalAmount { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal RemainingAmount => Math.Max(0, TotalAmount - PaidAmount);

    public string PaymentMethod { get; set; } = "Espèces";

    public string Status { get; set; } = "Payé";

    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
