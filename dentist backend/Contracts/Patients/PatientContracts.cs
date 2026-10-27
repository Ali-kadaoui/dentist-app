using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Patients;

public sealed record PatientListItem(
    Guid Id,
    string FullName,
    string FirstName,
    string LastName,
    string Phone,
    DateOnly? DateOfBirth,
    int? Age,
    string? Profession,
    string? Cin,
    string? Address,
    string? Email,
    string? Notes = null);

public sealed record PatientResponse(
    Guid Id,
    string FullName,
    string FirstName,
    string LastName,
    string Phone,
    DateOnly? DateOfBirth,
    int? Age,
    string? Profession,
    string? Cin,
    string? Address,
    string? Email,
    string? Gender,
    string? Notes)
{
    public static PatientResponse From(Patient patient) => new(
        patient.Id,
        string.IsNullOrWhiteSpace(patient.FullName)
            ? $"{patient.FirstName} {patient.LastName}".Trim()
            : patient.FullName,
        patient.FirstName,
        patient.LastName,
        patient.Phone,
        patient.DateOfBirth,
        patient.Age,
        patient.Profession,
        patient.Cin,
        patient.Address,
        patient.Email,
        patient.Gender,
        patient.Notes);
}

public sealed record CreatePatientRequest(
    string? FullName,
    string? FirstName,
    string? LastName,
    string? Phone,
    DateOnly? DateOfBirth,
    string? Profession,
    string? Cin,
    string? Address,
    string? Email = null,
    string? Gender = null,
    string? Notes = null);

public sealed record UpdatePatientRequest(
    string? FullName,
    string? FirstName,
    string? LastName,
    string? Phone,
    DateOnly? DateOfBirth,
    string? Profession,
    string? Cin,
    string? Address,
    string? Email = null,
    string? Gender = null,
    string? Notes = null);
