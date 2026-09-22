using Store.Domain.Entities;
using Store.Domain.Enums;
using Store.Domain.Exceptions;
using Store.Domain.Rules;

namespace Store.UnitTests.Domain;

public class OrderStatusTests
{
    private static readonly DateTime Created = new(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc);

    private static Order NewOrder(OrderStatus status = OrderStatus.Pending) => new()
    {
        InvoiceNumber = "RIV-20260901-0001",
        Status = status,
        CreatedAt = Created,
        EditableUntil = Created.AddDays(Order.EditableWindowDays)
    };

    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Confirmed, true)]
    [InlineData(OrderStatus.Pending, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Pending, OrderStatus.Fake, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Fake, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Pending, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Confirmed, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Pending, false)]
    [InlineData(OrderStatus.Fake, OrderStatus.Confirmed, false)]
    [InlineData(OrderStatus.Fake, OrderStatus.Cancelled, false)]
    [InlineData(OrderStatus.Pending, OrderStatus.Pending, false)]
    public void Transition_rules(OrderStatus from, OrderStatus to, bool allowed)
    {
        Assert.Equal(allowed, OrderStatusRules.CanTransition(from, to));
    }

    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Pending, OrderStatus.Fake, true)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Pending, OrderStatus.Confirmed, false)]
    public void Stock_is_returned_only_when_entering_a_terminal_state(OrderStatus from, OrderStatus to, bool returns)
    {
        Assert.Equal(returns, OrderStatusRules.ReturnsStock(from, to));
    }

    [Fact]
    public void Only_confirmed_orders_count_towards_sales()
    {
        Assert.True(OrderStatusRules.CountsTowardsSales(OrderStatus.Confirmed));
        Assert.False(OrderStatusRules.CountsTowardsSales(OrderStatus.Fake));
        Assert.False(OrderStatusRules.CountsTowardsSales(OrderStatus.Pending));
        Assert.False(OrderStatusRules.CountsTowardsSales(OrderStatus.Cancelled));
    }

    [Fact]
    public void ChangeStatus_within_window_updates_status_and_reports_stock_return()
    {
        var order = NewOrder();
        var returns = order.ChangeStatus(OrderStatus.Cancelled, Created.AddDays(10));
        Assert.True(returns);
        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void ChangeStatus_to_confirmed_does_not_return_stock()
    {
        var order = NewOrder();
        Assert.False(order.ChangeStatus(OrderStatus.Confirmed, Created.AddDays(1)));
    }

    [Fact]
    public void ChangeStatus_after_30_days_throws_INVOICE_LOCKED()
    {
        var order = NewOrder();
        var ex = Assert.Throws<DomainException>(() => order.ChangeStatus(OrderStatus.Confirmed, Created.AddDays(30).AddSeconds(1)));
        Assert.Equal("INVOICE_LOCKED", ex.ErrorCode);
        Assert.Equal(OrderStatus.Pending, order.Status);
    }

    [Fact]
    public void ChangeStatus_exactly_at_EditableUntil_is_still_allowed()
    {
        var order = NewOrder();
        order.ChangeStatus(OrderStatus.Confirmed, Created.AddDays(30));
        Assert.Equal(OrderStatus.Confirmed, order.Status);
    }

    [Fact]
    public void ChangeStatus_illegal_transition_throws_CONFLICT()
    {
        var order = NewOrder(OrderStatus.Cancelled);
        var ex = Assert.Throws<DomainException>(() => order.ChangeStatus(OrderStatus.Confirmed, Created.AddDays(1)));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public void CanEdit_reflects_window()
    {
        var order = NewOrder();
        Assert.True(order.CanEdit(Created.AddDays(29)));
        Assert.False(order.CanEdit(Created.AddDays(31)));
    }
}
