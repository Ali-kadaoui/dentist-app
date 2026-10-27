using System.Globalization;
using Dentist.Api.Domain.Entities;

namespace Dentist.Api.Infrastructure.Sms;

/// <summary>
/// Renders reminder text for an appointment.
/// Supported tokens: {name}, {firstName}, {lastName}, {date}, {time}, {phone}.
/// </summary>
public static class ReminderTemplate
{
    public const string Default =
        "Bonjour {name}, rappel : votre rendez-vous au cabinet dentaire est prevu le {date}. Merci de confirmer.";

    private static readonly CultureInfo FrCulture = new("fr-FR");

    public static string Render(string template, Patient patient, Appointment appointment)
    {
        var fullName = $"{patient.FirstName} {patient.LastName}".Trim();
        var formattedDateFr = appointment.Date.ToString("d MMMM yyyy", FrCulture);
        var shortDate = appointment.Date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["firstName"] = patient.FirstName,
            ["prenom"] = patient.FirstName,
            ["lastName"] = patient.LastName,
            ["nom"] = patient.LastName,
            ["name"] = fullName,
            ["fullName"] = fullName,
            ["nomComplet"] = fullName,
            ["patient"] = fullName,
            ["phone"] = patient.Phone,
            ["telephone"] = patient.Phone,
            ["date"] = formattedDateFr,
            ["dateCourte"] = shortDate,
            ["time"] = "09:00",
            ["heure"] = "09:00",
            ["cabinet"] = "Cabinet Dentaire",
            ["clinic"] = "Cabinet Dentaire",
        };

        var rendered = template;

        foreach (var (token, value) in values)
        {
            rendered = rendered.Replace("{" + token + "}", value, StringComparison.OrdinalIgnoreCase);
        }

        return rendered.Trim();
    }
}
