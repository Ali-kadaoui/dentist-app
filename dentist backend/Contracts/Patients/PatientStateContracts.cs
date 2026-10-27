using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Contracts.Patients;

/// <summary>One "problem / progress" entry in a patient's file.</summary>
public sealed record PatientStateResponse(
    Guid Id,
    Guid PatientId,
    string Problem,
    string Progress)
{
    public static PatientStateResponse From(PatientState state) => new(
        state.Id,
        state.PatientId,
        state.Problem,
        state.Progress);
}

public sealed record CreatePatientStateRequest(
    string? Problem,
    string? Progress);
