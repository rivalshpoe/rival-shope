using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Store.Application.Features.Analytics;
using Store.Application.Features.AuditLogs;
using Store.Application.Features.DeliveryZones;
using Store.Application.Features.Devices;
using Store.Application.Features.DiscountCodes;
using Store.Application.Features.Inventory;
using Store.Application.Features.Notifications;
using Store.Application.Features.Policies;
using Store.Application.Features.Reviews;

namespace Store.Api.Controllers.Admin;

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/delivery-zones")]
public sealed class AdminDeliveryZonesController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetDeliveryZonesQuery(ActiveOnly: false), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DeliveryZoneInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateDeliveryZoneCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DeliveryZoneInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateDeliveryZoneCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteDeliveryZoneCommand(id), ct);
        return SuccessNoContent();
    }
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/discount-codes")]
public sealed class AdminDiscountCodesController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetDiscountCodesQuery(), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DiscountCodeInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateDiscountCodeCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DiscountCodeInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateDiscountCodeCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteDiscountCodeCommand(id), ct);
        return SuccessNoContent();
    }
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/inventory")]
public sealed class AdminInventoryController : ApiControllerBase
{
    public sealed record RestockRequest(Guid ProductId, Guid? SizeId, int Quantity, string? Note);

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] bool lowStockOnly = false, [FromQuery] int? threshold = null,
        [FromQuery] int? page = null, [FromQuery] int? pageSize = null, CancellationToken ct = default) =>
        Success(await Sender.Send(new GetInventoryQuery(lowStockOnly, threshold, page, pageSize), ct));

    [HttpPost("restock")]
    public async Task<IActionResult> Restock([FromBody] RestockRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new RestockCommand(request.ProductId, request.SizeId, request.Quantity, request.Note), ct));

    [HttpGet("{productId:guid}/history")]
    public async Task<IActionResult> History(Guid productId, [FromQuery] Guid? sizeId, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetInventoryHistoryQuery(productId, sizeId, page, pageSize), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/devices")]
public sealed class AdminDevicesController : ApiControllerBase
{
    public sealed record BlockRequest(bool IsBlocked, string? Reason);

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] bool blockedOnly = false, [FromQuery] int? page = null, [FromQuery] int? pageSize = null, CancellationToken ct = default) =>
        Success(await Sender.Send(new GetDevicesQuery(blockedOnly, page, pageSize), ct));

    [HttpPatch("{id:guid}/block")]
    public async Task<IActionResult> Block(Guid id, [FromBody] BlockRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new BlockDeviceCommand(id, request.IsBlocked, request.Reason), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/notifications")]
public sealed class AdminNotificationsController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] bool unresolvedOnly = true, [FromQuery] int? page = null, [FromQuery] int? pageSize = null, CancellationToken ct = default) =>
        Success(await Sender.Send(new GetNotificationsQuery(unresolvedOnly, page, pageSize), ct));

    [HttpPatch("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, CancellationToken ct) =>
        Success(await Sender.Send(new ResolveNotificationCommand(id), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/analytics")]
public sealed class AdminAnalyticsController : ApiControllerBase
{
    /// <summary>Fake orders are excluded from all sales figures.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct) =>
        Success(await Sender.Send(new GetAnalyticsSummaryQuery(from, to), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/policies")]
public sealed class AdminPoliciesController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetPoliciesQuery(BypassCache: true), ct));

    [HttpPut("{key}")]
    public async Task<IActionResult> Update(string key, [FromBody] PolicyInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdatePolicyCommand(key, input), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/reviews")]
public sealed class AdminReviewsController : ApiControllerBase
{
    public sealed record ApproveRequest(bool IsApproved);

    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] bool? approvedOnly, CancellationToken ct) =>
        Success(await Sender.Send(new GetAdminReviewsQuery(page, pageSize, approvedOnly), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ReviewInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateReviewCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ReviewInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateReviewCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteReviewCommand(id), ct);
        return SuccessNoContent();
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRequest request, CancellationToken ct) =>
        Success(await Sender.Send(new ApproveReviewCommand(id, request.IsApproved), ct));
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/audit-logs")]
public sealed class AdminAuditLogsController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetAuditLogsQuery(page, pageSize), ct));
}
