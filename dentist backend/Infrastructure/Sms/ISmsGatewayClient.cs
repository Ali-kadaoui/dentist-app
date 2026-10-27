namespace Dentist.Api.Infrastructure.Sms;

public interface ISmsGatewayClient
{
    /// <summary>Posts a single SMS to the Python gateway.</summary>
    Task<SmsSendOutcome> SendAsync(string to, string message, CancellationToken cancellationToken = default);

    /// <summary>Reads the gateway/modem health. Returns null when unreachable.</summary>
    Task<SmsGatewayHealth?> GetHealthAsync(bool probe = true, CancellationToken cancellationToken = default);
}
