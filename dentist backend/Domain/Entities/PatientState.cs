namespace Dentist.Api.Domain.Entities;

/// <summary>
/// Clinical state of a patient: the problem they came with and the progress
/// made so far. One row per state entry, newest first in the UI.
/// </summary>
public sealed class PatientState
{
    public Guid Id { get; set; }

    public Guid PatientId { get; set; }

    public Patient Patient { get; set; } = null!;

    /// <summary>The problem / complaint the patient has.</summary>
    public string Problem { get; set; } = string.Empty;

    /// <summary>Progress made on that problem.</summary>
    public string Progress { get; set; } = string.Empty;
}