namespace Dentist.Api.Domain.Entities;

/// <summary>
/// A patient file with core identity, demographic, contact details and clinical references.
/// </summary>
public sealed class Patient
{
    public Guid Id { get; set; }

    /// <summary>Full display name calculated from First and Last name.</summary>
    public string FullName => $"{FirstName} {LastName}".Trim();

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    /// <summary>Date of birth.</summary>
    public DateOnly? DateOfBirth { get; set; }

    /// <summary>Calculated age derived from Date of Birth.</summary>
    public int? Age => CalculateAge(DateOfBirth);

    /// <summary>Profession / Occupation (e.g. "Ingénieur", "Enseignant").</summary>
    public string? Profession { get; set; }

    /// <summary>National ID / CIN (e.g. "AB123456").</summary>
    public string? Cin { get; set; }

    /// <summary>Phone number, used as SMS recipient.</summary>
    public string Phone { get; set; } = string.Empty;

    /// <summary>Postal / Street Address.</summary>
    public string? Address { get; set; }

    public string? Email { get; set; }

    public string? Gender { get; set; }

    public string? Notes { get; set; }

    public List<Appointment> Appointments { get; set; } = [];

    public List<PatientState> PatientStates { get; set; } = [];

    public static int? CalculateAge(DateOnly? dob)
    {
        if (!dob.HasValue) return null;
        var today = DateOnly.FromDateTime(DateTime.Today);
        var age = today.Year - dob.Value.Year;
        if (dob.Value > today.AddYears(-age)) age--;
        return age >= 0 ? age : null;
    }
}
