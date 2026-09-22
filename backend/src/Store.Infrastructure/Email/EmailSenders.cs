using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Options;

namespace Store.Infrastructure.Email;

/// <summary>
/// Resend (https://resend.com) transport. API key is read from configuration <c>Resend:ApiKey</c> (env RESEND__APIKEY) — never hard-coded.
/// The typed HttpClient is wrapped with the standard resilience handler (retry + circuit breaker + timeout) in DI.
/// </summary>
public sealed partial class ResendEmailSender : IEmailSender
{
    private readonly HttpClient _http;
    private readonly ResendOptions _options;
    private readonly ILogger<ResendEmailSender> _logger;

    public ResendEmailSender(HttpClient http, IOptions<ResendOptions> options, ILogger<ResendEmailSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException("Resend:ApiKey is not configured.");

        using var request = new HttpRequestMessage(HttpMethod.Post, "emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        request.Content = JsonContent.Create(new { from = _options.From, to = new[] { to }, subject, html = htmlBody });

        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            // Never log the recipient in full or the message body (contains the OTP).
            _logger.LogError("Resend returned {StatusCode}: {Body}", (int)response.StatusCode, Redact(body));
            throw new HttpRequestException($"Resend API failed with status {(int)response.StatusCode}");
        }
    }

    [GeneratedRegex(@"\d{6}")]
    private static partial Regex SixDigits();

    private static string Redact(string body) => SixDigits().Replace(body.Length > 500 ? body[..500] : body, "******");
}

/// <summary>Development transport: logs the message (OTP visible in console) instead of sending.</summary>
public sealed class DevelopmentEmailSender : IEmailSender
{
    private readonly ILogger<DevelopmentEmailSender> _logger;
    public DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger) => _logger = logger;

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var text = System.Text.RegularExpressions.Regex.Replace(htmlBody, "<[^>]+>", " ");
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ").Trim();
        _logger.LogWarning("[DEV EMAIL] To: {To} | Subject: {Subject} | Body: {Body}", to, subject, text);
        return Task.CompletedTask;
    }
}
