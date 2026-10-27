using Dentist.Api.Contracts.Medicines;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class MedicinesEndpoints
{
    public static IEndpointRouteBuilder MapMedicinesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/medicines").WithTags("Medicines");

        group.MapGet("", GetMedicines);
        group.MapGet("/categories", GetCategories);
        group.MapGet("/{id:guid}", GetMedicine);
        group.MapPost("", CreateMedicine);
        group.MapPut("/{id:guid}", UpdateMedicine);
        group.MapDelete("/{id:guid}", DeleteMedicine);

        return app;
    }

    private static async Task<IResult> GetMedicines(
        DentistDbContext db,
        string? search = null,
        string? category = null,
        int page = 1,
        int pageSize = 100,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Medicines.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(category) && category.ToLower() != "tous")
        {
            query = query.Where(m => m.Category.ToLower() == category.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(m =>
                EF.Functions.ILike(m.Name, pattern) ||
                (m.Dosage != null && EF.Functions.ILike(m.Dosage, pattern)) ||
                (m.Form != null && EF.Functions.ILike(m.Form, pattern)) ||
                EF.Functions.ILike(m.Category, pattern) ||
                (m.DefaultDosageInstructions != null && EF.Functions.ILike(m.DefaultDosageInstructions, pattern))
            );
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(m => m.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => MedicineResponse.From(m))
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            items,
            total,
            page,
            pageSize
        });
    }

    private static async Task<IResult> GetCategories(
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var categories = await db.Medicines
            .AsNoTracking()
            .Select(m => m.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(cancellationToken);

        return Results.Ok(categories);
    }

    private static async Task<IResult> GetMedicine(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var medicine = await db.Medicines
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        return medicine is null
            ? Results.NotFound()
            : Results.Ok(MedicineResponse.From(medicine));
    }

    private static async Task<IResult> CreateMedicine(
        CreateMedicineRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Nom requis",
                detail: "Le nom du médicament est obligatoire.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var medicine = new Medicine
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Dosage = request.Dosage?.Trim(),
            Form = request.Form?.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Général" : request.Category.Trim(),
            DefaultDosageInstructions = request.DefaultDosageInstructions?.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        db.Medicines.Add(medicine);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/medicines/{medicine.Id}", MedicineResponse.From(medicine));
    }

    private static async Task<IResult> UpdateMedicine(
        Guid id,
        UpdateMedicineRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var medicine = await db.Medicines.FindAsync([id], cancellationToken);
        if (medicine is null)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Nom requis",
                detail: "Le nom du médicament est obligatoire.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        medicine.Name = request.Name.Trim();
        medicine.Dosage = request.Dosage?.Trim();
        medicine.Form = request.Form?.Trim();
        medicine.Category = string.IsNullOrWhiteSpace(request.Category) ? "Général" : request.Category.Trim();
        medicine.DefaultDosageInstructions = request.DefaultDosageInstructions?.Trim();
        medicine.Notes = request.Notes?.Trim();

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(MedicineResponse.From(medicine));
    }

    private static async Task<IResult> DeleteMedicine(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var medicine = await db.Medicines.FindAsync([id], cancellationToken);
        if (medicine is null)
        {
            return Results.NotFound();
        }

        db.Medicines.Remove(medicine);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
