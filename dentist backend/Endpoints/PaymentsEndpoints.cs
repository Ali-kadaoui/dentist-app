using Dentist.Api.Contracts.Payments;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class PaymentsEndpoints
{
    public static IEndpointRouteBuilder MapPaymentsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/payments").WithTags("Payments");

        group.MapGet("", GetPayments);
        group.MapGet("/{id:guid}", GetPayment);
        group.MapPost("", CreatePayment);
        group.MapPut("/{id:guid}", UpdatePayment);
        group.MapDelete("/{id:guid}", DeletePayment);

        return app;
    }

    private static async Task<IResult> GetPayments(
        DentistDbContext db,
        string? search = null,
        Guid? patientId = null,
        string? status = null,
        string? paymentMethod = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Payments
            .Include(p => p.Patient)
            .AsNoTracking();

        if (patientId.HasValue)
        {
            query = query.Where(p => p.PatientId == patientId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status.ToLower() == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(paymentMethod))
        {
            query = query.Where(p => p.PaymentMethod.ToLower() == paymentMethod.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(p =>
                EF.Functions.ILike(p.Treatment, pattern) ||
                (p.Patient != null && (
                    EF.Functions.ILike(p.Patient.FirstName, pattern) ||
                    EF.Functions.ILike(p.Patient.LastName, pattern) ||
                    EF.Functions.ILike(p.Patient.Phone, pattern) ||
                    EF.Functions.ILike(p.Patient.Cin ?? "", pattern)
                ))
            );
        }

        var total = await query.CountAsync(cancellationToken);

        // Summary calculations
        var totalCollected = await query.SumAsync(p => p.PaidAmount, cancellationToken);
        var totalBilled = await query.SumAsync(p => p.TotalAmount, cancellationToken);
        var totalPending = Math.Max(0, totalBilled - totalCollected);

        var items = await query
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => PaymentResponse.From(p))
            .ToListAsync(cancellationToken);

        return Results.Ok(new PaymentListResponse(
            items,
            new PaymentSummaryResponse(totalCollected, totalPending, total),
            total
        ));
    }

    private static async Task<IResult> GetPayment(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var payment = await db.Payments
            .Include(p => p.Patient)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        return payment is null
            ? Results.NotFound()
            : Results.Ok(PaymentResponse.From(payment));
    }

    private static async Task<IResult> CreatePayment(
        CreatePaymentRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patient = await db.Patients.FindAsync([request.PatientId], cancellationToken);
        if (patient is null)
        {
            return Results.Problem(
                title: "Patient non trouvé",
                detail: $"Aucun patient avec l'ID {request.PatientId}",
                statusCode: StatusCodes.Status404NotFound);
        }

        var status = !string.IsNullOrWhiteSpace(request.Status)
            ? request.Status.Trim()
            : (request.PaidAmount >= request.TotalAmount
                ? "Payé"
                : request.PaidAmount > 0 ? "Partiel" : "En attente");

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            PatientId = request.PatientId,
            Patient = patient,
            Treatment = string.IsNullOrWhiteSpace(request.Treatment) ? "Consultation" : request.Treatment.Trim(),
            TotalAmount = Math.Max(0, request.TotalAmount),
            PaidAmount = Math.Max(0, request.PaidAmount),
            PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Espèces" : request.PaymentMethod.Trim(),
            Status = status,
            PaymentDate = request.PaymentDate?.ToUniversalTime() ?? DateTime.UtcNow,
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        db.Payments.Add(payment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/payments/{payment.Id}", PaymentResponse.From(payment));
    }

    private static async Task<IResult> UpdatePayment(
        Guid id,
        UpdatePaymentRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var payment = await db.Payments
            .Include(p => p.Patient)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (payment is null)
        {
            return Results.NotFound();
        }

        payment.PatientId = request.PatientId;
        payment.Treatment = string.IsNullOrWhiteSpace(request.Treatment) ? "Consultation" : request.Treatment.Trim();
        payment.TotalAmount = Math.Max(0, request.TotalAmount);
        payment.PaidAmount = Math.Max(0, request.PaidAmount);
        payment.PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Espèces" : request.PaymentMethod.Trim();
        payment.Status = string.IsNullOrWhiteSpace(request.Status)
            ? (payment.PaidAmount >= payment.TotalAmount ? "Payé" : payment.PaidAmount > 0 ? "Partiel" : "En attente")
            : request.Status.Trim();
        payment.PaymentDate = request.PaymentDate?.ToUniversalTime() ?? payment.PaymentDate;
        payment.Notes = request.Notes?.Trim();

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(PaymentResponse.From(payment));
    }

    private static async Task<IResult> DeletePayment(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var payment = await db.Payments.FindAsync([id], cancellationToken);
        if (payment is null)
        {
            return Results.NotFound();
        }

        db.Payments.Remove(payment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
