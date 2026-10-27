namespace Dentist.Api.Infrastructure.Sms;

/// <summary>
/// Result of one gateway call. Failures are values, not exceptions, so the
/// endpoint can map them to a status code without storing a message row.
/// </summary>
public sealed record SmsSendOutcome
{
    public bool Succeeded { get; private init; }

    public string? MessageId { get; private init; }

    public string? GatewayRequestId { get; private init; }

    public string? ErrorCode { get; private init; }

    public string? ErrorDetail { get; private init; }

    public int UpstreamStatus { get; private init; }

    public int? RetryAfterSeconds { get; private init; }

    public static SmsSendOutcome Success(string? messageId, string? gatewayRequestId) => new()
    {
        Succeeded = true,
        MessageId = messageId,
        GatewayRequestId = gatewayRequestId,
        UpstreamStatus = StatusCodes.Status200OK,
    };

    public static SmsSendOutcome Failure(
        string errorCode,
        string errorDetail,
        int upstreamStatus,
        int? retryAfterSeconds = null) => new()
    {
        Succeeded = false,
        ErrorCode = errorCode,
        ErrorDetail = errorDetail,
        UpstreamStatus = upstreamStatus,
        RetryAfterSeconds = retryAfterSeconds,
    };
}
