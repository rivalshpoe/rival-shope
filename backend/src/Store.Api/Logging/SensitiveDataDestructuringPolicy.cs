using System.Collections;
using System.Reflection;
using Serilog.Core;
using Serilog.Events;

namespace Store.Api.Logging;

/// <summary>
/// Serilog destructuring policy applied to every <c>{@Object}</c>: properties whose names look sensitive
/// (Authorization/Cookie headers, phone numbers, device fingerprints, OTP codes, tokens, secrets, passwords)
/// are replaced with <c>***</c> before the event reaches any sink. Header dictionaries are handled too.
/// </summary>
public sealed class SensitiveDataDestructuringPolicy : IDestructuringPolicy
{
    private static readonly string[] SensitiveFragments =
    [
        "authorization", "cookie", "phone", "whatsappnumber", "fingerprint", "otp", "token", "refresh", "secret",
        "password", "apikey", "api-key", "aeskey", "hmac", "devicehash", "address"
    ];

    // Exact names (case-insensitive) that are too generic to match as fragments (ErrorCode/StatusCode must stay visible).
    private static readonly HashSet<string> SensitiveExact = new(StringComparer.OrdinalIgnoreCase) { "code", "codehash", "pin" };

    private static readonly Type[] PassThrough = [typeof(string), typeof(Guid), typeof(DateTime), typeof(DateTimeOffset), typeof(TimeSpan), typeof(decimal)];

    public static bool IsSensitiveName(string? name)
    {
        if (string.IsNullOrEmpty(name)) return false;
        if (SensitiveExact.Contains(name)) return true;
        foreach (var fragment in SensitiveFragments)
            if (name.Contains(fragment, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    public bool TryDestructure(object value, ILogEventPropertyValueFactory propertyValueFactory, out LogEventPropertyValue result)
    {
        result = null!;
        if (value is null) return false;
        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum || PassThrough.Contains(type) || value is Exception) return false;

        // Header collections / dictionaries with string keys (IHeaderDictionary, Dictionary<string, ...>).
        if (value is IEnumerable<KeyValuePair<string, Microsoft.Extensions.Primitives.StringValues>> headers)
        {
            result = new DictionaryValue(headers.Select(kv => new KeyValuePair<ScalarValue, LogEventPropertyValue>(
                new ScalarValue(kv.Key), Mask(kv.Key, kv.Value.ToString(), propertyValueFactory))));
            return true;
        }
        if (value is IDictionary dictionary && dictionary.Keys.Cast<object>().All(k => k is string))
        {
            var entries = new List<KeyValuePair<ScalarValue, LogEventPropertyValue>>();
            foreach (DictionaryEntry entry in dictionary)
                entries.Add(new KeyValuePair<ScalarValue, LogEventPropertyValue>(new ScalarValue(entry.Key), Mask((string)entry.Key, entry.Value, propertyValueFactory)));
            result = new DictionaryValue(entries);
            return true;
        }
        if (value is IEnumerable) return false; // let Serilog enumerate; each element passes through this policy again

        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
            .ToArray();
        if (properties.Length == 0) return false;

        var structureProperties = new List<LogEventProperty>(properties.Length);
        foreach (var property in properties)
        {
            object? propertyValue;
            try { propertyValue = property.GetValue(value); }
            catch { propertyValue = "<error>"; }
            structureProperties.Add(new LogEventProperty(property.Name, Mask(property.Name, propertyValue, propertyValueFactory)));
        }
        result = new StructureValue(structureProperties, type.Name);
        return true;
    }

    private static LogEventPropertyValue Mask(string name, object? value, ILogEventPropertyValueFactory factory) =>
        value is not null && IsSensitiveName(name)
            ? new ScalarValue("***")
            : factory.CreatePropertyValue(value, destructureObjects: true);
}
