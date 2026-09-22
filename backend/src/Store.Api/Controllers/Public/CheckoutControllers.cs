using Microsoft.AspNetCore.Mvc;
using Store.Api.Filters;
using Store.Application.Features.DiscountCodes;
using Store.Application.Features.Orders;
using Store.Application.Features.Orders.Commands;

namespace Store.Api.Controllers.Public;

[Route("api/v1/discount-codes")]
public sealed class DiscountCodesController : ApiControllerBase
{
    public sealed record ValidateRequest(string? Code, decimal Subtotal);

    /// <summary>Validates a code against a subtotal. Never increments UsageCount.</summary>
    [HttpPost("validate")]
    public async Task<IActionResult> Validate([FromBody] ValidateRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new ValidateDiscountCodeCommand(request.Code, request.Subtotal), ct));
}

[Route("api/v1/orders")]
public sealed class OrdersController : ApiControllerBase
{
    /// <summary>
    /// Guest checkout. Headers: <c>X-Device-Fingerprint</c> (anti-fraud), <c>Idempotency-Key</c> (required; replays return the original response).
    /// Errors: 422 validation, 409 OUT_OF_STOCK, 429 RATE_LIMITED / DEVICE_BLOCKED, 409 DUPLICATE_REQUEST (same key in flight).
    /// </summary>
    [HttpPost]
    [Idempotent]
    public async Task<IActionResult> Create([FromBody] CreateOrderInput input, CancellationToken ct)
    {
        var key = Request.Headers[IdempotencyFilter.HeaderName].FirstOrDefault();
        var result = await Sender.Send(new CreateOrderCommand(input, key), ct);
        return Created(result);
    }
}
