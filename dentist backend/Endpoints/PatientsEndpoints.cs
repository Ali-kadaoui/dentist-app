using Dentist.Api.Common;
using Dentist.Api.Contracts.Patients;
using Dentist.Api.Data;
using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Endpoints;

public static class PatientsEndpoints
{
    public static IEndpointRouteBuilder MapPatientsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/patients").WithTags("Patients");

        group.MapGet("", GetPatients);
        group.MapGet("/{id:guid}", GetPatient);
        group.MapPost("", CreatePatient);
        group.MapPut("/{id:guid}", UpdatePatient);

        // The problem/progress log for one patient.
        group.MapGet("/{id:guid}/states", GetPatientStates);
        group.MapPost("/{id:guid}/states", CreatePatientState);
        group.MapDelete("/{id:guid}/states/{stateId:guid}", DeletePatientState);

        return app;
    }

    private static async Task<IResult> GetPatients(
        DentistDbContext db,
        string? search = null,
        int page = 1,
        int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Patients.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";

            query = query.Where(patient =>
                EF.Functions.ILike(patient.FirstName, pattern) ||
                EF.Functions.ILike(patient.LastName, pattern) ||
                (patient.Cin != null && EF.Functions.ILike(patient.Cin, pattern)) ||
                (patient.Profession != null && EF.Functions.ILike(patient.Profession, pattern)) ||
                EF.Functions.ILike(patient.Phone, pattern));
        }

        var total = await query.CountAsync(cancellationToken);

        var rawPatients = await query
            .OrderBy(patient => patient.LastName)
            .ThenBy(patient => patient.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rawPatients.Select(patient => new PatientListItem(
            patient.Id,
            patient.FullName,
            patient.FirstName,
            patient.LastName,
            patient.Phone,
            patient.DateOfBirth,
            patient.Age,
            patient.Profession,
            patient.Cin,
            patient.Address,
            patient.Email,
            patient.Notes)).ToList();

        return Results.Ok(new PagedResult<PatientListItem>(items, page, pageSize, total));
    }

    private static async Task<IResult> GetPatient(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patient = await db.Patients
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return patient is null
            ? Results.NotFound()
            : Results.Ok(PatientResponse.From(patient));
    }

    private static async Task<IResult> CreatePatient(
        CreatePatientRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request.FullName, request.FirstName, request.LastName, request.Phone, request.Email);

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        PhoneNumbers.TryNormalize(request.Phone, out var phone);

        var fullName = request.FullName?.Trim() ?? "";
        var firstName = request.FirstName?.Trim() ?? "";
        var lastName = request.LastName?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(fullName))
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            firstName = parts[0];
            lastName = parts.Length > 1 ? string.Join(" ", parts[1..]) : parts[0];
        }
        else if (string.IsNullOrWhiteSpace(fullName))
        {
            fullName = $"{firstName} {lastName}".Trim();
        }

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = firstName,
            LastName = lastName,
            Phone = phone,
            DateOfBirth = request.DateOfBirth,
            Profession = NormalizeOptional(request.Profession),
            Cin = NormalizeOptional(request.Cin),
            Address = NormalizeOptional(request.Address),
            Email = NormalizeOptional(request.Email),
            Gender = NormalizeOptional(request.Gender),
            Notes = NormalizeOptional(request.Notes),
        };

        db.Patients.Add(patient);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/patients/{patient.Id}", PatientResponse.From(patient));
    }

    private static async Task<IResult> UpdatePatient(
        Guid id,
        UpdatePatientRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patient = await db.Patients.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (patient is null)
        {
            return Results.NotFound();
        }

        var errors = Validate(request.FullName, request.FirstName, request.LastName, request.Phone, request.Email);

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        PhoneNumbers.TryNormalize(request.Phone, out var phone);

        var fullName = request.FullName?.Trim() ?? "";
        var firstName = request.FirstName?.Trim() ?? "";
        var lastName = request.LastName?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(fullName))
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            firstName = parts[0];
            lastName = parts.Length > 1 ? string.Join(" ", parts[1..]) : parts[0];
        }
        else if (string.IsNullOrWhiteSpace(fullName))
        {
            fullName = $"{firstName} {lastName}".Trim();
        }

        patient.FirstName = firstName;
        patient.LastName = lastName;
        patient.Phone = phone;
        patient.DateOfBirth = request.DateOfBirth;
        patient.Profession = NormalizeOptional(request.Profession);
        patient.Cin = NormalizeOptional(request.Cin);
        patient.Address = NormalizeOptional(request.Address);
        patient.Email = NormalizeOptional(request.Email);
        patient.Gender = NormalizeOptional(request.Gender);
        patient.Notes = NormalizeOptional(request.Notes);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(PatientResponse.From(patient));
    }

    private static async Task<IResult> GetPatientStates(
        Guid id,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patientExists = await db.Patients
            .AnyAsync(patient => patient.Id == id, cancellationToken);

        if (!patientExists)
        {
            return Results.NotFound();
        }

        var items = await db.PatientStates
            .AsNoTracking()
            .Where(state => state.PatientId == id)
            .Select(state => new PatientStateResponse(
                state.Id,
                state.PatientId,
                state.Problem,
                state.Progress))
            .ToListAsync(cancellationToken);

        return Results.Ok(items);
    }

    private static async Task<IResult> CreatePatientState(
        Guid id,
        CreatePatientStateRequest request,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var patientExists = await db.Patients
            .AnyAsync(patient => patient.Id == id, cancellationToken);

        if (!patientExists)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Problem))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["problem"] = ["State problem description is required."],
            });
        }

        var state = new PatientState
        {
            Id = Guid.NewGuid(),
            PatientId = id,
            Problem = request.Problem.Trim(),
            Progress = string.IsNullOrWhiteSpace(request.Progress) ? "En cours" : request.Progress.Trim(),
        };

        db.PatientStates.Add(state);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/patients/{id}/states/{state.Id}", new PatientStateResponse(
            state.Id,
            state.PatientId,
            state.Problem,
            state.Progress));
    }

    private static async Task<IResult> DeletePatientState(
        Guid id,
        Guid stateId,
        DentistDbContext db,
        CancellationToken cancellationToken)
    {
        var state = await db.PatientStates
            .FirstOrDefaultAsync(
                candidate => candidate.Id == stateId && candidate.PatientId == id,
                cancellationToken);

        if (state is null)
        {
            return Results.NotFound();
        }

        db.PatientStates.Remove(state);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static Dictionary<string, string[]> Validate(
        string? fullName,
        string? firstName,
        string? lastName,
        string? phone,
        string? email)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(lastName))
        {
            errors["fullName"] = ["Le nom complet est obligatoire."];
        }

        if (!PhoneNumbers.TryNormalize(phone, out _))
        {
            errors["phone"] = ["Utilisez un numéro de téléphone valide (ex: +212612345678 ou 0612345678)."];
        }

        if (!string.IsNullOrWhiteSpace(email) && !email.Contains('@'))
        {
            errors["email"] = ["Adresse email invalide."];
        }

        return errors;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
