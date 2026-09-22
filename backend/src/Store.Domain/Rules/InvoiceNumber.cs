using System.Globalization;
using System.Text.RegularExpressions;

namespace Store.Domain.Rules;

/// <summary>Invoice number format: <c>RIV-YYYYMMDD-NNNN</c> (daily sequential counter, zero-padded to at least 4 digits).</summary>
public static partial class InvoiceNumber
{
    public const string Prefix = "RIV";

    [GeneratedRegex(@"^RIV-\d{8}-\d{4,}$")]
    private static partial Regex Pattern();

    public static string Format(DateTime utcDate, long sequence)
    {
        if (sequence <= 0) throw new ArgumentOutOfRangeException(nameof(sequence));
        return $"{Prefix}-{utcDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}-{sequence.ToString("D4", CultureInfo.InvariantCulture)}";
    }

    public static bool IsValid(string? value) => !string.IsNullOrWhiteSpace(value) && Pattern().IsMatch(value);
}
