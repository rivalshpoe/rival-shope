using Store.Domain.Common;

namespace Store.Domain.Entities;

public class Review : AuditableEntity
{
    public string CustomerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }
    public bool IsApproved { get; set; }
}
