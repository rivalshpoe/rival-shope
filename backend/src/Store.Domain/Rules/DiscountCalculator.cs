using Store.Domain.Entities;

namespace Store.Domain.Rules;

public static class DiscountCalculator
{
    /// <summary>Percentage discount rounded half-away-from-zero to 2 decimals, never exceeding the subtotal.</summary>
    public static decimal Calculate(decimal subtotal, int percentageOff)
    {
        if (subtotal <= 0 || percentageOff <= 0) return 0m;
        var pct = Math.Min(percentageOff, 100);
        var amount = Math.Round(subtotal * pct / 100m, 2, MidpointRounding.AwayFromZero);
        return Math.Min(amount, subtotal);
    }

    /// <summary>Returns the discount amount if the code is valid at <paramref name="utcNow"/>, otherwise null.</summary>
    public static decimal? TryApply(DiscountCode? code, decimal subtotal, DateTime utcNow)
    {
        if (code is null || !code.IsCurrentlyValid(utcNow)) return null;
        return Calculate(subtotal, code.PercentageOff);
    }
}
