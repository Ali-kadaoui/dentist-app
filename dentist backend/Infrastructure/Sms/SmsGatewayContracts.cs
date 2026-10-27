using System.Text.Json.Serialization;

namespace Dentist.Api.Infrastructure.Sms;

// Wire contracts mirroring the FastAPI schemas in `sms/app/schemas.py`.

internal sealed record SmsGatewaySendRequest(string To, string Message);

internal sealed record SmsGatewaySendResponse
{
    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }

    [JsonPropertyName("message_id")]
    public string? MessageId { get; init; }

    public string? Status { get; init; }

    [JsonPropertyName("sent_at")]
    public DateTimeOffset? SentAt { get; init; }
}

/// <summary>RFC 9457 problem details returned by the gateway on failure.</summary>
public sealed record SmsGatewayProblem
{
    public string? Type { get; init; }

    public string? Title { get; init; }

    public int? Status { get; init; }

    public string? Code { get; init; }

    public string? Detail { get; init; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }

    [JsonPropertyName("modem_code")]
    public string? ModemCode { get; init; }
}

/// <summary>Payload of <c>GET /health?probe=true</c>.</summary>
public sealed record SmsGatewayHealth
{
    public string? Status { get; init; }

    public string? Transport { get; init; }

    public bool? Configured { get; init; }

    public SmsGatewayModem? Modem { get; init; }
}

public sealed record SmsGatewayModem
{
    public bool Reachable { get; init; }

    public string? Port { get; init; }

    [JsonPropertyName("base_url")]
    public string? BaseUrl { get; init; }

    public string? Model { get; init; }

    public string? Sim { get; init; }

    public string? Smsc { get; init; }

    public int? Signal { get; init; }

    public bool? Registered { get; init; }

    public string? Error { get; init; }
}
