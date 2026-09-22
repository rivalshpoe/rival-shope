using Store.Application.Features.Orders;
using Store.Application.Features.Orders.Commands;
using Store.Application.Features.Products.Queries;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using NSubstitute;

namespace Store.UnitTests.Application;

public class ValidatorTests
{
    private static CreateOrderInput ValidInput() => new(
        Items: [new CreateOrderItemInput(Guid.NewGuid(), null, null, 2)],
        NeedsDelivery: true,
        DeliveryZoneId: Guid.NewGuid(),
        Address: "رام الله - المصيون",
        CustomerName: "سارة",
        PhoneNumber: "599123456",
        WhatsAppCountryCode: "970",
        DiscountCode: null);

    [Fact]
    public void CreateOrder_valid_input_passes()
    {
        var result = new CreateOrderCommandValidator().Validate(new CreateOrderCommand(ValidInput(), "key-1"));
        Assert.True(result.IsValid, string.Join(", ", result.Errors.Select(e => e.ErrorMessage)));
    }

    [Fact]
    public void CreateOrder_requires_items_phone_and_address_when_delivering()
    {
        var input = ValidInput() with { Items = [], PhoneNumber = "12ab", Address = null };
        var result = new CreateOrderCommandValidator().Validate(new CreateOrderCommand(input, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Input.Items");
        Assert.Contains(result.Errors, e => e.PropertyName == "Input.PhoneNumber");
        Assert.Contains(result.Errors, e => e.PropertyName == "Input.Address");
    }

    [Fact]
    public void CreateOrder_quantity_out_of_range_fails()
    {
        var input = ValidInput() with { Items = [new CreateOrderItemInput(Guid.NewGuid(), null, null, 0)] };
        var result = new CreateOrderCommandValidator().Validate(new CreateOrderCommand(input, null));
        Assert.Contains(result.Errors, e => e.PropertyName == "Input.Items[0].Quantity");
    }

    [Fact]
    public async Task Search_longer_than_100_chars_is_rejected_before_touching_the_database()
    {
        var db = Substitute.For<IApplicationDbContext>();
        var cache = Substitute.For<ICacheService>();
        var clock = Substitute.For<IDateTimeProvider>();
        var handler = new SearchProductsQueryHandler(db, cache, clock);

        var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
            handler.Handle(new SearchProductsQuery(new string('a', 101), 1, 10), CancellationToken.None));

        Assert.Equal(ErrorCodes.SearchTooLong, ex.ErrorCode);
        Assert.Equal(400, ex.StatusCode);
        db.DidNotReceive().SearchProducts(Arg.Any<string>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Search_with_empty_query_returns_empty_page_without_database_access()
    {
        var db = Substitute.For<IApplicationDbContext>();
        var handler = new SearchProductsQueryHandler(db, Substitute.For<ICacheService>(), Substitute.For<IDateTimeProvider>());

        var result = await handler.Handle(new SearchProductsQuery("   ", 1, 10), CancellationToken.None);

        Assert.Empty(result.Items);
        db.DidNotReceive().SearchProducts(Arg.Any<string>(), Arg.Any<bool>());
    }

    [Theory]
    [InlineData(null, null, 1, 10)]
    [InlineData(0, 0, 1, 10)]
    [InlineData(3, 500, 3, 50)]
    [InlineData(-5, 20, 1, 20)]
    public void Paging_is_normalised_and_capped_at_50(int? page, int? pageSize, int expectedPage, int expectedSize)
    {
        var (p, ps) = Paging.Normalize(page, pageSize);
        Assert.Equal(expectedPage, p);
        Assert.Equal(expectedSize, ps);
    }
}
