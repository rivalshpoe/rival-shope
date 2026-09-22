using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Store.Application.Features.Orders.Commands;
using Store.Application.Features.Orders.Queries;
using Store.Domain.Enums;

namespace Store.Api.Controllers.Admin;

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/orders")]
public sealed class AdminOrdersController : ApiControllerBase
{
    public sealed record UpdateStatusRequest(OrderStatus Status);
    public sealed record CollectRequest(IReadOnlyList<string> InvoiceNumbers);

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] OrderStatus? status, [FromQuery] string? search, [FromQuery] DateTime? from,
        [FromQuery] DateTime? to, [FromQuery] bool? isCollected, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetAdminOrdersQuery(status, search, from, to, isCollected, page, pageSize), ct));

    /// <summary>Collected invoices (must be declared before the {id} route to avoid ambiguity).</summary>
    [HttpGet("collected")]
    public async Task<IActionResult> GetCollected([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetCollectedOrdersQuery(page, pageSize), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        Success(await Sender.Send(new GetAdminOrderByIdQuery(id), ct));

    /// <summary>Pending → Confirmed | Cancelled | Fake (Confirmed → Cancelled | Fake). 409 INVOICE_LOCKED after 30 days.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateOrderStatusCommand(id, request.Status), ct));

    /// <summary>Batch collection by invoice numbers (one transaction).</summary>
    [HttpPatch("collect")]
    public async Task<IActionResult> Collect([FromBody] CollectRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new CollectOrdersCommand(request.InvoiceNumbers ?? Array.Empty<string>()), ct));
}
