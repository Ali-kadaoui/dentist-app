namespace Dentist.Api.Common;

/// <summary>
/// The SMS gateway (and the Huawei modem behind it) only accepts international
/// numbers, so every phone number is normalized once, at the API boundary.
/// </summary>
public static class PhoneNumbers
{
    /// <summary>Normalizes a number to E.164 (<c>+212612345678</c>).</summary>
    public static bool TryNormalize(string? raw, out string normalized)
    {
        normalized = string.Empty;

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var trimmed = raw.Trim();
        if (!trimmed.StartsWith('+'))
        {
            return false;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());

        // E.164: 7 to 15 digits, never starting with 0.
        if (digits.Length is < 7 or > 15 || digits[0] == '0')
        {
            return false;
        }

        normalized = "+" + digits;
        return true;
    }
}
