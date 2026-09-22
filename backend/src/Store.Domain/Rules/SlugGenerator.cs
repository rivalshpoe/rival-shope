using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Store.Domain.Rules;

/// <summary>Builds URL-safe slugs; keeps Arabic letters (URL-encoded by clients) and Latin alphanumerics.</summary>
public static partial class SlugGenerator
{
    [GeneratedRegex(@"[^\p{L}\p{Nd}\-]+")]
    private static partial Regex Invalid();

    [GeneratedRegex(@"-{2,}")]
    private static partial Regex Dashes();

    public static string Generate(string input, int maxLength = 120)
    {
        if (string.IsNullOrWhiteSpace(input)) return Guid.NewGuid().ToString("N")[..8];

        var normalized = input.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsWhiteSpace(c) || c == '_' ? '-' : c);
        }

        var slug = Invalid().Replace(sb.ToString(), "-");
        slug = Dashes().Replace(slug, "-").Trim('-');
        if (slug.Length > maxLength) slug = slug[..maxLength].Trim('-');
        return string.IsNullOrEmpty(slug) ? Guid.NewGuid().ToString("N")[..8] : slug;
    }
}
