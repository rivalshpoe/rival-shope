using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Store.Application.Common.Exceptions;
using Store.Application.Features.Brands;
using Store.Application.Features.Categories;
using Store.Application.Features.Categories.Commands;
using Store.Application.Features.Categories.Queries;
using Store.Application.Features.Products;
using Store.Application.Features.Products.Commands;
using Store.Application.Features.Products.Queries;
using Store.Application.Features.Uploads;

namespace Store.Api.Controllers.Admin;

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/categories")]
public sealed class AdminCategoriesController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetCategoriesQuery(IncludeInactive: true), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CategoryInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateCategoryCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CategoryInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateCategoryCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteCategoryCommand(id), ct);
        return SuccessNoContent();
    }
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/brands")]
public sealed class AdminBrandsController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Success(await Sender.Send(new GetBrandsQuery(BypassCache: true), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BrandInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateBrandCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BrandInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateBrandCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteBrandCommand(id), ct);
        return SuccessNoContent();
    }
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/products")]
public sealed class AdminProductsController : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? search,
        [FromQuery] Guid? categoryId, [FromQuery] bool? isActive, CancellationToken ct) =>
        Success(await Sender.Send(new GetAdminProductsQuery(page, pageSize, search, categoryId, isActive), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        Success(await Sender.Send(new GetAdminProductByIdQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductInput input, CancellationToken ct) =>
        Created(await Sender.Send(new CreateProductCommand(input), ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductInput input, CancellationToken ct) =>
        Success(await Sender.Send(new UpdateProductCommand(id, input), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Sender.Send(new DeleteProductCommand(id), ct);
        return SuccessNoContent();
    }
}

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/uploads")]
public sealed class AdminUploadsController : ApiControllerBase
{
    /// <summary>multipart/form-data field <c>file</c> (≤ 5MB, real image by magic bytes) → WebP url + 400px thumbnail.</summary>
    [HttpPost("images")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ValidationException("file", "يرجى اختيار صورة.");

        await using var stream = file.OpenReadStream();
        var result = await Sender.Send(new UploadImageCommand(stream, file.Length, file.FileName), ct);
        return Created(result);
    }
}
