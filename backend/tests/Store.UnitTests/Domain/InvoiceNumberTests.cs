using Store.Domain.Rules;

namespace Store.UnitTests.Domain;

public class InvoiceNumberTests
{
    [Fact]
    public void Format_produces_RIV_yyyyMMdd_NNNN()
    {
        var date = new DateTime(2026, 9, 22, 23, 59, 0, DateTimeKind.Utc);
        Assert.Equal("RIV-20260922-0001", InvoiceNumber.Format(date, 1));
        Assert.Equal("RIV-20260922-0042", InvoiceNumber.Format(date, 42));
        Assert.Equal("RIV-20260922-9999", InvoiceNumber.Format(date, 9999));
    }

    [Fact]
    public void Format_grows_beyond_four_digits_without_truncation()
    {
        var date = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal("RIV-20260105-12345", InvoiceNumber.Format(date, 12345));
    }

    [Fact]
    public void Format_rejects_non_positive_sequence()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => InvoiceNumber.Format(DateTime.UtcNow, 0));
    }

    [Theory]
    [InlineData("RIV-20260922-0001", true)]
    [InlineData("RIV-20260922-12345", true)]
    [InlineData("riv-20260922-0001", false)]
    [InlineData("RIV-2026922-0001", false)]
    [InlineData("RIV-20260922-1", false)]
    [InlineData("INV-20260922-0001", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValid_matches_format(string? value, bool expected)
    {
        Assert.Equal(expected, InvoiceNumber.IsValid(value));
    }
}
