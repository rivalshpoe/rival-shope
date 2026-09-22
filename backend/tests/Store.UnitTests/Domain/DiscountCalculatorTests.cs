using Store.Domain.Entities;
using Store.Domain.Rules;

namespace Store.UnitTests.Domain;

public class DiscountCalculatorTests
{
    private static readonly DateTime Now = new(2026, 9, 22, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(250.0, 10, 25.0)]
    [InlineData(99.99, 15, 15.0)]     // 14.9985 → 15.00 (half away from zero)
    [InlineData(100.0, 100, 100.0)]
    [InlineData(0.0, 50, 0.0)]
    [InlineData(10.0, 0, 0.0)]
    [InlineData(33.33, 33, 11.0)]     // 10.9989 → 11.00
    public void Calculate_returns_rounded_percentage(decimal subtotal, int pct, decimal expected)
    {
        Assert.Equal(expected, DiscountCalculator.Calculate(subtotal, pct));
    }

    [Fact]
    public void Calculate_never_exceeds_subtotal_or_100_percent()
    {
        Assert.Equal(50m, DiscountCalculator.Calculate(50m, 150));
    }

    private static DiscountCode Code(DateTime start, DateTime end, bool active = true, bool deleted = false) => new()
    {
        Code = "SAVE10", PercentageOff = 10, StartAt = start, EndAt = end, IsActive = active, IsDeleted = deleted
    };

    [Fact]
    public void TryApply_inside_window_returns_amount()
    {
        var code = Code(Now.AddDays(-1), Now.AddDays(1));
        Assert.Equal(25m, DiscountCalculator.TryApply(code, 250m, Now));
    }

    [Fact]
    public void TryApply_before_start_is_invalid()
    {
        var code = Code(Now.AddMinutes(1), Now.AddDays(1));
        Assert.Null(DiscountCalculator.TryApply(code, 250m, Now));
    }

    [Fact]
    public void TryApply_after_end_is_invalid()
    {
        var code = Code(Now.AddDays(-2), Now.AddSeconds(-1));
        Assert.Null(DiscountCalculator.TryApply(code, 250m, Now));
    }

    [Fact]
    public void TryApply_window_bounds_are_inclusive()
    {
        var code = Code(Now, Now);
        Assert.Equal(25m, DiscountCalculator.TryApply(code, 250m, Now));
    }

    [Fact]
    public void TryApply_inactive_or_deleted_or_missing_is_invalid()
    {
        Assert.Null(DiscountCalculator.TryApply(Code(Now.AddDays(-1), Now.AddDays(1), active: false), 100m, Now));
        Assert.Null(DiscountCalculator.TryApply(Code(Now.AddDays(-1), Now.AddDays(1), deleted: true), 100m, Now));
        Assert.Null(DiscountCalculator.TryApply(null, 100m, Now));
    }
}
