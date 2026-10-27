using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Payments;

public sealed record PaymentResponse(
    Guid Id,
    Guid PatientId,
    string PatientFullName,
    string PatientPhone,
    string? PatientCin,
    string Treatment,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RemainingAmount,
    string PaymentMethod,
    string Status,
    DateTime PaymentDate,
    string? Notes,
    DateTime CreatedAt)
{
    public static PaymentResponse From(Payment payment) => new(
        payment.Id,
        payment.PatientId,
        payment.Patient != null
            ? (string.IsNullOrWhiteSpace(payment.Patient.FullName)
                ? $"{payment.Patient.FirstName} {payment.Patient.LastName}".Trim()
                : payment.Patient.FullName)
            : "Patient Inconnu",
        payment.Patient?.Phone ?? string.Empty,
        payment.Patient?.Cin,
        payment.Treatment,
        payment.TotalAmount,
        payment.PaidAmount,
        payment.RemainingAmount,
        payment.PaymentMethod,
        payment.Status,
        payment.PaymentDate,
        payment.Notes,
        payment.CreatedAt);
}

public sealed record PaymentSummaryResponse(
    decimal TotalCollected,
    decimal TotalPending,
    int TotalCount);

public sealed record PaymentListResponse(
    IReadOnlyList<PaymentResponse> Items,
    PaymentSummaryResponse Summary,
    int Total);

public sealed record CreatePaymentRequest(
    Guid PatientId,
    string Treatment = "Consultation",
    decimal TotalAmount = 0,
    decimal PaidAmount = 0,
    string PaymentMethod = "Espèces",
    string? Status = null,
    DateTime? PaymentDate = null,
    string? Notes = null);

public sealed record UpdatePaymentRequest(
    Guid PatientId,
    string Treatment = "Consultation",
    decimal TotalAmount = 0,
    decimal PaidAmount = 0,
    string PaymentMethod = "Espèces",
    string? Status = null,
    DateTime? PaymentDate = null,
    string? Notes = null);
