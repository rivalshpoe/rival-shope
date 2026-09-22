using Store.Domain.Common;

namespace Store.Domain.Entities;

public class Policy : AuditableEntity
{
    public static readonly string[] AllowedKeys = ["order", "cancellation", "returns", "shipping", "privacy"];

    /// <summary>One of <see cref="AllowedKeys"/>.</summary>
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}
