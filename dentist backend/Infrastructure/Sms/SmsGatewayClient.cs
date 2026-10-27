using System.Net.Http.Json;
using System.Text.Json;

namespace Dentist.Api.Infrastructure.Sms;

/// <summary>
/// Thin client over the Python gateway (<c>POST /send-sms</c>, <c>GET /health</c>).
/// The gateway owns the modem; this class only translates its contract.
/// </summary>
public sealed class SmsGatewayClient(HttpClient http, ILogger<SmsGatewayClient> logger) : ISmsGatewayClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<SmsSendOutcome> SendAsync(string to, string message, CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await http.PostAsJsonAsync(
                "send-sms",
                new SmsGatewaySendRequest(to, message),
                JsonOptions,
                cancellationToken);

            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var sent = Deserialize<SmsGatewaySendResponse>(body);
                if (sent is not null)
                {
                    return SmsSendOutcome.Success(sent.MessageId, sent.RequestId);
                }

                logger.LogWarning(
                    "SMS gateway returned HTTP {StatusCode} with an unparsable body.",
                    (int)response.StatusCode);

                return SmsSendOutcome.Failure(
                    "GATEWAY_INVALID_RESPONSE",
                    "The SMS gateway returned an unexpected payload.",
                    (int)response.StatusCode);
            }

            var problem = Deserialize<SmsGatewayProblem>(body);
            var code = string.IsNullOrWhiteSpace(problem?.Code) ? "GATEWAY_ERROR" : problem!.Code!;
            var detail = problem?.Detail ?? $"The SMS gateway returned HTTP {(int)response.StatusCode}.";

            logger.LogWarning(
                "SMS gateway rejected the message for {Recipient}: {Code} (HTTP {StatusCode}).",
                Mask(to),
                code,
                (int)response.StatusCode);

            return SmsSendOutcome.Failure(code, detail, (int)response.StatusCode, ReadRetryAfter(response));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller went away: let the request pipeline handle it.
            throw;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("SMS gateway did not answer within {Timeout}.", http.Timeout);
            return SmsSendOutcome.Failure(
                "GATEWAY_TIMEOUT",
                "The SMS gateway did not respond in time.",
                StatusCodes.Status504GatewayTimeout);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "SMS gateway unreachable at {BaseAddress}.", http.BaseAddress);
            return SmsSendOutcome.Failure(
                "GATEWAY_UNREACHABLE",
                "The SMS gateway is unreachable. Verify that the Python service is running.",
                StatusCodes.Status503ServiceUnavailable);
        }
    }

    public async Task<SmsGatewayHealth?> GetHealthAsync(bool probe = true, CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await http.GetAsync(probe ? "health?probe=true" : "health", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("SMS gateway health returned HTTP {StatusCode}.", (int)response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            return Deserialize<SmsGatewayHealth>(body);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    private static T? Deserialize<T>(string body) where T : class
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(body, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static int? ReadRetryAfter(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;

        if (retryAfter?.Delta is { } delta)
        {
            return (int)Math.Ceiling(delta.TotalSeconds);
        }

        if (retryAfter?.Date is { } date)
        {
            return Math.Max(0, (int)Math.Ceiling((date - DateTimeOffset.UtcNow).TotalSeconds));
        }

        return null;
    }

    private static string Mask(string phone) =>
        phone.Length <= 4 ? phone : new string('*', phone.Length - 4) + phone[^4..];
}
