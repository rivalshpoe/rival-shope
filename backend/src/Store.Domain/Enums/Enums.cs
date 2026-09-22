namespace Store.Domain.Enums;

public enum OrderStatus
{
    Pending = 0,
    Confirmed = 1,
    Cancelled = 2,
    Fake = 3
}

public enum InventoryChangeType
{
    Sale = 0,
    Restock = 1,
    Depleted = 2,
    Return = 3
}

public enum NotificationType
{
    NewOrder = 0,
    LowStock = 1,
    Depleted = 2
}
