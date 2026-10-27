namespace Dentist.Api.Infrastructure.Sms;

/// <summary>Bound from the "SmsGateway" configuration section.</summary>
public sealed class SmsGatewayOptions
{
    public const string SectionName = "SmsGateway";

    /// <summary>Base URL of the Python FastAPI gateway (no trailing slash needed).</summary>
    public string BaseUrl { get; set; } = "http://127.0.0.1:8000";

    /// <summary>Optional shared secret, forwarded as the X-API-Key header.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Must stay above the gateway's own 30 s send timeout.</summary>
    public int TimeoutSeconds { get; set; } = 40;

    /// <summary>Single GSM-7 segment. Longer texts need concatenation support.</summary>
    public int MaxMessageLength { get; set; } = 160;
}
