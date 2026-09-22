using Store.Domain.Enums;

namespace Store.Domain.Rules;

/// <summary>
/// Allowed transitions: Pending → Confirmed | Cancelled | Fake; Confirmed → Cancelled | Fake.
/// Cancelled and Fake are terminal. Stock is returned exactly once, when the order enters Cancelled or Fake.
/// </summary>
public static class OrderStatusRules
{
    public static bool CanTransition(OrderStatus from, OrderStatus to)
    {
        if (from == to) return false;
        return from switch
        {
            OrderStatus.Pending => to is OrderStatus.Confirmed or OrderStatus.Cancelled or OrderStatus.Fake,
            OrderStatus.Confirmed => to is OrderStatus.Cancelled or OrderStatus.Fake,
            _ => false
        };
    }

    public static bool IsTerminal(OrderStatus status) => status is OrderStatus.Cancelled or OrderStatus.Fake;

    public static bool ReturnsStock(OrderStatus from, OrderStatus to) => !IsTerminal(from) && IsTerminal(to);

    /// <summary>Fake orders are excluded from every sales metric.</summary>
    public static bool CountsTowardsSales(OrderStatus status) => status == OrderStatus.Confirmed;
}
