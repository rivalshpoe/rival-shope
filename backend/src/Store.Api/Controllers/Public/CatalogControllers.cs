using Microsoft.AspNetCore.Mvc;
using Store.Application.Features.Brands;
using Store.Application.Features.Categories.Queries;
using Store.Application.Features.DeliveryZones;
using Store.Application.Features.Policies;
using Store.Application.Features.Products.Queries;
using Store.Application.Features.Reviews;

namespace Store.Api.Controllers.Public;

[Route("api/v1/categories")]
public sealed class CategoriesController : ApiControllerBase
{
    /// <summary>Active categories with product counts (cached 10 min).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetCategoriesQuery(IncludeInactive: false), ct));
}

[Route("api/v1/brands")]
public sealed class BrandsController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetBrandsQuery(), ct));
}

[Route("api/v1/products")]
public sealed class ProductsController : ApiControllerBase
{
    /// <summary>Paged product list. sort = newest | bestselling | priceAsc | priceDesc. pageSize is capped at 50.</summary>
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] Guid? categoryId, [FromQuery] Guid? subCategoryId, [FromQuery] string? categorySlug,
        [FromQuery] Guid? brandId, [FromQuery] string? brandSlug, [FromQuery] string? search, [FromQuery] string? sort,
        [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetProductsQuery(categoryId, subCategoryId, categorySlug, brandId, brandSlug, search, sort, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        Success(await Sender.Send(new GetProductByIdQuery(id), ct));
}

[Route("api/v1/search")]
public sealed class SearchController : ApiControllerBase
{
    /// <summary>Full-text-ish search (ILIKE + pg_trgm). q longer than 100 chars ⇒ 400 SEARCH_TOO_LONG. Rate limited per IP.</summary>
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new SearchProductsQuery(q, page, pageSize), ct));
}

[Route("api/v1/delivery-zones")]
public sealed class DeliveryZonesController : ApiControllerBase
{
    /// <summary>Active delivery zones only (cached 10 min).</summary>
    [HttpGet]
    public async Task<IActionResult> GetActive(CancellationToken ct) =>
        Success(await Sender.Send(new GetDeliveryZonesQuery(ActiveOnly: true), ct));
}

[Route("api/v1/policies")]
public sealed class PoliciesController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetPoliciesQuery(), ct));

    [HttpGet("{key}")]
    public async Task<IActionResult> GetByKey(string key, CancellationToken ct) =>
        Success(await Sender.Send(new GetPolicyByKeyQuery(key), ct));
}

[Route("api/v1/reviews")]
public sealed class ReviewsController : ApiControllerBase
{
    /// <summary>Approved reviews only, optionally filtered by product.</summary>
    [HttpGet]
    public async Task<IActionResult> GetApproved([FromQuery] Guid? productId, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Success(await Sender.Send(new GetPublicReviewsQuery(productId, page, pageSize), ct));
}
