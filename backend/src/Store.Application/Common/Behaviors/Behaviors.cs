using System.Diagnostics;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Store.Application.Common.Behaviors;

/// <summary>Runs every registered FluentValidation validator; failures become a 422 <see cref="Exceptions.ValidationException"/>.</summary>
public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators) => _validators = validators;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (_validators.Any())
        {
            var context = new ValidationContext<TRequest>(request);
            var results = await Task.WhenAll(_validators.Select(v => v.ValidateAsync(context, cancellationToken)));
            var failures = results.SelectMany(r => r.Errors).Where(f => f is not null).ToList();
            if (failures.Count > 0)
            {
                var fieldErrors = failures
                    .GroupBy(f => ToCamelCase(f.PropertyName))
                    .ToDictionary(g => g.Key, g => g.First().ErrorMessage);
                throw new Exceptions.ValidationException(fieldErrors);
            }
        }
        return await next(cancellationToken);
    }

    /// <summary>Wrapper properties commands use to carry the HTTP body; stripped so keys match the JSON the client sent.</summary>
    private static readonly string[] BodyWrappers = ["Input.", "Body.", "Request.", "Dto."];

    internal static string ToCamelCase(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        foreach (var wrapper in BodyWrappers)
        {
            if (name.StartsWith(wrapper, StringComparison.Ordinal) && name.Length > wrapper.Length)
            {
                name = name[wrapper.Length..];
                break;
            }
        }
        // "Items[0].Quantity" -> "items[0].quantity"
        var parts = name.Split('.');
        for (var i = 0; i < parts.Length; i++)
        {
            if (parts[i].Length > 0 && char.IsUpper(parts[i][0]))
                parts[i] = char.ToLowerInvariant(parts[i][0]) + parts[i][1..];
        }
        return string.Join('.', parts);
    }
}

/// <summary>Structured timing log per request. Never logs request payloads (may contain PII).</summary>
public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger) => _logger = logger;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var name = typeof(TRequest).Name;
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await next(cancellationToken);
            sw.Stop();
            if (sw.ElapsedMilliseconds > 500)
                _logger.LogWarning("Slow request {RequestName} took {ElapsedMs}ms", name, sw.ElapsedMilliseconds);
            else
                _logger.LogDebug("Handled {RequestName} in {ElapsedMs}ms", name, sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exceptions.AppException ex)
        {
            _logger.LogInformation("Request {RequestName} failed with {ErrorCode} after {ElapsedMs}ms", name, ex.ErrorCode, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
